import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRightLeft,
  CalendarDays,
  ChevronRight,
  CirclePoundSterling,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { ThemePreset } from './contracts';
import {
  HttpTeamSelectionClient,
  type TeamSelectionPlayer,
  type TeamSelectionSlot,
} from './team-selection-api';
import './squad-management.css';

interface SquadManagementPageProps {
  preset: ThemePreset;
}

type WorkspaceTab = 'squad' | 'players' | 'activity';
type SquadView = 'pitch' | 'list';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type StatusFilter = 'all' | PlayerView['status'];

interface PlayerView {
  id: string;
  displayName: string;
  position: string;
  team: string;
  status: 'owned' | 'available' | 'interested' | 'trade_target';
  points: number;
  value: number;
  slot?: TeamSelectionSlot;
  slotOrder?: number;
  captain?: boolean;
  viceCaptain?: boolean;
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

const pitchPositionOrder = ['GKP', 'DEF', 'MID', 'FWD'];

function mapPlayer(player: PlayerApiResponse): PlayerView {
  return {
    id: player.id,
    displayName: player.display_name,
    position: normalizePosition(player.position),
    team: player.epl_team.short_name ?? player.epl_team.name,
    status: player.status,
    points: player.points,
    value: player.value,
  };
}

function mergeLineupPlayers(
  roster: PlayerView[],
  lineup: TeamSelectionPlayer[] | null,
): PlayerView[] {
  if (!lineup) return roster;

  const rosterById = new Map(roster.map((player) => [player.id, player]));
  const lineupIds = new Set(lineup.map((player) => player.id));
  const positioned = lineup.map((player) => {
    const existing = rosterById.get(player.id);
    return {
      id: player.id,
      displayName: existing?.displayName ?? player.name,
      position: normalizePosition(existing?.position ?? player.position),
      team: existing?.team ?? player.team,
      status: existing?.status ?? 'owned',
      points: existing?.points ?? 0,
      value: existing?.value ?? 0,
      slot: player.slot,
      slotOrder: player.slotOrder,
      captain: player.captain,
      viceCaptain: player.viceCaptain,
    } satisfies PlayerView;
  });

  return [...positioned, ...roster.filter((player) => !lineupIds.has(player.id))];
}

export function SquadManagementPage({ preset }: SquadManagementPageProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => (
    window.location.pathname.startsWith('/scouting') ? 'players' : 'squad'
  ));
  const [squadView, setSquadView] = useState<SquadView>('pitch');
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [squadPlayers, setSquadPlayers] = useState<PlayerView[]>([]);
  const [scoutingPool, setScoutingPool] = useState<PlayerView[]>([]);
  const [interests, setInterests] = useState<InterestApiResponse[]>([]);
  const [trades, setTrades] = useState<TradeApiResponse[]>([]);
  const [managerTeam, setManagerTeam] = useState('Current team');
  const [gameweek, setGameweek] = useState('Gameweek 1');
  const [lineupAvailable, setLineupAvailable] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState('Loading squad data.');
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const teamSelectionClient = new HttpTeamSelectionClient();
    void Promise.all([
      fetch('/api/squad/summary', { credentials: 'include' }),
      fetch('/api/scouting/players', { credentials: 'include' }),
      fetch('/api/interests', { credentials: 'include' }),
      fetch('/api/trades', { credentials: 'include' }),
      teamSelectionClient.getTeamSelection().catch(() => null),
    ])
      .then(async ([summaryResponse, scoutingResponse, interestResponse, tradeResponse, lineup]) => {
        if (!summaryResponse.ok || !scoutingResponse.ok || !interestResponse.ok || !tradeResponse.ok) {
          const unauthorized = [summaryResponse, scoutingResponse, interestResponse, tradeResponse]
            .some((response) => response.status === 401);
          throw new Error(unauthorized ? 'Sign in to manage squad activity.' : 'Unable to load squad activity.');
        }
        const [summary, scouting, persistedInterests, persistedTrades] = await Promise.all([
          summaryResponse.json() as Promise<SquadSummaryApiResponse>,
          scoutingResponse.json() as Promise<ScoutingApiResponse>,
          interestResponse.json() as Promise<InterestApiResponse[]>,
          tradeResponse.json() as Promise<{ trades?: TradeApiResponse[] }>,
        ]);
        return { summary, scouting, persistedInterests, persistedTrades, lineup };
      })
      .then(({ summary, scouting, persistedInterests, persistedTrades, lineup }) => {
        const roster = summary.players.map(mapPlayer);
        const hasLineup = Boolean(lineup?.players.length);
        setSquadPlayers(mergeLineupPlayers(roster, lineup?.players ?? null));
        setScoutingPool(scouting.players.map(mapPlayer));
        setManagerTeam(summary.manager_team.name);
        setGameweek(summary.gameweek.name);
        setInterests(persistedInterests);
        setTrades(persistedTrades.trades ?? []);
        setLineupAvailable(hasLineup);
        if (!hasLineup) setSquadView('list');
        setStatus(
          hasLineup
            ? `${summary.manager_team.name} lineup loaded from staging PostgreSQL.`
            : `${summary.manager_team.name} roster loaded. Pitch view is unavailable until a lineup is saved.`,
        );
      })
      .catch((error: Error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!selectedPlayer) return;

    drawerRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPlayer(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
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
  const squadValue = squadPlayers.reduce((total, player) => total + player.value, 0);
  const squadPoints = squadPlayers.reduce((total, player) => total + player.points, 0);
  const averagePoints = squadPlayers.length > 0 ? Math.round(squadPoints / squadPlayers.length) : 0;
  const activityCount = interests.length + trades.length;

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
    <main aria-labelledby="squad-management-title" className="feature-screen squad-workspace" data-density={preset.tokens.density}>
      <header className="squad-page-header">
        <div className="squad-title-lockup">
          <span aria-hidden="true" className="squad-title-mark"><LayoutGrid size={24} /></span>
          <div>
            <p className="eyebrow">My team</p>
            <h1 id="squad-management-title">Squad management</h1>
            <p className="squad-page-description">{managerTeam} · {gameweek}</p>
          </div>
        </div>
        <div className="squad-header-actions">
          <Button onClick={() => setActiveTab('players')} type="button" variant="secondary">
            <Search aria-hidden="true" size={16} />
            Find players
          </Button>
          <Button onClick={() => setActiveTab('activity')} type="button">
            <Activity aria-hidden="true" size={16} />
            Activity
            {activityCount > 0 ? <span className="squad-action-count">{activityCount}</span> : null}
          </Button>
        </div>
      </header>

      <p className="squad-load-status" role="status">{status}</p>

      <section aria-label="Squad summary" className="squad-metric-grid">
        <MetricCard icon={<Users aria-hidden="true" size={18} />} label="Players" value={String(squadPlayers.length)} />
        <MetricCard icon={<CirclePoundSterling aria-hidden="true" size={18} />} label="Squad value" value={`£${squadValue.toFixed(1)}m`} />
        <MetricCard icon={<Activity aria-hidden="true" size={18} />} label="Average points" value={String(averagePoints)} />
        <MetricCard icon={<CalendarDays aria-hidden="true" size={18} />} label="Current period" value={gameweek} />
      </section>

      <section className="squad-content-card">
        <div aria-label="Squad workspace sections" className="squad-tabs" role="tablist">
          <WorkspaceTabButton activeTab={activeTab} count={squadPlayers.length} label="My squad" tab="squad" onSelect={setActiveTab} />
          <WorkspaceTabButton activeTab={activeTab} count={scoutingPool.length} label="Player pool" tab="players" onSelect={setActiveTab} />
          <WorkspaceTabButton activeTab={activeTab} count={activityCount} label="Activity" tab="activity" onSelect={setActiveTab} />
        </div>

        {activeTab === 'squad' ? (
          <div aria-labelledby="squad-tab" className="squad-tab-panel" id="squad-panel" role="tabpanel">
            <div className="squad-view-header">
              <SectionHeading
                description="Review the persisted lineup on the pitch or switch to a complete roster table."
                title="Current squad"
              />
              <div aria-label="Squad view" className="squad-view-toggle" role="group">
                <button
                  aria-pressed={squadView === 'pitch'}
                  disabled={!lineupAvailable}
                  onClick={() => setSquadView('pitch')}
                  type="button"
                >
                  <LayoutGrid aria-hidden="true" size={17} />
                  Pitch
                </button>
                <button
                  aria-pressed={squadView === 'list'}
                  onClick={() => setSquadView('list')}
                  type="button"
                >
                  <List aria-hidden="true" size={17} />
                  List
                </button>
              </div>
            </div>

            {squadView === 'pitch' && lineupAvailable ? (
              <SquadPitch onSelect={openPlayer} players={squadPlayers} />
            ) : (
              <PlayerTable
                emptyMessage="No drafted players found."
                interestedPlayerIds={interestedPlayerIds}
                onInterest={registerInterest}
                onSelect={openPlayer}
                players={squadPlayers}
              />
            )}
          </div>
        ) : null}

        {activeTab === 'players' ? (
          <div aria-labelledby="players-tab" className="squad-tab-panel" id="players-panel" role="tabpanel">
            <SectionHeading
              description="Search the shared player pool, then open a player for detail or add them to your interests."
              title="Player pool"
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

        {activeTab === 'activity' ? (
          <div aria-labelledby="activity-tab" className="squad-tab-panel" id="activity-panel" role="tabpanel">
            <SectionHeading
              description="Interests and trade proposals stay separate from the lineup until you need them."
              title="Transfer activity"
            />
            <section aria-label="Interests and proposed trades" className="squad-activity-grid">
              <Card className="squad-activity-card">
                <header className="squad-activity-heading">
                  <div>
                    <p className="eyebrow">Watchlist</p>
                    <h2>Interests</h2>
                  </div>
                  <span className="squad-count-badge">{interests.length}</span>
                </header>
                {interests.length === 0 ? <EmptyState message="No interests registered yet." /> : null}
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
                        <span className="squad-player-avatar">{initials(interest.player.display_name)}</span>
                        <span><strong>{interest.player.display_name}</strong><small>Registered interest</small></span>
                        <ChevronRight aria-hidden="true" size={17} />
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="squad-activity-card">
                <header className="squad-activity-heading">
                  <div>
                    <p className="eyebrow">Negotiations</p>
                    <h2>Proposed trades</h2>
                  </div>
                  <span className="squad-count-badge">{trades.length}</span>
                </header>
                {trades.length === 0 ? <EmptyState message="No proposed trades." /> : null}
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
              </Card>
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
              <span className="squad-player-avatar squad-player-avatar-large">{initials(selectedPlayer.displayName)}</span>
              <div>
                <strong>{selectedPlayer.displayName}</strong>
                <span>{selectedPlayer.position} · {selectedPlayer.team}</span>
              </div>
              <StatusBadge status={selectedPlayer.status} />
            </div>

            <section aria-label="Player metrics" className="squad-drawer-metrics">
              <div><span>Points</span><strong>{selectedPlayer.points}</strong></div>
              <div><span>Value</span><strong>£{selectedPlayer.value.toFixed(1)}m</strong></div>
              <div><span>Position</span><strong>{selectedPlayer.position}</strong></div>
            </section>

            <section className="squad-drawer-context">
              <h3>Availability</h3>
              <p>{availabilityDescription(selectedPlayer.status)}</p>
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

function SquadPitch({ players, onSelect }: { players: PlayerView[]; onSelect: (player: PlayerView) => void }) {
  const starters = players
    .filter((player) => player.slot === 'starter')
    .sort((left, right) => (left.slotOrder ?? 0) - (right.slotOrder ?? 0));
  const bench = players
    .filter((player) => player.slot === 'bench' || player.slot === 'reserve')
    .sort((left, right) => (left.slotOrder ?? 0) - (right.slotOrder ?? 0));
  const rows = pitchPositionOrder
    .map((position) => ({ position, players: starters.filter((player) => player.position === position) }))
    .filter((row) => row.players.length > 0);
  const formation = pitchPositionOrder
    .slice(1)
    .map((position) => starters.filter((player) => player.position === position).length)
    .filter((count) => count > 0)
    .join('-');

  return (
    <section aria-label="Squad pitch" className="squad-pitch-shell">
      <header className="squad-pitch-meta">
        <span><strong>{starters.length}</strong> starters</span>
        <span><strong>{bench.length}</strong> bench</span>
        <span><strong>{formation || '—'}</strong> formation</span>
      </header>
      <div className="squad-pitch">
        <div aria-hidden="true" className="squad-pitch-markings">
          <span className="pitch-halfway" />
          <span className="pitch-centre-circle" />
          <span className="pitch-box pitch-box-top" />
          <span className="pitch-box pitch-box-bottom" />
        </div>
        <div className="squad-pitch-lineup">
          {rows.map((row) => (
            <div className={`squad-pitch-row pitch-row-${row.position.toLowerCase()}`} key={row.position}>
              {row.players.map((player) => <PitchPlayerCard key={player.id} onSelect={onSelect} player={player} />)}
            </div>
          ))}
        </div>
      </div>
      <section aria-label="Bench" className="squad-bench">
        <header><h3>Bench</h3><span>{bench.length} players</span></header>
        <div className="squad-bench-grid">
          {bench.map((player) => <PitchPlayerCard compact key={player.id} onSelect={onSelect} player={player} />)}
        </div>
      </section>
    </section>
  );
}

function PitchPlayerCard({
  compact = false,
  onSelect,
  player,
}: {
  compact?: boolean;
  onSelect: (player: PlayerView) => void;
  player: PlayerView;
}) {
  return (
    <button
      aria-label={`View ${player.displayName} details`}
      className={`pitch-player-card ${compact ? 'compact' : ''}`}
      onClick={() => onSelect(player)}
      type="button"
    >
      <span className={`squad-position-badge position-${player.position.toLowerCase()}`}>{player.position}</span>
      <span className="pitch-player-avatar">{initials(player.displayName)}</span>
      <strong>{player.displayName}</strong>
      <small>{player.team}</small>
      <span className="pitch-player-metrics">
        <span><strong>{player.points}</strong> pts</span>
        <span>£{player.value.toFixed(1)}m</span>
      </span>
      {player.captain ? <span className="pitch-captain">C</span> : null}
      {player.viceCaptain ? <span className="pitch-captain">VC</span> : null}
    </button>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="squad-metric-card">
      <span className="squad-metric-icon">{icon}</span>
      <div><span>{label}</span><strong>{value}</strong></div>
    </Card>
  );
}

function WorkspaceTabButton({
  activeTab,
  count,
  label,
  onSelect,
  tab,
}: {
  activeTab: WorkspaceTab;
  count: number;
  label: string;
  onSelect: (tab: WorkspaceTab) => void;
  tab: WorkspaceTab;
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
          <tr><th>Player</th><th>Position</th><th>Club</th><th>Points</th><th>Value</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const interested = interestedPlayerIds.has(player.id) || player.status === 'interested';
            const status = interested ? 'interested' : player.status;
            return (
              <tr key={player.id}>
                <td>
                  <button className="squad-player-button" onClick={() => onSelect({ ...player, status })} type="button">
                    <span className="squad-player-avatar">{initials(player.displayName)}</span>
                    <span><strong>{player.displayName}</strong><small>View player</small></span>
                  </button>
                </td>
                <td><span className={`squad-position-badge position-${player.position.toLowerCase()}`}>{player.position}</span></td>
                <td>{player.team}</td>
                <td><strong>{player.points}</strong></td>
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

function StatusBadge({ status }: { status: PlayerView['status'] }) {
  return <span className={`squad-status-badge status-${status}`}>{formatStatus(status)}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="squad-empty-state"><Users aria-hidden="true" size={20} /><p>{message}</p></div>;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
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

function availabilityDescription(status: PlayerView['status']): string {
  if (status === 'owned') return 'This player is currently assigned to your active squad.';
  if (status === 'trade_target') return 'This player is associated with an active trade target.';
  if (status === 'interested') return 'You are monitoring this player in your interests list.';
  return 'This player is currently available for a permitted squad workflow.';
}
