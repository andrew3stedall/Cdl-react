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

interface PlayerApiResponse {
  id: string;
  display_name: string;
  position: string;
  epl_team: { name: string; short_name?: string | null };
  status: PlayerView['status'];
  points: number;
  value: number;
}

interface SquadSummaryApiResponse {
  manager_team: { name: string };
  gameweek: { name: string };
  players: PlayerApiResponse[];
}

interface ScoutingApiResponse {
  players: PlayerApiResponse[];
}

interface InterestApiResponse {
  id: string;
  player: { id: string; display_name: string };
}

interface TradeApiResponse {
  id: string;
  status: string;
  assets: Array<{ player: { display_name: string } }>;
}

function mapPlayer(player: PlayerApiResponse): PlayerView {
  return {
    id: player.id,
    displayName: player.display_name,
    position: player.position,
    team: player.epl_team.short_name ?? player.epl_team.name,
    status: player.status,
    points: player.points,
    value: player.value,
  };
}

export function SquadManagementPage({ preset }: SquadManagementPageProps) {
  const [query, setQuery] = useState('');
  const [squadPlayers, setSquadPlayers] = useState<PlayerView[]>([]);
  const [scoutingPool, setScoutingPool] = useState<PlayerView[]>([]);
  const [interests, setInterests] = useState<InterestApiResponse[]>([]);
  const [trades, setTrades] = useState<TradeApiResponse[]>([]);
  const [managerTeam, setManagerTeam] = useState('Current team');
  const [gameweek, setGameweek] = useState('Gameweek 1');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState('Loading squad data.');

  useEffect(() => {
    void Promise.all([
      fetch('/api/squad/summary', { credentials: 'include' }),
      fetch('/api/scouting/players', { credentials: 'include' }),
      fetch('/api/interests', { credentials: 'include' }),
      fetch('/api/trades', { credentials: 'include' }),
    ])
      .then(async ([summaryResponse, scoutingResponse, interestResponse, tradeResponse]) => {
        if (!summaryResponse.ok || !scoutingResponse.ok || !interestResponse.ok || !tradeResponse.ok) {
          const unauthorized = [summaryResponse, scoutingResponse, interestResponse, tradeResponse]
            .some((response) => response.status === 401);
          throw new Error(unauthorized ? 'Sign in to manage squad activity.' : 'Unable to load squad activity.');
        }
        return Promise.all([
          summaryResponse.json() as Promise<SquadSummaryApiResponse>,
          scoutingResponse.json() as Promise<ScoutingApiResponse>,
          interestResponse.json() as Promise<InterestApiResponse[]>,
          tradeResponse.json() as Promise<{ trades?: TradeApiResponse[] }>,
        ]);
      })
      .then(([summary, scouting, persistedInterests, persistedTrades]) => {
        setSquadPlayers(summary.players.map(mapPlayer));
        setScoutingPool(scouting.players.map(mapPlayer));
        setManagerTeam(summary.manager_team.name);
        setGameweek(summary.gameweek.name);
        setInterests(persistedInterests);
        setTrades(persistedTrades.trades ?? []);
        setStatus(`${summary.manager_team.name} loaded from staging PostgreSQL.`);
      })
      .catch((error: Error) => setStatus(error.message));
  }, []);

  const scoutingPlayers = scoutingPool.filter((player) => player.displayName.toLowerCase().includes(query.toLowerCase()));
  const squadValue = squadPlayers.reduce((total, player) => total + player.value, 0);

  async function registerInterest(player: PlayerView) {
    const response = await fetch('/api/interests', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: player.id }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string; detail?: string };
      setStatus(payload.message ?? payload.detail ?? 'Unable to register interest.');
      return;
    }
    const interest = (await response.json()) as InterestApiResponse;
    setInterests((current) => [...current, interest]);
    setStatus(`${player.displayName} added to interests.`);
  }

  return (
    <main aria-labelledby="squad-management-title" className="feature-screen" data-density={preset.tokens.density}>
      <header>
        <p className="eyebrow">Squad Management</p>
        <h1 id="squad-management-title">Squad, scouting, interests, and transfers</h1>
        <p>Authenticated squad overview, player scouting, interests, proposed trades, and shared player detail.</p>
      </header>

      <p role="status">{status}</p>

      <section aria-label="Squad summary" className="squad-summary-grid">
        <Card><h2>Total players</h2><strong>{squadPlayers.length}</strong></Card>
        <Card><h2>Squad value</h2><strong>£{squadValue.toFixed(1)}m</strong></Card>
        <Card><h2>Team</h2><strong>{managerTeam}</strong></Card>
        <Card><h2>Gameweek</h2><strong>{gameweek}</strong></Card>
      </section>

      <section aria-label="Scouting filters" className="squad-filter-bar">
        <label>
          <Search aria-hidden="true" size={16} />
          Search players
          <input aria-label="Search players" onChange={(event) => setQuery(event.target.value)} placeholder="Search players" value={query} />
        </label>
      </section>

      <section aria-label="Current squad">
        <h2>Current squad</h2>
        <div role="table" className="squad-data-table" aria-label="Current squad players">
          <div role="row" className="squad-table-row squad-table-head">
            <span role="columnheader">Player</span><span role="columnheader">Pos</span><span role="columnheader">Team</span><span role="columnheader">Pts</span>
          </div>
          {squadPlayers.map((player) => (
            <button className="squad-table-row" key={player.id} onClick={() => setSelectedPlayer(player)} role="row" type="button">
              <span role="cell">{player.displayName}</span><span role="cell">{player.position}</span><span role="cell">{player.team}</span><span role="cell">{player.points}</span>
            </button>
          ))}
          {squadPlayers.length === 0 ? <p>No drafted players found.</p> : null}
        </div>
      </section>

      <section aria-label="Scouting players">
        <h2>Scouting</h2>
        <div role="table" className="squad-data-table" aria-label="Scouting table">
          <div role="row" className="squad-table-row squad-table-head">
            <span role="columnheader">Player</span><span role="columnheader">Status</span><span role="columnheader">Points</span><span role="columnheader">Action</span>
          </div>
          {scoutingPlayers.map((player) => (
            <div className="squad-table-row" key={player.id} role="row">
              <button className="squad-link-button" onClick={() => setSelectedPlayer(player)} role="cell" type="button">{player.displayName}</button>
              <span role="cell" className={`squad-status-badge ${player.status}`}>{player.status}</span>
              <span role="cell">{player.points}</span>
              <span role="cell">
                <Button disabled={player.status === 'owned'} onClick={() => void registerInterest(player)} type="button" variant="secondary">
                  <Star aria-hidden="true" size={14} />Interest
                </Button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Interests and proposed trades" className="squad-summary-grid">
        <Card>
          <h2>Interests</h2>
          {interests.length === 0 ? <p>No interests registered yet.</p> : null}
          {interests.map((interest) => <p key={interest.id}>{interest.player.display_name}</p>)}
        </Card>
        <Card>
          <h2>Proposed trades</h2>
          {trades.length === 0 ? <p>No proposed trades.</p> : null}
          {trades.map((trade) => (
            <p key={trade.id}>Trade {trade.status}: {trade.assets.map((asset) => asset.player.display_name).join(' ↔ ')}</p>
          ))}
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
