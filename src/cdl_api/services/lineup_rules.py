"""Shared league rules for Starting XI composition."""

from collections import Counter

STARTER_LIMITS: dict[str, tuple[int, int]] = {
    "GKP": (1, 1),
    "DEF": (3, 5),
    "MID": (2, 5),
    "FWD": (1, 3),
}


def is_valid_formation(positions: list[str] | tuple[str, ...]) -> bool:
    """Return true for an XI allowed by the authoritative league ranges."""
    if len(positions) != 11:
        return False
    normalized = [normalize_position(position) for position in positions]
    if any(position not in STARTER_LIMITS for position in normalized):
        return False
    counts = Counter(normalized)
    return all(
        minimum <= counts[position] <= maximum
        for position, (minimum, maximum) in STARTER_LIMITS.items()
    )


def valid_formation_names() -> set[str]:
    """Enumerate all eleven-player formations allowed by the range contract."""
    return {
        f"{defenders}-{midfielders}-{forwards}"
        for defenders in range(*_inclusive(STARTER_LIMITS["DEF"]))
        for midfielders in range(*_inclusive(STARTER_LIMITS["MID"]))
        for forwards in range(*_inclusive(STARTER_LIMITS["FWD"]))
        if 1 + defenders + midfielders + forwards == 11
    }


def normalize_position(position: str) -> str:
    normalized = position.strip().upper()
    return {
        "GK": "GKP",
        "GOALKEEPER": "GKP",
        "DEFENDER": "DEF",
        "MIDFIELDER": "MID",
        "FORWARD": "FWD",
        "STRIKER": "FWD",
    }.get(normalized, normalized)


def _inclusive(bounds: tuple[int, int]) -> tuple[int, int]:
    return bounds[0], bounds[1] + 1
