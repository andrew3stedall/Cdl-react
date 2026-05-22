import { useEffect, useState } from 'react';
import { Search, Star } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { ThemePreset } from './contracts';

interface SquadManagementPageProps {
  preset: ThemePreset;
}

interface PlayerView {
  id: string;
  displayName: string;
  position: string;
  team: string;
  status: 'owned' | 'available' | 'interested' | 'trade_target';
  points: number;
  value: number;
}

const players: PlayerView[] = [
  { id: 'player-1', displayName: 'Alex Keeper', position: 'GKP', team: 'ARS', status: 'owned', points: 42, value: 5 },
  { id: 'player-2', displayName: 'Ben Defender', position: 'DEF', team: 'MCI', status: 'owned', points: 55, value: 6 },
  { id: 'player-3', displayName: 'Casey Midfielder', position: 'MID', team: 'ARS', status: 'available', points: 61, value: 7.5 },
  { id: 'player-4', displayName: 'Dev Forward', position: 'FWD', team: 'MCI', status: 'trade_target', points: 70, value: 9 },
];

export function SquadManagementPage({ preset }: SquadManagementPageProps) {
  const [query, setQuery] = useState('');
  const [interestIds, setInterestIds] = useState<string[]>([]);
  const [tradeCreated, setTradeCreated] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState('Loading squad data.');

  useEffect(() => {
    setStatus('Squad data loaded.');
  }, []);

  const squadPlayers = players.filter((player) => player.status === 'owned');
  const scoutingPlayers = players.filter((player) => player.displayName.toLowerCase().includes(query.toLowerCase()));
  const squadValue = squadPlayers.reduce((total, player) => total + player.value, 0);

  return (
    <main aria-labelledby="squad-management-title" className="feature-screen" data-density={preset.tokens.density}>
      <header>
        <p className="eyebrow">Squad Management</p>
        <h1 id="squad-management-title">Squad, scouting, interests, and transfers</h1>
        <p>Authenticated squad overview, player scouting, interests, proposed trades, and shared player detail.</p>
      </header>

      <p role="status">{status}</p>

      <section aria-label="Squad summary" className="squad-summary-grid">
        <Card>
          <h2>Total players</h2>
          <strong>{squadPlayers.length}</strong>
        </Card>
        <Card>
          <h2>Squad value</h2>
          <strong>£{squadValue.toFixed(1)}m</strong>
        </Card>
        <Card>
          <h2>Gameweek</h2>
          <strong>Gameweek 1</strong>
        </Card>
      </section>

      <section aria-label="Scouting filters" className="squad-filter-bar">
        <label>
          <Search aria-hidden="true" size={16} />
          Search players
          <input
            aria-label="Search players"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players"
            value={query}
          />
        </label>
      </section>

      <section aria-label="Current squad">
        <h2>Current squad</h2>
        <div role="table" className="squad-data-table" aria-label="Current squad players">
          <div role="row" className="squad-table-row squad-table-head">
            <span role="columnheader">Player</span>
            <span role="columnheader">Pos</span>
            <span role="columnheader">Team</span>
            <span role="columnheader">Pts</span>
          </div>
          {squadPlayers.map((player) => (
            <button className="squad-table-row" key={player.id} onClick={() => setSelectedPlayer(player)} role="row" type="button">
              <span role="cell">{player.displayName}</span>
              <span role="cell">{player.position}</span>
              <span role="cell">{player.team}</span>
              <span role="cell">{player.points}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Scouting players">
        <h2>Scouting</h2>
        <div role="table" className="squad-data-table" aria-label="Scouting table">
          <div role="row" className="squad-table-row squad-table-head">
            <span role="columnheader">Player</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Points</span>
            <span role="columnheader">Action</span>
          </div>
          {scoutingPlayers.map((player) => (
            <div className="squad-table-row" key={player.id} role="row">
              <button className="squad-link-button" onClick={() => setSelectedPlayer(player)} role="cell" type="button">
                {player.displayName}
              </button>
              <span role="cell" className={`squad-status-badge ${player.status}`}>{player.status}</span>
              <span role="cell">{player.points}</span>
              <span role="cell">
                <Button
                  onClick={() => {
                    setInterestIds((ids) => [...ids, player.id]);
                    setStatus(`${player.displayName} added to interests.`);
                  }}
                  type="button"
                  variant="secondary"
                >
                  <Star aria-hidden="true" size={14} />
                  Interest
                </Button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Interests and proposed trades" className="squad-summary-grid">
        <Card>
          <h2>Interests</h2>
          {interestIds.length === 0 ? <p>No interests registered yet.</p> : null}
          {interestIds.map((id) => {
            const player = players.find((item) => item.id === id);
            return <p key={id}>{player?.displayName}</p>;
          })}
        </Card>
        <Card>
          <h2>Proposed trades</h2>
          <Button onClick={() => setTradeCreated(true)} type="button">Propose sample trade</Button>
          {tradeCreated ? <p>Trade proposal created. Validate against <a href="/rules#trade-window">Trade Window</a>.</p> : <p>No proposed trades.</p>}
        </Card>
      </section>

      {selectedPlayer ? (
        <section role="dialog" aria-label="Player detail" className="squad-player-detail">
          <Card>
            <h2>{selectedPlayer.displayName}</h2>
            <p>{selectedPlayer.position} · {selectedPlayer.team}</p>
            <p>Points: {selectedPlayer.points} · Value: £{selectedPlayer.value.toFixed(1)}m</p>
            <Button onClick={() => setSelectedPlayer(null)} type="button" variant="ghost">Close</Button>
          </Card>
        </section>
      ) : null}
    </main>
  );
}
