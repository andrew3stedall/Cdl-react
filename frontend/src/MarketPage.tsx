import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Bookmark,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Filter,
  Search,
  Shield,
  Star,
  Users,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import type { ThemePreset } from './contracts';
import { officialFplShirtUrl } from './fpl-shirt-assets';
import { availabilityIssueLabel, hasAvailabilityIssue } from './player-availability';
import type { SquadApiPlayer } from './squad-api';
import './market-page.css';

interface MarketPageProps {
  currentPath: string;
  onNavigate: (href: string) => void;
  preset: ThemePreset;
}

type MarketMode = 'discover' | 'interests' | 'trades';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type StatusFilter = 'all' | 'available' | 'owned' | 'interested' | 'risk';
type FixtureFilter = 'all' | 'easy';
type SortKey = 'points' | 'form' | 'xg' | 'xa' | 'value';

interface MarketPlayer {
  id: string;
  displayName: string;
  position: string;
  club: string;
  status: SquadApiPlayer['status'] | 'owned_by_other';
  draftTeamName: string | null;
  points: number | null;
  form: number | null;
  value: number | null;
  xg: number | null;
  xa: number | null;
  selectedPercent: number | null;
  nextOpponent: string | null;
  nextDifficulty: number | null;
  nextFixtureIsHome: boolean | null;
  availability: string | null;
  availabilityNews: string | null;
  chanceOfPlaying: number | null;
}

interface InterestView {
  id: string;
  player: MarketPlayer;
  gameweekName: string | null;
  note: string | null;
}

interface TradeView {
  id: string;
  status: string;
  offeredBy: string | null;
  offeredTo: string | null;
  assetNames: string[];
}

interface PlayerHistoryRow {
  gameweek: number;
  total_points: number;
  minutes: number;
  expected_goals: number;
  expected_assists: number;
}

interface PlayerHistoryResponse {
  history: PlayerHistoryRow[];
}

interface ApiInterest {
  id: string;
  player: SquadApiPlayer;
  gameweek?: { name?: string | null } | null;
  note?: string | null;
}

interface ApiTrade {
  id: string;
  status: string;
  offered_by?: { name?: string | null } | null;
  offered_to?: { name?: string | null } | null;
  assets?: Array<{ player?: { display_name?: string | null } | null }>;
}

interface ApiSummary {
  manager_team: { name: string };
  gameweek: { name: string };
  players: SquadApiPlayer[];
}

interface ApiScoutingResponse {
  players: SquadApiPlayer[];
}

const positionOptions: Array<{ label: string; value: PositionFilter }> = [
  { label: 'All positions', value: 'all' },
  { label: 'Goalkeepers', value: 'GKP' },
  { label: 'Defenders', value: 'DEF' },
  { label: 'Midfielders', value: 'MID' },
  { label: 'Forwards', value: 'FWD' },
];

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All players', value: 'all' },
  { label: 'Available to add', value: 'available' },
  { label: 'In your squad', value: 'owned' },
  { label: 'In your Interests', value: 'interested' },
  { label: 'Needs availability review', value: 'risk' },
];

const sortOptions: Array<{ label: string; value: SortKey }> = [
  { label: 'Total points', value: 'points' },
  { label: 'Recent form', value: 'form' },
  { label: 'Expected goals', value: 'xg' },
  { label: 'Expected assists', value: 'xa' },
  { label: 'Value', value: 'value' },
];

export function MarketPage({ currentPath, onNavigate, preset }: MarketPageProps) {
  const [mode, setMode] = useState<MarketMode>(() => modeFromPath(currentPath));
  const [players, setPlayers] = useState<MarketPlayer[]>([]);
  const [interests, setInterests] = useState<InterestView[]>([]);
  const [trades, setTrades] = useState<TradeView[]>([]);
  const [managerTeam, setManagerTeam] = useState('Your team');
  const [gameweek, setGameweek] = useState('Current gameweek');
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fixtureFilter, setFixtureFilter] = useState<FixtureFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<MarketPlayer | null>(null);
  const [history, setHistory] = useState<PlayerHistoryResponse | null>(null);
  const [historyStatus, setHistoryStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMode(modeFromPath(currentPath));
  }, [currentPath]);

  useEffect(() => {
    let active = true;

    async function loadMarket() {
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        fetchJson<ApiSummary>('/api/squad/summary'),
        fetchJson<ApiScoutingResponse>('/api/scouting/players'),
        fetchJson<ApiInterest[]>('/api/interests'),
        fetchJson<{ trades?: ApiTrade[] }>('/api/trades'),
      ]);
      if (!active) return;

      const [summaryResult, scoutingResult, interestsResult, tradesResult] = results;
      const errors: string[] = [];
      const summary = getFulfilled(summaryResult, 'squad context', errors);
      const scouting = getFulfilled(scoutingResult, 'player pool', errors);
      const interestPayload = getFulfilled(interestsResult, 'Interests', errors);
      const tradePayload = getFulfilled(tradesResult, 'trade activity', errors);

      if (summary) {
        setManagerTeam(summary.manager_team.name);
        setGameweek(summary.gameweek.name);
      }
      if (scouting) setPlayers(scouting.players.map(mapPlayer));
      if (interestPayload) setInterests(interestPayload.map(mapInterest));
      if (tradePayload) setTrades((tradePayload.trades ?? []).map(mapTrade));
      setLoading(false);
      if (errors.length === 4) {
        setError('Market data is temporarily unavailable. Try again from the shell reload control.');
      } else if (errors.length > 0) {
        setNotice(`Market loaded with ${errors.join(' and ')} unavailable.`);
      } else {
        setNotice('Market data is current for this gameweek.');
      }
    }

    void loadMarket();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlayer) {
      setHistory(null);
      setHistoryStatus('');
      return;
    }

    let active = true;
    setHistory(null);
    setHistoryStatus('Loading official FPL history…');
    void fetchJson<PlayerHistoryResponse>(`/api/fpl/players/${encodeURIComponent(selectedPlayer.id)}/history`)
      .then((response) => {
        if (!active) return;
        setHistory(response);
        setHistoryStatus('');
      })
      .catch(() => {
        if (active) setHistoryStatus('Official FPL history is currently unavailable.');
      });

    drawerRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPlayer(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      active = false;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedPlayer]);

  const interestedPlayerIds = useMemo(
    () => new Set(interests.map((interest) => interest.player.id)),
    [interests],
  );
  const availableCount = players.filter((player) => effectiveStatus(player, interestedPlayerIds, managerTeam) === 'available').length;
  const flaggedCount = players.filter((player) => hasAvailabilityIssue(toAvailabilityInput(player))).length;
  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return players
      .filter((player) => {
        const status = effectiveStatus(player, interestedPlayerIds, managerTeam);
        const matchesQuery = !normalizedQuery
          || player.displayName.toLowerCase().includes(normalizedQuery)
          || player.club.toLowerCase().includes(normalizedQuery)
          || player.position.toLowerCase().includes(normalizedQuery);
        const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
        const matchesStatus = statusFilter === 'all'
          || status === statusFilter
          || (statusFilter === 'risk' && hasAvailabilityIssue(toAvailabilityInput(player)));
        const matchesFixture = fixtureFilter === 'all'
          || (player.nextDifficulty !== null && player.nextDifficulty <= 3);
        return matchesQuery && matchesPosition && matchesStatus && matchesFixture;
      })
      .sort((left, right) => comparePlayers(left, right, sortKey));
  }, [fixtureFilter, interestedPlayerIds, managerTeam, players, positionFilter, query, sortKey, statusFilter]);

  const openPlayer = (player: MarketPlayer) => setSelectedPlayer({
    ...player,
    status: effectiveStatus(player, interestedPlayerIds, managerTeam),
  });

  function selectMode(nextMode: MarketMode) {
    const path = nextMode === 'discover' ? '/scouting' : `/scouting/${nextMode}`;
    onNavigate(path);
  }

  async function registerInterest(player: MarketPlayer) {
    if (pendingAction) return;
    setPendingAction(player.id);
    try {
      const response = await fetch('/api/interests', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.detail ?? 'Unable to add this player to Interests.');
      const interest = mapInterest(payload as ApiInterest);
      setInterests((current) => [...current, interest]);
      setPlayers((current) => current.map((candidate) => candidate.id === player.id ? { ...candidate, status: 'interested' } : candidate));
      setSelectedPlayer((current) => current?.id === player.id ? { ...current, status: 'interested' } : current);
      setNotice(`${player.displayName} added to Interests.`);
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Unable to add this player to Interests.');
    } finally {
      setPendingAction(null);
    }
  }

  async function removeInterest(interest: InterestView) {
    if (pendingAction) return;
    setPendingAction(interest.id);
    try {
      const response = await fetch(`/api/interests/${encodeURIComponent(interest.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? payload.detail ?? 'Unable to remove this Interest.');
      }
      setInterests((current) => current.filter((item) => item.id !== interest.id));
      setNotice(`${interest.player.displayName} removed from Interests.`);
      setSelectedPlayer((current) => current?.id === interest.player.id ? { ...current, status: 'available' } : current);
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Unable to remove this Interest.');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main aria-labelledby="market-page-title" className="feature-screen market-page" data-density={preset.tokens.density}>
      <header className="market-page__header">
        <div>
          <p className="eyebrow">Market</p>
          <h1 id="market-page-title">Find your next move</h1>
          <p className="market-page__intro">Search the player pool, weigh the evidence, and keep your next squad decision focused.</p>
        </div>
        <div aria-label="Market context" className="market-page__context">
          <span aria-hidden="true" className="market-page__team-mark">{initials(managerTeam)}</span>
          <div><strong>{managerTeam}</strong><span>{gameweek}</span></div>
        </div>
      </header>

      {error ? (
        <div className="market-page__error" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <span>{error}</span>
        </div>
      ) : null}
      {notice && !error ? <p className="market-page__status" role="status">{notice}</p> : null}

      <section aria-label="Market actions" className="market-page__action-grid">
        <MarketActionCard
          active={mode === 'discover'}
          detail={`${availableCount} available · ${flaggedCount} need availability review`}
          icon={<Search aria-hidden="true" size={19} />}
          onClick={() => selectMode('discover')}
          title="Find an upgrade"
        />
        <MarketActionCard
          active={mode === 'interests'}
          detail={interests.length > 0 ? `${interests.length} draw Interest${interests.length === 1 ? '' : 's'} to review` : 'Keep a draw shortlist in one place'}
          icon={<Bookmark aria-hidden="true" size={19} />}
          onClick={() => selectMode('interests')}
          title="Review Interests"
        />
        <MarketActionCard
          active={mode === 'trades'}
          detail={trades.length > 0 ? `${trades.length} proposal${trades.length === 1 ? '' : 's'} in activity` : 'No trade proposals waiting'}
          icon={<ArrowRightLeft aria-hidden="true" size={19} />}
          onClick={() => selectMode('trades')}
          title="Review trades"
        />
      </section>

      <section aria-labelledby="market-workspace-title" className="market-page__workspace">
        <header className="market-page__workspace-header">
          <div>
            <p className="eyebrow">Market workspace</p>
            <h2 id="market-workspace-title">{modeTitle(mode)}</h2>
            <p>{modeDescription(mode)}</p>
          </div>
          <div aria-label="Market workspace sections" className="market-page__tabs" role="tablist">
            <WorkspaceTab active={mode === 'discover'} label="Discovery" onSelect={() => selectMode('discover')} />
            <WorkspaceTab active={mode === 'interests'} label="Interests" onSelect={() => selectMode('interests')} />
            <WorkspaceTab active={mode === 'trades'} label="Trades" onSelect={() => selectMode('trades')} />
          </div>
        </header>

        {mode === 'discover' ? (
          <DiscoveryPanel
            filtersOpen={filtersOpen}
            filteredPlayers={filteredPlayers}
            fixtureFilter={fixtureFilter}
            interestedPlayerIds={interestedPlayerIds}
            managerTeam={managerTeam}
            loading={loading}
            onClearFilters={() => {
              setQuery('');
              setPositionFilter('all');
              setStatusFilter('all');
              setFixtureFilter('all');
            }}
            onFixtureFilterChange={setFixtureFilter}
            onFiltersOpenChange={setFiltersOpen}
            onInterest={registerInterest}
            onOpenPlayer={openPlayer}
            onPositionChange={setPositionFilter}
            onQueryChange={setQuery}
            onSortChange={setSortKey}
            onStatusChange={setStatusFilter}
            pendingAction={pendingAction}
            positionFilter={positionFilter}
            query={query}
            sortKey={sortKey}
            statusFilter={statusFilter}
          />
        ) : null}
        {mode === 'interests' ? (
          <InterestsPanel interests={interests} onBrowse={() => selectMode('discover')} onOpenPlayer={openPlayer} onRemove={removeInterest} pendingAction={pendingAction} />
        ) : null}
        {mode === 'trades' ? <TradesPanel onBrowse={() => selectMode('discover')} trades={trades} /> : null}
      </section>

      {selectedPlayer ? (
        <PlayerDrawer
          history={history}
          historyStatus={historyStatus}
          interest={interests.find((item) => item.player.id === selectedPlayer.id) ?? null}
          onAddInterest={() => void registerInterest(selectedPlayer)}
          onClose={() => setSelectedPlayer(null)}
          onNavigate={onNavigate}
          onRemoveInterest={removeInterest}
          pendingAction={pendingAction}
          player={selectedPlayer}
          managerTeam={managerTeam}
          drawerRef={drawerRef}
        />
      ) : null}
    </main>
  );
}

function DiscoveryPanel({
  filteredPlayers,
  filtersOpen,
  fixtureFilter,
  interestedPlayerIds,
  managerTeam,
  loading,
  onClearFilters,
  onFixtureFilterChange,
  onFiltersOpenChange,
  onInterest,
  onOpenPlayer,
  onPositionChange,
  onQueryChange,
  onSortChange,
  onStatusChange,
  pendingAction,
  positionFilter,
  query,
  sortKey,
  statusFilter,
}: {
  filteredPlayers: MarketPlayer[];
  filtersOpen: boolean;
  fixtureFilter: FixtureFilter;
  interestedPlayerIds: Set<string>;
  managerTeam: string;
  loading: boolean;
  onClearFilters: () => void;
  onFixtureFilterChange: (value: FixtureFilter) => void;
  onFiltersOpenChange: (open: boolean) => void;
  onInterest: (player: MarketPlayer) => Promise<void>;
  onOpenPlayer: (player: MarketPlayer) => void;
  onPositionChange: (value: PositionFilter) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  onStatusChange: (value: StatusFilter) => void;
  pendingAction: string | null;
  positionFilter: PositionFilter;
  query: string;
  sortKey: SortKey;
  statusFilter: StatusFilter;
}) {
  const hasFilters = Boolean(query.trim()) || positionFilter !== 'all' || statusFilter !== 'all' || fixtureFilter !== 'all';
  return (
    <div className="market-page__discovery">
      <div className="market-page__toolbar">
        <label className="market-page__search">
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">Search players</span>
          <input aria-label="Search market players" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search player, club or position" value={query} />
        </label>
        <button aria-expanded={filtersOpen} aria-label="Open market filters" className="market-page__filter-button" onClick={() => onFiltersOpenChange(!filtersOpen)} type="button">
          <Filter aria-hidden="true" size={17} />
          <span>Filters</span>
        </button>
        <label className="market-page__sort"><span className="sr-only">Sort players by</span><select aria-label="Sort players by" onChange={(event) => onSortChange(event.target.value as SortKey)} value={sortKey}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>

      {filtersOpen ? (
        <div aria-label="Market filters" className="market-page__filter-drawer">
          <label><span>Position</span><select aria-label="Filter market by position" onChange={(event) => onPositionChange(event.target.value as PositionFilter)} value={positionFilter}>{positionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>Ownership</span><select aria-label="Filter market by ownership" onChange={(event) => onStatusChange(event.target.value as StatusFilter)} value={statusFilter}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>Next fixtures</span><select aria-label="Filter market by fixture difficulty" onChange={(event) => onFixtureFilterChange(event.target.value as FixtureFilter)} value={fixtureFilter}><option value="all">Any difficulty</option><option value="easy">FDR 1–3 only</option></select></label>
          {hasFilters ? <Button onClick={onClearFilters} type="button" variant="ghost">Clear filters</Button> : null}
        </div>
      ) : null}

      <div className="market-page__result-bar">
        <div><strong>{loading ? 'Loading player pool…' : `${filteredPlayers.length} player${filteredPlayers.length === 1 ? '' : 's'}`}</strong><span>{hasFilters ? 'Matching your filters' : 'Ranked by total points'}</span></div>
        <span className="market-page__data-note"><Shield aria-hidden="true" size={14} /> Official FPL evidence</span>
      </div>

      {loading ? <div className="market-page__empty" role="status"><Search aria-hidden="true" size={22} /><strong>Loading the player pool</strong><span>Pulling the latest available market evidence.</span></div> : null}
      {!loading && filteredPlayers.length === 0 ? <div className="market-page__empty"><Search aria-hidden="true" size={22} /><strong>No players match these filters</strong><span>Clear a filter or broaden your search to keep exploring.</span>{hasFilters ? <Button onClick={onClearFilters} type="button" variant="secondary">Clear filters</Button> : null}</div> : null}
      {!loading && filteredPlayers.length > 0 ? (
        <div className="market-page__table-wrap">
          <table aria-label="Market player results" className="market-page__player-table">
            <caption className="sr-only">Market player results</caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Pts</th>
                <th scope="col">Form</th>
                <th className="market-page__expected-heading" scope="col">xG / xA</th>
                <th scope="col">Next</th>
                <th className="market-page__availability-heading" scope="col">Status</th>
                <th className="market-page__action-heading" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <MarketPlayerRow
                  interested={interestedPlayerIds.has(player.id)}
                  managerTeam={managerTeam}
                  key={player.id}
                  onInterest={onInterest}
                  onOpen={onOpenPlayer}
                  pendingAction={pendingAction}
                  player={player}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function MarketPlayerRow({ interested, managerTeam, onInterest, onOpen, pendingAction, player }: { interested: boolean; managerTeam: string; onInterest: (player: MarketPlayer) => Promise<void>; onOpen: (player: MarketPlayer) => void; pendingAction: string | null; player: MarketPlayer }) {
  const status = interested ? 'interested' : effectiveStatus(player, new Set(), managerTeam);
  const canInterest = status !== 'owned' && status !== 'interested';
  return (
    <tr className="market-page__player-row">
      <td className="market-page__player-cell">
        <button aria-label={`View ${player.displayName} details`} className="market-page__player-identity" onClick={() => onOpen(player)} type="button">
          <PositionMarker position={player.position} />
          <TeamShirt team={player.club} />
          <span><strong>{player.displayName}</strong><small>{positionLabel(player.position)} · {player.club}</small></span>
        </button>
      </td>
      <td><Metric hideLabel label="Pts" value={formatInteger(player.points)} /></td>
      <td><Metric dots hideLabel value={player.form} label="Form" /></td>
      <td className="market-page__metric--expected"><Metric hideLabel label="xG / xA" value={`${formatMetric(player.xg)} / ${formatMetric(player.xa)}`} /></td>
      <td><div className="market-page__fixture"><span className="market-page__fixture-full">{formatFixture(player)}</span><span className="market-page__fixture-compact">{formatCompactFixture(player)}</span>{player.nextDifficulty === null ? <small className="is-placeholder">FDR —</small> : <small className={`fdr-band-${player.nextDifficulty}`}>FDR {player.nextDifficulty}</small>}</div></td>
      <td className="market-page__availability"><StatusBadge player={player} status={status} /></td>
      <td className="market-page__action-cell"><div className="market-page__row-action">
        {canInterest ? <Button aria-label={`Add ${player.displayName} to Interests`} disabled={pendingAction === player.id} onClick={() => void onInterest(player)} type="button" variant="secondary"><Star aria-hidden="true" size={14} />{pendingAction === player.id ? 'Adding…' : 'Interest'}</Button> : <button aria-label={`View ${player.displayName} details`} className="market-page__icon-button" onClick={() => onOpen(player)} type="button"><ChevronRight aria-hidden="true" size={18} /></button>}
      </div></td>
    </tr>
  );
}

function InterestsPanel({ interests, onBrowse, onOpenPlayer, onRemove, pendingAction }: { interests: InterestView[]; onBrowse: () => void; onOpenPlayer: (player: MarketPlayer) => void; onRemove: (interest: InterestView) => Promise<void>; pendingAction: string | null }) {
  return (
    <section aria-label="Your Interests" className="market-page__activity-panel">
      <div className="market-page__explainer"><Bookmark aria-hidden="true" size={20} /><div><strong>Interests are draw preferences</strong><span>They keep a player on your current shortlist. They do not add a player to your squad or act as a general watchlist.</span></div></div>
      {interests.length === 0 ? <EmptyActivity icon={<Bookmark aria-hidden="true" size={23} />} onAction={onBrowse} action="Find a player" title="Your shortlist is empty" description="Start in Discovery, then add players you would want to prioritise in a draw." /> : <div className="market-page__activity-list">{interests.map((interest) => <article className="market-page__activity-row" key={interest.id}><button aria-label={`View ${interest.player.displayName} details`} className="market-page__player-identity" onClick={() => onOpenPlayer(interest.player)} type="button"><PositionMarker position={interest.player.position} /><TeamShirt team={interest.player.club} /><span><strong>{interest.player.displayName}</strong><small>{interest.player.club} · {interest.gameweekName ?? 'Current gameweek'}</small></span></button><StatusBadge player={interest.player} status="interested" /><Button aria-label={`Remove ${interest.player.displayName} from Interests`} disabled={pendingAction === interest.id} onClick={() => void onRemove(interest)} type="button" variant="ghost">{pendingAction === interest.id ? 'Removing…' : 'Remove'}</Button></article>)}</div>}
    </section>
  );
}

function TradesPanel({ onBrowse, trades }: { onBrowse: () => void; trades: TradeView[] }) {
  if (trades.length === 0) return <EmptyActivity icon={<ArrowRightLeft aria-hidden="true" size={23} />} onAction={onBrowse} action="Browse players" title="No trade proposals to review" description="When a proposal is sent or received, its status and player movement will appear here." />;
  return <section aria-label="Trade activity" className="market-page__activity-list">{trades.map((trade) => <article className="market-page__trade-row" key={trade.id}><span className="market-page__trade-icon"><ArrowRightLeft aria-hidden="true" size={18} /></span><div><strong>{trade.assetNames.length > 0 ? trade.assetNames.join(' ↔ ') : 'Player trade proposal'}</strong><span>{trade.offeredBy ?? 'Another manager'} → {trade.offeredTo ?? 'Your team'}</span></div><StatusBadge player={null} status={trade.status} /></article>)}</section>;
}

function PlayerDrawer({ drawerRef, history, historyStatus, interest, managerTeam, onAddInterest, onClose, onNavigate, onRemoveInterest, pendingAction, player }: { drawerRef: MutableRefObject<HTMLElement | null>; history: PlayerHistoryResponse | null; historyStatus: string; interest: InterestView | null; managerTeam: string; onAddInterest: () => void; onClose: () => void; onNavigate: (href: string) => void; onRemoveInterest: (interest: InterestView) => Promise<void>; pendingAction: string | null; player: MarketPlayer }) {
  const status = interest ? 'interested' : effectiveStatus(player, new Set(), managerTeam);
  const issue = availabilityIssueLabel(toAvailabilityInput(player));
  return (
    <div className="market-page__drawer-layer"><button aria-label="Close player details" className="market-page__drawer-backdrop" onClick={onClose} type="button" /><aside aria-labelledby="market-player-detail-title" aria-modal="true" className="market-page__drawer" ref={drawerRef} role="dialog" tabIndex={-1}><span aria-hidden="true" className="market-page__sheet-handle" /><header className="market-page__drawer-header"><TeamShirt large team={player.club} /><div><p className="eyebrow">Player evidence</p><h2 id="market-player-detail-title">{player.displayName}</h2><span><PositionMarker position={player.position} /> {positionLabel(player.position)} · {player.club}</span></div><button aria-label="Close player details" className="market-page__icon-button" onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header><section aria-label="Player metrics" className="market-page__detail-metrics"><Metric label="Total points" value={formatInteger(player.points)} /><Metric dots label="Form" value={player.form} /><Metric label="xG" value={formatMetric(player.xg)} /><Metric label="xA" value={formatMetric(player.xa)} /><Metric label="Value" value={player.value === null ? '—' : `£${player.value.toFixed(1)}m`} /><Metric label="Selected" value={player.selectedPercent === null ? '—' : `${formatMetric(player.selectedPercent)}%`} /></section><section className="market-page__drawer-section"><h3>Next fixture</h3><p>{formatFixture(player)}{player.nextDifficulty === null ? '' : ` · FDR ${player.nextDifficulty}`}</p></section><section className="market-page__drawer-section"><h3>Availability</h3><p>{issue ? issue : 'No current availability flag from official FPL data.'}{player.availabilityNews ? ` ${player.availabilityNews}` : ''}</p></section><section className="market-page__drawer-section"><h3>Recent FPL history</h3>{historyStatus ? <p role="status">{historyStatus}</p> : null}{history?.history.length ? <div aria-label="Recent FPL gameweek history" className="market-page__history"><table><thead><tr><th>GW</th><th>Pts</th><th>Min</th><th>xG</th><th>xA</th></tr></thead><tbody>{history.history.slice(-5).reverse().map((row) => <tr key={row.gameweek}><td>{row.gameweek}</td><td><strong>{row.total_points}</strong></td><td>{row.minutes}</td><td>{row.expected_goals.toFixed(2)}</td><td>{row.expected_assists.toFixed(2)}</td></tr>)}</tbody></table></div> : null}{history && history.history.length === 0 ? <p>No completed gameweek history is available.</p> : null}</section><footer className="market-page__drawer-actions">{status === 'owned' ? <Button onClick={() => { onClose(); onNavigate('/squad'); }} type="button"><Users aria-hidden="true" size={16} />View in Squad</Button> : null}{status === 'interested' && interest ? <Button disabled={pendingAction === interest.id} onClick={() => void onRemoveInterest(interest)} type="button" variant="secondary">{pendingAction === interest.id ? 'Removing…' : 'Remove Interest'}</Button> : null}{status !== 'owned' && status !== 'interested' ? <Button disabled={pendingAction === player.id} onClick={onAddInterest} type="button"><Star aria-hidden="true" size={16} />{pendingAction === player.id ? 'Adding…' : 'Add to Interests'}</Button> : null}<Button onClick={onClose} type="button" variant="ghost">Close</Button></footer></aside></div>
  );
}

function MarketActionCard({ active, detail, icon, onClick, title }: { active: boolean; detail: string; icon: ReactNode; onClick: () => void; title: string }) {
  return <button className={`market-page__action-card${active ? ' is-active' : ''}`} onClick={onClick} type="button"><span className="market-page__action-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight aria-hidden="true" size={17} /></button>;
}

function WorkspaceTab({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  return <button aria-selected={active} className={`market-page__tab${active ? ' is-active' : ''}`} onClick={onSelect} role="tab" type="button">{label}</button>;
}

function EmptyActivity({ action, description, icon, onAction, title }: { action: string; description: string; icon: ReactNode; onAction: () => void; title: string }) {
  return <div className="market-page__empty market-page__empty--activity"><span className="market-page__empty-icon">{icon}</span><strong>{title}</strong><span>{description}</span><Button onClick={onAction} type="button">{action}<ArrowRight aria-hidden="true" size={16} /></Button></div>;
}

function Metric({ className = '', dots = false, hideLabel = false, label, value }: { className?: string; dots?: boolean; hideLabel?: boolean; label: string; value: number | string | null }) {
  return <div className={`market-page__metric ${className}`.trim()}>{hideLabel ? null : <span>{label}</span>}<strong>{typeof value === 'number' ? formatMetric(value) : value ?? '—'}</strong>{dots ? <FormDots value={typeof value === 'number' ? value : null} /> : null}</div>;
}

function StatusBadge({ player, status }: { player: MarketPlayer | null; status: string }) {
  const issue = player ? availabilityIssueLabel(toAvailabilityInput(player)) : null;
  const label = issue && status !== 'owned' ? issue : formatStatus(status, player);
  const shortLabel = issue && status !== 'owned' ? 'Risk' : formatShortStatus(status, player);
  const icon = issue ? <CircleAlert aria-hidden="true" size={13} /> : status === 'available' ? <CircleCheck aria-hidden="true" size={13} /> : null;
  return <span className={`market-page__status-badge status-${status}`}>{icon}<span className="market-page__status-full">{label}</span><span className="market-page__status-short">{shortLabel}</span></span>;
}

function FormDots({ value }: { value: number | null }) {
  const active = value === null || Number.isNaN(value) ? 0 : Math.max(0, Math.min(5, Math.round(value / 2)));
  const band = formBand(value);
  return <span aria-hidden="true" className={`market-page__form-dots form-band-${band}`}>{Array.from({ length: 5 }, (_, index) => <i className={index < active ? 'active' : ''} key={index} />)}</span>;
}

function PositionMarker({ position }: { position: string }) {
  return <span aria-hidden="true" className={`market-page__position-marker position-${position.toLowerCase()}`} title={`${positionLabel(position)} player`} />;
}

function TeamShirt({ large = false, team }: { large?: boolean; team: string }) {
  const fallback = `/team-shirts/${team.trim().toLowerCase()}.svg`;
  return <img alt="" aria-hidden="true" className={`market-page__shirt${large ? ' large' : ''}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/team-shirts/unknown.svg'; }} src={officialFplShirtUrl(team, large) ?? fallback} />;
}

function modeFromPath(path: string): MarketMode {
  if (path.startsWith('/scouting/interests')) return 'interests';
  if (path.startsWith('/scouting/trades')) return 'trades';
  return 'discover';
}

function modeTitle(mode: MarketMode): string {
  if (mode === 'interests') return 'Your Interests';
  if (mode === 'trades') return 'Trade activity';
  return 'Player discovery';
}

function modeDescription(mode: MarketMode): string {
  if (mode === 'interests') return 'Keep draw preferences visible without confusing them with ownership or a general watchlist.';
  if (mode === 'trades') return 'Review proposals and negotiation activity that may change your squad.';
  return 'Start with the players you can act on, then open the evidence before choosing a next step.';
}

function mapPlayer(player: SquadApiPlayer): MarketPlayer {
  const fixture = player.next_fixture ?? null;
  return {
    id: player.id,
    displayName: player.display_name,
    position: normalizePosition(player.position),
    club: player.epl_team.short_name ?? player.epl_team.name,
    status: player.status,
    draftTeamName: player.draft_team?.name ?? null,
    points: numberOrNull(player.points),
    form: numberOrNull(player.form),
    value: numberOrNull(player.value),
    xg: numberOrNull(player.expected_goals),
    xa: numberOrNull(player.expected_assists),
    selectedPercent: numberOrNull(player.selected_by_percent),
    nextOpponent: fixture?.opponent.short_name ?? fixture?.opponent.name ?? null,
    nextDifficulty: numberOrNull(fixture?.difficulty),
    nextFixtureIsHome: fixture?.is_home ?? null,
    availability: player.availability_status ?? null,
    availabilityNews: player.availability_news ?? null,
    chanceOfPlaying: numberOrNull(player.chance_of_playing_next_round),
  };
}

function mapInterest(interest: ApiInterest): InterestView {
  return { id: interest.id, player: mapPlayer(interest.player), gameweekName: interest.gameweek?.name ?? null, note: interest.note ?? null };
}

function mapTrade(trade: ApiTrade): TradeView {
  return { id: trade.id, status: trade.status, offeredBy: trade.offered_by?.name ?? null, offeredTo: trade.offered_to?.name ?? null, assetNames: (trade.assets ?? []).map((asset) => asset.player?.display_name ?? '').filter(Boolean) };
}

function effectiveStatus(player: MarketPlayer, interestedPlayerIds: Set<string>, managerTeam: string): MarketPlayer['status'] {
  if (interestedPlayerIds.has(player.id) && player.status !== 'owned') return 'interested';
  if (player.status === 'owned' && player.draftTeamName && player.draftTeamName !== managerTeam) return 'owned_by_other';
  return player.status;
}

function toAvailabilityInput(player: MarketPlayer) {
  return { availability_status: player.availability, availability_news: player.availabilityNews, chance_of_playing_next_round: player.chanceOfPlaying };
}

function comparePlayers(left: MarketPlayer, right: MarketPlayer, key: SortKey): number {
  const leftValue = key === 'points' ? left.points : key === 'form' ? left.form : key === 'xg' ? left.xg : key === 'xa' ? left.xa : left.value;
  const rightValue = key === 'points' ? right.points : key === 'form' ? right.form : key === 'xg' ? right.xg : key === 'xa' ? right.xa : right.value;
  if (leftValue === null && rightValue === null) return left.displayName.localeCompare(right.displayName);
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return rightValue - leftValue || left.displayName.localeCompare(right.displayName);
}

function formatStatus(status: string, player: MarketPlayer | null): string {
  if (status === 'owned') return 'In your squad';
  if (status === 'owned_by_other') return player?.draftTeamName ? `Owned by ${player.draftTeamName}` : 'Owned by another team';
  if (status === 'interested') return 'In Interests';
  if (status === 'trade_target') return 'Trade target';
  if (status === 'proposed') return 'Needs review';
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  return player?.draftTeamName ? `Owned by ${player.draftTeamName}` : 'Available';
}

function formatShortStatus(status: string, player: MarketPlayer | null): string {
  if (status === 'owned') return 'Squad';
  if (status === 'owned_by_other') return 'Owned';
  if (status === 'interested') return 'Interest';
  if (status === 'trade_target') return 'Trade';
  if (status === 'proposed') return 'Review';
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  return player?.draftTeamName ? 'Owned' : 'Available';
}

function formatFixture(player: MarketPlayer): string {
  if (!player.nextOpponent) return 'Next fixture —';
  return `${player.nextOpponent} · ${player.nextFixtureIsHome === false ? 'A' : 'H'}`;
}

function formatCompactFixture(player: MarketPlayer): string {
  if (!player.nextOpponent) return '—';
  return `${player.nextOpponent} ${player.nextFixtureIsHome === false ? 'A' : 'H'}`;
}

function formatInteger(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : String(Math.round(value));
}

function formatMetric(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(1);
}

function formBand(value: number | null): 'negative' | 'low' | 'steady' | 'high' | 'unknown' {
  if (value === null || Number.isNaN(value)) return 'unknown';
  if (value < 0) return 'negative';
  if (value < 4) return 'low';
  if (value < 10) return 'steady';
  return 'high';
}

function positionLabel(position: string): string {
  return ({ GKP: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' } as Record<string, string>)[position] ?? position;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === 'GK' ? 'GKP' : normalized;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CD';
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : `Request failed with ${response.status}.`);
  return payload as T;
}

function getFulfilled<T>(result: PromiseSettledResult<T>, label: string, errors: string[]): T | null {
  if (result.status === 'fulfilled') return result.value;
  errors.push(label);
  return null;
}
