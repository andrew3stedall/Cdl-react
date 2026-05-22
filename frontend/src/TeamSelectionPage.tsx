import { useState } from 'react';
import { BadgeCheck, CircleAlert } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { ThemePreset } from './contracts';

interface TeamSelectionPageProps {
  preset: ThemePreset;
}

type Slot = 'starter' | 'bench' | 'reserve';
type ChipStatus = 'available' | 'active' | 'used';

interface PlayerRow {
  id: string;
  name: string;
  position: string;
  team: string;
  slot: Slot;
  captain?: boolean;
  viceCaptain?: boolean;
}

interface ChipRow {
  id: string;
  name: string;
  status: ChipStatus;
}

const initialPlayers: PlayerRow[] = [
  { id: 'player-1', name: 'Alex Keeper', position: 'GKP', team: 'ARS', slot: 'starter' },
  { id: 'player-2', name: 'Ben Defender', position: 'DEF', team: 'MCI', slot: 'starter' },
  { id: 'player-3', name: 'Casey Midfielder', position: 'MID', team: 'ARS', slot: 'starter', captain: true },
  { id: 'player-4', name: 'Riley Forward', position: 'FWD', team: 'MCI', slot: 'bench', viceCaptain: true },
  { id: 'player-5', name: 'Morgan Reserve', position: 'MID', team: 'ARS', slot: 'reserve' },
];

const initialChips: ChipRow[] = [
  { id: 'wildcard', name: 'Wildcard', status: 'available' },
  { id: 'bench-boost', name: 'Bench Boost', status: 'used' },
  { id: 'triple-captain', name: 'Triple Captain', status: 'available' },
];

export function TeamSelectionPage({ preset }: TeamSelectionPageProps) {
  const [players, setPlayers] = useState(initialPlayers);
  const [chips, setChips] = useState(initialChips);
  const [message, setMessage] = useState('Team selection loaded.');

  const starters = players.filter((player) => player.slot === 'starter');
  const bench = players.filter((player) => player.slot === 'bench');
  const reserves = players.filter((player) => player.slot === 'reserve');
  const activeChip = chips.find((chip) => chip.status === 'active');
  const valid = starters.length === 3 && bench.length === 1 && reserves.length === 1;

  const movePlayer = (playerId: string, slot: Slot) => {
    setPlayers((current) => current.map((player) => (player.id === playerId ? { ...player, slot } : player)));
    setMessage(`Player moved to ${slot}. Save lineup to validate server-side.`);
  };

  const toggleChip = (chipId: string) => {
    const chip = chips.find((candidate) => candidate.id === chipId);
    if (!chip) return;
    if (chip.status === 'used') {
      setMessage('Used chips cannot be activated. See /rules#chip-usage.');
      return;
    }
    if (chip.status !== 'active' && activeChip) {
      setMessage('Only one chip can be active at a time. See /rules#chip-usage.');
      return;
    }
    setChips((current) =>
      current.map((candidate) => {
        if (candidate.id !== chipId) return candidate;
        return { ...candidate, status: candidate.status === 'active' ? 'available' : 'active' };
      }),
    );
    setMessage(`${chip.name} chip state updated.`);
  };

  const saveLineup = () => {
    if (!valid) {
      setMessage('Invalid lineup. Review /rules#lineup-validation.');
      return;
    }
    setMessage('Lineup saved and validated.');
  };

  return (
    <main className="feature-screen team-selection-page" data-density={preset.tokens.density} aria-labelledby="team-selection-title">
      <header>
        <p className="eyebrow">Team Selection</p>
        <h1 id="team-selection-title">Lineup, chips, bench, and reserves</h1>
        <p>Manage starters, bench, reserves, and chip state for the current gameweek.</p>
      </header>

      <p role="status" className="team-selection-status">
        {valid ? <BadgeCheck aria-hidden="true" size={16} /> : <CircleAlert aria-hidden="true" size={16} />}
        {message}
      </p>

      <section aria-label="Chip selector" className="team-selection-grid">
        {chips.map((chip) => (
          <Card className="team-selection-card" key={chip.id}>
            <h2>{chip.name}</h2>
            <p className={`chip-status ${chip.status}`}>{chip.status}</p>
            <Button onClick={() => toggleChip(chip.id)} type="button" variant={chip.status === 'active' ? 'secondary' : 'ghost'}>
              {chip.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
            <a href="/rules#chip-usage">Chip rules</a>
          </Card>
        ))}
      </section>

      <section aria-label="Team pitch" className="team-selection-layout">
        <Card className="team-selection-card pitch-panel">
          <h2>Starters</h2>
          <PlayerTable players={starters} onMove={movePlayer} />
          <Button onClick={saveLineup} type="button">Save lineup</Button>
        </Card>
        <Card className="team-selection-card">
          <h2>Bench</h2>
          <PlayerTable players={bench} onMove={movePlayer} />
          <h2>Reserves</h2>
          <PlayerTable players={reserves} onMove={movePlayer} />
        </Card>
      </section>

      <section aria-label="Fixture and table summaries" className="team-selection-grid">
        <Card className="team-selection-card">
          <h2>CDL Fixture</h2>
          <p>Castle FC vs Rival Town</p>
          <p>CDL table: Castle FC, Rival Town</p>
        </Card>
        <Card className="team-selection-card">
          <h2>EPL Fixture</h2>
          <p>Arsenal vs Manchester City</p>
          <p>EPL table: Arsenal, Manchester City</p>
        </Card>
      </section>
    </main>
  );
}

interface PlayerTableProps {
  players: PlayerRow[];
  onMove: (playerId: string, slot: Slot) => void;
}

function PlayerTable({ players, onMove }: PlayerTableProps) {
  return (
    <div className="team-selection-table" role="table">
      <div className="team-selection-row team-selection-head" role="row">
        <span role="columnheader">Player</span>
        <span role="columnheader">Pos</span>
        <span role="columnheader">Team</span>
        <span role="columnheader">Move</span>
      </div>
      {players.map((player) => (
        <div className="team-selection-row" key={player.id} role="row">
          <span role="cell">
            {player.name}
            {player.captain ? ' (C)' : ''}
            {player.viceCaptain ? ' (VC)' : ''}
          </span>
          <span role="cell">{player.position}</span>
          <span role="cell">{player.team}</span>
          <span role="cell">
            <select aria-label={`Move ${player.name}`} onChange={(event) => onMove(player.id, event.target.value as Slot)} value={player.slot}>
              <option value="starter">Starter</option>
              <option value="bench">Bench</option>
              <option value="reserve">Reserve</option>
            </select>
          </span>
        </div>
      ))}
    </div>
  );
}
