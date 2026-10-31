import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { FixtureSquadComparison, sortFixtureListPlayers } from './FixtureSquadComparison';
import type { FixtureSquad, FixtureSquadPlayer } from '../../league-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const alphaTeam = { id: 'alpha', name: 'Alpha FC', shortName: 'ALP', managerName: 'Andrew' };
const betaTeam = { id: 'beta', name: 'Beta FC', shortName: 'BET', managerName: 'DJ' };
const arsenal = { id: 'ars', name: 'Arsenal', shortName: 'ARS' };
const chelsea = { id: 'che', name: 'Chelsea', shortName: 'CHE' };

function player(
  id: string,
  displayName: string,
  position: string,
  slot: 'starter' | 'bench' | 'reserve',
  points: number,
  kickoffAt = '2026-08-30T10:00:00Z',
): FixtureSquadPlayer {
  return {
    id,
    displayName,
    position,
    points,
    form: 6,
    slot,
