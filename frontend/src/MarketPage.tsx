Warning: truncated output (original token count: 20293)
Total output lines: 1447

import { fetchWithQuery as fetch } from './query-cache';
import { type MutableRefObject, type ReactNode, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, useCarousel } from './components/ui/carousel';
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

type MarketMode = 'discover' | 'interests' | 'trades' | 'draws' | 'loans';
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
            <Button aria-label="Open fixture difficulty" onClick={() => onNavigate('/fdr')} type="button" variant="secondary"><Chart…8293 tokens truncated…nClose: () => void;
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
                showViewToggle squads={tradeSquads} view={view}
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
