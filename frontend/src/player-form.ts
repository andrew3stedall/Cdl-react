import type { PlayerCardFormGameweek } from './components/player/PlayerCard';
import type { SquadApiFormGameweek } from './squad-api';

export function toPlayerCardFormHistory(
  history: readonly SquadApiFormGameweek[] | null | undefined,
): PlayerCardFormGameweek[] {
  return (history ?? []).map((gameweek) => ({
    gameweek: gameweek.gameweek,
    fixtures: gameweek.fixtures.map((fixture) => ({
      fixtureId: fixture.fixture_id,
      minutes: fixture.minutes,
      points: fixture.total_points,
    })),
  }));
}

export function formHistoryFromRows(
  rows: readonly { fixture_id?: string | number; gameweek: number; total_points: number; minutes: number }[],
): SquadApiFormGameweek[] {
  const grouped = new Map<number, SquadApiFormGameweek>();
  rows.forEach((row) => {
    const gameweek = grouped.get(row.gameweek) ?? { gameweek: row.gameweek, fixtures: [] };
    gameweek.fixtures.push({
      fixture_id: String(row.fixture_id ?? `${row.gameweek}-${gameweek.fixtures.length}`),
      minutes: row.minutes,
      total_points: row.total_points,
    });
    grouped.set(row.gameweek, gameweek);
  });
  return [...grouped.values()].sort((left, right) => left.gameweek - right.gameweek);
}
