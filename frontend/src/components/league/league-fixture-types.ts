import type { LeagueFixture } from '../../league-api';

export type GameweekState = 'not-started' | 'underway' | 'finished';

export interface GameweekGroup {
  gameweek: LeagueFixture['gameweek'];
  fixtures: LeagueFixture[];
  id: string;
  isCurrent: boolean;
  isNext: boolean;
  state: GameweekState;
}

export interface FixtureRoundGroup {
  gameweeks: GameweekGroup[];
  expectedGameweeks: number;
  isCurrent: boolean;
  key: string;
  label: string;
  subLabel: string;
}
