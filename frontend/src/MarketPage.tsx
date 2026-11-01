import { fetchWithQuery as fetch } from './query-cache';
import { type MutableRefObject, type ReactNode, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Binoculars,
  Bookmark,
  CircleAlert,
  Filter,
  ListOrdered,
  MoveDown,
  MoveUp,
  Search,
  Star,
  Users,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { SortableTableHead, useSortedRows } from './components/ui/sortable-table';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, useCarousel, type CarouselApi } from './components/ui/carousel';
import { PlayerCard, type PlayerCardFixtureTone, type PlayerCardPlayer } from './components/player/PlayerCard';
import { PageHero, PageHeroControls, PageHeroViewToggle } from './components/ui/page-hero';
import { PlayerFormMinutesGroupComparison, PlayerProfilePage } from './PlayerProfilePage';
import { FixtureSquadComparison, type FixtureSquadView } from './components/fixture/FixtureSquadComparison';
import type { FixturePlayerFixture, FixtureSquad, FixtureSquadPlayer } from './league-api';
import { useModalLifecycle } from './components/ui/sheet';
import type { SessionState, ThemePreset } from './contracts';
import { managerNicknameForTeam } from './manager-nicknames';
import { invalidateData, subscribeDataFreshness } from './data-freshness';
import { invalidateQueryCache } from './query-cache';
import { HttpSquadClient, type SquadApiFormGameweek, type SquadApiPlayer, type SquadApiTeam } from './squad-api';
import { HttpLoansClient } from './loans-api';
import { toPlayerCardFormHistory } from './player-form';
import './market-page.css';

interface MarketPageProps {
  currentPath: string;
  onNavigate: (href: string) => void;
  preset: ThemePreset;
  session?: SessionState;
}

const LoansPanel = lazy(() => import('./LoansPanel').then((module) => ({ default: module.LoansPanel })));
const marketSquadClient = new HttpSquadClient();
const marketLoansClient = new HttpLoansClient();

type MarketMode = 'discover' | 'scouting' | 'interests' | 'trades' | 'draws' | 'loans';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type FixtureFilter = 'all' | 'easy';
type SortKey = 'points' | 'form' | 'xg' | 'xa' | 'value';

interface MarketPlayer {
  id: string;
  displayName: string;
  position: string;
  club: string;
  clubId: string;
  clubName: string;
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
  nextFixture: SquadApiPlayer['next_fixture'];
  nextFixtures: SquadApiPlayer['next_fixtures'];
  availabilityStatus: string | null;
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
  offeredById: string | null;
  offeredToId: string | null;
  offeredBy: string | null;
  offeredTo: string | null;
  approvalStatus?: string | null;
  requiredApproverRole?: string | null;
  executedAt?: string | null;
  assetNames: string[];
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
  const [selectedTradeTarget, setSelectedTradeTarget] = useState<MarketPlayer | null>(null);
  const [ownedPlayers, setOwnedPlayers] = useState<MarketPlayer[]>([]);
  const [tradeSubmissionPending, setTradeSubmissionPending] = useState(false);
  const tradeSubmissionRef = useRef(false);
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
  const hasLoadedMarketRef = useRef(false);
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
      if (!hasLoadedMarketRef.current) setLoading(true);
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
        setOwnedPlayers(summary.players
          .filter((player) => player.status === 'owned' && player.draft_team?.id === summary.manager_team.id)
          .map(mapPlayer));
      }
      if (scouting) setPlayers(scouting.players.map(mapPlayer));
      if (interestPayload) setInterests(interestPayload.map(mapInterest));
      if (tradePayload) setTrades((tradePayload.trades ?? []).map(mapTrade));
      if (errors.length < 4) hasLoadedMarketRef.current = true;
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

  function beginTradeProposal(player: MarketPlayer) {
    if (player.status !== 'owned_by_other' || !player.draftTeamId) return;
    setSelectedPlayer(null);
    setSelectedTradeTarget(player);
  }

  async function submitTradeProposal(target: MarketPlayer, offeredPlayerIds: string[], requestedPlayerIds: string[]) {
    if (!target.draftTeamId || tradeSubmissionRef.current) return;
    tradeSubmissionRef.current = true;
    setTradeSubmissionPending(true);
    try {
      await marketSquadClient.createTrade(target.draftTeamId, offeredPlayerIds, requestedPlayerIds);
      setSelectedTradeTarget(null);
      setNotice(`Trade proposal for ${target.displayName} sent to ${target.ownerName ?? 'the selected manager'}.`);
      setRefreshKey((key) => key + 1);
      invalidateData(['trade'], 'market');
    } finally {
      tradeSubmissionRef.current = false;
      setTradeSubmissionPending(false);
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
            <PageHeroViewToggle
              ariaLabel="Market workspace sections"
              onChange={(nextMode) => selectMode(nextMode as MarketMode)}
              options={[
                { value: 'discover', label: 'Discovery', icon: <Search aria-hidden="true" size={17} /> },
                { value: 'scouting', label: 'Scouting', icon: <Binoculars aria-hidden="true" size={17} /> },
                { value: 'interests', label: 'Interests', icon: <Bookmark aria-hidden="true" size={17} /> },
                { value: 'trades', label: 'Trades', icon: <ArrowRightLeft aria-hidden="true" size={17} /> },
                { value: 'draws', label: 'Free agency', icon: <ListOrdered aria-hidden="true" size={17} /> },
              ]}
              value={mode === 'loans' ? 'trades' : mode}
            />
          </PageHeroControls>
        )}
        actionsLabel="Market utilities"
        onNavigate={onNavigate}
        title="Market"
        titleId="market-page-title"
      />

      {mode !== 'scouting' && error ? (
        <div className="market-page__error" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          <span>{error}</span>
          <Button disabled={loading} onClick={() => setRefreshKey((key) => key + 1)} type="button" variant="secondary">{loading ? 'Retrying…' : 'Retry'}</Button>
        </div>
      ) : null}
      {mode !== 'scouting' && notice && !error ? <p className="market-page__status" role="status">{notice}</p> : null}

      <section className="market-page__workspace">
        {mode === 'trades' || mode === 'loans' ? <nav aria-label="Trade workflows" className="market-page__workflow-links">
          <Button aria-pressed={mode === 'trades'} onClick={() => selectMode('trades')} variant="secondary">Trades</Button>
          <Button aria-pressed={mode === 'loans'} onClick={() => selectMode('loans')} variant="secondary">Loans</Button>
        </nav> : null}
        {mode === 'loans' ? <Suspense fallback={<p role="status">Loading loans…</p>}><LoansPanel
          managerTeam={managerTeam}
          players={players.map((player) => ({ id: player.id, name: player.displayName, ownerTeamId: player.draftTeamId, ownerTeamName: player.draftTeamName }))}
          roles={session?.user?.roles ?? []}
          teams={Array.from(new Map([[managerTeam.id, managerTeam], ...players.filter((player) => player.draftTeamId).map((player) => [player.draftTeamId!, { id: player.draftTeamId!, name: player.draftTeamName ?? player.draftTeamId! }] as const)]).values())}
        /></Suspense> : null}
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
        {mode === 'scouting' ? (
          <ScoutingPanel
            failed={failedSections.has('player pool')}
            loading={loading}
            managerTeam={managerTeam}
            onOpenPlayer={openPlayer}
            players={players}
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
            invalidateQueryCache();
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
          interest={interests.find((item) => item.player.id === selectedPlayer.id) ?? null}
          onAddInterest={() => void registerInterest(selectedPlayer)}
          onClose={() => setSelectedPlayer(null)}
          onNavigate={onNavigate}
          onRemoveInterest={removeInterest}
          pendingAction={pendingAction}
          player={selectedPlayer}
          managerTeam={managerTeam}
          drawerRef={drawerRef}
          onProposeTrade={beginTradeProposal}
        />
      ) : null}
      {selectedTradeTarget ? (
        <TradeProposalDrawer
          drawerRef={drawerRef}
          onClose={() => setSelectedTradeTarget(null)}
          onSubmit={(offeredPlayerIds, requestedPlayerIds) => submitTradeProposal(selectedTradeTarget, offeredPlayerIds, requestedPlayerIds)}
          ownedPlayers={ownedPlayers}
          otherPlayers={players.filter((player) => player.draftTeamId === selectedTradeTarget.draftTeamId)}
          pending={tradeSubmissionPending}
          target={selectedTradeTarget}
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
  const { direction, onSort, sortColumn, sortedRows } = useSortedRows(filteredPlayers, (player, column) => {
    if (column === 'player') return player.displayName;
    if (column === 'points') return player.points;
    if (column === 'form') return player.form;
    if (column === 'value') return player.value;
    return (player.xg ?? -1) * 1_000_000 + (player.xa ?? -1);
  });
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
          <Table aria-label="Market player results" className="market-page__player-table">
            <TableCaption className="sr-only">Market player results</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead><SortableTableHead column="player" direction={direction} onSort={onSort} sortColumn={sortColumn}>Player</SortableTableHead></TableHead>
                <TableHead><SortableTableHead column="points" direction={direction} onSort={onSort} sortColumn={sortColumn}>Pts</SortableTableHead></TableHead>
                <TableHead><SortableTableHead column="form" direction={direction} onSort={onSort} sortColumn={sortColumn}>Form</SortableTableHead></TableHead>
                <TableHead><SortableTableHead column="value" direction={direction} onSort={onSort} sortColumn={sortColumn}>Value</SortableTableHead></TableHead>
                <TableHead><SortableTableHead column="expected" direction={direction} onSort={onSort} sortColumn={sortColumn}>xG / xA</SortableTableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((player) => (
                <MarketPlayerRow
                  key={player.id}
                  managerTeam={managerTeam}
                  onOpen={onOpenPlayer}
                  player={player}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function ScoutingPanel({ failed, loading, managerTeam, onOpenPlayer, players }: { failed: boolean; loading: boolean; managerTeam: SquadApiTeam; onOpenPlayer: (player: MarketPlayer) => void; players: MarketPlayer[] }) {
  const teams = useMemo(() => Array.from(new Map(players.map((player) => [player.clubId, { id: player.clubId, name: player.clubName }])).values()).sort((left, right) => left.name.localeCompare(right.name)), [players]);
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPositionIndex, setSelectedPositionIndex] = useState(0);
  useEffect(() => {
    if (!api) return undefined;
    const syncSelectedTeam = () => setSelectedIndex(api.selectedScrollSnap());
    syncSelectedTeam();
    api.on('select', syncSelectedTeam);
    api.on('reInit', syncSelectedTeam);
    return () => {
      api.off('select', syncSelectedTeam);
      api.off('reInit', syncSelectedTeam);
    };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    if (api.selectedScrollSnap() >= teams.length) api.scrollTo(Math.max(teams.length - 1, 0));
  }, [api, teams.length]);

  useEffect(() => {
    if (!api) return undefined;
    const updateTeamSlideEmphasis = () => {
      const snapList = api.scrollSnapList();
      const progress = api.scrollProgress();
      const cards = api.slideNodes()
        .map((slide) => slide.querySelector<HTMLElement>('.market-page__scouting-team'))
        .filter((card): card is HTMLElement => card !== null);

      cards.forEach((card, index) => {
        const snap = snapList[index];
        if (snap === undefined || snapList.length === 0) return;
        const directDistance = Math.abs(snap - progress) % 1;
        const wrappedDistance = Math.min(directDistance, 1 - directDistance);
        const cardDistance = wrappedDistance * snapList.length;
        const scale = Math.max(0.8, 1 - cardDistance * 0.14);
        const opacity = Math.max(0.34, 1 - cardDistance * 0.45);
        card.style.transform = `scale(${scale})`;
        card.style.opacity = `${opacity}`;
      });
    };

    updateTeamSlideEmphasis();
    api.on('reInit', updateTeamSlideEmphasis);
    api.on('scroll', updateTeamSlideEmphasis);
    return () => {
      api.off('reInit', updateTeamSlideEmphasis);
      api.off('scroll', updateTeamSlideEmphasis);
    };
  }, [api]);

  if (loading && players.length === 0) return <div aria-label="Loading scouting players" className="market-page__scouting-loading" role="status">Loading Premier League players…</div>;
  if (failed && players.length === 0) return <div className="market-page__empty" role="alert"><CircleAlert aria-hidden="true" size={22} /><strong>Scouting data is unavailable</strong></div>;
  if (teams.length === 0) return <div className="market-page__empty"><Binoculars aria-hidden="true" size={22} /><strong>No Premier League players are available</strong></div>;

  const activeTeam = teams[Math.min(selectedIndex, teams.length - 1)] ?? teams[0];
  return (
    <section aria-label="Scouting by Premier League team" className="market-page__scouting">
      <header className="market-page__scouting-header">
        <p className="eyebrow">Premier League teams</p>
      </header>
      {failed ? <p className="market-page__status" role="status">Some scouting data could not be refreshed. Showing the available players.</p> : null}
      <Carousel aria-label="Premier League teams" className="market-page__scouting-carousel" opts={{ align: "center", loop: teams.length > 1 }} setApi={setApi}>
        <CarouselContent className="market-page__scouting-track">
          {teams.map((team) => (
            <ScoutingTeamCard
              key={team.id}
              managerTeam={managerTeam}
              onOpenPlayer={onOpenPlayer}
              onPositionChange={setSelectedPositionIndex}
              players={players.filter((player) => player.clubId === team.id)}
              selectedPositionIndex={selectedPositionIndex}
              teamName={team.name}
            />
          ))}
        </CarouselContent>
        <CarouselPrevious aria-label={`Previous team from ${activeTeam.name}`} />
        <CarouselNext aria-label={`Next team from ${activeTeam.name}`} />
      </Carousel>
      <nav aria-label="Premier League team navigation" className="market-page__scouting-team-dots">
        {teams.map((team, index) => (
          <button
            aria-current={index === selectedIndex ? 'true' : undefined}
            aria-label={`Go to ${team.name}`}
            className={`market-page__scouting-team-dot${index === selectedIndex ? ' is-selected' : ''}`}
            key={team.id}
            onClick={() => api?.scrollTo(index)}
            type="button"
          />
        ))}
      </nav>
      <p className="market-page__scouting-hint">Swipe horizontally to browse teams. Select a player to open their profile.</p>
    </section>
  );
}


const SCOUTING_TEAM_CONTAINER_REM = 30;

function ScoutingTeamCard({ managerTeam, onOpenPlayer, onPositionChange, players, selectedPositionIndex, teamName }: { managerTeam: SquadApiTeam; onOpenPlayer: (player: MarketPlayer) => void; onPositionChange: (index: number) => void; players: MarketPlayer[]; selectedPositionIndex: number; teamName: string }) {
  const [positionApi, setPositionApi] = useState<CarouselApi>();
  useEffect(() => {
    if (!positionApi) return undefined;
    const syncSelectedPosition = () => onPositionChange(positionApi.selectedScrollSnap());
    positionApi.on('select', syncSelectedPosition);
    return () => {
      positionApi.off('select', syncSelectedPosition);
    };
  }, [onPositionChange, positionApi]);

  useEffect(() => {
    if (positionApi && positionApi.selectedScrollSnap() !== selectedPositionIndex) {
      positionApi.scrollTo(selectedPositionIndex, true);
    }
  }, [positionApi, selectedPositionIndex]);
  return (
    <CarouselItem aria-label={teamName} className="market-page__scouting-slide">
      <div className="market-page__scouting-team" style={{ height: `${SCOUTING_TEAM_CONTAINER_REM}rem` }}>
        <header className="market-page__scouting-team-header">
          <h2>{teamName}</h2>
          <nav aria-label={`${teamName} position navigation`} className="market-page__scouting-position-dots">
            {scoutingPositionGroups.map(({ label }, index) => (
              <button
                aria-current={index === selectedPositionIndex ? 'true' : undefined}
                aria-label={`Go to ${label} at ${teamName}`}
                className={`market-page__scouting-position-dot${index === selectedPositionIndex ? ' is-selected' : ''}`}
                key={label}
                onClick={() => positionApi?.scrollTo(index)}
                type="button"
              />
            ))}
          </nav>
        </header>
        <Carousel
          aria-label={`${teamName} player positions`}
          className="market-page__scouting-position-carousel"
          orientation="vertical"
          opts={{ loop: false }}
          setApi={setPositionApi}
        >
          <CarouselContent className="market-page__scouting-position-track">
            {scoutingPositionGroups.map(({ label, value }) => {
              const positionPlayers = players
                .filter((player) => player.position === value)
                .sort((left, right) => comparePlayers(left, right, 'points'));
              return (
                <CarouselItem aria-label={`${label} at ${teamName}`} className="market-page__scouting-position-slide" key={value}>
                  <section className="market-page__scouting-position">
                    <header className="market-page__scouting-position-header">
                      <h3>{label}</h3>
                      <span>{positionPlayers.length}</span>
                    </header>
                    {positionPlayers.length > 0 ? (
                      <div aria-label={`${label} player cards`} className="market-page__scouting-player-grid">
                        {positionPlayers.map((player) => (
                          <button
                            aria-label={`View ${player.displayName} details, ${formatInteger(player.points)} points, ${player.ownerName ? `owned by ${player.ownerName}` : 'free agent'}`}
                            className="market-page__scouting-player"
                            key={player.id}
                            onClick={() => onOpenPlayer(player)}
                            type="button"
                          >
                            <PlayerCard formPosition="below" layout="pitch" player={toPlayerCardPlayer(player, ownershipToneFor(player, managerTeam))} points={player.points ?? 0} showPositionMarker={false} size="sm" />
                          </button>
                        ))}
                      </div>
                    ) : <p className="market-page__scouting-empty">No players in this position</p>}
                  </section>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>
    </CarouselItem>
  );
}
const scoutingPositionGroups: Array<{ label: string; value: string }> = [
  { label: 'Goalkeepers', value: 'GKP' },
  { label: 'Defenders', value: 'DEF' },
  { label: 'Midfielders', value: 'MID' },
  { label: 'Forwards', value: 'FWD' },
];

function MarketLoadingTable() {
  return (
    <div aria-label="Loading market players" className="market-page__table-wrap market-page__table-wrap--loading" role="status">
      <Table aria-hidden="true" className="market-page__player-table">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Player</TableHead>
            <TableHead scope="col">Pts</TableHead>
            <TableHead scope="col">Form</TableHead>
            <TableHead scope="col">Value</TableHead>
            <TableHead scope="col">xG / xA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 7 }, (_, index) => (
            <TableRow className="market-page__loading-row" key={index}>
              <TableCell><span className="market-page__loading-block market-page__loading-block--player" /></TableCell>
              <TableCell><span className="market-page__loading-block market-page__loading-block--number" /></TableCell>
              <TableCell><span className="market-page__loading-block market-page__loading-block--number" /></TableCell>
              <TableCell><span className="market-page__loading-block market-page__loading-block--number" /></TableCell>
              <TableCell><span className="market-page__loading-block" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MarketPlayerRow({ managerTeam, onOpen, player }: { managerTeam: SquadApiTeam; onOpen: (player: MarketPlayer) => void; player: MarketPlayer }) {
  const rowLabel = `View ${player.displayName} details`;
  return (
    <TableRow
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
      <TableCell className="market-page__player-cell">
        <div className="market-page__player-identity">
          <PlayerCard className="market-page__list-player-card" formPosition="beside" layout="list" player={toPlayerCardPlayer(player, ownershipToneFor(player, managerTeam))} showPositionMarker={false} size="sm" />
        </div>
      </TableCell>
      <TableCell><strong className="market-page__list-points">{formatInteger(player.points)}</strong></TableCell>
      <TableCell><strong className="market-page__list-metric">{formatMetric(player.form)}</strong></TableCell>
      <TableCell><strong className="market-page__list-metric">{formatMetric(player.value)}</strong></TableCell>
      <TableCell><span className="market-page__expected"><span>{formatMetric(player.xg)}</span><span>{formatMetric(player.xa)}</span></span></TableCell>
    </TableRow>
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

function PlayerDrawer({ drawerRef, interest, managerTeam, onAddInterest, onClose, onNavigate, onProposeTrade, onRemoveInterest, pendingAction, player }: { drawerRef: MutableRefObject<HTMLElement | null>; interest: InterestView | null; managerTeam: SquadApiTeam; onAddInterest: () => void; onClose: () => void; onNavigate: (href: string) => void; onProposeTrade: (player: MarketPlayer) => void; onRemoveInterest: (interest: InterestView) => Promise<void>; pendingAction: string | null; player: MarketPlayer }) {
  useModalLifecycle(drawerRef, true, onClose);
  const status = effectiveStatus(player, interest ? new Set([player.id]) : new Set(), managerTeam);
  const actionDisabled = pendingAction !== null;

  return (
    <div className="market-page__drawer-layer">
      <button aria-label="Close player details" className="market-page__drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label={`Player profile for ${player.displayName}`} aria-modal="true" className="market-page__drawer market-page__drawer--profile" ref={drawerRef} role="dialog" tabIndex={-1}>
        <PlayerProfilePage
          actionBar={(
            <>
              {status === 'owned' ? (
                <button className="player-profile__action" onClick={() => { onClose(); onNavigate('/squad'); }} type="button">
                  <Users aria-hidden="true" size={17} />
                  <span>View in Squad</span>
                </button>
              ) : status === 'owned_by_other' ? (
                <button aria-label={`Propose trade for ${player.displayName}`} className="player-profile__action" onClick={() => onProposeTrade(player)} type="button">
                  <ArrowRightLeft aria-hidden="true" size={17} />
                  <span>Propose trade</span>
                </button>
              ) : status === 'interested' && interest ? (
                <button aria-label={`Remove ${player.displayName} from Interests`} className="player-profile__action" disabled={pendingAction === interest.id} onClick={() => void onRemoveInterest(interest)} type="button">
                  <span>{pendingAction === interest.id ? 'Removing…' : 'Remove Interest'}</span>
                </button>
              ) : (
                <button aria-label={`Add ${player.displayName} to Interests`} className="player-profile__action" disabled={actionDisabled} onClick={onAddInterest} type="button">
                  <Star aria-hidden="true" size={17} />
                  <span>{pendingAction === player.id ? 'Adding…' : 'Add to Interests'}</span>
                </button>
              )}
              <button className="player-profile__action" onClick={onClose} type="button">
                <span>Close</span>
              </button>
            </>
          )}
          actionBarLabel="Scouting player actions"
          initialPlayer={toProfilePlayer(player)}
          onClose={onClose}
          playerId={player.id}
          presentation="drawer"
          showActions={false}
        />
      </aside>
    </div>
  );
}

function TradeProposalDrawer({ drawerRef, onClose, onSubmit, otherPlayers, ownedPlayers, pending, target }: {
  drawerRef: MutableRefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: (offeredPlayerIds: string[], requestedPlayerIds: string[]) => Promise<void>;
  otherPlayers: MarketPlayer[];
  ownedPlayers: MarketPlayer[];
  pending: boolean;
  target: MarketPlayer;
}) {
  useModalLifecycle(drawerRef, true, onClose);
  const [offeredPlayerIds, setOfferedPlayerIds] = useState<string[]>([]);
  const [requestedPlayerIds, setRequestedPlayerIds] = useState<string[]>([target.id]);
  const [view, setView] = useState<FixtureSquadView>(() => window.localStorage.getItem('cdl:squad-view') === 'list' ? 'list' : 'pitch');
  const [selectionOpen, setSelectionOpen] = useState(() => window.sessionStorage.getItem('cdl:trade-selection-open') !== 'false');
  const [proposalType, setProposalType] = useState<'trade' | 'loan'>('trade');
  const [loanDuration, setLoanDuration] = useState(4);
  const [loanNotice, setLoanNotice] = useState('');
  const [loanPending, setLoanPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => { body.style.overflow = previousOverflow; };
  }, []);
  const selectedOfferPlayers = offeredPlayerIds.map((id) => ownedPlayers.find((player) => player.id === id)).filter((player): player is MarketPlayer => player !== undefined);
  const selectedRequestPlayers = requestedPlayerIds.map((id) => otherPlayers.find((player) => player.id === id)).filter((player): player is MarketPlayer => player !== undefined);
  const selectedAssets = alternateTradeAssets<{ player: MarketPlayer; direction: 'in' | 'out'; label: string }>(
    selectedOfferPlayers.map((player) => ({ player, direction: 'out' as const, label: proposalType === 'loan' ? 'Player to loan' : 'You offer' })),
    proposalType === 'trade' ? selectedRequestPlayers.map((player) => ({ player, direction: 'in' as const, label: 'You request' })) : [],
  );
  const tradeSquads = [
    createTradeFixtureSquad(ownedPlayers, true, 'Your squad', ownedPlayers[0]?.draftTeamId ?? 'trade-user-squad', ownedPlayers[0]?.draftTeamName ?? 'Your squad'),
    createTradeFixtureSquad(otherPlayers, false, `${target.ownerName ?? 'Their'} squad`, target.draftTeamId ?? 'trade-opponent-squad', target.draftTeamName ?? target.ownerName ?? 'Their squad'),
  ];

  function togglePlayer(side: 'offer' | 'request', player: MarketPlayer) {
    if (side === 'offer' && proposalType === 'loan') {
      setOfferedPlayerIds((ids) => ids.length === 1 && ids[0] === player.id ? [] : [player.id]);
      return;
    }
    const setter = side === 'offer' ? setOfferedPlayerIds : setRequestedPlayerIds;
    setter((ids) => ids.includes(player.id) ? ids.filter((id) => id !== player.id) : [...ids, player.id]);
  }

  async function submit() {
    if (offeredPlayerIds.length === 0 || requestedPlayerIds.length === 0 || pending) return;
    setError('');
    try {
      await onSubmit(offeredPlayerIds, requestedPlayerIds);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send the trade proposal.');
    }
  }

  async function submitLoan() {
    const player = selectedOfferPlayers[0];
    if (!player || !target.draftTeamId || loanPending) return;
    setLoanPending(true);
    setLoanNotice('');
    try {
      const response = await marketLoansClient.createLoan({ player_id: player.id, borrower_team_id: target.draftTeamId, duration_gameweeks: Math.max(4, Math.floor(loanDuration)) });
      setLoanNotice(`Proposal sent to ${response.loan.borrower_team_name}.`);
      invalidateData(['squad'], 'market');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Loan proposal could not be sent.');
    } finally { setLoanPending(false); }
  }

  return (
    <div className="market-page__drawer-layer">
      <button aria-label="Close trade proposal" className="market-page__drawer-backdrop" disabled={pending} onClick={onClose} type="button" />
      <aside aria-label={`Trade proposal for ${target.displayName}`} aria-modal="true" className="market-page__drawer market-page__drawer--planner" ref={drawerRef} role="dialog" tabIndex={-1}>
        <div className="market-page__trade-proposal">
          <header className="market-page__planner-header"><div><h2>Propose to {target.ownerName ?? 'manager'}</h2><span>{target.displayName}</span></div><Button aria-label="Close proposal" disabled={pending || loanPending} onClick={onClose} type="button" variant="ghost">×</Button></header>
          <div aria-label="Proposal type" className="market-page__proposal-type" role="group">
            <Button aria-pressed={proposalType === 'trade'} onClick={() => { setProposalType('trade'); setError(''); }} type="button" variant={proposalType === 'trade' ? 'primary' : 'secondary'}>Trade</Button>
            <Button aria-pressed={proposalType === 'loan'} onClick={() => { setProposalType('loan'); setOfferedPlayerIds([]); setError(''); }} type="button" variant={proposalType === 'loan' ? 'primary' : 'secondary'}>Loan</Button>
          </div>
          <section className="market-page__trade-selection">
            <button aria-controls="trade-player-selection" aria-expanded={selectionOpen} className="market-page__accordion-trigger" onClick={() => setSelectionOpen((open) => { window.sessionStorage.setItem('cdl:trade-selection-open', String(!open)); return !open; })} type="button"><span>Players</span><span>{selectionOpen ? '−' : '+'}</span></button>
            {selectionOpen ? <div id="trade-player-selection" className="market-page__trade-selection-content">
              <FixtureSquadComparison
                attackDirection="down" gameweekStatus="future"
                onPlayerClick={(fixturePlayer) => {
                  const player = [...ownedPlayers, ...otherPlayers].find((candidate) => candidate.id === fixturePlayer.id);
                  if (!player) return;
                  const isOwned = ownedPlayers.some((candidate) => candidate.id === player.id);
                  if (!isOwned && proposalType === 'loan') return;
                  togglePlayer(isOwned ? 'offer' : 'request', player);
                }}
                onViewChange={(nextView) => { setView(nextView); window.localStorage.setItem('cdl:squad-view', nextView); }}
                playerInteraction="select" pitchFixtureDisplay="home-club"
                selectedPlayerIds={new Set(proposalType === 'trade' ? [...offeredPlayerIds, ...requestedPlayerIds] : offeredPlayerIds)}
                showViewToggle sortableList squads={tradeSquads} view={view}
              />
            </div> : null}
          </section>
          <TradeSelectedCarousel assets={selectedAssets} onRemove={(direction, player) => togglePlayer(direction === 'out' ? 'offer' : 'request', player)} />
          {proposalType === 'loan' ? <label className="market-page__loan-duration">Duration (gameweeks)<input min={4} onChange={(event) => setLoanDuration(Math.max(4, Number(event.currentTarget.value) || 4))} type="number" value={loanDuration} /></label> : null}
          {error ? <p role="alert">{error}</p> : null}
          {loanNotice ? <p role="status">{loanNotice}</p> : null}
          <div className="market-page__trade-proposal-actions">
            {proposalType === 'trade' ? <Button disabled={offeredPlayerIds.length === 0 || requestedPlayerIds.length === 0 || pending || loanPending} onClick={() => void submit()} type="button">{pending ? 'Sending…' : 'Send trade proposal'}</Button> : <Button disabled={selectedOfferPlayers.length !== 1 || !target.draftTeamId || loanPending} onClick={() => void submitLoan()} type="button">{loanPending ? 'Sending…' : 'Send loan proposal'}</Button>}
            <Button disabled={pending || loanPending} onClick={onClose} type="button" variant="secondary">Close</Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TradeSelectedCarousel({ assets, onRemove }: {
  assets: Array<{ player: MarketPlayer; direction: 'in' | 'out'; label: string }>;
  onRemove: (direction: 'in' | 'out', player: MarketPlayer) => void;
}) {
  return (
    <section aria-label="Selected trade players" className="market-page__selected-strip">
      <h3>Trade players</h3>
      {assets.length ? (
        <Carousel aria-label="Trade player cards" className="market-page__selected-carousel" opts={{ align: 'start', containScroll: 'trimSnaps' }}>
          <CarouselContent className="market-page__selected-carousel-track">
            {assets.map(({ direction, label, player }, index) => (
              <CarouselItem aria-label={`${player.displayName}, ${index + 1} of ${assets.length}`} className="market-page__selected-carousel-slide" key={`${direction}:${player.id}`}>
                <article className={`market-page__selected-player-card market-page__selected-player-card--${direction}`} data-testid="trade-selected-player-card">
                  <span className={`market-page__direction-label market-page__direction-label--${direction}`}>{label}</span>
                  <PlayerCard ariaLabel={`Player card for ${player.displayName}`} className="market-page__selected-player-header" formPosition="below" layout="token" player={toTradeRosterPlayer(player, 'home')} size="sm" />
                  <PlayerFormMinutesGroupComparison players={[toProfilePlayer(player)]} squadClient={marketSquadClient} />
                  <button aria-label={`Remove ${player.displayName} from ${label}`} className="market-page__selected-player-card-remove" onClick={() => onRemove(direction, player)} type="button">×</button>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselDots assets={assets} />
          {assets.length > 2 ? <><CarouselPrevious aria-label="Previous trade players" /><CarouselNext aria-label="Next trade players" /></> : null}
        </Carousel>
      ) : <div className="market-page__selected-carousel-empty">Select players above to build your proposal.</div>}
    </section>
  );
}

function alternateTradeAssets<T>(outgoing: T[], incoming: T[]): T[] {
  const alternating: T[] = [];
  for (let index = 0; index < Math.max(outgoing.length, incoming.length); index += 1) {
    if (outgoing[index] !== undefined) alternating.push(outgoing[index]);
    if (incoming[index] !== undefined) alternating.push(incoming[index]);
  }
  return alternating;
}

function CarouselDots({ assets }: { assets: Array<{ player: MarketPlayer; direction: 'in' | 'out'; label: string }> }) {
  const { api } = useCarousel();
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    if (!api) return undefined;
    const updateIndex = () => setActiveIndex(api.selectedScrollSnap());
    updateIndex();
    api.on('select', updateIndex);
    api.on('reInit', updateIndex);
    return () => { api.off('select', updateIndex); api.off('reInit', updateIndex); };
  }, [api]);
  return <div aria-label="Trade player navigation" className="market-page__carousel-dots" role="group">
    {assets.map(({ direction, player }, index) => <button aria-label={`Show ${player.displayName}`} aria-pressed={activeIndex === index} className={`market-page__carousel-dot market-page__carousel-dot--${direction}`} key={player.id} onClick={() => api?.scrollTo(index)} type="button" />)}
  </div>;
}

function EmptyActivity({ action, icon, onAction, title }: { action: string; icon: ReactNode; onAction: () => void; title: string }) {
  return <div className="market-page__empty market-page__empty--activity"><span className="market-page__empty-icon">{icon}</span><strong>{title}</strong><Button onClick={onAction} type="button">{action}<ArrowRight aria-hidden="true" size={16} /></Button></div>;
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

function createTradeFixtureSquad(players: MarketPlayer[], isUserTeam: boolean, teamName: string, teamId: string, managerName: string): FixtureSquad {
  const positionOrder = ['GKP', 'DEF', 'MID', 'FWD'];
  const available = players.map(toTradeFixturePlayer).sort((left, right) => positionOrder.indexOf(left.position) - positionOrder.indexOf(right.position) || left.displayName.localeCompare(right.displayName));
  const starters: FixtureSquadPlayer[] = [];
  const startingFormation: Record<string, number> = { GKP: 1, DEF: 4, MID: 4, FWD: 2 };
  for (const position of positionOrder) starters.push(...available.filter((player) => player.position === position).slice(0, startingFormation[position]));
  if (starters.length < Math.min(11, available.length)) {
    const startingIds = new Set(starters.map((player) => player.id));
    starters.push(...available.filter((player) => !startingIds.has(player.id)).slice(0, 11 - starters.length));
  }
  const startingIds = new Set(starters.map((player) => player.id));
  const remainder = available.filter((player) => !startingIds.has(player.id));
  const bench = remainder.slice(0, 5).map((player) => ({ ...player, slot: 'bench' as const }));
  const reserves = remainder.slice(5).map((player) => ({ ...player, slot: 'reserve' as const }));
  const lineup = starters.map((player) => ({ ...player, slot: 'starter' as const }));
  return { team: { id: teamId, name: teamName, shortName: teamName, managerName }, isUserTeam, players: [...lineup, ...bench, ...reserves], starters: lineup, bench, reserves };
}

function toTradeFixturePlayer(player: MarketPlayer): FixtureSquadPlayer {
  const fixtures: FixturePlayerFixture[] = (player.nextFixtures?.length ? player.nextFixtures : player.nextFixture ? [player.nextFixture] : []).map((fixture) => ({
    fixtureId: fixture.fixture_id, gameweek: fixture.gameweek?.number ?? null,
    opponent: { id: fixture.opponent.id, name: fixture.opponent.name, shortName: fixture.opponent.short_name ?? fixture.opponent.name },
    difficulty: fixture.difficulty ?? undefined, isHome: fixture.is_home, kickoffAt: fixture.kickoff_at,
  }));
  const nextFixture = fixtures[0];
  return {
    id: player.id, displayName: player.displayName, position: player.position === 'GK' ? 'GKP' : player.position,
    club: { id: player.club, name: player.club, shortName: player.club }, nextOpponent: nextFixture?.opponent,
    nextFixtureIsHome: nextFixture?.isHome, nextFixtureDifficulty: nextFixture?.difficulty,
    fixtureFixtures: fixtures, points: player.points ?? 0, form: player.form ?? 0, formHistory: player.formHistory, slot: 'starter',
  };
}

function toTradeRosterPlayer(player: MarketPlayer, fixtureDisplay: 'opponent' | 'home' = 'opponent'): PlayerCardPlayer {
  const upcomingFixtures = player.nextFixtures?.length
    ? player.nextFixtures
    : player.nextFixture ? [player.nextFixture] : [];
  const cardFixtures = fixtureDisplay === 'home'
    ? [{ difficulty: upcomingFixtures.find((fixture) => fixture.is_home)?.difficulty, label: player.club, title: upcomingFixtures.some((fixture) => fixture.is_home) ? 'Home fixture difficulty' : 'Home fixture difficulty unavailable', tone: 'secondary' as const }]
    : upcomingFixtures.map((fixture) => ({
      difficulty: fixture.difficulty,
      label: fixture.opponent.short_name ?? fixture.opponent.name,
      title: `GW${fixture.gameweek?.number ?? '—'} · ${fixture.is_home ? 'Home' : 'Away'}`,
      tone: 'secondary' as const,
    }));
  return {
    displayName: player.displayName,
    fixtures: cardFixtures,
    form: player.form,
    formHistory: toPlayerCardFormHistory(player.formHistory),
    position: player.position,
    team: player.club,
  };
}

function toProfilePlayer(player: MarketPlayer): SquadApiPlayer {
  return {
    id: player.id,
    display_name: player.displayName,
    position: player.position,
    epl_team: { id: player.club, name: player.club, short_name: player.club },
    draft_team: player.draftTeamId && player.draftTeamName
      ? { id: player.draftTeamId, name: player.draftTeamName, short_name: player.draftTeamName }
      : null,
    status: player.status === 'owned_by_other' ? 'available' : player.status,
    points: player.points ?? 0,
    form: player.form,
    value: player.value ?? 0,
    selected_by_percent: player.selectedPercent,
    expected_goals: player.xg,
    expected_assists: player.xa,
    availability_status: player.availabilityStatus,
    availability_news: player.availabilityNews,
    chance_of_playing_next_round: player.chanceOfPlaying,
    next_fixture: player.nextFixture,
    next_fixtures: player.nextFixtures,
    form_history: player.formHistory,
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
  if (path.startsWith('/scouting/scouting')) return 'scouting';
  if (path.startsWith('/scouting/interests')) return 'interests';
  if (path.startsWith('/scouting/trades')) return 'trades';
  if (path.startsWith('/scouting/loans')) return 'loans';
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
    clubId: player.epl_team.id,
    clubName: player.epl_team.name,
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
    nextFixture: player.next_fixture ?? null,
    nextFixtures: player.next_fixtures ?? null,
    availabilityStatus: player.availability_status ?? null,
    availabilityNews: player.availability_news ?? null,
    chanceOfPlaying: typeof player.chance_of_playing_next_round === 'number' ? player.chance_of_playing_next_round : null,
  };
}

function mapInterest(interest: ApiInterest): InterestView {
  return { id: interest.id, player: mapPlayer(interest.player), gameweekName: interest.gameweek?.name ?? null, note: interest.note ?? null };
}

function mapTrade(trade: ApiTrade): TradeView {
  return { id: trade.id, status: trade.status, offeredById: trade.offered_by?.id ?? null, offeredToId: trade.offered_to?.id ?? null, offeredBy: trade.offered_by?.name ?? null, offeredTo: trade.offered_to?.name ?? null, approvalStatus: trade.approval_status ?? null, requiredApproverRole: trade.required_approver_role ?? null, executedAt: trade.executed_at ?? null, assetNames: (trade.assets ?? []).map((asset) => asset.player?.display_name ?? '').filter(Boolean) };
}

function effectiveStatus(player: MarketPlayer, interestedPlayerIds: Set<string>, managerTeam: SquadApiTeam): MarketPlayer['status'] {
  const ownershipTone = ownershipToneFor(player, managerTeam);
  if (ownershipTone === 'tertiary') return 'owned_by_other';
  if (ownershipTone === 'primary' || player.status === 'owned') return 'owned';
  if (interestedPlayerIds.has(player.id)) return 'interested';
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
