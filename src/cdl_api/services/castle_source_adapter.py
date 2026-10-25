"""Lossless Castle source binding and conservative native projections.

JSON payloads intentionally retain unknown fields; this is an import boundary.
"""

# ruff: noqa: ANN401
import hashlib
import json
from collections import Counter
from difflib import SequenceMatcher
from datetime import UTC, datetime
from typing import Any

from cdl_api.contracts.castle_sync import CastleSyncConfig

SOURCE = "castle:uqaigbmofxhufamxylot"


def canonical(value: Any) -> str:
    def encode(item: Any) -> str:
        if isinstance(item, datetime):
            return item.replace(tzinfo=item.tzinfo or UTC).astimezone(UTC).isoformat()
        raise TypeError("Unsupported sync value")

    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=encode)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def sync_id(*parts: str) -> str:
    return "castle-" + digest(parts)[:56]


def timestamp(value: Any) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Source timestamp missing")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=parsed.tzinfo or UTC).astimezone(UTC)


def normalized(value: str) -> str:
    return " ".join(value.casefold().split())


def team_similarity(left: str, right: str) -> float:
    left_normalized, right_normalized = normalized(left), normalized(right)
    token_sorted = SequenceMatcher(
        None,
        " ".join(sorted(left_normalized.split())),
        " ".join(sorted(right_normalized.split())),
    ).ratio()
    compact = SequenceMatcher(
        None, left_normalized.replace(" ", ""), right_normalized.replace(" ", "")
    ).ratio()
    return max(token_sorted, compact)


class CastleSourceAdapter:
    """Map existing identities without creating users, permissions or FPL rows."""

    def __init__(
        self, bundle: dict[str, Any], config: CastleSyncConfig, catalog: dict[str, list[dict]]
    ) -> None:
        self.config, self.catalog = config, catalog
        manifest = bundle.get("manifest", {})
        if manifest.get("format") != "castle-data-export-v1":
            raise ValueError("Unsupported source export")
        if any(not f.get("file", "").startswith("fpl/") for f in manifest.get("failures", [])):
            raise ValueError("Incomplete non-FPL export")
        all_files = bundle["files"]
        scopes = sorted({p.split("/")[1] for p in all_files if p.startswith("leagues/")})
        selected = config.source_league_id or (scopes[0] if len(scopes) == 1 else "")
        if selected not in scopes:
            raise ValueError("Select exactly one available source league")
        self.source_league_id = selected
        if not any(
            m.get("league_id") == selected for m in all_files.get("self/memberships.json", [])
        ):
            raise ValueError("Selected source league is outside exported membership")
        self.root = f"leagues/{selected}/"
        self.files = {
            p: value
            for p, value in all_files.items()
            if p.startswith(self.root) or p.startswith("global/") or p == "self/memberships.json"
        }
        # Required tables are checked against the exporter count manifest, including empty reads.
        counts = {c["file"]: c["rows"] for c in manifest.get("collections", [])}
        required = [
            "leagues",
            "league_members",
            "profiles",
            "castle_teams",
            "draft_picks",
            "lineups",
            "castle_fixtures",
            "trades",
            "draws",
            "draw_results",
        ]
        for name in required:
            path = f"{self.root}{name}.json"
            if path not in self.files or counts.get(path) != len(self.files[path]):
                raise ValueError("Missing or truncated required source collection")
        self.gaps: Counter[str] = Counter()
        self.archive_only: Counter[str] = Counter()
        self.already_represented: Counter[str] = Counter()
        self.team_match_review: list[dict[str, Any]] = []
        self.team_fuzzy_matches: list[dict[str, Any]] = []
        self.fixture_team_review: list[dict[str, Any]] = []
        self.fixture_evidence_review: list[dict[str, Any]] = []
        self.mappings: dict[str, str] = {}
        self.projections: list[dict[str, Any]] = []
        self.teams: dict[str, dict] = {}
        self.managers: dict[str, dict] = {}
        self.players: dict[int, str] = {}
        if len(self.rows("leagues")) != 1 or self.rows("leagues")[0].get("id") != selected:
            raise ValueError("Source league binding is inconsistent")
        self.league = self.rows("leagues")[0]
        if not isinstance(self.league.get("season_number"), int):
            raise ValueError("Source season number is required")
        self.scope = f"{SOURCE}:{selected}:{self.league.get('season_number')}"
        self._bind()

    def rows(self, name: str) -> list[dict[str, Any]]:
        return self.files.get(f"{self.root}{name}.json", [])

    def target_rows(self, name: str) -> list[dict[str, Any]]:
        return self.catalog.get(name, [])

    def _bind(self) -> None:
        cfg = self.config
        season = next(
            (s for s in self.target_rows("seasons") if s["id"] == cfg.target_season_id), None
        )
        if not season or season["league_id"] != cfg.target_league_id:
            raise ValueError("Target season does not belong to target league")
        if season["name"] != self.league.get("season_label"):
            raise ValueError("Source and target season labels differ")
        self.mappings["league"] = cfg.target_league_id
        self.mappings["season"] = cfg.target_season_id
        target_teams = [
            t for t in self.target_rows("draft_teams") if t["league_id"] == cfg.target_league_id
        ]
        manager_by_id = {m["id"]: m for m in self.target_rows("managers")}
        used: set[str] = set()
        for team in self.rows("castle_teams"):
            alias = cfg.team_aliases.get(team["name"])
            matches = [
                t
                for t in target_teams
                if (
                    t["id"] == alias
                    if alias
                    else normalized(t["name"]) == normalized(team["name"])
                )
            ]
            ranked = sorted(
                (
                    (team_similarity(team["name"], candidate["name"]), candidate)
                    for candidate in target_teams
                ),
                key=lambda item: (-item[0], item[1]["id"]),
            )
            available = [(score, candidate) for score, candidate in ranked if candidate["id"] not in used]
            if not matches and not alias and available:
                best_score, best_target = available[0]
                second_score = available[1][0] if len(available) > 1 else 0.0
                if best_score >= 0.82 and best_score - second_score >= 0.15:
                    matches = [best_target]
                    self.team_fuzzy_matches.append(
                        {
                            "source_team_id": team["id"],
                            "source_team_name": team["name"],
                            "target_team_id": best_target["id"],
                            "target_team_name": best_target["name"],
                            "similarity": round(best_score, 3),
                        }
                    )
            if len(matches) != 1 or matches[0]["id"] in used:
                self.gaps["unmapped_or_ambiguous_team"] += 1
                self.team_match_review.append(
                    {
                        "source_team_id": team["id"],
                        "source_team_name": team["name"],
                        "reason": "duplicate_target_match" if matches else "no_confident_match",
                        "target_candidates": [
                            {
                                "target_team_id": candidate["id"],
                                "target_team_name": candidate["name"],
                                "similarity": round(score, 3),
                                "already_mapped": candidate["id"] in used,
                            }
                            for score, candidate in ranked[:3]
                        ],
                    }
                )
                continue
            target = matches[0]
            used.add(target["id"])
            self.teams[team["id"]] = target
            self.mappings[f"team:{team['id']}"] = target["id"]
            owner = team.get("owner_user_id")
            if owner and target.get("manager_id") in manager_by_id:
                if owner in self.managers:
                    raise ValueError("Source manager maps to more than one target team")
                self.managers[owner] = target
                self.mappings[f"manager:{owner}"] = target["manager_id"]
        players = {p["id"]: p for p in self.target_rows("fpl_players")}
        cache = next(
            (
                c["payload_json"]
                for c in self.target_rows("external_payload_cache")
                if c["resource"] == "bootstrap-static"
            ),
            {},
        )
        by_code = {
            p.get("code"): f"fpl-{p['id']}" for p in cache.get("elements", []) if p.get("code")
        }
        candidates = self.rows("draft_picks") + self.rows("draw_results")
        candidates += [
            p
            for trade in self.rows("trades")
            for key in ("proposer_players", "receiver_players")
            for p in trade.get(key, [])
        ]
        for row in self.rows("draws"):
            if row.get("status") == "completed":
                candidates += [
                    p for entries in (row.get("interests_snapshot") or {}).values() for p in entries
                ]
        positions = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}
        for row in candidates:
            pid = row["fpl_player_id"]
            explicit = cfg.player_ids.get(str(pid))
            code = row.get("fpl_player_code")
            target_id = explicit or (by_code.get(code) if code else f"fpl-{pid}")
            target = players.get(target_id)
            valid = target and (
                explicit
                or code
                or (
                    normalized(target["web_name"]) == normalized(row.get("player_web_name", ""))
                    and target["position_id"] == positions.get(row.get("element_type"))
                )
            )
            if valid:
                if pid in self.players and self.players[pid] != target_id:
                    raise ValueError("Conflicting source player identities")
                self.players[pid] = target_id
                self.mappings[f"player:{pid}"] = target_id
        self.gaps["source_trade_visibility_is_partial"] = 1
        if any(
            not d.get("interests_snapshot")
            for d in self.rows("draws")
            if d["status"] == "completed"
        ):
            self.gaps["historical_draw_snapshot_missing"] += 1
        self.gaps["multi_award_draw_history_archived_not_projected"] = len(
            self.rows("draw_results")
        )
        for name in [
            "notifications",
            "predictions",
            "top8_votes",
            "player_interests",
            "gw_deadlines",
            "gw_reports",
            "roster_moves",
            "season_archives",
        ]:
            if self.rows(name):
                self.gaps[f"{name}_preserved_in_source_archive"] = len(self.rows(name))

    def project(self, table: str, row_id: str, values: dict[str, Any]) -> None:
        self.projections.append({"table": table, "id": row_id, "values": values})

    def build_projections(self) -> None:
        self._ownerships()
        self._lineups()
        self._fixtures()
        self._trades()

    def _ownerships(self) -> None:
        active = [
            r
            for r in self.target_rows("squad_ownerships")
            if r["season_id"] == self.config.target_season_id and r["ended_at"] is None
        ]
        for pick in self.rows("draft_picks"):
            team, player = (
                self.managers.get(pick["user_id"]),
                self.players.get(pick["fpl_player_id"]),
            )
            if not team or not player:
                self.gaps["ownership_identity_unresolved"] += 1
                continue
            matches = [o for o in active if o["player_id"] == player]
            if len(matches) == 1 and matches[0]["draft_team_id"] == team["id"]:
                self.mappings[f"ownership:{pick['id']}"] = matches[0]["id"]
            else:
                # Snapshot ownership cannot establish the actual transfer/release timeline.
                self.gaps["ownership_requires_timeline_reconciliation"] += 1

    def _lineups(self) -> None:
        for row in self.rows("lineups"):
            team = self.managers.get(row["user_id"])
            starters, bench = row.get("starter_ids") or [], row.get("bench_ids") or []
            if (
                not team
                or len(starters) != 11
                or len(set(starters + bench)) != len(starters + bench)
                or any(p not in self.players for p in starters + bench)
            ):
                self.gaps["lineup_invalid_or_identity_unresolved"] += 1
                continue
            gw = row["gameweek"]
            explicit_players = {self.players[p] for p in starters + bench}
            existing_slots = [
                s
                for s in self.target_rows("team_selection_lineup_slots")
                if s["season_id"] == self.config.target_season_id
                and s["draft_team_id"] == team["id"]
                and s["gameweek"] == gw
            ]
            if (
                len({s["player_id"] for s in existing_slots}) != len(existing_slots)
                or any(
                    s["player_id"] not in explicit_players and s["slot"] != "reserve"
                    for s in existing_slots
                )
                or row.get("captain_id") not in starters
                or row.get("vice_captain_id") not in starters
            ):
                self.gaps["lineup_stale_slots_or_armbands_require_review"] += 1
                continue
            try:
                updated = timestamp(row["updated_at"])
                locked = timestamp(row["locked_at"]) if row.get("locked_at") else None
            except ValueError:
                self.gaps["lineup_timestamp_missing"] += 1
                continue
            for slot, ids in [("starter", starters), ("bench", bench)]:
                for order, pid in enumerate(ids, 1):
                    player = self.players[pid]
                    existing = next((s for s in existing_slots if s["player_id"] == player), None)
                    lineup_id = (
                        existing["id"]
                        if existing
                        else sync_id(self.scope, "lineup", row["id"], player)
                    )
                    self.mappings[f"lineup:{row['id']}:{player}"] = lineup_id
                    self.project(
                        "team_selection_lineup_slots",
                        lineup_id,
                        {
                            "season_id": self.config.target_season_id,
                            "draft_team_id": team["id"],
                            "player_id": player,
                            "gameweek": gw,
                            "slot": slot,
                            "slot_order": order,
                            "is_captain": pid == row.get("captain_id"),
                            "is_vice_captain": pid == row.get("vice_captain_id"),
                            "locked_at": locked,
                            "updated_at": updated,
                        },
                    )
            if row.get("chips"):
                self.gaps["chips_require_season_usage_reconciliation"] += len(row["chips"])

    def _fixtures(self) -> None:
        events = {int(e["id"]): e for e in self.target_rows("fpl_gameweeks")}
        source_team_names = {team["id"]: team["name"] for team in self.rows("castle_teams")}
        for row in self.rows("castle_fixtures"):
            home, away = (
                self.teams.get(row.get("home_team_id")),
                self.teams.get(row.get("away_team_id")),
            )
            if not home or not away:
                if (
                    row.get("stage") in {"semi", "final", "consolation"}
                    and row.get("home_team_id") is None
                    and row.get("away_team_id") is None
                ):
                    self.archive_only["playoff_fixture_waiting_for_participants"] += 1
                else:
                    self.gaps["fixture_unassigned_or_unmapped_team"] += 1
                    self.fixture_team_review.append(
                        {
                            "source_fixture_id": row.get("id"),
                            "gameweek": row.get("gameweek"),
                            "stage": row.get("stage"),
                            "home_source_team_id": row.get("home_team_id"),
                            "home_source_team_name": source_team_names.get(
                                row.get("home_team_id")
                            ),
                            "home_target_team_id": home["id"] if home else None,
                            "away_source_team_id": row.get("away_team_id"),
                            "away_source_team_name": source_team_names.get(
                                row.get("away_team_id")
                            ),
                            "away_target_team_id": away["id"] if away else None,
                        }
                    )
                continue
            gw = row["gameweek"]
            if gw not in events:
                self.gaps["fixture_gameweek_context_missing"] += 1
                continue
            candidates = [
                f
                for f in self.target_rows("cdl_fixtures")
                if f["payload_json"].get("gameweek", {}).get("number") == gw
                and f["payload_json"].get("home_team", {}).get("id") == home["id"]
                and f["payload_json"].get("away_team", {}).get("id") == away["id"]
            ]
            if len(candidates) > 1:
                self.gaps["fixture_identity_ambiguous"] += 1
                continue
            fid = candidates[0]["id"] if candidates else sync_id(self.scope, "fixture", row["id"])
            existing_results = [
                r
                for r in self.target_rows("fixture_results")
                if r["payload_json"].get("fixture_id") == fid
            ]
            snapshots = [
                s
                for s in self.target_rows("fixture_scoring_snapshots")
                if s["payload_json"].get("fixture_id") == fid
            ]
            source_unscored = row.get("home_score") is None and row.get("away_score") is None
            target_has_only_empty_synthetic_evidence = (
                existing_results
                and all(
                    result.get("payload_json", {}).get("synthetic") is True
                    and result.get("payload_json", {}).get("home_score") is None
                    and result.get("payload_json", {}).get("away_score") is None
                    for result in existing_results
                )
                and snapshots
                and all(snapshot.get("payload_json", {}).get("synthetic") is True for snapshot in snapshots)
            )
            if source_unscored and target_has_only_empty_synthetic_evidence:
                self.already_represented["unscored_fixture_matches_staging_seed"] += 1
                self.mappings[f"fixture:{row['id']}"] = fid
                continue
            evidence_reasons = []
            if len(existing_results) > 1:
                evidence_reasons.append("multiple_target_results")
            if snapshots:
                evidence_reasons.append("target_scoring_snapshots")
            if any(r["payload_json"].get("finalised") for r in existing_results):
                evidence_reasons.append("finalised_target_result")
            if evidence_reasons:
                self.gaps["fixture_has_existing_scoring_evidence"] += 1
                target_fixture = candidates[0] if candidates else None
                self.fixture_evidence_review.append(
                    {
                        "source_fixture_id": row.get("id"),
                        "gameweek": gw,
                        "stage": row.get("stage"),
                        "source_home_team": source_team_names.get(row.get("home_team_id")),
                        "source_away_team": source_team_names.get(row.get("away_team_id")),
                        "source_home_score": row.get("home_score"),
                        "source_away_score": row.get("away_score"),
                        "target_fixture_id": target_fixture.get("id") if target_fixture else fid,
                        "target_status": (
                            target_fixture.get("payload_json", {}).get("status")
                            if target_fixture
                            else None
                        ),
                        "target_results": [
                            {
                                "id": result.get("id"),
                                "home_score": result.get("payload_json", {}).get("home_score"),
                                "away_score": result.get("payload_json", {}).get("away_score"),
                                "finalised": result.get("payload_json", {}).get("finalised"),
                                "synthetic": result.get("payload_json", {}).get("synthetic"),
                            }
                            for result in existing_results
                        ],
                        "target_scoring_snapshot_count": len(snapshots),
                        "target_scoring_snapshots_synthetic": [
                            snapshot.get("payload_json", {}).get("synthetic")
                            for snapshot in snapshots
                        ],
                        "reasons": evidence_reasons,
                    }
                )
                continue
            self.mappings[f"fixture:{row['id']}"] = fid
            scored = row.get("home_score") is not None and row.get("away_score") is not None
            finished = bool(events.get(gw, {}).get("finished"))
            status = (
                "complete"
                if scored and finished
                else "started"
                if events.get(gw, {}).get("is_current")
                else "pending"
            )

            def summary(team: dict) -> dict:
                return {"id": team["id"], "name": team["name"]}

            payload = {
                "id": fid,
                "gameweek": {"id": f"gw-{gw}", "name": f"Gameweek {gw}", "number": gw},
                "home_team": summary(home),
                "away_team": summary(away),
                "status": status,
                "round_label": {
                    "regular": "Regular season",
                    "semi": "Semi Final",
                    "final": "Final",
                    "consolation": "Consolation",
                }.get(row["stage"], row["stage"]),
                "kickoff_label": f"Gameweek {gw}",
                "is_current": bool(events.get(gw, {}).get("is_current")),
                "is_next": bool(events.get(gw, {}).get("is_next")),
                "detail_available": False,
                "synthetic": False,
                "castle_source_record_id": row["id"],
                "season_id": self.config.target_season_id,
            }
            self.project("cdl_fixtures", fid, {"payload_json": payload})
            if scored:
                outcome = (
                    "pending"
                    if status != "complete"
                    else "home_win"
                    if row["home_score"] > row["away_score"]
                    else "away_win"
                    if row["away_score"] > row["home_score"]
                    else "draw"
                )
                result_id = (
                    existing_results[0]["id"]
                    if existing_results
                    else sync_id(self.scope, "result", row["id"])
                )
                self.project(
                    "fixture_results",
                    result_id,
                    {
                        "payload_json": {
                            "fixture_id": fid,
                            "home_score": row["home_score"],
                            "away_score": row["away_score"],
                            "outcome": outcome,
                            "synthetic": False,
                        }
                    },
                )

    def _trades(self) -> None:
        statuses = {
            "approved": ("accepted", "approved"),
            "rejected": ("rejected", "not_submitted"),
            "commissioner_rejected": ("accepted", "rejected"),
            "cancelled": ("cancelled", "not_submitted"),
            "expired": ("cancelled", "not_submitted"),
        }
        for row in self.rows("trades"):
            proposer, receiver = (
                self.managers.get(row["proposer_id"]),
                self.managers.get(row["receiver_id"]),
            )
            gw = self.config.trade_gameweeks.get(row["id"], row.get("executed_gw"))
            players = [
                p for key in ("proposer_players", "receiver_players") for p in row.get(key, [])
            ]
            if (
                row.get("is_loan")
                or not proposer
                or not receiver
                or not isinstance(gw, int)
                or gw < 1
                or row["status"] not in statuses
                or any(p["fpl_player_id"] not in self.players for p in players)
            ):
                self.gaps["trade_requires_gameweek_identity_or_loan_mapping"] += 1
                continue
            tid = sync_id(self.scope, "trade", row["id"])
            if any(
                t["id"] != tid
                and t["season_id"] == self.config.target_season_id
                and t["gameweek"] == gw
                and {t["offered_by_team_id"], t["offered_to_team_id"]}
                == {proposer["id"], receiver["id"]}
                for t in self.target_rows("trade_proposals")
            ):
                self.gaps["trade_existing_native_identity_requires_review"] += 1
                continue
            desired_assets = {
                sync_id(tid, key, self.players[p["fpl_player_id"]])
                for key in ("proposer_players", "receiver_players")
                for p in row.get(key, [])
            }
            if any(
                a["trade_id"] == tid and a["id"] not in desired_assets
                for a in self.target_rows("trade_assets")
            ):
                self.gaps["trade_changed_asset_set_requires_review"] += 1
                continue
            status, approval = statuses[row["status"]]
            self.project(
                "trade_proposals",
                tid,
                {
                    "season_id": self.config.target_season_id,
                    "offered_by_team_id": proposer["id"],
                    "offered_to_team_id": receiver["id"],
                    "gameweek": gw,
                    "status": status,
                    "approval_status": approval,
                    "required_approver_role": "commissioner"
                    if approval != "not_submitted"
                    else None,
                    "approved_by_manager_id": None,
                    "executed_at": None,
                    "created_at": timestamp(row["created_at"]),
                    "updated_at": timestamp(row["updated_at"]),
                },
            )
            for key, origin, dest in [
                ("proposer_players", proposer, receiver),
                ("receiver_players", receiver, proposer),
            ]:
                for player in row.get(key, []):
                    pid = self.players[player["fpl_player_id"]]
                    self.project(
                        "trade_assets",
                        sync_id(tid, key, pid),
                        {
                            "trade_id": tid,
                            "player_id": pid,
                            "from_team_id": origin["id"],
                            "to_team_id": dest["id"],
                        },
                    )
            if row.get("rejection_reason") and len(row["rejection_reason"]) <= 512:
                self.project(
                    "squad_rejection_reasons",
                    sync_id(tid, "reason"),
                    {
                        "subject_type": "trade",
                        "subject_id": tid,
                        "code": row["status"],
                        "message": row["rejection_reason"],
                        "created_at": timestamp(row["updated_at"]),
                    },
                )
            self.mappings[f"trade:{row['id']}"] = tid
