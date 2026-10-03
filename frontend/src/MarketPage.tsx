import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Bookmark,
  ChartNoAxesCombined,
  CircleAlert,
  Filter,
  ListOrdered,
  MoveDown,
  MoveUp,
  Search,
  Star,
  Users,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { FormDots, PlayerCard, type PlayerCardFixtureTone, type PlayerCardFormGameweek, type PlayerCardPlayer } from './components/player/PlayerCard';
import { PageHero, PageHeroControls, PageHeroViewToggle } from './components/ui/page-hero';
import { useModalLifecycle } from './components/ui/sheet';
import type { SessionState, ThemePreset } from './contracts';
import { managerNicknameForTeam } from './manager-nicknames';
import { invalidateData, subscribeDataFreshness } from './data-freshness';
import type { SquadApiFormGameweek, SquadApiPlayer, SquadApiTeam } from './squad-api';
import { formHistoryFromRows, toPlayerCardFormHistory } from './player-form';
import './market-page.css';

interface MarketPageProps {
  currentPath: string;
  onNavigate: (href: string) => void;
  preset: ThemePreset;
  session?: SessionState;
}

type MarketMode = 'discover' | 'interests' | 'trades' | 'draws';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type FixtureFilter = 'all' | 'easy';
type SortKey = 'points' | 'form' | 'xg' | 'xa' | 'value';

interface MarketPlayer {
  id: string;
  displayName: string;
  position: string;
  club: string;
  status: SquadApiPlayer['status'] | 'owned_by_other';
  draftTeamId: string | null;
  draftTeamName: string | null;
  ownerName: string | null;
  points: number | null;
  form: number | null;
  value: number | null;
  xg: number | null;
  xa: number | null;
  selectedPercent: number | null;
  nextDifficulty: number | null;
  formHistory: SquadApiFormGameweek[];
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
  offeredById: string | null;
  offeredToId: string | null;
  offeredBy: string | null;
  offeredTo: string | null;
  approvalStatus?: string | null;
  requiredApproverRole?: string | null;
  executedAt?: string | null;
  assetNames: string[];
}

interface PlayerHistoryRow {
  gameweek: number;
  fixture_id?: number;
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
  offered_by?: { id?: string | null; name?: string | null } | null;
  offered_to?: { id?: string | null; name?: string | null } | null;
  approval_status?: string | null;
  required_approver_role?: string | null;
  executed_at?: string | null;
  assets?: Array<{ player?: { display_name?: string | null } | null }>;
}

interface ApiSummary {
  manager_team: SquadApiTeam;
  gameweek: { name: string };
  players: SquadApiPlayer[];
}

interface ApiScoutingResponse {
  players: SquadApiPlayer[];
}

interface FreeAgencyDraw {
  id: string;
  season_id: string | number;
  gameweek: number;
  status: 'scheduled' | 'open_for_preferences' | 'locked' | 'processing' | 'processed' | string;
  opens_at: string | null;
  closes_at: string;
  processed_at: string | null;
  draw_order?: string[] | null;
}

interface DrawResult {
  draw: FreeAgencyDraw;
  awards: Array<{ draft_team_id: string; team_name: string; player_id: string; player_name: string }>;
  own_preferences: Array<{ player_id: string; rank: number }>;
  own_result: { draft_team_id: string; won_player_id: string | null; preference_rank: number | null; reason_code: string | null } | null;
}

interface DrawPreference {
  player_id: string;
  rank: number;
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

export function MarketPage({ currentPath, onNavigate, preset, session }: MarketPageProps) {
  const [mode, setMode] = useState<MarketMode>(() => modeFromPath(currentPath));
  const [players, setPlayers] = useState<MarketPlayer[]>([]);
  const [interests, setInterests] = useState<InterestView[]>([]);
  const [trades, setTrades] = useState<TradeView[]>([]);
  const [managerTeam, setManagerTeam] = useState<SquadApiTeam>({ id: '', name: 'Your team' });
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
  const [failedSections, setFailedSections] = useState<Set<string>>(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingTradeAction, setPendingTradeAction] = useState<string | null>(null);
  const [approvalTrades, setApprovalTrades] = useState<TradeView[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [approvalRefreshKey, setApprovalRefreshKey] = useState(0);
  const [approvalNotice, setApprovalNotice] = useState('');
  const [draws, setDraws] = useState<FreeAgencyDraw[]>([]);
  const [selectedDrawId, setSelectedDrawId] = useState('');
  const [drawLoadStatus, setDrawLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [drawError, setDrawError] = useState('');
  const [drawRefreshKey, setDrawRefreshKey] = useState(0);
  const [drawDetailsRefreshKey, setDrawDetailsRefreshKey] = useState(0);
  const [drawPreferences, setDrawPreferences] = useState<string[]>([]);
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null);
  const [drawDetailsLoading, setDrawDetailsLoading] = useState(false);
  const [drawDetailsError, setDrawDetailsError] = useState('');
  const [drawActionPending, setDrawActionPending] = useState(false);
  const [drawNotice, setDrawNotice] = useState('');
  const [drawManagementPending, setDrawManagementPending] = useState(false);
  const [drawManagementNotice, setDrawManagementNotice] = useState('');
  const [drawManagementError, setDrawManagementError] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const selectedPlayerId = selectedPlayer?.id;
  const canReviewTrades = Boolean(session?.user?.roles.some((role) => ['commissioner', 'vice_commissioner', 'admin'].includes(role)));
  const canManageDraws = Boolean(session?.user?.roles.some((role) => role === 'commissioner' || role === 'admin'));

  useEffect(() => {
    setMode(modeFromPath(currentPath));
  }, [currentPath]);

  useEffect(() => subscribeDataFreshness('market', ['squad', 'lineup', 'interest', 'trade', 'draw', 'global'], () => {
    setRefreshKey((current) => current + 1);
    setApprovalRefreshKey((current) => current + 1);
  }), []);

  useEffect(() => {
    if (mode !== 'draws') return undefined;
    let active = true;
    setDrawLoadStatus('loading');
    setDrawError('');
    void fetchJson<FreeAgencyDraw[] | { draws: FreeAgencyDraw[] }>('/api/free-agency/draws')
      .then((payload) => {
        if (!active) return;
        const nextDraws = Array.isArray(payload) ? payload : payload.draws;
        setDraws(nextDraws);
        setSelectedDrawId((current) => nextDraws.some((draw) => draw.id === current) ? current : nextDraws[0]?.id ?? '');
        setDrawLoadStatus('loaded');
      })
      .catch((loadError) => {
        if (!active) return;
        setDrawError(loadError instanceof Error ? loadError.message : 'Free agency draws are unavailable.');
        setDrawLoadStatus('error');
      });
    return () => { active = false; };
  }, [drawRefreshKey, mode]);

  const selectedDraw = draws.find((draw) => draw.id === selectedDrawId) ?? null;

  useEffect(() => {
    if (!selectedDraw) {
      setDrawPreferences([]);
      setDrawResult(null);
      setDrawDetailsError('');
      return undefined;
    }
    let active = true;
    setDrawDetailsLoading(true);
    setDrawDetailsError('');
    setDrawPreferences([]);
    setDrawResult(null);
    const reads: Array<Promise<unknown>> = [fetchJson<DrawPreference[]>(`/api/free-agency/draws/${encodeURIComponent(selectedDraw.id)}/preferences`)];
    if (selectedDraw.status === 'processed') reads.push(fetchJson<DrawResult>(`/api/free-agency/draws/${encodeURIComponent(selectedDraw.id)}/results`));
    void Promise.allSettled(reads).then(([preferencesRead, resultRead]) => {
      if (!active) return;
      if (preferencesRead.status === 'fulfilled') {
        setDrawPreferences(mapDrawPreferences(preferencesRead.value));
      } else {
        setDrawPreferences([]);
        setDrawDetailsError('Your private preferences are unavailable.');
      }
      if (selectedDraw.status === 'processed' && resultRead) {
        if (resultRead.status === 'fulfilled') setDrawResult(resultRead.value as DrawResult);
        else setDrawDetailsError((current) => current ? `${current} Results are unavailable.` : 'Draw results are unavailable.');
      } else {
        setDrawResult(null);
      }
      setDrawDetailsLoading(false);
    });
    return () => { active = false; };
  }, [drawDetailsRefreshKey, selectedDraw?.id, selectedDraw?.status]);

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
        setManagerTeam(summary.manager_team);
      }
      if (scouting) setPlayers(scouting.players.map(mapPlayer));
      if (interestPayload) setInterests(interestPayload.map(mapInterest));
      if (tradePayload) setTrades((tradePayload.trades ?? []).map(mapTrade));
      setLoading(false);
      setFailedSections(new Set(errors));
      if (errors.length === 4) {
        setError('Market data is temporarily unavailable.');
      } else if (errors.length > 0) {
        setNotice(`Unavailable: ${errors.join(' and ')}.`);
        setError(null);
      } else {
        setError(null);
        setNotice('');
      }
    }

    void loadMarket();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (mode !== 'trades' || !canReviewTrades) {
      setApprovalStatus('idle');
      return undefined;
    }
    let active = true;
    setApprovalStatus('loading');
    void fetchJson<{ trades?: ApiTrade[] }>('/api/trades/approvals')
      .then((response) => {
        if (!active) return;
        setApprovalTrades((response.trades ?? []).map(mapTrade));
        setApprovalStatus('ready');
      })
      .catch(() => {
        if (active) setApprovalStatus('error');
      });
    return () => { active = false; };
  }, [approvalRefreshKey, canReviewTrades, mode]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setHistory(null);
      setHistoryStatus('');
      return;
    }

    let active = true;
    setHistory(null);
    setHistoryStatus('Loading official FPL history…');
    void fetchJson<PlayerHistoryResponse>(`/api/fpl/players/${encodeURIComponent(selectedPlayerId)}/history`)
      .then((response) => {
        if (!active) return;
        setHistory(response);
        const formHistory = formHistoryFromRows(response.history);
        setPlayers((current) => current.map((player) => player.id === selectedPlayerId ? { ...player, formHistory } : player));
        setSelectedPlayer((current) => current?.id === selectedPlayerId ? { ...current, formHistory } : current);
        setHistoryStatus('');
      })
      .catch(() => {
        if (active) setHistoryStatus('Official FPL history is currently unavailable.');
      });

    return () => {
      active = false;
    };
  }, [selectedPlayerId]);

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

  function moveDrawPreference(index: number, direction: -1 | 1) {
    setDrawPreferences((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  async function saveDrawPreferences() {
    if (!selectedDraw || selectedDraw.status !== 'open_for_preferences' || drawActionPending) return;
    setDrawActionPending(true);
    setDrawNotice('');
    try {
      const response = await fetchJson<DrawPreference[]>(`/api/free-agency/draws/${encodeURIComponent(selectedDraw.id)}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_ids: drawPreferences }),
      });
      setDrawPreferences(mapDrawPreferences(response));
      setDrawNotice('Preferences saved. Only your team can view this ranked list.');
      invalidateData(['draw'], 'market');
    } catch (actionError) {
      setDrawNotice(actionError instanceof Error ? actionError.message : 'Unable to save draw preferences.');
    } finally {
      setDrawActionPending(false);
    }
  }

  async function createFreeAgencyDraw(gameweek: number, opensAt: string, closesAt: string) {
    if (!canManageDraws || drawManagementPending) return;
    setDrawManagementPending(true);
    setDrawManagementNotice('');
    setDrawManagementError(false);
    try {
      const draw = await fetchJson<FreeAgencyDraw>('/api/free-agency/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameweek, opens_at: opensAt || undefined, closes_at: closesAt }),
      });
      setDraws((current) => [draw, ...current.filter((item) => item.id !== draw.id)]);
      setSelectedDrawId(draw.id);
      setDrawManagementNotice(`Gameweek ${draw.gameweek} draw created.`);
      invalidateData(['draw'], 'market');
    } catch (actionError) {
      setDrawManagementNotice(actionError instanceof Error ? actionError.message : 'Unable to create the draw.');
      setDrawManagementError(true);
    } finally {
      setDrawManagementPending(false);
    }
  }

  async function manageFreeAgencyDraw(draw: FreeAgencyDraw, action: 'open' | 'lock' | 'process') {
    if (!canManageDraws || drawManagementPending) return;
    setDrawManagementPending(true);
    setDrawManagementNotice('');
    setDrawManagementError(false);
    try {
      const updated = await fetchJson<FreeAgencyDraw>(`/api/free-agency/draws/${encodeURIComponent(draw.id)}/${action}`, { method: 'POST' });
      setDraws((current) => current.map((item) => item.id === updated.id ? updated : item));
      setDrawManagementNotice(`Gameweek ${updated.gameweek} draw ${action === 'process' ? 'processed' : action === 'lock' ? 'locked' : 'opened'}.`);
      invalidateData(['draw'], 'market');
    } catch (actionError) {
      setDrawManagementNotice(actionError instanceof Error ? actionError.message : `Unable to ${action} the draw.`);
      setDrawManagementError(true);
    } finally {
      setDrawManagementPending(false);
    }
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
      invalidateData(['interest'], 'market');
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
      setPlayers((current) => current.map((player) => player.id === interest.player.id ? { ...player, status: 'available' } : player));
      setNotice(`${interest.player.displayName} removed from Interests.`);
      setSelectedPlayer((current) => current?.id === interest.player.id ? { ...current, status: 'available' } : current);
      invalidateData(['interest'], 'market');
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Unable to remove this Interest.');
    } finally {
      setPendingAction(null);
    }
  }

  async function updateTrade(trade: TradeView, status: 'accepted' | 'rejected' | 'cancelled') {
    if (pendingTradeAction) return;
    setPendingTradeAction(trade.id);
    try {
      await fetchJson<ApiTrade>(`/api/trades/${encodeURIComponent(trade.id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const response = await fetchJson<{ trades?: ApiTrade[] }>('/api/trades');
      setTrades((response.trades ?? []).map(mapTrade));
      setApprovalRefreshKey((key) => key + 1);
      setNotice(status === 'accepted'
        ? 'Trade accepted. Commissioner approval is still required before ownership changes.'
        : status === 'rejected' ? 'Trade rejected.' : 'Trade proposal cancelled.');
      invalidateData(status === 'accepted' ? ['trade', 'squad'] : ['trade'], 'market');
    } catch (actionError) {
      setNotice(actionError instanceof Error ? actionError.message : 'Unable to update this trade.');
    } finally {
      setPendingTradeAction(null);
    }
  }

  async function decideTradeApproval(trade: TradeView, decision: 'approved' | 'rejected') {
    if (pendingTradeAction) return;
    setPendingTradeAction(trade.id);
    setApprovalNotice('');
    try {
      const updated = await fetchJson<ApiTrade>(`/api/trades/${encodeURIComponent(trade.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      setApprovalNotice(decision === 'approved'
        ? updated.executed_at ? 'Trade approved and ownership updated.' : 'Trade approved.'
        : 'Trade approval rejected. Ownership remains unchanged.');
      setApprovalRefreshKey((key) => key + 1);
      invalidateData(decision === 'approved' ? ['trade', 'squad'] : ['trade'], 'market');
    } catch (actionError) {
      setApprovalNotice(actionError instanceof Error ? actionError.message : 'Unable to record the trade decision.');
    } finally {
      setPendingTradeAction(null);
    }
  }

  return (
    <main aria-labelledby="market-page-title" className="feature-screen market-page" data-density={preset.tokens.density}>
      <PageHero
        actions={(
          <PageHeroControls>
            <Button aria-label="Open fixture difficulty" onClick={() => onNavigate('/fdr')} type="button" variant="secondary"><ChartNoAxesCombined aria-hidden="true" size={16} />FDR</Button>
            <PageHeroViewToggle
              ariaLabel="Market workspace sections"
              onChange={(nextMode) => selectMode(nextMode as MarketMode)}
              options={[
                { value: 'discover', label: 'Discovery', icon: <Search aria-hidden="true" size={17} /> },
                { value: 'interests', label: 'Interests', icon: <Bookmark aria-hidden="true" size={17} /> },
                { value: 'trades', label: 'Trades', icon: <ArrowRightLeft aria-hidden="true" size={17} /> },
                { value: 'draws', label: 'Free agency', icon: <ListOrdered aria-hidden="true" size={17} /> },
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
          <Button disabled={loading} onClick={() => setRefreshKey((key) => key + 1)} type="button" variant="secondary">{loading ? 'Retrying…' : 'Retry'}</Button>
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
          failed={failedSections.has('player pool')}
          managerTeam={managerTeam}
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
          <InterestsPanel failed={failedSections.has('Interests')} interests={interests} loading={loading} managerTeam={managerTeam} onBrowse={() => selectMode('discover')} onOpenPlayer={openPlayer} onRemove={removeInterest} onRetry={() => setRefreshKey((key) => key + 1)} pendingAction={pendingAction} />
        ) : null}
        {mode === 'trades' ? <TradesPanel approvalFailed={approvalStatus === 'error'} approvalLoading={approvalStatus === 'loading'} approvalNotice={approvalNotice} approvalTrades={approvalTrades} approverRoles={session?.user?.roles ?? []} canReviewTrades={canReviewTrades} failed={failedSections.has('trade activity')} loading={loading} managerTeam={managerTeam} onApprovalRetry={() => setApprovalRefreshKey((key) => key + 1)} onBrowse={() => selectMode('discover')} onDecideApproval={decideTradeApproval} onRetry={() => setRefreshKey((key) => key + 1)} onUpdateTrade={updateTrade} pendingTradeAction={pendingTradeAction} trades={trades} /> : null}
        {mode === 'draws' ? <FreeAgencyDrawPanel
          availablePlayers={players.filter((player) => !player.draftTeamId && player.status !== 'owned' && player.status !== 'owned_by_other')}
          draw={selectedDraw}
          drawActionPending={drawActionPending}
          drawDetailsError={drawDetailsError}
          drawDetailsLoading={drawDetailsLoading}
          drawError={drawError}
          drawLoadStatus={drawLoadStatus}
          drawNotice={drawNotice}
          canManageDraws={canManageDraws}
          drawManagementNotice={drawManagementNotice}
          drawManagementError={drawManagementError}
          drawManagementPending={drawManagementPending}
          drawResult={drawResult}
          draws={draws}
          loadingPlayers={loading && players.length === 0}
          onAddPlayer={(playerId) => setDrawPreferences((current) => current.includes(playerId) ? current : [...current, playerId])}
          onCreateDraw={createFreeAgencyDraw}
          onManageDraw={manageFreeAgencyDraw}
          onMovePreference={moveDrawPreference}
          onRefresh={() => {
            setDrawRefreshKey((key) => key + 1);
            setDrawDetailsRefreshKey((key) => key + 1);
          }}
          onRemovePlayer={(playerId) => setDrawPreferences((current) => current.filter((id) => id !== playerId))}
          onSave={() => void saveDrawPreferences()}
          onSelectDraw={setSelectedDrawId}
          preferences={drawPreferences}
          saving={drawActionPending}
        /> : null}
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
  failed,
  filteredPlayers,
  filtersOpen,
  fixtureFilter,
  loading,
  managerTeam,
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
  failed: boolean;
  filtersOpen: boolean;
  fixtureFilter: FixtureFilter;
  loading: boolean;
  managerTeam: SquadApiTeam;
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
      {!loading && failed ? <p role="alert">Player pool unavailable. Retry to load players.</p> : null}
      {!loading && !failed && filteredPlayers.length === 0 ? <div className="market-page__empty"><Search aria-hidden="true" size={22} /><strong>No players found</strong>{hasFilters ? <Button onClick={onClearFilters} type="button" variant="secondary">Clear filters</Button> : null}</div> : null}
      {!loading && !failed && filteredPlayers.length > 0 ? (
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
                  managerTeam={managerTeam}
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

function MarketPlayerRow({ managerTeam, onOpen, player }: { managerTeam: SquadApiTeam; onOpen: (player: MarketPlayer) => void; player: MarketPlayer }) {
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
          <PlayerCard className="market-page__list-player-card" formPosition="beside" layout="list" player={toPlayerCardPlayer(player, ownershipToneFor(player, managerTeam))} showPositionMarker={false} size="sm" />
        </div>
      </td>
      <td><strong className="market-page__list-points">{formatInteger(player.points)}</strong></td>
      <td><span className="market-page__expected"><span>{formatMetric(player.xg)}</span><span>{formatMetric(player.xa)}</span></span></td>
    </tr>
  );
}

function InterestsPanel({ failed, interests, loading, managerTeam, onBrowse, onOpenPlayer, onRemove, onRetry, pendingAction }: { failed: boolean; interests: InterestView[]; loading: boolean; managerTeam: SquadApiTeam; onBrowse: () => void; onOpenPlayer: (player: MarketPlayer) => void; onRemove: (interest: InterestView) => Promise<void>; onRetry: () => void; pendingAction: string | null }) {
  return (
    <section aria-label="Your Interests" className="market-page__activity-panel">
      {loading ? <p role="status">Loading Interests…</p> : null}
      {!loading && failed ? <p role="alert">Interests unavailable. <Button onClick={onRetry} type="button" variant="secondary">Retry</Button></p> : null}
      {!loading && !failed && interests.length === 0 ? <EmptyActivity icon={<Bookmark aria-hidden="true" size={23} />} onAction={onBrowse} action="Find a player" title="No Interests" /> : null}
      {!loading && !failed && interests.length > 0 ? <div className="market-page__activity-list">{interests.map((interest) => <article className="market-page__activity-row" key={interest.id}><button aria-label={`View ${interest.player.displayName} details`} className="market-page__player-identity" onClick={() => onOpenPlayer(interest.player)} type="button"><PlayerCard formPosition="beside" layout="list" player={toPlayerCardPlayer(interest.player, ownershipToneFor(interest.player, managerTeam))} showPositionMarker={false} size="xs" /></button><Button aria-label={`Remove ${interest.player.displayName} from Interests`} disabled={pendingAction === interest.id} onClick={() => void onRemove(interest)} type="button" variant="ghost">{pendingAction === interest.id ? 'Removing…' : 'Remove'}</Button></article>)}</div> : null}
    </section>
  );
}

function TradesPanel({ approvalFailed, approvalLoading, approvalNotice, approvalTrades, approverRoles, canReviewTrades, failed, loading, managerTeam, onApprovalRetry, onBrowse, onDecideApproval, onRetry, onUpdateTrade, pendingTradeAction, trades }: { approvalFailed: boolean; approvalLoading: boolean; approvalNotice: string; approvalTrades: TradeView[]; approverRoles: string[]; canReviewTrades: boolean; failed: boolean; loading: boolean; managerTeam: SquadApiTeam; onApprovalRetry: () => void; onBrowse: () => void; onDecideApproval: (trade: TradeView, decision: 'approved' | 'rejected') => Promise<void>; onRetry: () => void; onUpdateTrade: (trade: TradeView, status: 'accepted' | 'rejected' | 'cancelled') => Promise<void>; pendingTradeAction: string | null; trades: TradeView[] }) {
  const eligibleApprovals = approvalTrades.filter((trade) => approverRoles.includes('admin')
    || (trade.requiredApproverRole === 'vice_commissioner' ? approverRoles.includes('vice_commissioner') : approverRoles.includes('commissioner')));
  return <div className="market-page__trade-workspace">
    <section aria-label="Trade activity" className="market-page__activity-panel">
      <h2>Trade activity</h2>
      {loading ? <p role="status">Loading trade activity…</p> : null}
      {!loading && failed ? <p role="alert">Trade activity unavailable. <Button onClick={onRetry} type="button" variant="secondary">Retry</Button></p> : null}
      {!loading && !failed && trades.length === 0 ? <EmptyActivity icon={<ArrowRightLeft aria-hidden="true" size={23} />} onAction={onBrowse} action="Browse players" title="No trade proposals" /> : null}
      {!loading && !failed && trades.length > 0 ? <div className="market-page__activity-list">{trades.map((trade) => {
        const recipient = trade.offeredToId === managerTeam.id;
        const sender = trade.offeredById === managerTeam.id;
        const pending = pendingTradeAction === trade.id;
        const terminal = ['rejected', 'cancelled', 'executed'].includes(trade.status);
        return <article className="market-page__trade-row" key={trade.id}><span className="market-page__trade-icon"><ArrowRightLeft aria-hidden="true" size={18} /></span><div><strong>{trade.assetNames.length > 0 ? trade.assetNames.join(' ↔ ') : 'Player trade proposal'}</strong><span>{trade.offeredBy ?? 'Another manager'} → {trade.offeredTo ?? 'Your team'}</span><StatusBadge status={trade.status} />{trade.status === 'accepted' && trade.approvalStatus !== 'approved' ? <span>Awaiting commissioner approval</span> : null}{!terminal && trade.status === 'proposed' && recipient ? <div className="market-page__trade-actions"><Button disabled={pending} onClick={() => void onUpdateTrade(trade, 'accepted')} type="button">{pending ? 'Saving…' : 'Accept'}</Button><Button disabled={pending} onClick={() => void onUpdateTrade(trade, 'rejected')} type="button" variant="secondary">Reject</Button></div> : null}{!terminal && trade.status === 'proposed' && sender ? <Button disabled={pending} onClick={() => void onUpdateTrade(trade, 'cancelled')} type="button" variant="secondary">{pending ? 'Cancelling…' : 'Cancel proposal'}</Button> : null}</div></article>;
      })}</div> : null}
    </section>
    {canReviewTrades ? <section aria-label="Trade approvals" className="market-page__activity-panel">
      <div className="market-page__trade-approval-heading"><h2>Trade approvals</h2><span>Eligible decisions</span></div>
      {approvalNotice ? <p role="status">{approvalNotice}</p> : null}
      {approvalLoading ? <p role="status">Loading eligible approvals…</p> : null}
      {approvalFailed ? <p role="alert">Approval queue unavailable. <Button onClick={onApprovalRetry} type="button" variant="secondary">Retry</Button></p> : null}
      {!approvalLoading && !approvalFailed && eligibleApprovals.length === 0 ? <p className="market-page__empty">No trades need your approval.</p> : null}
      {!approvalLoading && !approvalFailed && eligibleApprovals.map((trade) => {
        const pending = pendingTradeAction === trade.id;
        const roleLabel = trade.requiredApproverRole === 'vice_commissioner' ? 'Vice commissioner' : 'Commissioner';
        return <article className="market-page__trade-row" key={trade.id}><div><strong>{trade.assetNames.length ? trade.assetNames.join(' ↔ ') : 'Player trade'}</strong><span>{trade.offeredBy ?? 'Manager'} → {trade.offeredTo ?? 'Manager'}</span><span>Requires {roleLabel} approval</span><StatusBadge status={trade.approvalStatus ?? 'pending'} /><div className="market-page__trade-actions"><Button disabled={pending} onClick={() => void onDecideApproval(trade, 'approved')} type="button">{pending ? 'Saving…' : 'Approve'}</Button><Button disabled={pending} onClick={() => void onDecideApproval(trade, 'rejected')} type="button" variant="secondary">Reject</Button></div></div></article>;
      })}
    </section> : null}
  </div>;
}

function FreeAgencyDrawPanel({ availablePlayers, canManageDraws, draw, drawActionPending, drawDetailsError, drawDetailsLoading, drawError, drawLoadStatus, drawManagementError, drawManagementNotice, drawManagementPending, drawNotice, drawResult, draws, loadingPlayers, onAddPlayer, onCreateDraw, onManageDraw, onMovePreference, onRefresh, onRemovePlayer, onSave, onSelectDraw, preferences, saving }: {
  availablePlayers: MarketPlayer[];
  canManageDraws: boolean;
  draw: FreeAgencyDraw | null;
  drawActionPending: boolean;
  drawDetailsError: string;
  drawDetailsLoading: boolean;
  drawError: string;
  drawLoadStatus: 'idle' | 'loading' | 'loaded' | 'error';
  drawManagementError: boolean;
  drawManagementNotice: string;
  drawManagementPending: boolean;
  drawNotice: string;
  drawResult: DrawResult | null;
  draws: FreeAgencyDraw[];
  loadingPlayers: boolean;
  onAddPlayer: (playerId: string) => void;
  onCreateDraw: (gameweek: number, opensAt: string, closesAt: string) => Promise<void>;
  onManageDraw: (draw: FreeAgencyDraw, action: 'open' | 'lock' | 'process') => Promise<void>;
  onMovePreference: (index: number, direction: -1 | 1) => void;
  onRefresh: () => void;
  onRemovePlayer: (playerId: string) => void;
  onSave: () => void;
  onSelectDraw: (drawId: string) => void;
  preferences: string[];
  saving: boolean;
}) {
  const [playerQuery, setPlayerQuery] = useState('');
  const [newDrawGameweek, setNewDrawGameweek] = useState('');
  const [newDrawOpensAt, setNewDrawOpensAt] = useState('');
  const [newDrawClosesAt, setNewDrawClosesAt] = useState('');
  const preferenceSet = new Set(preferences);
  const availableMatches = availablePlayers
    .filter((player) => !preferenceSet.has(player.id))
    .filter((player) => `${player.displayName} ${player.club} ${player.position}`.toLowerCase().includes(playerQuery.trim().toLowerCase()))
    .slice(0, 20);
  const preferenceNames = preferences.map((playerId) => availablePlayers.find((player) => player.id === playerId)?.displayName ?? `Player ${playerId}`);
  const mayEdit = draw?.status === 'open_for_preferences';

  if (drawLoadStatus === 'loading' && draws.length === 0 && !canManageDraws) return <section aria-label="Free agency draw" className="market-page__activity-panel"><p role="status">Loading free agency draws…</p></section>;
  if (drawLoadStatus === 'error' && draws.length === 0 && !canManageDraws) return <section aria-label="Free agency draw" className="market-page__activity-panel"><p role="alert">{drawError || 'Free agency draws are unavailable.'} <Button onClick={onRefresh} type="button" variant="secondary">Retry</Button></p></section>;
  if (draws.length === 0 && !canManageDraws) return <section aria-label="Free agency draw" className="market-page__activity-panel"><EmptyActivity action="Retry" icon={<ListOrdered aria-hidden="true" size={23} />} onAction={onRefresh} title="No free agency draws" /></section>;

  return (
    <section aria-label="Free agency draw" className="market-page__activity-panel market-page__draw-panel">
      <header className="market-page__draw-header">
        <div><span className="eyebrow">Free agency</span><h2>{draw ? `Gameweek ${draw.gameweek}` : 'Draw preferences'}</h2></div>
        {draws.length > 1 ? <label><span>Draw</span><select aria-label="Select free agency draw" onChange={(event) => onSelectDraw(event.target.value)} value={draw?.id ?? ''}>{draws.map((item) => <option key={item.id} value={item.id}>GW {item.gameweek} · {formatDrawStatus(item.status)}</option>)}</select></label> : null}
      </header>
      {draw ? <p className="market-page__draw-meta"><StatusBadge status={draw.status} /><span>Closes {formatDrawDate(draw.closes_at)}</span>{draw.opens_at ? <span>Opens {formatDrawDate(draw.opens_at)}</span> : null}</p> : null}
      {drawLoadStatus === 'loading' ? <p role="status">Refreshing draws…</p> : null}
      {drawLoadStatus === 'error' ? <p role="alert">{drawError} <Button onClick={onRefresh} type="button" variant="secondary">Retry</Button></p> : null}
      {canManageDraws ? <section aria-label="Commissioner draw controls" className="market-page__draw-admin">
        <h3>Commissioner controls</h3>
        <div className="market-page__draw-create">
          <label><span>Gameweek</span><input aria-label="New draw gameweek" min="1" onChange={(event) => setNewDrawGameweek(event.target.value)} type="number" value={newDrawGameweek} /></label>
          <label><span>Opens at (optional)</span><input aria-label="New draw opens at" onChange={(event) => setNewDrawOpensAt(event.target.value)} type="datetime-local" value={newDrawOpensAt} /></label>
          <label><span>Closes at</span><input aria-label="New draw closes at" onChange={(event) => setNewDrawClosesAt(event.target.value)} type="datetime-local" value={newDrawClosesAt} /></label>
          <Button disabled={drawManagementPending || Number(newDrawGameweek) < 1 || !newDrawClosesAt} onClick={() => void onCreateDraw(Number(newDrawGameweek), newDrawOpensAt ? new Date(newDrawOpensAt).toISOString() : '', new Date(newDrawClosesAt).toISOString())} type="button">{drawManagementPending ? 'Saving…' : 'Create draw'}</Button>
        </div>
        {draw ? <div className="market-page__draw-admin-actions">
          {draw.status === 'scheduled' ? <Button disabled={drawManagementPending || !drawCanOpen(draw)} onClick={() => void onManageDraw(draw, 'open')} type="button" variant="secondary">Open preferences</Button> : null}
          {draw.status === 'open_for_preferences' ? <Button disabled={drawManagementPending} onClick={() => void onManageDraw(draw, 'lock')} type="button" variant="secondary">Lock draw</Button> : null}
          {draw.status === 'locked' ? <Button disabled={drawManagementPending || !drawCanProcess(draw)} onClick={() => void onManageDraw(draw, 'process')} type="button" variant="secondary">Process draw</Button> : null}
        </div> : null}
        {drawManagementNotice ? <p role={drawManagementError ? 'alert' : 'status'}>{drawManagementNotice}</p> : null}
      </section> : null}
      {!draw && draws.length === 0 ? <p>No free agency draws are scheduled.</p> : null}
      {draw ? <>
        {drawDetailsLoading ? <p role="status">Loading your private preferences…</p> : null}
        {drawDetailsError ? <p role="alert">{drawDetailsError} <Button onClick={onRefresh} type="button" variant="secondary">Retry</Button></p> : null}
        {drawNotice ? <p role="status">{drawNotice}</p> : null}
        {mayEdit ? <>
          <h3>Rank your player preferences</h3>
          <ol aria-label="Ranked draw preferences" className="market-page__draw-preferences">
            {preferences.map((playerId, index) => <li key={playerId}><span className="market-page__draw-rank">{index + 1}</span><strong>{preferenceNames[index]}</strong><div className="market-page__draw-row-actions"><Button aria-label={`Move ${preferenceNames[index]} up`} disabled={index === 0 || saving} onClick={() => onMovePreference(index, -1)} type="button" variant="ghost"><MoveUp aria-hidden="true" size={16} /></Button><Button aria-label={`Move ${preferenceNames[index]} down`} disabled={index === preferences.length - 1 || saving} onClick={() => onMovePreference(index, 1)} type="button" variant="ghost"><MoveDown aria-hidden="true" size={16} /></Button><Button aria-label={`Remove ${preferenceNames[index]}`} disabled={saving} onClick={() => onRemovePlayer(playerId)} type="button" variant="ghost">Remove</Button></div></li>)}
          </ol>
          <label className="market-page__draw-search"><span>Add an available player</span><input onChange={(event) => setPlayerQuery(event.target.value)} placeholder="Search players" value={playerQuery} /></label>
          {loadingPlayers ? <p role="status">Loading available players…</p> : availablePlayers.length === 0 ? <p>No unowned players are available in the current player pool.</p> : availableMatches.length === 0 ? <p>No matching available players.</p> : <ul className="market-page__draw-candidates">{availableMatches.map((player) => <li key={player.id}><span>{player.displayName} <small>{positionLabel(player.position)} · {player.club}</small></span><Button disabled={drawActionPending} onClick={() => onAddPlayer(player.id)} type="button" variant="secondary">Add</Button></li>)}</ul>}
          <Button disabled={drawActionPending || drawDetailsLoading} onClick={onSave} type="button">{drawActionPending ? 'Saving…' : 'Save preferences'}</Button>
          <p className="market-page__draw-privacy">Your ranked preferences stay private to your team.</p>
        </> : null}
        {!mayEdit && !drawDetailsLoading ? <>
          <h3>Your saved preferences</h3>
          {preferences.length ? <ol className="market-page__draw-preferences">{preferences.map((playerId, index) => <li key={playerId}><span className="market-page__draw-rank">{index + 1}</span><strong>{preferenceNames[index]}</strong></li>)}</ol> : <p>No preferences were saved for this draw.</p>}
        </> : null}
        {draw.status === 'processed' && drawResult ? <>
          <h3>Your draw result</h3>
          {drawResult.own_result?.won_player_id ? <p>You received {drawResult.awards.find((award) => award.player_id === drawResult.own_result?.won_player_id)?.player_name ?? 'a player'}{drawResult.own_result.preference_rank ? ` at preference ${drawResult.own_result.preference_rank}` : ''}.</p> : <p>No player was awarded to your team.</p>}
          <h3>Public awards</h3>
          {drawResult.awards.length ? <ul className="market-page__draw-awards">{drawResult.awards.map((award) => <li key={`${award.draft_team_id}-${award.player_id}`}><span>{award.team_name}</span><strong>{award.player_name}</strong></li>)}</ul> : <p>No players were awarded in this draw.</p>}
        </> : null}
      </> : null}
    </section>
  );
}

function PlayerDrawer({ drawerRef, history, historyStatus, interest, managerTeam, onAddInterest, onClose, onNavigate, onRemoveInterest, pendingAction, player }: { drawerRef: MutableRefObject<HTMLElement | null>; history: PlayerHistoryResponse | null; historyStatus: string; interest: InterestView | null; managerTeam: SquadApiTeam; onAddInterest: () => void; onClose: () => void; onNavigate: (href: string) => void; onRemoveInterest: (interest: InterestView) => Promise<void>; pendingAction: string | null; player: MarketPlayer }) {
  useModalLifecycle(drawerRef, true, onClose);
  const status = interest ? 'interested' : effectiveStatus(player, new Set(), managerTeam);
  const ownershipTone = ownershipToneFor(player, managerTeam);
  return (
    <div className="market-page__drawer-layer"><button aria-label="Close player details" className="market-page__drawer-backdrop" onClick={onClose} type="button" /><aside aria-labelledby="market-player-detail-title" aria-modal="true" className="market-page__drawer" ref={drawerRef} role="dialog" tabIndex={-1}><span aria-hidden="true" className="market-page__sheet-handle" /><header className="market-page__drawer-header"><PlayerCard formPosition="hidden" layout="token" player={toPlayerCardPlayer(player, ownershipTone)} showOpponent={false} showPositionMarker={false} size="lg" /><div><h2 id="market-player-detail-title">{player.displayName}</h2><span>{positionLabel(player.position)} · {player.club}</span></div><button aria-label="Close player details" className="market-page__icon-button" onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header><section aria-label="Player metrics" className="market-page__detail-metrics"><Metric label="Total points" value={formatInteger(player.points)} /><Metric dots formHistory={toPlayerCardFormHistory(player.formHistory)} label="Form" value={player.form} /><Metric label="xG" value={formatMetric(player.xg)} /><Metric label="xA" value={formatMetric(player.xa)} /><Metric label="Value" value={player.value === null ? '—' : `£${player.value.toFixed(1)}m`} /><Metric label="Selected" value={player.selectedPercent === null ? '—' : `${formatMetric(player.selectedPercent)}%`} /></section><section className="market-page__drawer-section"><h3>Owner</h3><p className={`market-page__owner-value market-page__owner-value--${ownershipTone}`}>{ownerLabel(player)}</p></section><section className="market-page__drawer-section"><h3>Recent FPL history</h3>{historyStatus ? <p role="status">{historyStatus}</p> : null}{history?.history.length ? <div aria-label="Recent FPL gameweek history" className="market-page__history"><table><thead><tr><th>GW</th><th>Pts</th><th>Min</th><th>xG</th><th>xA</th></tr></thead><tbody>{history.history.slice(-5).reverse().map((row) => <tr key={row.gameweek}><td>{row.gameweek}</td><td><strong>{row.total_points}</strong></td><td>{row.minutes}</td><td>{row.expected_goals.toFixed(2)}</td><td>{row.expected_assists.toFixed(2)}</td></tr>)}</tbody></table></div> : null}{history && history.history.length === 0 ? <p>No completed gameweek history is available.</p> : null}</section><footer className="market-page__drawer-actions">{status === 'owned' ? <Button onClick={() => { onClose(); onNavigate('/squad'); }} type="button"><Users aria-hidden="true" size={16} />View in Squad</Button> : null}{status === 'interested' && interest ? <Button aria-label={`Remove ${player.displayName} from Interests`} disabled={pendingAction === interest.id} onClick={() => void onRemoveInterest(interest)} type="button" variant="secondary">{pendingAction === interest.id ? 'Removing…' : 'Remove Interest'}</Button> : null}{status !== 'owned' && status !== 'interested' ? <Button aria-label={`Add ${player.displayName} to Interests`} disabled={pendingAction === player.id} onClick={onAddInterest} type="button"><Star aria-hidden="true" size={16} />{pendingAction === player.id ? 'Adding…' : 'Add to Interests'}</Button> : null}<Button onClick={onClose} type="button" variant="ghost">Close</Button></footer></aside></div>
  );
}

function EmptyActivity({ action, icon, onAction, title }: { action: string; icon: ReactNode; onAction: () => void; title: string }) {
  return <div className="market-page__empty market-page__empty--activity"><span className="market-page__empty-icon">{icon}</span><strong>{title}</strong><Button onClick={onAction} type="button">{action}<ArrowRight aria-hidden="true" size={16} /></Button></div>;
}

function Metric({ className = '', dots = false, formHistory, hideLabel = false, label, value }: { className?: string; dots?: boolean; formHistory?: PlayerCardFormGameweek[]; hideLabel?: boolean; label: string; value: number | string | null }) {
  return <div className={`market-page__metric ${className}`.trim()}>{hideLabel ? null : <span>{label}</span>}<strong>{typeof value === 'number' ? formatMetric(value) : value ?? '—'}</strong>{dots ? <FormDots history={formHistory} /> : null}</div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`market-page__status-badge status-${status}`}>{formatTradeStatus(status)}</span>;
}

function toPlayerCardPlayer(player: MarketPlayer, ownershipTone: PlayerCardFixtureTone): PlayerCardPlayer {
  return {
    displayName: player.displayName,
    fixtures: [{ label: ownerLabel(player), title: player.ownerName ? `Owned by ${player.ownerName}` : 'Free player', tone: ownershipTone }],
    form: player.form,
    formHistory: toPlayerCardFormHistory(player.formHistory),
    position: player.position,
    team: player.club,
  };
}

function ownerLabel(player: MarketPlayer): string {
  return player.ownerName ?? 'Free';
}

function ownershipToneFor(player: MarketPlayer, managerTeam: SquadApiTeam): PlayerCardFixtureTone {
  if (!player.draftTeamId && !player.draftTeamName) return 'secondary';
  if (player.draftTeamId === managerTeam.id || player.draftTeamName === managerTeam.name) return 'primary';
  return 'tertiary';
}

function modeFromPath(path: string): MarketMode {
  if (path.startsWith('/scouting/interests')) return 'interests';
  if (path.startsWith('/scouting/trades')) return 'trades';
  if (path.startsWith('/scouting/draws')) return 'draws';
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
    draftTeamId: player.draft_team?.id ?? null,
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
    formHistory: player.form_history ?? [],
  };
}

function mapInterest(interest: ApiInterest): InterestView {
  return { id: interest.id, player: mapPlayer(interest.player), gameweekName: interest.gameweek?.name ?? null, note: interest.note ?? null };
}

function mapTrade(trade: ApiTrade): TradeView {
  return { id: trade.id, status: trade.status, offeredById: trade.offered_by?.id ?? null, offeredToId: trade.offered_to?.id ?? null, offeredBy: trade.offered_by?.name ?? null, offeredTo: trade.offered_to?.name ?? null, approvalStatus: trade.approval_status ?? null, requiredApproverRole: trade.required_approver_role ?? null, executedAt: trade.executed_at ?? null, assetNames: (trade.assets ?? []).map((asset) => asset.player?.display_name ?? '').filter(Boolean) };
}

function effectiveStatus(player: MarketPlayer, interestedPlayerIds: Set<string>, managerTeam: SquadApiTeam): MarketPlayer['status'] {
  if (interestedPlayerIds.has(player.id) && player.status !== 'owned') return 'interested';
  if (player.status === 'owned' && ownershipToneFor(player, managerTeam) === 'tertiary') return 'owned_by_other';
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
  if (status === 'open_for_preferences') return 'Preferences open';
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'locked') return 'Locked';
  if (status === 'processing') return 'Processing';
  if (status === 'processed') return 'Processed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'corrected') return 'Corrected';
  if (status === 'trade_target') return 'Trade target';
  if (status === 'proposed') return 'Needs review';
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

function formatDrawStatus(status: string): string {
  return formatTradeStatus(status);
}

function formatDrawDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}

function drawCanOpen(draw: FreeAgencyDraw): boolean {
  const now = Date.now();
  const opensAt = draw.opens_at ? Date.parse(draw.opens_at) : null;
  const closesAt = Date.parse(draw.closes_at);
  return (opensAt === null || (Number.isFinite(opensAt) && opensAt <= now))
    && Number.isFinite(closesAt) && closesAt > now;
}

function drawCanProcess(draw: FreeAgencyDraw): boolean {
  const closesAt = Date.parse(draw.closes_at);
  return Number.isFinite(closesAt) && closesAt <= Date.now();
}

function mapDrawPreferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return (value as DrawPreference[])
    .filter((preference) => preference && typeof preference.player_id === 'string' && Number.isFinite(preference.rank))
    .sort((left, right) => left.rank - right.rank)
    .map((preference) => preference.player_id);
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...init?.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : `Request failed with ${response.status}.`);
  return payload as T;
}

function getFulfilled<T>(result: PromiseSettledResult<T>, label: string, errors: string[]): T | null {
  if (result.status === 'fulfilled') return result.value;
  errors.push(label);
  return null;
}
