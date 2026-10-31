import { type ReactNode, useEffect, useState } from 'react';
import { List } from 'lucide-react';

import { PlayerCard, type PlayerCardPlayer, formBand } from '../player/PlayerCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { SortableTableHead } from '../ui/sortable-table';
import type { AttackDirection } from '../../contracts';
import { fixtureDifficultyTitle } from '../../SquadPage';
import type { FixturePlayerFixture, FixtureSquad, FixtureSquadPlayer } from '../../league-api';
import { managerNicknameForTeam } from '../../manager-nicknames';
import { toPlayerCardFormHistory } from '../../player-form';
import './fixture-squad-comparison.css';

export interface FixtureSquadComparisonProps {
  attackDirection: AttackDirection;
  gameweekStatus: FixtureGameweekStatus;
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  playerInteraction?: FixturePlayerInteraction;
  selectedPlayerIds?: ReadonlySet<string>;
  pitchFixtureDisplay?: FixturePitchFixtureDisplay;
  squads: FixtureSquad[];
  view?: FixtureSquadView;
  onViewChange?: (view: FixtureSquadView) => void;
  showViewToggle?: boolean;
  sortableList?: boolean;
}

export type FixtureGameweekStatus = 'past' | 'current' | 'future';
export type FixturePlayerInteraction = 'points' | 'profile' | 'select';
