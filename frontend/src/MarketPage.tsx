import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Bookmark,
  CircleAlert,
  Filter,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { FormDots, PlayerCard, type PlayerCardPlayer } from './components/player/PlayerCard';
import { PageHero, PageHeroControls, PageHeroViewToggle } from './components/ui/page-hero';
import type { ThemePreset } from './contracts';
import { managerNicknameForTeam } from './manager-nicknames';
import type { SquadApiPlayer } from './squad-api';
import './market-page.css';

interface MarketPageProps {
  currentPath: string;
  onNavigate: (href: string) => void;
  preset: ThemePreset;
}

type MarketMode = 'discover' | 'interests' | 'trades';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type FixtureFilter = 'all' | 'easy';
type SortKey = 'points' | 'form' | 'xg' | 'xa' | 'value';

interface MarketPlayer {
  id: string;
  displayName: string;
  position: string;
  club: string;
  status: SquadApiPlayer['status'] | 'owned_by_other';
  draftTeamName: string | null;
  ownerName: string | null;
  points: number | null;
  form: number | null;
  value: number | null;
  xg: number | null;
  xa: number | null;
  selectedPercent: number | null;
  nextDifficulty: number | null;
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
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
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
      }
      if (scouting) setPlayers(scouting.players.map(mapPlayer));
      if (interestPayload) setInterests(interestPayload.map(mapInterest));
      if (tradePayload) setTrades((tradePayload.trades ?? []).map(mapTrade));
      setLoading(false);
      if (errors.length === 4) {
        setError('Market data is temporarily unavailable. Try again from the shell reload control.');
      } else if (errors.length > 0) {
        setNotice(`Unavailable: ${errors.join(' and ')}.`);
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
  const filteredPlayers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return players
      .filter((player) => {
        const matchesQuery = !normalizedQuery
          || player.displayName.toLowerCase().includes(normalizedQuery)
          || player.club.toLowerCase().includes(normalizedQuery)
          || player.position.toLowerCase().includes(normalizedQuery);
        const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
        const matchesFixture = fixtureFilter === 'all'
          || (player.nextDifficulty !== null && player.nextDifficulty <= 3);
        return matchesQuery && matchesPosition && matchesFixture;
      })
      .sort((left, right) => comparePlayers(left, right, sortKey));
  }, [fixtureFilter, players, positionFilter, query, sortKey]);

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
      <PageHero
        actions={(
          <PageHeroControls>
            <PageHeroViewToggle
              ariaLabel="Market workspace sections"
              onChange={(nextMode) => selectMode(nextMode as MarketMode)}
              options={[
                { value: 'discover', label: 'Discovery', icon: <Search aria-hidden="true" size={17} /> },
                { value: 'interests', label: 'Interests', icon: <Bookmark aria-hidden="true" size={17} /> },
                { value: 'trades', label: 'Trades', icon: <ArrowRightLeft aria-hidden="true" size={17} /> },
              ]}
              value={mode}
            />
          </PageHeroControls>
        )}
        actionsLabel="Market utilities"
        onNavigate={onNavigate}
        title="Market"
        titleId="market-page-title"
      />

      {error ? (
        <div className="market-page__error" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <span>{error}</span>
        </div>
      ) : null}
      {notice && !error ? <p className="market-page__status" role="status">{notice}</p> : null}

      <section className="market-page__workspace">
        {mode === 'discover' ? (
          <DiscoveryPanel
            filtersOpen={filtersOpen}
            filteredPlayers={filteredPlayers}
            fixtureFilter={fixtureFilter}
            loading={loading}
            onClearFilters={() => {
              setQuery('');
              setPositionFilter('all');
              setFixtureFilter('all');
            }}
            onFixtureFilterChange={setFixtureFilter}
            onFiltersOpenChange={setFiltersOpen}
            onOpenPlayer={openPlayer}
            onPositionChange={setPositionFilter}
            onQueryChange={setQuery}
            onSortChange={setSortKey}
            positionFilter={positionFilter}
            query={query}
            sortKey={sortKey}
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
  loading,
  onClearFilters,
  onFixtureFilterChange,
  onFiltersOpenChange,
  onOpenPlayer,
  onPositionChange,
  onQueryChange,
  onSortChange,
  positionFilter,
  query,
  sortKey,
}: {
  filteredPlayers: MarketPlayer[];
  filtersOpen: boolean;
  fixtureFilter: FixtureFilter;
  loading: boolean;
  onClearFilters: () => void;
  onFixtureFilterChange: (value: FixtureFilter) => void;
  onFiltersOpenChange: (open: boolean) => void;
  onOpenPlayer: (player: MarketPlayer) => void;
  onPositionChange: (value: PositionFilter) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  positionFilter: PositionFilter;
  query: string;
  sortKey: SortKey;
}) {
  const hasFilters = Boolean(query.trim()) || positionFilter !== 'all' || fixtureFilter !== 'all';
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
          <label><span>Next fixtures</span><select aria-label="Filter market by fixture difficulty" onChange={(event) => onFixtureFilterChange(event.target.value as FixtureFilter)} value={fixtureFilter}><option value="all">Any difficulty</option><option value="easy">FDR 1–3 only</option></select></label>
          {hasFilters ? <Button onClick={onClearFilters} type="button" variant="ghost">Clear filters</Button> : null}
        </div>
      ) : null}

      <div className="market-page__result-bar">
        <strong>{loading ? 'Loading players…' : `${filteredPlayers.length} player${filteredPlayers.length === 1 ? '' : 's'}`}</strong>
      </div>

      {loading ? <MarketLoadingTable /> : null}
      {!loading && filteredPlayers.length === 0 ? <div className="market-page__empty"><Search aria-hidden="true" size={22} /><strong>No players found</strong>{hasFilters ? <Button onClick={onClearFilters} type="button" variant="secondary">Clear filters</Button> : null}</div> : null}
      {!loading && filteredPlayers.length > 0 ? (
        <div className="market-page__table-wrap">
          <table aria-label="Market player results" className="market-page__player-table">
            <caption className="sr-only">Market player results</caption>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Pts</th>
                <th scope="col">xG / xA</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <MarketPlayerRow
                  key={player.id}
                  onOpen={onOpenPlayer}
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

function MarketLoadingTable() {
  return (
    <div aria-label="Loading market players" className="market-page__table-wrap market-page__table-wrap--loading" role="status">
      <table aria-hidden="true" className="market-page__player-table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Pts</th>
            <th scope="col">xG / xA</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 7 }, (_, index) => (
            <tr className="market-page__loading-row" key={index}>
              <td><span className="market-page__loading-block market-page__loading-block--player" /></td>
              <td><span className="market-page__loading-block market-page__loading-block--number" /></td>
              <td><span className="market-page__loading-block" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketPlayerRow({ onOpen, player }: { onOpen: (player: MarketPlayer) => void; player: MarketPlayer }) {
  const rowLabel = `View ${player.displayName} details`;
  return (
    <tr
      aria-label={rowLabel}
      className="market-page__player-row"
      onClick={() => onOpen(player)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(player);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <td className="market-page__player-cell">
        <div className="market-page__player-identity">
          <PlayerCard className="market-page__list-player-card" formPosition="beside" layout="list" player={toPlayerCardPlayer(player)} showPositionMarker={false} size="sm" />
        </div>
      </td>
      <td><strong className="market-page__list-points">{formatInteger(player.points)}</strong></td>
      <td><span className="market-page__expected"><span>{formatMetric(player.xg)}</span><span>{formatMetric(player.xa)}</span></span></td>
    </tr>
  );
}

function InterestsPanel({ interests, onBrowse, onOpenPlayer, onRemove, pendingAction }: { interests: InterestView[]; onBrowse: () => void; onOpenPlayer: (player: MarketPlayer) => void; onRemove: (interest: InterestView) => Promise<void>; pendingAction: string | null }) {
  return (
    <section aria-label="Your Interests" className="market-page__activity-panel">
      {interests.length === 0 ? <EmptyActivity icon={<Bookmark aria-hidden="true" size={23} />} onAction={onBrowse} action="Find a player" title="No Interests" /> : <div className="market-page__activity-list">{interests.map((interest) => <article className="market-page__activity-row" key={interest.id}><button aria-label={`View ${interest.player.displayName} details`} className="market-page__player-identity" onClick={() => onOpenPlayer(interest.player)} type="button"><PlayerCard formPosition="beside" layout="list" player={toPlayerCardPlayer(interest.player)} showPositionMarker={false} size="xs" /></button><Button aria-label={`Remove ${interest.player.displayName} from Interests`} disabled={pendingAction === interest.id} onClick={() => void onRemove(interest)} type="button" variant="ghost">{pendingAction === interest.id ? 'Removing…' : 'Remove'}</Button></article>)}</div>}
    </section>
  );
}

function TradesPanel({ onBrowse, trades }: { onBrowse: () => void; trades: TradeView[] }) {
  if (trades.length === 0) return <EmptyActivity icon={<ArrowRightLeft aria-hidden="true" size={23} />} onAction={onBrowse} action="Browse players" title="No trade proposals" />;
  return <section aria-label="Trade activity" className="market-page__activity-list">{trades.map((trade) => <article className="market-page__trade-row" key={trade.id}><span className="market-page__trade-icon"><ArrowRightLeft aria-hidden="true" size={18} /></span><div><strong>{trade.assetNames.length > 0 ? trade.assetNames.join(' ↔ ') : 'Player trade proposal'}</strong><span>{trade.offeredBy ?? 'Another manager'} → {trade.offeredTo ?? 'Your team'}</span><StatusBadge status={trade.status} /></div></article>)}</section>;
}

function PlayerDrawer({ drawerRef, history, historyStatus, interest, managerTeam, onAddInterest, onClose, onNavigate, onRemoveInterest, pendingAction, player }: { drawerRef: MutableRefObject<HTMLElement | null>; history: PlayerHistoryResponse | null; historyStatus: string; interest: InterestView | null; managerTeam: string; onAddInterest: () => void; onClose: () => void; onNavigate: (href: string) => void; onRemoveInterest: (interest: InterestView) => Promise<void>; pendingAction: string | null; player: MarketPlayer }) {
  const status = interest ? 'interested' : effectiveStatus(player, new Set(), managerTeam);
  return (
    <div className="market-page__drawer-layer"><button aria-label="Close player details" className="market-page__drawer-backdrop" onClick={onClose} type="button" /><aside aria-labelledby="market-player-detail-title" aria-modal="true" className="market-page__drawer" ref={drawerRef} role="dialog" tabIndex={-1}><span aria-hidden="true" className="market-page__sheet-handle" /><header className="market-page__drawer-header"><PlayerCard formPosition="hidden" layout="token" player={toPlayerCardPlayer(player)} showOpponent={false} showPositionMarker={false} size="lg" /><div><h2 id="market-player-detail-title">{player.displayName}</h2><span>{positionLabel(player.position)} · {player.club}</span></div><button aria-label="Close player details" className="market-page__icon-button" onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header><section aria-label="Player metrics" className="market-page__detail-metrics"><Metric label="Total points" value={formatInteger(player.points)} /><Metric dots label="Form" value={player.form} /><Metric label="xG" value={formatMetric(player.xg)} /><Metric label="xA" value={formatMetric(player.xa)} /><Metric label="Value" value={player.value === null ? '—' : `£${player.value.toFixed(1)}m`} /><Metric label="Selected" value={player.selectedPercent === null ? '—' : `${formatMetric(player.selectedPercent)}%`} /></section><section className="market-page__drawer-section"><h3>Owner</h3><p className="market-page__owner-value">{ownerLabel(player)}</p></section><section className="market-page__drawer-section"><h3>Recent FPL history</h3>{historyStatus ? <p role="status">{historyStatus}</p> : null}{history?.history.length ? <div aria-label="Recent FPL gameweek history" className="market-page__history"><table><thead><tr><th>GW</th><th>Pts</th><th>Min</th><th>xG</th><th>xA</th></tr></thead><tbody>{history.history.slice(-5).reverse().map((row) => <tr key={row.gameweek}><td>{row.gameweek}</td><td><strong>{row.total_points}</strong></td><td>{row.minutes}</td><td>{row.expected_goals.toFixed(2)}</td><td>{row.expected_assists.toFixed(2)}</td></tr>)}</tbody></table></div> : null}{history && history.history.length === 0 ? <p>No completed gameweek history is available.</p> : null}</section><footer className="market-page__drawer-actions">{status === 'owned' ? <Button onClick={() => { onClose(); onNavigate('/squad'); }} type="button"><Users aria-hidden="true" size={16} />View in Squad</Button> : null}{status === 'interested' && interest ? <Button aria-label={`Remove ${player.displayName} from Interests`} disabled={pendingAction === interest.id} onClick={() => void onRemoveInterest(interest)} type="button" variant="secondary">{pendingAction === interest.id ? 'Removing…' : 'Remove Interest'}</Button> : null}{status !== 'owned' && status !== 'interested' ? <Button aria-label={`Add ${player.displayName} to Interests`} disabled={pendingAction === player.id} onClick={onAddInterest} type="button"><Star aria-hidden="true" size={16} />{pendingAction === player.id ? 'Adding…' : 'Add to Interests'}</Button> : null}<Button onClick={onClose} type="button" variant="ghost">Close</Button></footer></aside></div>
  );
}

function EmptyActivity({ action, icon, onAction, title }: { action: string; icon: ReactNode; onAction: () => void; title: string }) {
  return <div className="market-page__empty market-page__empty--activity"><span className="market-page__empty-icon">{icon}</span><strong>{title}</strong><Button onClick={onAction} type="button">{action}<ArrowRight aria-hidden="true" size={16} /></Button></div>;
}

function Metric({ className = '', dots = false, hideLabel = false, label, value }: { className?: string; dots?: boolean; hideLabel?: boolean; label: string; value: number | string | null }) {
  return <div className={`market-page__metric ${className}`.trim()}>{hideLabel ? null : <span>{label}</span>}<strong>{typeof value === 'number' ? formatMetric(value) : value ?? '—'}</strong>{dots ? <FormDots value={typeof value === 'number' ? value : null} /> : null}</div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`market-page__status-badge status-${status}`}>{formatTradeStatus(status)}</span>;
}

function toPlayerCardPlayer(player: MarketPlayer): PlayerCardPlayer {
  return {
    displayName: player.displayName,
    fixtures: [{ label: ownerLabel(player), title: player.ownerName ? `Owned by ${player.ownerName}` : 'Free player' }],
    form: player.form,
    position: player.position,
    team: player.club,
  };
}

function ownerLabel(player: MarketPlayer): string {
  return player.ownerName ?? 'Free';
}

function modeFromPath(path: string): MarketMode {
  if (path.startsWith('/scouting/interests')) return 'interests';
  if (path.startsWith('/scouting/trades')) return 'trades';
  return 'discover';
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
    ownerName: player.draft_team
      ? managerNicknameForTeam({ id: player.draft_team.id, name: player.draft_team.name })
      : null,
    points: numberOrNull(player.points),
    form: numberOrNull(player.form),
    value: numberOrNull(player.value),
    xg: numberOrNull(player.expected_goals),
    xa: numberOrNull(player.expected_assists),
    selectedPercent: numberOrNull(player.selected_by_percent),
    nextDifficulty: numberOrNull(fixture?.difficulty),
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

function comparePlayers(left: MarketPlayer, right: MarketPlayer, key: SortKey): number {
  const leftValue = key === 'points' ? left.points : key === 'form' ? left.form : key === 'xg' ? left.xg : key === 'xa' ? left.xa : left.value;
  const rightValue = key === 'points' ? right.points : key === 'form' ? right.form : key === 'xg' ? right.xg : key === 'xa' ? right.xa : right.value;
  if (leftValue === null && rightValue === null) return left.displayName.localeCompare(right.displayName);
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return rightValue - leftValue || left.displayName.localeCompare(right.displayName);
}

function formatTradeStatus(status: string): string {
  if (status === 'trade_target') return 'Trade target';
  if (status === 'proposed') return 'Needs review';
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

function formatInteger(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : String(Math.round(value));
}

function formatMetric(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(1);
}

function positionLabel(position: string): string {
  return ({ GKP: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' } as Record<string, string>)[position] ?? position;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === 'GK' ? 'GKP' : normalized;
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
