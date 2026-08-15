import type { ApiErrorResponse, GameweekSummary, TeamSummary } from './contracts';
import type { LeagueFixture, LeagueTableResponse } from './league-api';
import type { SquadApiPlayer, SquadWorkspace } from './squad-api';
import type { TeamSelectionChip, TeamSelectionPlayer, TeamSelectionSnapshot } from './team-selection-api';

export type ManagerDeskContext = 'pre_deadline' | 'live' | 'finalised';

export interface ManagerDeskSnapshot {
  context: ManagerDeskContext;
  gameweek: GameweekSummary;
  selection: TeamSelectionSnapshot;
  squad: SquadWorkspace;
  currentFixture: LeagueFixture | null;
  nextFixture: LeagueFixture | null;
  currentFixtures: LeagueFixture[];
  nextFixtures: LeagueFixture[];
  recentFixtures: LeagueFixture[];
  formFixtures: LeagueFixture[];
  leagueTable: LeagueTableResponse;
  availablePlayers: SquadApiPlayer[];
  drawDeadlineAt: string | null;
  interestCount: number;
}

export interface ManagerDeskClient {
  getDesk(): Promise<ManagerDeskSnapshot>;
}

interface ApiTeam {
  id: string;
  name: string;
  short_name?: string | null;
}

interface ApiGameweek {
  id: string;
  name: string;
  number: number;
  deadline_at?: string | null;
}

interface ApiSelectionPlayer extends ApiTeamSelectionPlayer {
  display_name: string;
  epl_team: ApiTeam;
}

interface ApiTeamSelectionPlayer {
  id: string;
  position: string;
  slot: 'starter' | 'bench' | 'reserve';
  slot_order: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

interface ApiTeamSelectionResponse {
  manager_team: ApiTeam;
  gameweek: ApiGameweek;
  lineup: ApiSelectionPlayer[];
  chips: Array<{ id: string; name: string; status: TeamSelectionChip['status'] }>;
  fixture_lock: {
    locked: boolean;
    fixture_id: string | null;
    fixture_type: string | null;
    lock_scope: string | null;
    locked_at: string | null;
    reason: string | null;
  };
}

interface ApiFixture {
  id: string;
  gameweek: ApiGameweek;
  home_team: ApiTeam;
  away_team: ApiTeam;
  status: LeagueFixture['status'];
  kickoff_label: string;
  round_label: string;
  is_current: boolean;
  is_next: boolean;
  detail_available: boolean;
  score: {
    home_score: number | null;
    away_score: number | null;
    bonus_points: Record<string, number>;
    chips_played: Record<string, string[]>;
    outcome: LeagueFixture['score']['outcome'];
  };
}

interface ApiLeagueTableResponse {
  source: string;
  rows: Array<{
    position: number;
    team: ApiTeam;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points_for: number;
    points_against: number;
    points_difference: number;
    league_points: number;
  }>;
}

interface ApiDeskResponse {
  context: ManagerDeskContext;
  gameweek: ApiGameweek;
  selection: ApiTeamSelectionResponse;
  squad: SquadWorkspace;
  current_fixture: ApiFixture | null;
  next_fixture: ApiFixture | null;
  current_fixtures: ApiFixture[];
  next_fixtures: ApiFixture[];
  recent_fixtures: ApiFixture[];
  form_fixtures?: ApiFixture[];
  league_table: ApiLeagueTableResponse;
  available_players: SquadApiPlayer[];
  draw_deadline_at?: string | null;
  interest_count?: number;
}

export class HttpManagerDeskClient implements ManagerDeskClient {
  constructor(private readonly baseUrl = '/api') {}

  async getDesk(): Promise<ManagerDeskSnapshot> {
    const response = await this.request<ApiDeskResponse>('/desk');
    return {
      context: response.context,
      gameweek: mapGameweek(response.gameweek),
      selection: mapSelection(response.selection),
      squad: response.squad,
      currentFixture: mapFixture(response.current_fixture),
      nextFixture: mapFixture(response.next_fixture),
      currentFixtures: response.current_fixtures.map(mapFixture).filter(isFixture),
      nextFixtures: response.next_fixtures.map(mapFixture).filter(isFixture),
      recentFixtures: response.recent_fixtures.map(mapFixture).filter(isFixture),
      formFixtures: (response.form_fixtures ?? response.recent_fixtures).map(mapFixture).filter(isFixture),
      leagueTable: {
        source: response.league_table.source,
        rows: response.league_table.rows.map((row) => ({
          position: row.position,
          team: mapTeam(row.team),
          played: row.played,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
          pointsFor: row.points_for,
          pointsAgainst: row.points_against,
          pointsDifference: row.points_difference,
          leaguePoints: row.league_points,
        })),
      },
      availablePlayers: response.available_players,
      drawDeadlineAt: response.draw_deadline_at ?? null,
      interestCount: response.interest_count ?? 0,
    };
  }

  private async request<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Manager desk request failed.', { cause: error });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload as Partial<ApiErrorResponse>;
      throw new Error(error.message ?? `Manager desk request failed with ${response.status}.`);
    }
    return payload as T;
  }
}

function mapSelection(response: ApiTeamSelectionResponse): TeamSelectionSnapshot {
  return {
    managerTeam: mapTeam(response.manager_team),
    gameweek: mapGameweek(response.gameweek),
    players: response.lineup.map((player): TeamSelectionPlayer => ({
      id: player.id,
      name: player.display_name,
      position: player.position,
      team: player.epl_team.short_name ?? player.epl_team.name,
      slot: player.slot,
      slotOrder: player.slot_order,
      captain: player.is_captain,
      viceCaptain: player.is_vice_captain,
    })),
    chips: response.chips,
    fixtureLock: {
      locked: response.fixture_lock.locked,
      fixtureId: response.fixture_lock.fixture_id,
      fixtureType: response.fixture_lock.fixture_type,
      lockScope: response.fixture_lock.lock_scope,
      lockedAt: response.fixture_lock.locked_at,
      reason: response.fixture_lock.reason,
    },
  };
}

function mapFixture(fixture: ApiFixture | null): LeagueFixture | null {
  if (!fixture) return null;
  return {
    id: fixture.id,
    gameweek: mapGameweek(fixture.gameweek),
    homeTeam: mapTeam(fixture.home_team),
    awayTeam: mapTeam(fixture.away_team),
    status: fixture.status,
    kickoffLabel: fixture.kickoff_label,
    roundLabel: fixture.round_label,
    isCurrent: fixture.is_current,
    isNext: fixture.is_next,
    detailAvailable: fixture.detail_available,
    score: {
      homeScore: fixture.score.home_score,
      awayScore: fixture.score.away_score,
      bonusPoints: fixture.score.bonus_points,
      chipsPlayed: fixture.score.chips_played,
      outcome: fixture.score.outcome,
    },
  };
}

function mapGameweek(gameweek: ApiGameweek): GameweekSummary {
  return {
    id: gameweek.id,
    name: gameweek.name,
    number: gameweek.number,
    deadlineAt: gameweek.deadline_at ?? null,
  };
}

function mapTeam(team: ApiTeam): TeamSummary {
  return { id: team.id, name: team.name, shortName: team.short_name ?? undefined };
}

function isFixture(fixture: LeagueFixture | null): fixture is LeagueFixture {
  return fixture !== null;
}

export const defaultManagerDeskClient: ManagerDeskClient = new HttpManagerDeskClient();
