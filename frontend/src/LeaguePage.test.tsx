import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test } from 'vitest';

import { LeaguePage } from './LeaguePage';
import { shouldShowFixturePoints, sortFixtureBench } from './components/fixture/FixtureSquadComparison';
import type { FixtureDetailResponse, FixtureSquad, LeagueClient, LeagueSnapshot } from './league-api';
import type { SquadApiHistoryResponse } from './squad-api';
import type { SessionState } from './contracts';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const castle = { id: 'castle', name: 'Castle United', shortName: 'CAS', managerName: 'Andrew' };
const drafton = { id: 'drafton', name: 'Drafton Rovers', shortName: 'DRA', managerName: 'DJ' };
const keepers = { id: 'keepers', name: 'Keeper City', shortName: 'KPR', managerName: 'Warren' };
const wildcards = { id: 'wildcards', name: 'Wildcard Athletic', shortName: 'WCA', managerName: 'Kev' };
const pastGameweek = { id: 'gw-11', name: 'Gameweek 11', number: 11, deadlineAt: '2026-08-07T17:30:00Z' };
const gameweek = { id: 'gw-12', name: 'Gameweek 12', number: 12, deadlineAt: '2026-08-14T17:30:00Z' };
const fixture = {
  id: 'fixture-1201',
  gameweek,
  homeTeam: castle,
  awayTeam: drafton,
  status: 'started' as const,
  kickoffLabel: 'GW12 live',
  roundLabel: 'Regular season',
  isCurrent: true,
  isNext: false,
  detailAvailable: true,
  score: {
    homeScore: 58,
    awayScore: 52,
    bonusPoints: { castle: 3 },
    chipsPlayed: { castle: ['Triple Captain'] },
    outcome: 'home_win' as const,
  },
};

const finishedFixture = {
  ...fixture,
  id: 'fixture-1202',
  homeTeam: drafton,
  awayTeam: castle,
  status: 'complete' as const,
  score: { homeScore: 48, awayScore: 43, bonusPoints: {}, chipsPlayed: {}, outcome: 'home_win' as const },
};

const pastFixture = {
  ...fixture,
  id: 'fixture-1101',
  gameweek: pastGameweek,
  status: 'complete' as const,
  isCurrent: false,
  score: { homeScore: 42, awayScore: 39, bonusPoints: {}, chipsPlayed: {}, outcome: 'home_win' as const },
};

const nextFixture = {
  ...fixture,
  id: 'fixture-1301',
