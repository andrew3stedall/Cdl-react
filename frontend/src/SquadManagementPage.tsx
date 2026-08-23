import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Store,
  Star,
  Users,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { PlayerCard, type PlayerCardPlayer } from './components/player/PlayerCard';
import type { ThemePreset } from './contracts';
import './squad-management.css';

interface SquadManagementPageProps {
  preset: ThemePreset;
}

type MarketTab = 'discovery' | 'interests' | 'trades';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type StatusFilter = 'all' | PlayerView['status'];

interface PlayerView {
  id: string;
  displayName: string;
  position: string;
  team: string;
  status: 'owned' | 'available' | 'interested' | 'trade_target';
  points: number;
  form: number;
  value: number;
  selectedByPercent: number;
  expectedGoals: number;
  expectedAssists: number;
  availabilityStatus?: string | null;
  availabilityNews: string;
  chanceOfPlayingNextRound?: number | null;
}

interface PlayerApiResponse {
  id: string;
  display_name: string;
  position: string;
  epl_team: { name: string; short_name?: string | null };
  status: PlayerView['status'];
  points: number;
  form?: number;
  value: number;
  selected_by_percent?: number;
  expected_goals?: number;
  expected_assists?: number;
  availability_status?: string | null;
  availability_news?: string;
  chance_of_playing_next_round?: number | null;
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

interface PlayerHistoryRow {
  gameweek: number;
  total_points: number;
  minutes: number;
  expected_goals: number;
  expected_assists: number;
}

interface PlayerUpcomingFixture {
  gameweek?: number | null;
  difficulty: number;
  is_home: boolean;
}

interface PlayerHistoryApiResponse {
  player_id: string;
  fetched_at: string;
  history: PlayerHistoryRow[];
  fixtures: PlayerUpcomingFixture[];
}

const positionOptions: Array<{ label: string; value: PositionFilter }> = [
  { label: 'All positions', value: 'all' },
  { label: 'Goalkeepers', value: 'GKP' },
  { label: 'Defenders', value: 'DEF' },
  { label: 'Midfielders', value: 'MID' },
  { label: 'Forwards', value: 'FWD' },
];

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All availability', value: 'all' },
  { label: 'Available', value: 'available' },
  { label: 'In your squad', value: 'owned' },
  { label: 'Interested', value: 'interested' },
  { label: 'Trade targets', value: 'trade_target' },
];

function mapPlayer(player: PlayerApiResponse): PlayerView {
  return {
    id: player.id,
    displayName: player.display_name,
    position: normalizePosition(player.position),
    team: player.epl_team.short_name ?? player.epl_team.name,
    status: player.status,
    points: player.points,
    form: player.form ?? 0,
    value: player.value,
    selectedByPercent: player.selected_by_percent ?? 0,
    expectedGoals: player.expected_goals ?? 0,
    expectedAssists: player.expected_assists ?? 0,
    availabilityStatus: player.availability_status,
    availabilityNews: player.availability_news ?? '',
    chanceOfPlayingNextRound: player.chance_of_playing_next_round,
  };
}

export function SquadManagementPage({ preset }: SquadManagementPageProps) {
  const [activeTab, setActiveTab] = useState<MarketTab>('discovery');
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scoutingPool, setScoutingPool] = useState<PlayerView[]>([]);
  const [interests, setInterests] = useState<InterestApiResponse[]>([]);
  const [trades, setTrades] = useState<TradeApiResponse[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerView | null>(null);
  const [playerHistory, setPlayerHistory] = useState<PlayerHistoryApiResponse | null>(null);
  const [playerHistoryStatus, setPlayerHistoryStatus] = useState('');
  const [status, setStatus] = useState('Loading market data.');
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch('/api/scouting/players', { credentials: 'include' }),
      fetch('/api/interests', { credentials: 'include' }),
      fetch('/api/trades', { credentials: 'include' }),
    ])
      .then(async ([scoutingResponse, interestResponse, tradeResponse]) => {
        if (!scoutingResponse.ok || !interestResponse.ok || !tradeResponse.ok) {
          const unauthorized = [scoutingResponse, interestResponse, tradeResponse]
            .some((response) => response.status === 401);
          throw new Error(unauthorized ? 'Sign in to manage market activity.' : 'Unable to load market activity.');
        }
        const [scouting, persistedInterests, persistedTrades] = await Promise.all([
          scoutingResponse.json() as Promise<ScoutingApiResponse>,
          interestResponse.json() as Promise<InterestApiResponse[]>,
          tradeResponse.json() as Promise<{ trades?: TradeApiResponse[] }>,
        ]);
        return { scouting, persistedInterests, persistedTrades };
      })
      .then(({ scouting, persistedInterests, persistedTrades }) => {
        setScoutingPool(scouting.players.map(mapPlayer));
        setInterests(persistedInterests);
        setTrades(persistedTrades.trades ?? []);
        setStatus('Market data is up to date.');
      })
      .catch((error: Error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!selectedPlayer) {
      setPlayerHistory(null);
      setPlayerHistoryStatus('');
      return;
    }

    let cancelled = false;
    setPlayerHistory(null);
    setPlayerHistoryStatus('Loading official FPL history…');
    void fetch(`/api/fpl/players/${encodeURIComponent(selectedPlayer.id)}/history`, {
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Official FPL history is currently unavailable.');
        return response.json() as Promise<PlayerHistoryApiResponse>;
      })
      .then((history) => {
        if (cancelled) return;
        setPlayerHistory(history);
        setPlayerHistoryStatus('');
      })
      .catch((error: Error) => {
        if (!cancelled) setPlayerHistoryStatus(error.message);
      });

    drawerRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPlayer(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedPlayer]);

  const interestedPlayerIds = useMemo(
    () => new Set(interests.map((interest) => interest.player.id)),
    [interests],
  );
  const filteredPlayers = scoutingPool.filter((player) => {
    const matchesQuery = player.displayName.toLowerCase().includes(query.trim().toLowerCase())
      || player.team.toLowerCase().includes(query.trim().toLowerCase());
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    const effectiveStatus = interestedPlayerIds.has(player.id) ? 'interested' : player.status;
    const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
    return matchesQuery && matchesPosition && matchesStatus;
  });
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
    setScoutingPool((current) => current.map((candidate) => (
      candidate.id === player.id ? { ...candidate, status: 'interested' } : candidate
    )));
    setSelectedPlayer((current) => (
      current?.id === player.id ? { ...current, status: 'interested' } : current
    ));
    setStatus(`${player.displayName} added to interests.`);
  }

  const openPlayer = (player: PlayerView) => setSelectedPlayer({
    ...player,
    status: interestedPlayerIds.has(player.id) ? 'interested' : player.status,
  });

  return (
    <main aria-labelledby="market-title" className="feature-screen squad-workspace market-workspace" data-density={preset.tokens.density}>
      <header className="squad-page-header">
        <div className="squad-title-lockup">
          <span aria-hidden="true" className="squad-title-mark"><Store size={24} /></span>
          <div>
            <p className="eyebrow">Market</p>
            <h1 id="market-title">Player market</h1>
            <p className="squad-page-description">Discover players, set draw preferences and manage trades.</p>
          </div>
        </div>
      </header>

      <p className="squad-load-status" role="status">{status}</p>

      <section className="squad-content-card">
        <div aria-label="Market sections" className="squad-tabs market-tabs" role="tablist">
          <WorkspaceTabButton activeTab={activeTab} count={scoutingPool.length} label="Discovery" tab="discovery" onSelect={setActiveTab} />
          <WorkspaceTabButton activeTab={activeTab} count={interests.length} label="Interests" tab="interests" onSelect={setActiveTab} />
          <WorkspaceTabButton activeTab={activeTab} count={trades.length} label="Trades" tab="trades" onSelect={setActiveTab} />
        </div>

        {activeTab === 'discovery' ? (
          <div aria-labelledby="discovery-tab" className="squad-tab-panel" id="discovery-panel" role="tabpanel">
            <SectionHeading
              description="Search the player pool, compare the evidence and add players to your draw preferences."
              title="Discover players"
            />
            <section aria-label="Player pool filters" className="squad-filter-toolbar">
              <label className="squad-search-field">
                <Search aria-hidden="true" size={17} />
                <span className="sr-only">Search players</span>
                <input
                  aria-label="Search players"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by player or club"
                  value={query}
                />
              </label>
              <label className="squad-filter-field">
                <SlidersHorizontal aria-hidden="true" size={16} />
                <span className="sr-only">Position</span>
                <select
                  aria-label="Filter by position"
                  onChange={(event) => setPositionFilter(event.target.value as PositionFilter)}
                  value={positionFilter}
                >
                  {positionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="squad-filter-field">
                <span className="sr-only">Availability</span>
                <select
                  aria-label="Filter by availability"
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  value={statusFilter}
                >
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </section>
            <p className="squad-results-count">{filteredPlayers.length} players</p>
            <PlayerTable
              emptyMessage="No players match the current filters."
              interestedPlayerIds={interestedPlayerIds}
              onInterest={registerInterest}
              onSelect={openPlayer}
              players={filteredPlayers}
              showInterestAction
            />
          </div>
        ) : null}

        {activeTab === 'interests' ? (
          <div aria-labelledby="interests-tab" className="squad-tab-panel" id="interests-panel" role="tabpanel">
            <SectionHeading
              description="Your ranked draw preferences, kept separate from watchlist and trade activity."
              title="Interests"
            />
            <section aria-label="Player interests" className="squad-activity-card market-list-card">
              <header className="squad-activity-heading">
                <div>
                  <p className="eyebrow">Draw preferences</p>
                  <h2>{interests.length ? `${interests.length} registered` : 'No interests yet'}</h2>
                </div>
                <span className="squad-count-badge">{interests.length}</span>
              </header>
              {interests.length === 0 ? <EmptyState message="Add players from Discovery to build your draw preference list." /> : null}
              <div className="squad-activity-list">
                {interests.map((interest) => {
                  const player = scoutingPool.find((candidate) => candidate.id === interest.player.id);
                  return (
                    <button
                      className="squad-activity-item"
                      key={interest.id}
                      onClick={() => player && openPlayer(player)}
                      type="button"
                    >
                      <PlayerCard formPosition="hidden" layout="list" player={toPlayerCardPlayer(player ?? { displayName: interest.player.display_name, position: '', team: 'unknown', form: null, chanceOfPlayingNextRound: null })} showPositionMarker={Boolean(player?.position)} size="xs" />
                      <span><strong>{interest.player.display_name}</strong><small>Registered interest</small></span>
                      <ChevronRight aria-hidden="true" size={17} />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'trades' ? (
          <div aria-labelledby="trades-tab" className="squad-tab-panel" id="trades-panel" role="tabpanel">
            <SectionHeading
              description="Review proposed player swaps and keep negotiations in one place."
              title="Trades"
            />
            <section aria-label="Proposed trades" className="squad-activity-card market-list-card">
              <header className="squad-activity-heading">
                <div>
                  <p className="eyebrow">Negotiations</p>
                  <h2>{trades.length ? `${trades.length} proposed` : 'No proposed trades'}</h2>
                </div>
                <span className="squad-count-badge">{trades.length}</span>
              </header>
              {trades.length === 0 ? <EmptyState message="Trade proposals will appear here when a negotiation is started." /> : null}
              <div className="squad-activity-list">
                {trades.map((trade) => (
                  <div className="squad-trade-item" key={trade.id}>
                    <span className="squad-trade-icon"><ArrowRightLeft aria-hidden="true" size={17} /></span>
                    <span>
                      <strong>Trade {trade.status}: {trade.assets.map((asset) => asset.player.display_name).join(' ↔ ')}</strong>
                      <small>Open negotiation</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>

      {selectedPlayer ? (
        <div className="squad-drawer-layer">
          <button aria-label="Close player details" className="squad-drawer-backdrop" onClick={() => setSelectedPlayer(null)} type="button" />
          <aside
            aria-labelledby="player-detail-title"
            aria-modal="true"
            className="squad-player-drawer"
            ref={drawerRef}
            role="dialog"
            tabIndex={-1}
          >
            <header className="squad-drawer-header">
              <div>
                <p className="eyebrow">Player details</p>
                <h2 id="player-detail-title">{selectedPlayer.displayName}</h2>
              </div>
              <button aria-label="Close player details" className="squad-icon-button" onClick={() => setSelectedPlayer(null)} type="button">
                <X aria-hidden="true" size={19} />
              </button>
            </header>

            <div className="squad-drawer-player">
              <PlayerCard formPosition="hidden" layout="token" player={toPlayerCardPlayer(selectedPlayer)} showPositionMarker size="lg" />
              <div>
                <strong>{selectedPlayer.displayName}</strong>
                <span>{selectedPlayer.position} · {selectedPlayer.team}</span>
              </div>
              <StatusBadge status={selectedPlayer.status} />
            </div>

            <section aria-label="Player metrics" className="squad-drawer-metrics">
              <div><span>Points</span><strong>{selectedPlayer.points}</strong></div>
              <div><span>Form</span><strong>{selectedPlayer.form.toFixed(1)}</strong></div>
              <div><span>Value</span><strong>£{selectedPlayer.value.toFixed(1)}m</strong></div>
              <div><span>Selected</span><strong>{selectedPlayer.selectedByPercent.toFixed(1)}%</strong></div>
              <div><span>xG</span><strong>{selectedPlayer.expectedGoals.toFixed(2)}</strong></div>
              <div><span>xA</span><strong>{selectedPlayer.expectedAssists.toFixed(2)}</strong></div>
            </section>

            <section className="squad-drawer-context">
              <h3>FPL availability</h3>
              <p>{fplAvailabilityDescription(selectedPlayer)}</p>
            </section>

            <section className="squad-drawer-context">
              <h3>FPL gameweek history</h3>
              {playerHistoryStatus ? <p role="status">{playerHistoryStatus}</p> : null}
              {playerHistory?.history.length ? (
                <div aria-label="Recent FPL gameweek history" className="squad-table-scroll" role="region" tabIndex={0}>
                  <table className="squad-table">
                    <thead><tr><th>GW</th><th>Pts</th><th>Min</th><th>xG</th><th>xA</th></tr></thead>
                    <tbody>
                      {playerHistory.history.slice(-6).reverse().map((row) => (
                        <tr key={row.gameweek}>
                          <td>{row.gameweek}</td>
                          <td><strong>{row.total_points}</strong></td>
                          <td>{row.minutes}</td>
                          <td>{row.expected_goals.toFixed(2)}</td>
                          <td>{row.expected_assists.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {playerHistory && playerHistory.history.length === 0 ? <p>No completed FPL gameweek history yet.</p> : null}
              {playerHistory?.fixtures[0] ? (
                <p>
                  Next fixture: {playerHistory.fixtures[0].gameweek ? `GW${playerHistory.fixtures[0].gameweek}` : 'TBC'} · FDR {playerHistory.fixtures[0].difficulty} · {playerHistory.fixtures[0].is_home ? 'Home' : 'Away'}
                </p>
              ) : null}
            </section>

            <footer className="squad-drawer-actions">
              {selectedPlayer.status !== 'owned' && selectedPlayer.status !== 'interested' ? (
                <Button onClick={() => void registerInterest(selectedPlayer)} type="button">
                  <Star aria-hidden="true" size={16} />
                  Add to interests
                </Button>
              ) : null}
              <Button onClick={() => setSelectedPlayer(null)} type="button" variant="secondary">Close</Button>
            </footer>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function WorkspaceTabButton({
  activeTab,
  count,
  label,
  onSelect,
  tab,
}: {
  activeTab: MarketTab;
  count: number;
  label: string;
  onSelect: (tab: MarketTab) => void;
  tab: MarketTab;
}) {
  const active = activeTab === tab;
  return (
    <button
      aria-controls={`${tab}-panel`}
      aria-selected={active}
      className={`squad-tab ${active ? 'active' : ''}`}
      id={`${tab}-tab`}
      onClick={() => onSelect(tab)}
      role="tab"
      tabIndex={active ? 0 : -1}
      type="button"
    >
      {label}<span>{count}</span>
    </button>
  );
}

function SectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <header className="squad-section-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
    </header>
  );
}

function PlayerTable({
  emptyMessage,
  interestedPlayerIds,
  onInterest,
  onSelect,
  players,
  showInterestAction = false,
}: {
  emptyMessage: string;
  interestedPlayerIds: Set<string>;
  onInterest: (player: PlayerView) => Promise<void>;
  onSelect: (player: PlayerView) => void;
  players: PlayerView[];
  showInterestAction?: boolean;
}) {
  if (players.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div aria-label="Players table" className="squad-table-scroll" role="region" tabIndex={0}>
      <table className="squad-table">
        <thead>
          <tr><th>Player</th><th>Position</th><th>Club</th><th>Points</th><th>Form</th><th>Value</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const interested = interestedPlayerIds.has(player.id) || player.status === 'interested';
            const status = interested ? 'interested' : player.status;
            return (
              <tr key={player.id}>
                <td>
                  <button className="squad-player-button" onClick={() => onSelect({ ...player, status })} type="button">
                    <PlayerCard formPosition="beside" layout="list" player={toPlayerCardPlayer(player)} showPositionMarker size="xs" />
                  </button>
                </td>
                <td><span className={`squad-position-badge position-${player.position.toLowerCase()}`}>{player.position}</span></td>
                <td>{player.team}</td>
                <td><strong>{player.points}</strong></td>
                <td>{player.form.toFixed(1)}</td>
                <td>£{player.value.toFixed(1)}m</td>
                <td><StatusBadge status={status} /></td>
                <td className="squad-row-action">
                  {showInterestAction && status !== 'owned' ? (
                    <Button
                      aria-label={interested ? `${player.displayName} is in interests` : `Add ${player.displayName} to interests`}
                      disabled={interested}
                      onClick={() => void onInterest(player)}
                      type="button"
                      variant="secondary"
                    >
                      <Star aria-hidden="true" size={14} />
                      {interested ? 'Watching' : 'Interest'}
                    </Button>
                  ) : (
                    <button aria-label={`View ${player.displayName} details`} className="squad-icon-button" onClick={() => onSelect({ ...player, status })} type="button">
                      <ChevronRight aria-hidden="true" size={18} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function toPlayerCardPlayer(player: { displayName: string; team: string; position: string; form: number | null; chanceOfPlayingNextRound?: number | null }): PlayerCardPlayer {
  return {
    availabilityChance: player.chanceOfPlayingNextRound,
    displayName: player.displayName,
    form: player.form,
    position: player.position,
    team: player.team,
  };
}

function StatusBadge({ status }: { status: PlayerView['status'] }) {
  return <span className={`squad-status-badge status-${status}`}>{formatStatus(status)}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="squad-empty-state"><Users aria-hidden="true" size={20} /><p>{message}</p></div>;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === 'GK' ? 'GKP' : normalized;
}

function formatStatus(status: PlayerView['status']): string {
  if (status === 'owned') return 'In squad';
  if (status === 'trade_target') return 'Trade target';
  if (status === 'interested') return 'Interested';
  return 'Available';
}

function fplAvailabilityDescription(player: PlayerView): string {
  const chance = player.chanceOfPlayingNextRound;
  const chanceText = chance == null ? '' : ` ${chance}% chance of playing next round.`;
  if (player.availabilityNews.trim()) return `${player.availabilityNews.trim()}${chanceText}`;
  if (player.availabilityStatus === 'a') return 'Available according to the latest official FPL data.';
  if (player.availabilityStatus) return `FPL status: ${player.availabilityStatus}.${chanceText}`;
  return 'No official FPL availability note is currently published.';
}
