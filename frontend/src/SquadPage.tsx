import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  ArrowRightLeft,
  Bell,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  CircleMinus,
  CirclePlus,
  Crown,
  Filter,
  Home,
  Layers,
  List,
  LockKeyhole,
  MoreHorizontal,
  Repeat2,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  Trophy,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import type { AttackDirection, ThemePreset } from './contracts';
import { officialFplShirtUrl } from './fpl-shirt-assets';
import { availabilityChance, getAvailabilityIssue, hasAvailabilityIssue } from './player-availability';
import {
  HttpSquadClient,
  SquadApiError,
  type SquadApiNotification,
  type SquadApiPlayer,
  type SquadApiSummary,
  type SquadClient,
} from './squad-api';
import {
  HttpTeamSelectionClient,
  TeamSelectionApiError,
  type TeamSelectionChip,
  type TeamSelectionPlayer,
  type TeamSelectionClient,
  type TeamSelectionSlot,
  type TeamSelectionSnapshot,
} from './team-selection-api';
import './squad-page.css';
import './squad-lineup-groups.css';
import { PlayerProfilePage } from './PlayerProfilePage';

interface SquadPageProps {
  attackDirection?: AttackDirection;
  onNavigate?: (href: string) => void;
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
  squadClient?: SquadClient;
}

type SquadView = 'pitch' | 'list';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type DrawerMode = 'compare' | 'trade' | 'profile' | null;
type PlayerStatus = 'owned' | 'available' | 'interested' | 'trade_target';
type SortKey = 'points' | 'form' | 'xg' | 'xa';
type BenchSlotOrder = 0 | 1 | 2 | 3 | 4;

export interface SubstitutionOption {
  target: TeamSelectionPlayer;
  benchOrders: BenchSlotOrder[];
  defaultBenchOrder: BenchSlotOrder | null;
}

type SubstitutionOptionView = SubstitutionOption & { targetView: PlayerView };

interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  fplCode?: number | null;
}

interface PlayerView {
  id: string;
  displayName: string;
  position: string;
  team: string;
  status: PlayerStatus;
  points: number | null;
  form: number | null;
  value: number | null;
  selectedByPercent: number | null;
  draftTeam: TeamRef | null;
  xg: number | null;
  xa: number | null;
  nextOpponent: string | null;
  nextFixtureIsHome: boolean | null;
  nextFixtureDifficulty: number | null;
  nextFixtureKickoff: string | null;
  availability: string | null;
  availabilityNews: string | null;
  chanceOfPlaying: number | null;
  slot?: TeamSelectionSlot;
  slotOrder?: number;
  captain?: boolean;
  viceCaptain?: boolean;
}

interface PlayerApiResponse {
  id: string;
  display_name: string;
  position: string;
  epl_team: { id?: string; name: string; short_name?: string | null; fpl_code?: number | null };
  draft_team?: { id: string; name: string; short_name?: string | null } | null;
  status: PlayerStatus;
  points: number;
  form?: number | null;
  value: number;
  selected_by_percent?: number | null;
  xg?: number | null;
  xa?: number | null;
  expected_goals?: number | null;
  expected_assists?: number | null;
  next_opponent?: string | null;
  availability?: string | null;
  availability_status?: string | null;
  availability_news?: string | null;
  chance_of_playing_next_round?: number | null;
  next_fixture?: {
    opponent: { id: string; name: string; short_name?: string | null };
    difficulty?: number | null;
    is_home: boolean;
    kickoff_at?: string | null;
  } | null;
}

const pitchPositionOrder = ['FWD', 'MID', 'DEF', 'GKP'];
const positionOptions: Array<{ shortLabel: string; value: PositionFilter }> = [
  { shortLabel: 'All', value: 'all' },
  { shortLabel: 'GKP', value: 'GKP' },
  { shortLabel: 'DEF', value: 'DEF' },
  { shortLabel: 'MID', value: 'MID' },
  { shortLabel: 'FWD', value: 'FWD' },
];
const defaultTeamSelectionClient = new HttpTeamSelectionClient();
const defaultSquadClient = new HttpSquadClient();
const STARTER_LIMITS: Record<string, readonly [number, number]> = {
  GKP: [1, 1],
  DEF: [3, 5],
  MID: [2, 5],
  FWD: [1, 3],
};
const BENCH_SLOT_ORDERS: BenchSlotOrder[] = [0, 1, 2, 3, 4];
const REQUIRED_CHIPS: TeamSelectionChip[] = [
  { id: 'triple-captain', name: 'Triple Captain', status: 'available' },
  { id: 'dual-captain', name: 'Dual Captain', status: 'available' },
  { id: 'auto-captain', name: 'Auto Captain', status: 'available' },
  { id: 'bench-boost', name: 'Bench Boost', status: 'available' },
  { id: 'best-xi', name: 'Best XI', status: 'available' },
];

function completeChipSet(chips: TeamSelectionChip[]): TeamSelectionChip[] {
  const supplied = new Map(chips.map((chip) => [chip.id, chip]));
  const required = REQUIRED_CHIPS.map((chip) => supplied.get(chip.id) ?? chip);
  const extras = chips.filter((chip) => !REQUIRED_CHIPS.some((requiredChip) => requiredChip.id === chip.id));
  return [...required, ...extras];
}

function normalizeTeamSelection(snapshot: TeamSelectionSnapshot): TeamSelectionSnapshot {
  return { ...snapshot, chips: completeChipSet(snapshot.chips) };
}

function getStoredView(): SquadView {
  try {
    return window.localStorage.getItem('cdl:squad-view') === 'list' ? 'list' : 'pitch';
  } catch {
    return 'pitch';
  }
}

function mapPlayer(player: PlayerApiResponse): PlayerView {
  const nextFixture = player.next_fixture ?? null;
  return {
    id: player.id,
    displayName: player.display_name,
    position: normalizePosition(player.position),
    team: player.epl_team.short_name ?? player.epl_team.name,
    status: player.status,
    points: typeof player.points === 'number' ? player.points : null,
    form: typeof player.form === 'number' ? player.form : null,
    value: typeof player.value === 'number' ? player.value : null,
    selectedByPercent: typeof player.selected_by_percent === 'number' ? player.selected_by_percent : null,
    draftTeam: player.draft_team
      ? {
          id: player.draft_team.id,
          name: player.draft_team.name,
          shortName: player.draft_team.short_name ?? player.draft_team.name,
        }
      : null,
    xg: firstNumber(player.xg, player.expected_goals),
    xa: firstNumber(player.xa, player.expected_assists),
    nextOpponent: nextFixture?.opponent.short_name ?? nextFixture?.opponent.name ?? player.next_opponent ?? null,
    nextFixtureIsHome: nextFixture?.is_home ?? null,
    nextFixtureDifficulty: typeof nextFixture?.difficulty === 'number' ? nextFixture.difficulty : null,
    nextFixtureKickoff: nextFixture?.kickoff_at ?? null,
    availability: player.availability ?? player.availability_status ?? null,
    availabilityNews: player.availability_news ?? null,
    chanceOfPlaying: typeof player.chance_of_playing_next_round === 'number'
      ? player.chance_of_playing_next_round
      : null,
  };
}

function mapTeamSelectionPlayer(player: TeamSelectionPlayer): PlayerView {
  return {
    id: player.id,
    displayName: player.name,
    position: normalizePosition(player.position),
    team: player.team,
    status: 'owned',
    points: null,
    form: null,
    value: null,
    selectedByPercent: null,
    draftTeam: null,
    xg: null,
    xa: null,
    nextOpponent: null,
    nextFixtureIsHome: null,
    nextFixtureDifficulty: null,
    nextFixtureKickoff: null,
    availability: null,
    availabilityNews: null,
    chanceOfPlaying: null,
    slot: player.slot,
    slotOrder: player.slotOrder,
    captain: player.captain,
    viceCaptain: player.viceCaptain,
  };
}

function mergeLineupPlayers(roster: PlayerView[], lineup: TeamSelectionPlayer[] | null): PlayerView[] {
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
      points: existing?.points ?? null,
      form: existing?.form ?? null,
      value: existing?.value ?? null,
      selectedByPercent: existing?.selectedByPercent ?? null,
      draftTeam: existing?.draftTeam ?? null,
      xg: existing?.xg ?? null,
      xa: existing?.xa ?? null,
      nextOpponent: existing?.nextOpponent ?? null,
      nextFixtureIsHome: existing?.nextFixtureIsHome ?? null,
      nextFixtureDifficulty: existing?.nextFixtureDifficulty ?? null,
      nextFixtureKickoff: existing?.nextFixtureKickoff ?? null,
      availability: existing?.availability ?? null,
      availabilityNews: existing?.availabilityNews ?? null,
      chanceOfPlaying: existing?.chanceOfPlaying ?? null,
      slot: player.slot,
      slotOrder: player.slotOrder,
      captain: player.captain,
      viceCaptain: player.viceCaptain,
    } satisfies PlayerView;
  });

  return [...positioned, ...roster.filter((player) => !lineupIds.has(player.id))];
}

export function SquadPage({
  attackDirection = 'up',
  onNavigate,
  preset,
  squadClient = defaultSquadClient,
  teamSelectionClient = defaultTeamSelectionClient,
}: SquadPageProps) {
  const [squadView, setSquadView] = useState<SquadView>(getStoredView);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [squadPlayers, setSquadPlayers] = useState<PlayerView[]>([]);
  const [scoutingPool, setScoutingPool] = useState<PlayerView[]>([]);
  const [notifications, setNotifications] = useState<SquadApiNotification[]>([]);
  const [proposedTradeCount, setProposedTradeCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [managerTeam, setManagerTeam] = useState<TeamRef>({ id: '', name: 'Current team', shortName: '' });
  const [gameweek, setGameweek] = useState('Gameweek');
  const [lineupAvailable, setLineupAvailable] = useState(false);
  const [teamSelection, setTeamSelection] = useState<TeamSelectionSnapshot | null>(null);
  const [lineupDirty, setLineupDirty] = useState(false);
  const [lineupSaving, setLineupSaving] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [status, setStatus] = useState('Loading squad.');
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerView | null>(null);
  const [substitutionSource, setSubstitutionSource] = useState<TeamSelectionPlayer | null>(null);
  const [substitutionTargetId, setSubstitutionTargetId] = useState<string | null>(null);
  const [substitutionBenchOrder, setSubstitutionBenchOrder] = useState<BenchSlotOrder | null>(null);
  const [comparePlayers, setComparePlayers] = useState<PlayerView[]>([]);
  const [compareQuery, setCompareQuery] = useState('');
  const [tradeSource, setTradeSource] = useState<PlayerView | null>(null);
  const [tradeTeamId, setTradeTeamId] = useState('');
  const [tradeTarget, setTradeTarget] = useState<PlayerView | null>(null);
  const [tradeQuery, setTradeQuery] = useState('');
  const [stagedRemovalIds, setStagedRemovalIds] = useState<Set<string>>(() => new Set());
  const [stagedAdditionIds, setStagedAdditionIds] = useState<Set<string>>(() => new Set());
  const [drawWins, setDrawWins] = useState<PlayerView[]>([]);
  const [changesPanelOpen, setChangesPanelOpen] = useState(false);
  const [changesLoaded, setChangesLoaded] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [scoutingLoaded, setScoutingLoaded] = useState(false);
  const [scoutingLoading, setScoutingLoading] = useState(false);
  const [scoutingError, setScoutingError] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [changesSaving, setChangesSaving] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'risk'>('all');
  const [fixtureFilter, setFixtureFilter] = useState<'all' | 'easy'>('all');
  const drawerRef = useRef<HTMLElement | null>(null);

  const navigateInternally = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(href);
  };

  useEffect(() => {
    let mounted = true;
    void Promise.allSettled([
      squadClient.getWorkspace(),
      teamSelectionClient.getTeamSelection(),
    ])
      .then(([workspaceResult, lineupResult]) => {
        if (!mounted) return;
        const workspace = settledValue(workspaceResult);
        const lineup = settledValue(lineupResult);
        const summary = workspace?.summary;
        const normalizedLineup = lineup ? normalizeTeamSelection(lineup) : null;
        if (!summary && !normalizedLineup) throw new Error('Unable to load your squad.');
        const roster = summary?.players.map(mapPlayer)
          ?? normalizedLineup?.players.map(mapTeamSelectionPlayer)
          ?? [];
        const hasLineup = Boolean(normalizedLineup?.players.length);
        setTeamSelection(normalizedLineup);
        setSquadPlayers(mergeLineupPlayers(roster, normalizedLineup?.players ?? null));
        setManagerTeam({
          id: summary?.manager_team.id ?? normalizedLineup?.managerTeam.id ?? '',
          name: summary?.manager_team.name ?? normalizedLineup?.managerTeam.name ?? 'Current team',
          shortName: summary?.manager_team.short_name
            ?? normalizedLineup?.managerTeam.shortName
            ?? normalizedLineup?.managerTeam.name
            ?? '',
        });
        setGameweek(normalizedLineup?.gameweek.name ?? summary?.gameweek.name ?? 'Gameweek');
        setProposedTradeCount(workspace?.notifications.proposed_trade_count ?? 0);
        setNotifications(workspace?.notifications.notifications ?? []);
        setStagedAdditionIds(new Set());
        setLineupAvailable(hasLineup);
        setLineupDirty(false);
        if (!hasLineup) setSquadView('list');
        setStatus(
          hasLineup
            ? `${summary?.manager_team.name ?? normalizedLineup?.managerTeam.name ?? 'Your'} squad ready for review.`
            : `${summary?.manager_team.name ?? normalizedLineup?.managerTeam.name ?? 'Your'} squad loaded.`,
        );
        const failures = [workspaceResult, lineupResult]
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failures.length > 0) {
          const reason = failures[0].reason instanceof Error ? failures[0].reason.message : 'one or more data sources failed';
          setStatus(`Squad loaded with partial data. ${reason}`);
        }
      })
      .catch((error: Error) => {
        if (mounted) setStatus(error.message);
      });
    return () => {
      mounted = false;
    };
  }, [squadClient, teamSelectionClient]);

  useEffect(() => {
    if (drawerMode !== 'compare' && drawerMode !== 'trade') return;
    if (scoutingLoaded || scoutingLoading) return;
    let mounted = true;
    setScoutingLoading(true);
    setScoutingError(null);
    void squadClient.getScoutingPlayers()
      .then((response) => {
        if (!mounted) return;
        setScoutingPool(response.players.map(mapPlayer));
        setScoutingLoaded(true);
      })
      .catch((error: Error) => {
        if (mounted) setScoutingError(error.message);
      })
      .finally(() => {
        if (mounted) setScoutingLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [drawerMode, scoutingLoaded, squadClient]);

  useEffect(() => {
    try {
      window.localStorage.setItem('cdl:squad-view', squadView);
    } catch {
      // Local view preference is optional.
    }
  }, [squadView]);

  useEffect(() => {
    if (!drawerMode) return;
    drawerRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [drawerMode]);

  const deadlineAt = teamSelection?.gameweek.deadlineAt ?? null;
  const lineupLocked = teamSelection?.fixtureLock.locked ?? false;
  const lineupValid = selectionIsValid(teamSelection?.players ?? []);

  useEffect(() => {
    if (!deadlineAt) return;
    setClockNow(Date.now());
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [deadlineAt]);

  const visibleSquadPlayers = useMemo(
    () => squadPlayers.filter((player) => !stagedRemovalIds.has(player.id)),
    [squadPlayers, stagedRemovalIds],
  );
  const pendingRemovalPlayers = useMemo(
    () => squadPlayers.filter((player) => stagedRemovalIds.has(player.id)),
    [squadPlayers, stagedRemovalIds],
  );
  const stagedAdditionPlayers = drawWins.filter((player) => stagedAdditionIds.has(player.id));
  const listPlayers = useMemo(() => {
    const filtered = visibleSquadPlayers
      .filter((player) => positionFilter === 'all' || player.position === positionFilter)
      .filter((player) => matchesQuery(player, query))
      .filter((player) => availabilityFilter === 'all' || isAvailabilityRisk(player))
      .filter((player) => fixtureFilter === 'all' || (player.nextFixtureDifficulty !== null && player.nextFixtureDifficulty <= 3));
    return [...filtered].sort((left, right) => compareListPlayers(left, right, sortKey));
  }, [availabilityFilter, fixtureFilter, positionFilter, query, sortKey, visibleSquadPlayers]);
  const positionCounts = useMemo(() => ({
    all: visibleSquadPlayers.length,
    GKP: visibleSquadPlayers.filter((player) => player.position === 'GKP').length,
    DEF: visibleSquadPlayers.filter((player) => player.position === 'DEF').length,
    MID: visibleSquadPlayers.filter((player) => player.position === 'MID').length,
    FWD: visibleSquadPlayers.filter((player) => player.position === 'FWD').length,
  }), [visibleSquadPlayers]);
  const stagedChangeCount = pendingRemovalPlayers.length + stagedAdditionPlayers.length;
  const validationMessages = buildSquadChangeValidation(stagedAdditionPlayers, pendingRemovalPlayers);
  const comparisonCandidates = scoutingPool
    .filter((player) => !comparePlayers.some((selected) => selected.id === player.id))
    .filter((player) => matchesQuery(player, compareQuery))
    .slice(0, 8);
  const tradeTeams = uniqueTradeTeams(scoutingPool, managerTeam.id);
  const tradeCandidates = scoutingPool
    .filter((player) => player.draftTeam?.id === tradeTeamId)
    .filter((player) => matchesQuery(player, tradeQuery))
    .slice(0, 8);
  const substitutionOptions = useMemo(() => {
    if (!teamSelection || !substitutionSource) return [];
    return getSubstitutionOptions(teamSelection.players, substitutionSource.id).map((option) => ({
      ...option,
      targetView: squadPlayers.find((player) => player.id === option.target.id)
        ?? mapTeamSelectionPlayer(option.target),
    }));
  }, [squadPlayers, substitutionSource, teamSelection]);
  const substitutionCandidateIds = useMemo(
    () => new Set(substitutionOptions.map((option) => option.target.id)),
    [substitutionOptions],
  );
  const substitutionSourceView = substitutionSource
    ? squadPlayers.find((player) => player.id === substitutionSource.id) ?? mapTeamSelectionPlayer(substitutionSource)
    : null;
  const selectedSubstitutionOption = substitutionOptions.find(
    (option) => option.target.id === substitutionTargetId,
  ) ?? null;

  async function loadChanges() {
    if (changesLoaded || changesLoading) return;
    setChangesLoading(true);
    setChangesError(null);
    try {
      const response = await squadClient.getChanges();
      setDrawWins(response.available_to_add.map(mapPlayer));
      setChangesLoaded(true);
    } catch (error) {
      setChangesError(error instanceof Error ? error.message : 'Unable to load available players.');
    } finally {
      setChangesLoading(false);
    }
  }

  function toggleChangesPanel() {
    const nextOpen = !changesPanelOpen;
    setChangesPanelOpen(nextOpen);
    if (nextOpen) void loadChanges();
  }
  function closeDrawer() {
    setDrawerMode(null);
    setSelectedPlayer(null);
    setCompareQuery('');
    setTradeQuery('');
  }

  function cancelSubstitution() {
    const sourceName = substitutionSource?.name;
    setSubstitutionSource(null);
    setSubstitutionTargetId(null);
    setSubstitutionBenchOrder(null);
    if (sourceName) setStatus(`Substitution for ${sourceName} cancelled.`);
  }

  function openPlayer(player: PlayerView) {
    setSelectedPlayer(player);
    setDrawerMode('profile');
  }

  function handleProfileSelectionChange(updated: TeamSelectionSnapshot) {
    const normalized = normalizeTeamSelection(updated);
    setTeamSelection(normalized);
    setSquadPlayers((current) => mergeLineupPlayers(current, normalized.players));
    setLineupDirty(false);
  }

  function handleProfileSquadChange(updatedSummary: SquadApiSummary) {
    setSquadPlayers(mergeLineupPlayers(updatedSummary.players.map(mapPlayer), teamSelection?.players ?? null));
    closeDrawer();
    setStatus('Squad updated from the player profile.');
  }

  function profilePlayer(player: PlayerView): SquadApiPlayer {
    return {
      id: player.id,
      display_name: player.displayName,
      position: player.position,
      epl_team: { id: player.team, name: player.team, short_name: player.team },
      draft_team: player.draftTeam
        ? { id: player.draftTeam.id, name: player.draftTeam.name, short_name: player.draftTeam.shortName }
        : null,
      status: player.status,
      points: player.points ?? 0,
      form: player.form,
      value: player.value ?? 0,
      selected_by_percent: player.selectedByPercent,
      expected_goals: player.xg,
      expected_assists: player.xa,
      availability_status: player.availability,
      availability_news: player.availabilityNews,
      chance_of_playing_next_round: player.chanceOfPlaying,
      next_fixture: player.nextOpponent
        ? {
            fixture_id: `squad-${player.id}`,
            opponent: { id: player.nextOpponent, name: player.nextOpponent, short_name: player.nextOpponent },
            difficulty: player.nextFixtureDifficulty,
            is_home: player.nextFixtureIsHome ?? true,
            kickoff_at: player.nextFixtureKickoff,
          }
        : null,
    };
  }

  function chooseSubstitutionTarget(option: SubstitutionOption) {
    setSubstitutionTargetId(option.target.id);
    setSubstitutionBenchOrder(option.defaultBenchOrder ?? option.benchOrders[0] ?? null);
    setStatus(`${option.target.name} selected. Choose a bench position if needed, then confirm.`);
  }

  function chooseSubstitutionTargetView(player: PlayerView) {
    const option = substitutionOptions.find((candidate) => candidate.target.id === player.id);
    if (option) chooseSubstitutionTarget(option);
  }

  function confirmSubstitution() {
    if (!teamSelection || !substitutionSource || !selectedSubstitutionOption || lineupLocked) return;
    const nextPlayers = applySubstitution(
      teamSelection.players,
      substitutionSource.id,
      selectedSubstitutionOption.target.id,
      substitutionBenchOrder,
    );
    if (!selectionIsValid(nextPlayers)) {
      setStatus('That substitution would make the lineup invalid. Choose another eligible player.');
      return;
    }
    const sourceName = substitutionSource.name;
    const targetName = selectedSubstitutionOption.target.name;
    setTeamSelection((current) => current ? { ...current, players: nextPlayers } : current);
    setSquadPlayers((current) => mergeLineupPlayers(current, nextPlayers));
    setLineupDirty(true);
    setSubstitutionSource(null);
    setSubstitutionTargetId(null);
    setSubstitutionBenchOrder(null);
    setStatus(`${sourceName} swapped with ${targetName}. Save lineup to apply this change.`);
  }

  function startCompare(player: PlayerView) {
    setComparePlayers([player]);
    setCompareQuery('');
    setDrawerMode('compare');
  }

  function addComparisonPlayer(player: PlayerView) {
    setComparePlayers((current) => current.length >= 3 ? current : [...current, player]);
    setCompareQuery('');
  }

  function removeComparisonPlayer(playerId: string) {
    setComparePlayers((current) => current.length <= 1 ? current : current.filter((player) => player.id !== playerId));
  }

  function startTrade(player: PlayerView) {
    setTradeSource(player);
    setTradeTeamId('');
    setTradeTarget(null);
    setTradeQuery('');
    setDrawerMode('trade');
  }

  function stageAddition(player: PlayerView) {
    setStagedAdditionIds((current) => new Set([...current, player.id]));
    setChangesPanelOpen(true);
    setStatus(`${player.displayName} staged to join the squad.`);
  }

  function restoreAddition(player: PlayerView) {
    setStagedAdditionIds((current) => {
      const next = new Set(current);
      next.delete(player.id);
      return next;
    });
    setStatus(`${player.displayName} removed from pending additions.`);
  }

  function restorePlayer(player: PlayerView) {
    setStagedRemovalIds((current) => {
      const next = new Set(current);
      next.delete(player.id);
      return next;
    });
    setStatus(`${player.displayName} restored to the squad.`);
  }

  async function saveLineup() {
    if (!teamSelection || lineupLocked) return;
    if (!lineupValid) {
      setStatus('Invalid lineup. Review /rules#lineup-validation.');
      return;
    }
    setLineupSaving(true);
    try {
      const updated = await teamSelectionClient.saveLineup(teamSelection.players);
      setTeamSelection(normalizeTeamSelection(updated));
      setSquadPlayers((current) => mergeLineupPlayers(current, updated.players));
      setLineupDirty(false);
      setStatus('Lineup saved and validated.');
    } catch (error) {
      setStatus(apiErrorMessage(error, 'Unable to save the lineup.'));
    } finally {
      setLineupSaving(false);
    }
  }

  async function toggleChip(chip: TeamSelectionChip) {
    if (!teamSelection || lineupLocked) return;
    if (chip.status === 'used') {
      setStatus('Used chips cannot be activated. See /rules#chip-usage.');
      return;
    }
    const activeChip = teamSelection.chips.find((candidate) => candidate.status === 'active');
    if (chip.status !== 'active' && activeChip) {
      setStatus('Only one chip can be active at a time. See /rules#chip-usage.');
      return;
    }
    try {
      const updated = await teamSelectionClient.updateChip(chip.id, chip.status !== 'active');
      setTeamSelection(normalizeTeamSelection(updated));
      setStatus(`${chip.name} chip state updated.`);
    } catch (error) {
      setStatus(apiErrorMessage(error, 'Unable to update the chip.'));
    }
  }

  async function submitTrade() {
    if (!tradeSource || !tradeTarget || !tradeTeamId) return;
    try {
      const trade = await squadClient.createTrade(tradeTeamId, [tradeSource.id], [tradeTarget.id]);
      if (trade.status === 'proposed') setProposedTradeCount((current) => current + 1);
      closeDrawer();
      setStatus(`Trade proposal for ${tradeSource.displayName} sent to ${tradeTarget.draftTeam?.name ?? 'the selected manager'}.`);
    } catch (error) {
      setStatus(apiErrorMessage(error, 'Unable to submit the trade proposal.'));
    }
  }

  async function confirmChanges() {
    if (lineupLocked || validationMessages.length > 0 || changesSaving) return;
    setChangesSaving(true);
    try {
      const summary = await squadClient.applyChanges(
        stagedAdditionPlayers.map((player) => player.id),
        [...stagedRemovalIds],
      );
      const updatedLineup = await teamSelectionClient.getTeamSelection();
      const normalizedLineup = normalizeTeamSelection(updatedLineup);
      setTeamSelection(normalizedLineup);
      setSquadPlayers(mergeLineupPlayers(summary.players.map(mapPlayer), normalizedLineup.players));
      setDrawWins((await squadClient.getChanges()).available_to_add.map(mapPlayer));
      setChangesLoaded(true);
      setStagedRemovalIds(new Set());
      setStagedAdditionIds(new Set());
      setConfirmationOpen(false);
      setChangesPanelOpen(false);
      setLineupDirty(false);
      setStatus('Squad changes saved and temporary rights updated.');
    } catch (error) {
      setStatus(apiErrorMessage(error, 'Unable to save squad changes.'));
    } finally {
      setChangesSaving(false);
    }
  }

  return (
    <main aria-labelledby="squad-title" className="squad-page" data-density={preset.tokens.density}>
      <header className="squad-page__hero">
        <div className="squad-page__brand-lockup">
          <span aria-hidden="true" className="squad-page__brand-mark"><Shield size={25} /></span>
          <div>
            <p className="squad-page__brand-name">Castle Draft League</p>
            <h1 id="squad-title">Squad</h1>
            <p className="squad-page__team-name">{managerTeam.name} · {gameweek}</p>
          </div>
        </div>
        <div aria-label="Squad utilities" className="squad-page__hero-icons">
          <div aria-label="Squad view" className="squad-page__view-toggle" role="group">
            <button
              aria-label="View as pitch"
              aria-pressed={squadView === 'pitch'}
              disabled={!lineupAvailable}
              onClick={() => setSquadView('pitch')}
              title="Pitch view"
              type="button"
            >
              <SoccerPitchIcon />
            </button>
            <button
              aria-label="View as list"
              aria-pressed={squadView === 'list'}
              onClick={() => setSquadView('list')}
              title="List view"
              type="button"
            >
              <List aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="squad-page__notifications">
            <button
              aria-expanded={notificationsOpen}
              aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ''}`}
              className="squad-page__icon-button"
              onClick={() => setNotificationsOpen((open) => !open)}
              title="Notifications"
              type="button"
            >
              <Bell size={20} />
              {notifications.length ? <span className="squad-page__notification-count">{notifications.length}</span> : null}
            </button>
            {notificationsOpen ? (
              <div aria-label="Notifications" className="squad-page__notifications-popover" role="dialog">
                <div className="squad-page__notifications-heading"><strong>Notifications</strong><span>{notifications.length}</span></div>
                {notifications.length === 0 ? <p className="squad-page__empty-copy">You are all caught up.</p> : notifications.map((notification) => (
                  <a
                    href={notification.action_href}
                    key={notification.id}
                    className="squad-page__notification"
                    onClick={(event) => navigateInternally(event, notification.action_href)}
                  >
                    <strong>{notification.title}</strong><span>{notification.message}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section aria-label="Matchweek controls" className="squad-page__matchweek-controls">
        <div className="squad-page__deadline">
          <span className="squad-page__deadline-icon"><CalendarClock aria-hidden="true" size={19} /></span>
          <div>
            <span className="eyebrow">Next deadline</span>
            <strong>{deadlineAt ? formatDeadlineDate(deadlineAt) : 'Deadline pending'}</strong>
            <small>{deadlineAt ? formatCountdown(deadlineAt, clockNow) : 'Awaiting gameweek schedule'}</small>
          </div>
        </div>
        <div aria-label="Chip controls" className="squad-page__chips">
          {(teamSelection?.chips ?? REQUIRED_CHIPS).map((chip) => (
            <ChipToggle chip={chip} disabled={lineupLocked} key={chip.id} onToggle={() => void toggleChip(chip)} />
          ))}
        </div>
        <div className="squad-page__matchweek-actions">
          <Button
            disabled={!teamSelection || lineupLocked || lineupSaving || !lineupDirty}
            onClick={() => void saveLineup()}
            type="button"
          >
            {lineupLocked ? <LockKeyhole aria-hidden="true" size={16} /> : <Save aria-hidden="true" size={16} />}
            Save lineup
          </Button>
          <p className="squad-page__matchweek-status" role="status">
            {lineupLocked ? `Lineup locked. ${teamSelection?.fixtureLock.reason ?? 'The gameweek deadline has passed.'}` : status}
          </p>
        </div>
      </section>

      {proposedTradeCount > 0 ? (
        <section aria-label="Squad attention" className="squad-page__attention">
          <CircleAlert aria-hidden="true" size={18} />
          <div><strong>{proposedTradeCount} proposed {proposedTradeCount === 1 ? 'trade' : 'trades'} need review</strong><span>Trade activity is managed in Market.</span></div>
          <a href="/scouting" onClick={(event) => navigateInternally(event, '/scouting')}>Review</a>
        </section>
      ) : null}

      {substitutionSource && substitutionSourceView ? (
        <SubstitutionModePanel
          candidateCount={substitutionOptions.length}
          locked={lineupLocked}
          onBenchOrderChange={setSubstitutionBenchOrder}
          onCancel={cancelSubstitution}
          onConfirm={confirmSubstitution}
          option={selectedSubstitutionOption}
          selectedBenchOrder={substitutionBenchOrder}
          source={substitutionSource}
          sourceView={substitutionSourceView}
        />
      ) : null}

      <section className="squad-page__roster-card">
        {squadView === 'pitch' && lineupAvailable ? (
          <SquadPitch
            attackDirection={attackDirection}
            onSelect={openPlayer}
            onSubstitutionTarget={chooseSubstitutionTargetView}
            players={visibleSquadPlayers}
            substitutionCandidateIds={substitutionCandidateIds}
            substitutionMode={Boolean(substitutionSource)}
            substitutionSourceId={substitutionSource?.id ?? null}
            substitutionTargetId={substitutionTargetId}
          />
        ) : (
          <SquadList
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            onPositionChange={setPositionFilter}
            onQueryChange={setQuery}
            onSelect={openPlayer}
            onSubstitutionTarget={chooseSubstitutionTargetView}
            onSortChange={setSortKey}
            players={listPlayers}
            positionCounts={positionCounts}
            positionFilter={positionFilter}
            query={query}
            sortKey={sortKey}
            availabilityFilter={availabilityFilter}
            fixtureFilter={fixtureFilter}
            onAvailabilityFilterChange={setAvailabilityFilter}
            onFixtureFilterChange={setFixtureFilter}
            substitutionCandidateIds={substitutionCandidateIds}
            substitutionMode={Boolean(substitutionSource)}
            substitutionSourceId={substitutionSource?.id ?? null}
            substitutionTargetId={substitutionTargetId}
          />
        )}
      </section>

      <aside aria-label="Squad changes" className={`squad-page__changes-panel ${changesPanelOpen ? 'is-open' : ''}`}>
        <button className="squad-page__changes-toggle" onClick={toggleChangesPanel} type="button">
          <span className="squad-page__changes-icon"><ArrowRightLeft size={19} /></span>
          <span><strong>Squad Changes</strong><small>{stagedChangeCount > 0 ? `${stagedChangeCount} pending changes` : 'No pending changes'}</small></span>
          <ChevronDown aria-hidden="true" className={changesPanelOpen ? 'is-open' : ''} size={20} />
        </button>

        {changesPanelOpen ? (
          <div className="squad-page__changes-body">
            {changesLoading ? <p className="squad-page__empty-copy">Loading available players…</p> : null}
            {changesError ? <p className="squad-page__error-copy">Available players unavailable: {changesError}</p> : null}
            <section className="squad-page__change-section">
              <div className="squad-page__change-heading"><h3>Available to Add</h3><span>{drawWins.length}</span></div>
              {drawWins.length === 0 ? (
                <p className="squad-page__empty-copy">No active temporary player rights.</p>
              ) : null}
              <div className="squad-page__change-list">
                {drawWins.map((player) => {
                  const staged = stagedAdditionIds.has(player.id);
                  return (
                    <div className={`squad-page__change-player ${staged ? 'added' : ''}`} key={player.id}>
                      <PlayerIdentity player={player} />
                      <span className="squad-page__change-badge added">{staged ? 'Added' : 'Right active'}</span>
                      <Button onClick={() => (staged ? restoreAddition(player) : stageAddition(player))} type="button" variant="secondary">
                        {staged ? 'Undo' : 'Add to Squad'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="squad-page__change-section">
              <div className="squad-page__change-heading"><h3>Pending Removal</h3><span>{pendingRemovalPlayers.length}</span></div>
              {pendingRemovalPlayers.length === 0 ? <p className="squad-page__empty-copy">No players are staged for removal.</p> : null}
              <div className="squad-page__change-list">
                {pendingRemovalPlayers.map((player) => (
                  <div className="squad-page__change-player removed" key={player.id}>
                    <PlayerIdentity player={player} />
                    <span className="squad-page__change-badge removed">Removed</span>
                    <Button onClick={() => restorePlayer(player)} type="button" variant="secondary">Restore to Squad</Button>
                  </div>
                ))}
              </div>
            </section>

              <Button disabled={stagedChangeCount === 0 || lineupLocked} onClick={() => setConfirmationOpen(true)} type="button">
                Submit Squad Changes
              </Button>
          </div>
        ) : null}
      </aside>

      {drawerMode ? (
        <DrawerLayer onClose={closeDrawer}>
            {drawerMode === 'profile' && selectedPlayer ? (
              <aside
                aria-labelledby="player-profile-title"
                aria-modal="true"
                className="squad-page__drawer squad-page__drawer--profile"
                ref={drawerRef}
                role="dialog"
                tabIndex={-1}
              >
                <PlayerProfilePage
                  initialPlayer={profilePlayer(selectedPlayer)}
                  initialSelection={teamSelection ?? undefined}
                  onClose={closeDrawer}
                  onCompare={() => startCompare(selectedPlayer)}
                  onSquadChange={handleProfileSquadChange}
                  onSelectionChange={handleProfileSelectionChange}
                  onTrade={() => startTrade(selectedPlayer)}
                  playerId={selectedPlayer.id}
                  presentation="drawer"
                  squadClient={squadClient}
                  teamSelectionClient={teamSelectionClient}
                />
              </aside>
            ) : null}
            {drawerMode !== 'profile' ? <aside className="squad-page__drawer" ref={drawerRef} tabIndex={-1}>
            {drawerMode === 'compare' ? (
              <CompareDrawer
                candidates={comparisonCandidates}
                error={scoutingError}
                loading={scoutingLoading}
                onAdd={addComparisonPlayer}
                onClose={closeDrawer}
                onQueryChange={setCompareQuery}
                onRemove={removeComparisonPlayer}
                players={comparePlayers}
                query={compareQuery}
              />
            ) : null}
            {drawerMode === 'trade' && tradeSource ? (
              <TradeDrawer
                candidates={tradeCandidates}
                error={scoutingError}
                loading={scoutingLoading}
                onClose={closeDrawer}
                onQueryChange={setTradeQuery}
                onTargetChange={setTradeTarget}
                onTeamChange={(teamId) => {
                  setTradeTeamId(teamId);
                  setTradeTarget(null);
                  setTradeQuery('');
                }}
                query={tradeQuery}
                source={tradeSource}
                target={tradeTarget}
                teams={tradeTeams}
                teamId={tradeTeamId}
                onSubmit={() => void submitTrade()}
              />
            ) : null}
            </aside> : null}
        </DrawerLayer>
      ) : null}

      {confirmationOpen ? (
        <div className="squad-page__modal-layer">
          <button aria-label="Close squad change review" className="squad-page__backdrop" onClick={() => setConfirmationOpen(false)} type="button" />
          <section aria-labelledby="squad-change-review-title" aria-modal="true" className="squad-page__confirmation" role="dialog">
            <span aria-hidden="true" className="squad-page__sheet-handle" />
            <header>
              <span className="squad-page__brand-mark"><Shield size={22} /></span>
              <div><p className="eyebrow">Review changes</p><h2 id="squad-change-review-title">Confirm Squad Changes</h2></div>
              <button aria-label="Close squad change review" className="squad-page__icon-button" onClick={() => setConfirmationOpen(false)} type="button"><X size={18} /></button>
            </header>
            <div className="squad-page__review-counts">
              <span className="removed"><CircleMinus size={20} /><strong>{pendingRemovalPlayers.length}</strong><small>Removed</small></span>
              <ArrowRightLeft aria-hidden="true" size={20} />
              <span className="added"><CirclePlus size={20} /><strong>{stagedAdditionPlayers.length}</strong><small>Added</small></span>
            </div>
            <ChangeReview label="Added" players={stagedAdditionPlayers} />
            <ChangeReview label="Removed" players={pendingRemovalPlayers} />
            {validationMessages.length > 0 ? (
              <div className="squad-page__validation" role="alert">
                <strong>Changes cannot be submitted yet.</strong>
                {validationMessages.map((message) => <p key={message}>{message}</p>)}
              </div>
            ) : null}
            <footer>
              <Button onClick={() => setConfirmationOpen(false)} type="button" variant="secondary">Back</Button>
              <Button disabled={validationMessages.length > 0 || changesSaving || lineupLocked} onClick={() => void confirmChanges()} type="button">
                {changesSaving ? 'Saving…' : 'Confirm Changes'}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}

      <nav aria-label="Squad mobile navigation" className="squad-page__mobile-nav">
        <a href="/" onClick={(event) => navigateInternally(event, '/')}><Home size={19} /><span>Desk</span></a>
        <a aria-current="page" href="/squad-management" onClick={(event) => navigateInternally(event, '/squad-management')}><Shield size={19} /><span>Squad</span></a>
        <a href="/scouting" onClick={(event) => navigateInternally(event, '/scouting')}><Search size={19} /><span>Market</span></a>
        <a href="/team-selection" onClick={(event) => navigateInternally(event, '/team-selection')}><CalendarDays size={19} /><span>Matchweek</span></a>
        <a href="/league" onClick={(event) => navigateInternally(event, '/league')}><Trophy size={19} /><span>League</span></a>
      </nav>
    </main>
  );
}

function SquadPitch({
  attackDirection,
  onSelect,
  onSubstitutionTarget,
  players,
  substitutionCandidateIds,
  substitutionMode,
  substitutionSourceId,
  substitutionTargetId,
}: {
  attackDirection: AttackDirection;
  onSelect: (player: PlayerView) => void;
  onSubstitutionTarget: (player: PlayerView) => void;
  players: PlayerView[];
  substitutionCandidateIds: ReadonlySet<string>;
  substitutionMode: boolean;
  substitutionSourceId: string | null;
  substitutionTargetId: string | null;
}) {
  const starters = players.filter((player) => player.slot === 'starter').sort(sortBySlot);
  const bench = players.filter((player) => player.slot === 'bench').sort(sortBySlot);
  const reserves = players.filter((player) => player.slot === 'reserve').sort(sortBySlot);
  const orientedPositionOrder = attackDirection === 'down'
    ? [...pitchPositionOrder].reverse()
    : pitchPositionOrder;
  const rows = orientedPositionOrder
    .map((position) => ({ position, players: starters.filter((player) => player.position === position) }))
    .filter((row) => row.players.length > 0);
  const formation = ['DEF', 'MID', 'FWD']
    .map((position) => starters.filter((player) => player.position === position).length)
    .join('-');

  return (
    <section aria-label="Squad pitch" className="squad-page__pitch-shell" data-attack-direction={attackDirection}>
      <div className={`squad-page__pitch attack-${attackDirection}`} data-attack-direction={attackDirection}>
        <div
          aria-hidden="true"
          className="squad-page__pitch-field"
          data-visible-pitch-slice={attackDirection === 'up' ? 'bottom' : 'top'}
        >
          <div className="squad-page__pitch-markings"><span /><span /><span /><span /></div>
        </div>
        <div className="squad-page__formation">{formation}</div>
        <div className="squad-page__pitch-lineup">
          {rows.map((row) => (
            <div className={`squad-page__pitch-row position-${row.position.toLowerCase()}`} key={row.position}>
              {row.players.map((player) => (
                <PitchCard
                  key={player.id}
                  onSelect={onSelect}
                  onSubstitutionTarget={onSubstitutionTarget}
                  player={player}
                  substitutionCandidateIds={substitutionCandidateIds}
                  substitutionMode={substitutionMode}
                  substitutionSourceId={substitutionSourceId}
                  substitutionTargetId={substitutionTargetId}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <section aria-label="Bench" className="squad-page__bench">
        <header><h3>Bench</h3><span>1 GK + 4 ordered substitutes</span></header>
        <div>{bench.map((player) => (
          <PitchCard
            benchOrder={player.slotOrder}
            compact
            key={player.id}
            onSelect={onSelect}
            onSubstitutionTarget={onSubstitutionTarget}
            player={player}
            substitutionCandidateIds={substitutionCandidateIds}
            substitutionMode={substitutionMode}
            substitutionSourceId={substitutionSourceId}
            substitutionTargetId={substitutionTargetId}
          />
        ))}</div>
      </section>
      <section aria-label="Reserves" className="squad-page__reserves">
        <header><h3>Reserves</h3><span>{reserves.length} players</span></header>
        <div>{reserves.map((player) => (
          <PitchCard
            compact
            key={player.id}
            onSelect={onSelect}
            onSubstitutionTarget={onSubstitutionTarget}
            player={player}
            substitutionCandidateIds={substitutionCandidateIds}
            substitutionMode={substitutionMode}
            substitutionSourceId={substitutionSourceId}
            substitutionTargetId={substitutionTargetId}
          />
        ))}</div>
      </section>
    </section>
  );
}

function PitchCard({
  benchOrder,
  compact = false,
  onSelect,
  onSubstitutionTarget,
  player,
  substitutionCandidateIds,
  substitutionMode,
  substitutionSourceId,
  substitutionTargetId,
}: {
  benchOrder?: number;
  compact?: boolean;
  onSelect: (player: PlayerView) => void;
  onSubstitutionTarget: (player: PlayerView) => void;
  player: PlayerView;
  substitutionCandidateIds: ReadonlySet<string>;
  substitutionMode: boolean;
  substitutionSourceId: string | null;
  substitutionTargetId: string | null;
}) {
  const isSource = substitutionSourceId === player.id;
  const isCandidate = substitutionCandidateIds.has(player.id);
  const isTarget = substitutionTargetId === player.id;
  const handleClick = () => {
    if (substitutionMode) {
      if (isCandidate) onSubstitutionTarget(player);
      return;
    }
    onSelect(player);
  };
  const label = substitutionMode
    ? isCandidate
      ? `Substitute with ${player.displayName}`
      : isSource
        ? `Substitution source ${player.displayName}`
        : `${player.displayName} is not a legal substitution candidate`
    : `View ${player.displayName} details`;
  return (
    <button
      aria-label={label}
      aria-pressed={substitutionMode && isCandidate ? isTarget : undefined}
      className={`squad-page__pitch-player position-${player.position.toLowerCase()} form-band-${formBand(player.form)} ${compact ? 'compact' : ''} ${substitutionMode ? 'is-substitution-mode' : ''} ${isSource ? 'is-substitution-source' : ''} ${isCandidate ? 'is-substitution-candidate' : ''} ${isTarget ? 'is-substitution-target' : ''} ${substitutionMode && !isCandidate ? 'is-substitution-unavailable' : ''}`}
      disabled={substitutionMode && !isCandidate}
      onClick={handleClick}
      type="button"
    >
      <span aria-hidden="true" className="squad-page__pitch-shirt-crop"><TeamShirt large team={player.team} /></span>
      <strong className="squad-page__pitch-player-name">{shortPlayerName(player.displayName)}</strong>
      <span className="squad-page__pitch-player-form"><FormDots value={player.form} /></span>
      <small
        className={`${fixtureOpponentClassName(player.nextFixtureDifficulty)} ${player.nextOpponent ? '' : 'is-placeholder'}`.trim()}
        title={fixtureDifficultyTitle(player.nextFixtureDifficulty)}
      >
        {formatFixtureLabel(player)}
      </small>
      {player.captain ? <span className="squad-page__captain">C</span> : null}
      {player.viceCaptain ? <span className="squad-page__captain vice">VC</span> : null}
      <AvailabilityFlag player={player} />
      {compact && benchOrder !== undefined ? <span className="squad-page__bench-order">{benchOrder === 0 ? 'GK' : benchOrder}</span> : null}
    </button>
  );
}

function ChipToggle({ chip, disabled, onToggle }: { chip: TeamSelectionChip; disabled: boolean; onToggle: () => void }) {
  const active = chip.status === 'active';
  const used = chip.status === 'used';
  return (
    <button
      aria-label={`${chip.name}, ${chip.status}`}
      aria-pressed={active}
      className={`squad-page__chip-toggle ${active ? 'is-active' : ''} ${used ? 'is-used' : ''}`}
      disabled={disabled}
      onClick={onToggle}
      title={`${chip.name}: ${chip.status}`}
      type="button"
    >
      <ChipGlyph chip={chip} />
      {active ? <span aria-hidden="true" className="squad-page__chip-dot" /> : null}
      {used ? <CircleCheck aria-hidden="true" className="squad-page__chip-used" size={12} /> : null}
      <span className="sr-only">{chip.name}</span>
    </button>
  );
}

function ChipGlyph({ chip }: { chip: TeamSelectionChip }) {
  const name = `${chip.id} ${chip.name}`.toLowerCase();
  if (name.includes('bench')) return <Layers aria-hidden="true" size={18} />;
  if (name.includes('dual')) return <Users aria-hidden="true" size={18} />;
  if (name.includes('auto')) return <CircleCheck aria-hidden="true" size={18} />;
  if (name.includes('best')) return <Trophy aria-hidden="true" size={18} />;
  if (name.includes('captain')) return <Crown aria-hidden="true" size={18} />;
  return <WandSparkles aria-hidden="true" size={18} />;
}

function SoccerPitchIcon() {
  return (
    <svg aria-hidden="true" className="squad-page__pitch-icon" viewBox="0 0 24 24" fill="none">
      <rect height="18" rx="1.5" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="3" />
      <path d="M12 3v18M3 8h4.2v8H3M21 8h-4.2v8H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SquadList({
  availabilityFilter,
  fixtureFilter,
  filtersOpen,
  onAvailabilityFilterChange,
  onFiltersOpenChange,
  onFixtureFilterChange,
  onPositionChange,
  onQueryChange,
  onSelect,
  onSubstitutionTarget,
  onSortChange,
  players,
  positionCounts,
  positionFilter,
  query,
  sortKey,
  substitutionCandidateIds,
  substitutionMode,
  substitutionSourceId,
  substitutionTargetId,
}: {
  availabilityFilter: 'all' | 'risk';
  fixtureFilter: 'all' | 'easy';
  filtersOpen: boolean;
  onAvailabilityFilterChange: (filter: 'all' | 'risk') => void;
  onFiltersOpenChange: (open: boolean) => void;
  onFixtureFilterChange: (filter: 'all' | 'easy') => void;
  onPositionChange: (position: PositionFilter) => void;
  onQueryChange: (query: string) => void;
  onSelect: (player: PlayerView) => void;
  onSubstitutionTarget: (player: PlayerView) => void;
  onSortChange: (sort: SortKey) => void;
  players: PlayerView[];
  positionCounts: Record<PositionFilter, number>;
  positionFilter: PositionFilter;
  query: string;
  sortKey: SortKey;
  substitutionCandidateIds: ReadonlySet<string>;
  substitutionMode: boolean;
  substitutionSourceId: string | null;
  substitutionTargetId: string | null;
}) {
  const groups = lineupGroups(players);
  function selectPlayer(player: PlayerView) {
    if (substitutionMode) {
      if (substitutionCandidateIds.has(player.id)) onSubstitutionTarget(player);
      return;
    }
    onSelect(player);
  }
  return (
    <div className="squad-page__list">
      <div className="squad-page__list-controls">
        <label className="squad-page__search"><Search size={18} /><span className="sr-only">Search squad players</span><input aria-label="Search squad players" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search players..." value={query} /></label>
        <button aria-expanded={filtersOpen} aria-label="Advanced squad filters" className="squad-page__filter-button" onClick={() => onFiltersOpenChange(!filtersOpen)} type="button"><Filter size={18} /></button>
        <button
          aria-label={`Sort squad by ${sortLabel(sortKey)}`}
          className="squad-page__sort-button"
          onClick={() => onSortChange(nextSortKey(sortKey))}
          title={`Sort by ${sortLabel(sortKey)}. Press to change.`}
          type="button"
        >
          <ArrowDownUp aria-hidden="true" size={17} />
          <span className="sr-only">Sort by {sortLabel(sortKey)}</span>
        </button>
      </div>

      {filtersOpen ? (
        <div className="squad-page__filter-controls">
          <SlidersHorizontal size={17} />
          <label><span>Availability</span><select aria-label="Filter by availability" onChange={(event) => onAvailabilityFilterChange(event.target.value as 'all' | 'risk')} value={availabilityFilter}><option value="all">All players</option><option value="risk">Reduced chance</option></select></label>
          <label><span>Next fixture</span><select aria-label="Filter by next fixture difficulty" onChange={(event) => onFixtureFilterChange(event.target.value as 'all' | 'easy')} value={fixtureFilter}><option value="all">Any difficulty</option><option value="easy">Easy or balanced</option></select></label>
        </div>
      ) : null}

      <div aria-label="Squad positions" className="squad-page__position-tabs" role="tablist">
        {positionOptions.map((option) => (
          <button aria-selected={positionFilter === option.value} key={option.value} onClick={() => onPositionChange(option.value)} role="tab" type="button">
            {option.shortLabel}<span>{positionCounts[option.value]}</span>
          </button>
        ))}
      </div>

      <div className="squad-page__lineup-tables">
        {groups.map((group) => (
          <section aria-label={`${group.label} players`} className="squad-page__list-section" key={group.slot}>
            <header className="squad-page__list-section-header">
              <h2>{group.label}</h2>
              <span>{group.players.length}</span>
            </header>
            <div aria-label={`${group.label} players table`} className="squad-page__table-scroll" role="region" tabIndex={0}>
              <table className="squad-page__list-table">
                <colgroup>
                  <col className="player" />
                  <col className="points" />
                  <col className="form" />
                  <col className="expected" />
                  <col className="availability" />
                  <col className="action" />
                </colgroup>
                <thead><tr><th>Player</th><th className="sorted">Pts <ArrowDown size={11} /></th><th>Form</th><th>xG / xA</th><th><span className="sr-only">Availability</span><CircleCheck aria-hidden="true" size={13} /></th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {group.players.map((player) => (
                    <tr
                      className={`squad-page__player-row position-${player.position.toLowerCase()} ${substitutionMode ? 'is-substitution-mode' : ''} ${substitutionSourceId === player.id ? 'is-substitution-source' : ''} ${substitutionCandidateIds.has(player.id) ? 'is-substitution-candidate' : ''} ${substitutionTargetId === player.id ? 'is-substitution-target' : ''} ${substitutionMode && !substitutionCandidateIds.has(player.id) ? 'is-substitution-unavailable' : ''}`}
                      key={player.id}
                    >
                      <td>
                        <button
                          aria-label={substitutionMode
                            ? substitutionCandidateIds.has(player.id)
                              ? `Substitute with ${player.displayName}`
                              : `${player.displayName} is not a legal substitution candidate`
                            : `View ${player.displayName} details`}
                          aria-pressed={substitutionMode && substitutionCandidateIds.has(player.id) ? substitutionTargetId === player.id : undefined}
                          className="squad-page__player-link"
                          disabled={substitutionMode && !substitutionCandidateIds.has(player.id)}
                          onClick={() => selectPlayer(player)}
                          type="button"
                        >
                          <PlayerIdentity circle player={player} />
                          {player.captain ? <span className="squad-page__row-badge">C</span> : null}
                          {player.viceCaptain ? <span className="squad-page__row-badge vice">VC</span> : null}
                        </button>
                      </td>
                      <td><strong>{formatInteger(player.points)}</strong></td>
                      <td><span className="squad-page__list-form-value"><strong>{formatMetric(player.form)}</strong><span className="squad-page__list-form"><FormDots value={player.form} /></span></span></td>
                      <td><span className="squad-page__expected"><span>{formatMetric(player.xg)}</span><span>{formatMetric(player.xa)}</span></span></td>
                      <td><AvailabilityFlag inline player={player} /></td>
                      <td>
                        <button
                          aria-label={substitutionMode
                            ? substitutionCandidateIds.has(player.id)
                              ? `Substitute with ${player.displayName}`
                              : `${player.displayName} is not a legal substitution candidate`
                            : `Player actions for ${player.displayName}`}
                          aria-pressed={substitutionMode && substitutionCandidateIds.has(player.id) ? substitutionTargetId === player.id : undefined}
                          className="squad-page__icon-button"
                          disabled={substitutionMode && !substitutionCandidateIds.has(player.id)}
                          onClick={() => selectPlayer(player)}
                          title={substitutionMode ? `Substitute with ${player.displayName}` : `Actions for ${player.displayName}`}
                          type="button"
                        >
                          {substitutionMode ? <Repeat2 size={17} /> : <MoreHorizontal size={17} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function DrawerLayer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="squad-page__drawer-layer"><button aria-label="Close drawer" className="squad-page__backdrop" onClick={onClose} type="button" />{children}</div>;
}

function DrawerHeader({ onClose, player, title }: { onClose: () => void; player?: PlayerView; title: string }) {
  return (
    <header className="squad-page__drawer-header">
      {player ? <TeamShirt large team={player.team} /> : <span className="squad-page__brand-mark"><Shield size={22} /></span>}
      <div><h2>{title}</h2>{player ? <p><PositionMarker position={player.position} /> · <span className={`${fixtureOpponentClassName(player.nextFixtureDifficulty)} ${player.nextOpponent ? '' : 'is-placeholder'}`.trim()} title={fixtureDifficultyTitle(player.nextFixtureDifficulty)}>{formatFixtureLabel(player)}</span></p> : null}</div>
      <button aria-label="Close drawer" className="squad-page__icon-button" onClick={onClose} type="button"><X size={19} /></button>
    </header>
  );
}

function SubstitutionModePanel({
  candidateCount,
  onBenchOrderChange,
  onCancel,
  onConfirm,
  option,
  selectedBenchOrder,
  source,
  sourceView,
  locked,
}: {
  candidateCount: number;
  onBenchOrderChange: (order: BenchSlotOrder | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  option: SubstitutionOptionView | null;
  selectedBenchOrder: BenchSlotOrder | null;
  source: TeamSelectionPlayer;
  sourceView: PlayerView;
  locked: boolean;
}) {
  const benchPlayer = option ? benchEntrantForSubstitution(source, option.target) : null;
  return (
    <section aria-label="Substitution mode" className="squad-page__substitution-mode">
      <div className="squad-page__substitution-mode-header">
        <span className="action-icon"><Repeat2 aria-hidden="true" size={18} /></span>
        <div>
          <p className="eyebrow">Substitution mode</p>
          <strong>Choose a player from the squad below</strong>
          <small>{candidateCount === 0 ? 'No legal replacements are available in this formation.' : `${candidateCount} legal replacement${candidateCount === 1 ? '' : 's'} shown.`}</small>
        </div>
        <button aria-label="Cancel substitution" className="squad-page__icon-button" onClick={onCancel} type="button"><X size={18} /></button>
      </div>
      <div className="squad-page__substitution-mode-selection">
        <div className="squad-page__substitution-mode-player">
          <span className="eyebrow">Replacing</span>
          <PlayerIdentity player={sourceView} showMeta={false} />
          <small>{lineupAreaLabel(source)}</small>
        </div>
        {option ? (
          <>
            <ArrowRightLeft aria-hidden="true" className="squad-page__substitution-mode-arrow" size={17} />
            <div className="squad-page__substitution-mode-player selected">
              <span className="eyebrow">Selected replacement</span>
              <PlayerIdentity player={option.targetView} showMeta={false} />
              <small>{lineupAreaLabel(option.target)}</small>
            </div>
          </>
        ) : null}
      </div>
      {option && option.benchOrders.length > 0 && benchPlayer ? (
        <div className="squad-page__substitution-mode-slots">
          <div>
            <span className="eyebrow">Bench position for {benchPlayer.name}</span>
            <small>Choose the goalkeeper slot or outfield order.</small>
          </div>
          <div aria-label={`Bench position for ${benchPlayer.name}`} className="squad-page__bench-slot-options" role="group">
            {option.benchOrders.map((order) => (
              <button
                aria-pressed={selectedBenchOrder === order}
                aria-label={`Bench position ${order === 0 ? 'goalkeeper' : order}`}
                className="squad-page__bench-slot-option"
                disabled={locked}
                key={order}
                onClick={() => onBenchOrderChange(order)}
                type="button"
              >
                {order === 0 ? 'GK' : order}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {option ? (
        <Button disabled={locked} onClick={onConfirm} type="button">
          <Repeat2 aria-hidden="true" size={16} />
          Confirm substitution
        </Button>
      ) : null}
    </section>
  );
}

function CompareDrawer({
  candidates,
  error,
  loading,
  onAdd,
  onClose,
  onQueryChange,
  onRemove,
  players,
  query,
}: {
  candidates: PlayerView[];
  error: string | null;
  loading: boolean;
  onAdd: (player: PlayerView) => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onRemove: (playerId: string) => void;
  players: PlayerView[];
  query: string;
}) {
  return (
    <>
      <span aria-hidden="true" className="squad-page__sheet-handle" />
      <DrawerHeader onClose={onClose} title="Player comparison" />
      <p className="squad-page__drawer-copy">Compare up to three players in the order you select them.</p>
      <div className="squad-page__compare-grid">
        {players.map((player, index) => (
          <article className="squad-page__compare-card" key={player.id}>
            <div className="squad-page__compare-order">{index + 1}</div>
            <PlayerIdentity player={player} />
            <div className="squad-page__compare-metrics"><Metric label="Points" value={formatInteger(player.points)} /><Metric label="Form" value={formatMetric(player.form)} /><Metric placeholder={player.xg === null} label="xG" value={formatMetric(player.xg)} /><Metric placeholder={player.xa === null} label="xA" value={formatMetric(player.xa)} /></div>
            {index > 0 ? <button className="squad-page__text-button" onClick={() => onRemove(player.id)} type="button">Remove</button> : null}
          </article>
        ))}
      </div>
      {players.length < 3 ? (
        <section className="squad-page__search-add">
          <label><Search size={16} /><span className="sr-only">Search comparison players</span><input aria-label="Search comparison players" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search player or club" value={query} /></label>
          {loading ? <p className="squad-page__empty-copy">Loading comparison players…</p> : null}
          {error ? <p className="squad-page__error-copy">Comparison players unavailable: {error}</p> : null}
          {query.trim() ? <div className="squad-page__search-results">{candidates.map((player) => <button key={player.id} onClick={() => onAdd(player)} type="button"><PlayerIdentity player={player} /><span>Add</span></button>)}</div> : null}
        </section>
      ) : null}
    </>
  );
}

function TradeDrawer({
  candidates,
  error,
  loading,
  onClose,
  onQueryChange,
  onSubmit,
  onTargetChange,
  onTeamChange,
  query,
  source,
  target,
  teams,
  teamId,
}: {
  candidates: PlayerView[];
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onTargetChange: (player: PlayerView) => void;
  onTeamChange: (teamId: string) => void;
  query: string;
  source: PlayerView;
  target: PlayerView | null;
  teams: TeamRef[];
  teamId: string;
}) {
  return (
    <>
      <span aria-hidden="true" className="squad-page__sheet-handle" />
      <DrawerHeader onClose={onClose} title="Start a trade" />
      {loading ? <p className="squad-page__empty-copy">Loading trade players…</p> : null}
      {error ? <p className="squad-page__error-copy">Trade players unavailable: {error}</p> : null}
      <section className="squad-page__drawer-section"><h3>You would offer</h3><PlayerIdentity large player={source} /></section>
      <label className="squad-page__field"><span>Other manager</span><select onChange={(event) => onTeamChange(event.target.value)} value={teamId}><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {teamId ? (
        <section className="squad-page__search-add">
          <label><Search size={16} /><span className="sr-only">Search trade targets</span><input aria-label="Search trade targets" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search their players" value={query} /></label>
          {query.trim() ? <div className="squad-page__search-results">{candidates.map((player) => <button key={player.id} onClick={() => onTargetChange(player)} type="button"><PlayerIdentity player={player} /><span>Select</span></button>)}</div> : null}
        </section>
      ) : null}
      {target ? <section className="squad-page__drawer-section"><h3>Target</h3><PlayerIdentity large player={target} /><div className="squad-page__trade-guidance"><div><strong>FPL evidence</strong><span className="squad-page__api-chip">Official data</span></div><p>{source.displayName}: {formatInteger(source.points)} pts · {formatMetric(source.form)} form. {target.displayName}: {formatInteger(target.points)} pts · {formatMetric(target.form)} form.</p></div></section> : null}
      <Button disabled={!target} onClick={onSubmit} type="button">Send trade proposal</Button>
    </>
  );
}

function PlayerIdentity({ circle = false, large = false, player, showForm = false, showMeta = true }: { circle?: boolean; large?: boolean; player: PlayerView; showForm?: boolean; showMeta?: boolean }) {
  if (circle) {
    return (
      <span className="squad-page__identity squad-page__identity--circle">
        <span aria-hidden="true" className="squad-page__identity-circle-shirt-crop"><TeamShirt large team={player.team} /></span>
        <strong className="squad-page__identity-circle-name">{shortPlayerName(player.displayName)}</strong>
        <small className={`${fixtureOpponentClassName(player.nextFixtureDifficulty)} squad-page__identity-circle-opponent ${player.nextOpponent ? '' : 'is-placeholder'}`.trim()} title={fixtureDifficultyTitle(player.nextFixtureDifficulty)}>{formatFixtureLabel(player)}</small>
      </span>
    );
  }
  return (
    <span className={`squad-page__identity ${large ? 'large' : ''}`}>
      <PositionMarker position={player.position} />
      <TeamShirt large={large} team={player.team} />
      <span><strong>{player.displayName}</strong>{showForm ? <span className="squad-page__list-form"><FormDots value={player.form} /></span> : null}{showMeta ? <small><span className={`${fixtureOpponentClassName(player.nextFixtureDifficulty)} ${player.nextOpponent ? '' : 'is-placeholder'}`.trim()} title={fixtureDifficultyTitle(player.nextFixtureDifficulty)}>{formatFixtureLabel(player)}</span></small> : null}</span>
    </span>
  );
}

function PositionMarker({ position }: { position: string }) {
  return <span aria-hidden="true" className={`squad-page__position-marker position-${normalizePosition(position).toLowerCase()}`} title={`${positionLabel(position)} player`} />;
}

export function TeamShirt({ large = false, team }: { large?: boolean; team: string }) {
  const normalized = team.trim().toLowerCase();
  const officialSrc = officialFplShirtUrl(team, large);
  const fallbackSrc = `/team-shirts/${normalized}.svg`;
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`squad-page__shirt ${large ? 'large' : ''}`}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = officialSrc ? fallbackSrc : '/team-shirts/unknown.svg';
      }}
      src={officialSrc ?? '/team-shirts/unknown.svg'}
    />
  );
}

function AvailabilityFlag({ inline = false, player }: { inline?: boolean; player: PlayerView }) {
  const issue = getAvailabilityIssue({
    availability: player.availability,
    chance_of_playing_next_round: player.chanceOfPlaying,
  });
  if (!issue) return null;
  const Icon = issue.severity === 'critical' ? CircleX : CircleAlert;
  const chance = availabilityChance(player.chanceOfPlaying);
  return <span aria-label={`Availability: ${issue.label}`} className={`squad-page__availability-flag ${issue.severity} ${inline ? 'inline' : ''}`} title={`Availability: ${issue.label}`}>{chance !== null ? <span aria-hidden="true" className="squad-page__availability-chance">{chance}</span> : <Icon aria-hidden="true" size={13} />}</span>;
}

function Metric({ dots = false, label, placeholder = false, value }: { dots?: boolean; label: string; placeholder?: boolean; value: string }) {
  return <div className={`squad-page__metric ${placeholder ? 'is-placeholder' : ''}`}><span>{label}</span><strong>{value}</strong>{dots ? <FormDots value={Number(value)} /> : null}{placeholder ? <small>Not in source</small> : null}</div>;
}

export function FormDots({ value }: { value: number | null }) {
  const active = value === null || Number.isNaN(value)
    ? 0
    : value < 0
      ? 1
      : Math.max(0, Math.min(5, Math.round(value / 2)));
  const band = formBand(value);
  return <span aria-hidden="true" className={`squad-page__form-dots form-band-${band}`}>{Array.from({ length: 5 }, (_, index) => <i className={index < active ? 'active' : ''} key={index} />)}</span>;
}

function ChangeReview({ label, players }: { label: string; players: PlayerView[] }) {
  return <section className="squad-page__review-section"><h3>{label}</h3>{players.length === 0 ? <p>None</p> : players.map((player) => <PlayerIdentity key={player.id} player={player} />)}</section>;
}

function buildSquadChangeValidation(additions: PlayerView[], removals: PlayerView[]): string[] {
  if (additions.length === removals.length) return [];
  if (additions.length > removals.length) return [`Remove ${additions.length - removals.length} more player${additions.length - removals.length === 1 ? '' : 's'} before confirming.`];
  return [`Add ${removals.length - additions.length} draw-won player${removals.length - additions.length === 1 ? '' : 's'} before confirming.`];
}

function uniqueTradeTeams(players: PlayerView[], ownTeamId: string): TeamRef[] {
  const teams = new Map<string, TeamRef>();
  players.forEach((player) => {
    if (player.draftTeam && player.draftTeam.id !== ownTeamId) teams.set(player.draftTeam.id, player.draftTeam);
  });
  return [...teams.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function matchesQuery(player: PlayerView, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return player.displayName.toLowerCase().includes(normalized)
    || player.team.toLowerCase().includes(normalized)
    || player.position.toLowerCase().includes(normalized);
}

function compareSortMetric(left: PlayerView, right: PlayerView, key: SortKey): number {
  const leftValue = key === 'points' ? left.points : key === 'form' ? left.form : key === 'xg' ? left.xg : left.xa;
  const rightValue = key === 'points' ? right.points : key === 'form' ? right.form : key === 'xg' ? right.xg : right.xa;
  if (leftValue === null && rightValue === null) return left.displayName.localeCompare(right.displayName);
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return rightValue - leftValue || left.displayName.localeCompare(right.displayName);
}

function compareListPlayers(left: PlayerView, right: PlayerView, key: SortKey): number {
  const slotOrder: Record<TeamSelectionSlot, number> = { starter: 0, bench: 1, reserve: 2 };
  const leftSlot = left.slot ?? 'reserve';
  const rightSlot = right.slot ?? 'reserve';
  const slotDifference = slotOrder[leftSlot] - slotOrder[rightSlot];
  if (slotDifference !== 0) return slotDifference;
  if (leftSlot === 'bench') return sortBySlot(left, right);
  const positionDifference = pitchPositionOrder.indexOf(left.position) - pitchPositionOrder.indexOf(right.position);
  if (positionDifference !== 0) return positionDifference;
  return compareSortMetric(left, right, key);
}

function sortLabel(key: SortKey): string {
  if (key === 'points') return 'points';
  if (key === 'form') return 'form';
  if (key === 'xg') return 'xG';
  return 'xA';
}

function nextSortKey(key: SortKey): SortKey {
  const keys: SortKey[] = ['points', 'form', 'xg', 'xa'];
  return keys[(keys.indexOf(key) + 1) % keys.length];
}

function lineupGroups(players: PlayerView[]) {
  const definitions: Array<{ slot: TeamSelectionSlot; label: string; description: string }> = [
    { slot: 'starter', label: 'Starting XI', description: 'Legal matchday formation' },
    { slot: 'bench', label: 'Bench', description: '1 goalkeeper + outfield substitutes 1–4' },
    { slot: 'reserve', label: 'Reserves', description: 'Not in the matchday squad' },
  ];
  return definitions
    .map((definition) => ({
      ...definition,
      players: players.filter((player) => (player.slot ?? 'reserve') === definition.slot),
    }))
    .filter((group) => group.players.length > 0);
}

function sortBySlot(left: PlayerView, right: PlayerView): number {
  return (left.slotOrder ?? Number.MAX_SAFE_INTEGER) - (right.slotOrder ?? Number.MAX_SAFE_INTEGER);
}

export function selectionIsValid(players: TeamSelectionPlayer[]): boolean {
  const starters = players.filter((player) => player.slot === 'starter');
  const bench = players.filter((player) => player.slot === 'bench');
  const reserves = players.filter((player) => player.slot === 'reserve');
  const captainCount = players.filter((player) => player.captain).length;
  const viceCaptainCount = players.filter((player) => player.viceCaptain).length;
  if (captainCount !== 1 || viceCaptainCount !== 1) return false;
  if (players.length !== 20) {
    return starters.length === 3 && bench.length === 1 && reserves.length === 1;
  }
  if (starters.length !== 11 || bench.length !== 5 || reserves.length !== 4) return false;

  for (const [position, [minimum, maximum]] of Object.entries(STARTER_LIMITS)) {
    const count = starters.filter((player) => normalizePosition(player.position) === position).length;
    if (count < minimum || count > maximum) return false;
  }

  const benchGoalkeepers = bench.filter((player) => normalizePosition(player.position) === 'GKP');
  const benchOutfield = bench.filter((player) => normalizePosition(player.position) !== 'GKP');
  const captain = players.find((player) => player.captain);
  const viceCaptain = players.find((player) => player.viceCaptain);
  return benchGoalkeepers.length === 1
    && benchGoalkeepers[0].slotOrder === 0
    && benchOutfield.length === 4
    && benchOutfield.map((player) => player.slotOrder).sort((left, right) => left - right).join(',') === '1,2,3,4'
    && captain?.slot === 'starter'
    && viceCaptain?.slot === 'starter'
    && captain.id !== viceCaptain.id;
}

export function getSubstitutionOptions(
  players: TeamSelectionPlayer[],
  sourceId: string,
): SubstitutionOption[] {
  const source = players.find((player) => player.id === sourceId);
  if (!source) return [];

  return players
    .filter((target) => target.id !== source.id)
    .filter((target) => target.slot !== source.slot || target.slot === 'bench')
    .map((target) => {
      const benchPlayer = benchEntrantForSubstitution(source, target);
      const possibleBenchOrders = benchPlayer
        ? benchOrdersForPosition(benchPlayer.position)
        : [null];
      const legalBenchOrders = possibleBenchOrders.filter((order) => (
        selectionIsValid(applySubstitution(players, source.id, target.id, order))
      ));
      if (legalBenchOrders.length === 0) return null;
      const benchOrders = legalBenchOrders.filter(
        (order): order is BenchSlotOrder => order !== null,
      );
      return {
        target,
        benchOrders,
        defaultBenchOrder: benchPlayer
          ? preferredBenchOrder(source, target, benchOrders)
          : null,
      };
    })
    .filter((option): option is SubstitutionOption => option !== null)
    .sort((left, right) => (
      lineupSlotRank(left.target.slot) - lineupSlotRank(right.target.slot)
      || left.target.slotOrder - right.target.slotOrder
      || left.target.name.localeCompare(right.target.name)
    ));
}

function benchEntrantForSubstitution(
  source: TeamSelectionPlayer,
  target: TeamSelectionPlayer,
): TeamSelectionPlayer | null {
  if (source.slot === 'bench' && target.slot !== 'bench') return target;
  if (source.slot !== 'bench' && target.slot === 'bench') return source;
  return null;
}

function benchOrdersForPosition(position: string): BenchSlotOrder[] {
  return normalizePosition(position) === 'GKP'
    ? [0]
    : BENCH_SLOT_ORDERS.filter((order) => order !== 0);
}

function preferredBenchOrder(
  source: TeamSelectionPlayer,
  target: TeamSelectionPlayer,
  allowedOrders: BenchSlotOrder[],
): BenchSlotOrder {
  const currentOrder = source.slot === 'bench' ? source.slotOrder : target.slotOrder;
  return allowedOrders.includes(currentOrder as BenchSlotOrder)
    ? currentOrder as BenchSlotOrder
    : allowedOrders[0];
}

export function applySubstitution(
  players: TeamSelectionPlayer[],
  sourceId: string,
  targetId: string,
  benchOrder: BenchSlotOrder | null,
): TeamSelectionPlayer[] {
  const source = players.find((player) => player.id === sourceId);
  const target = players.find((player) => player.id === targetId);
  if (!source || !target) return players;

  if (source.slot === target.slot) {
    if (source.slot !== 'bench') return players;
    return normalizeLineupPlayers(players.map((player) => {
      if (player.id === source.id) return { ...player, slotOrder: target.slotOrder };
      if (player.id === target.id) return { ...player, slotOrder: source.slotOrder };
      return player;
    }));
  }

  const swapped = players.map((player) => {
    if (player.id === source.id) {
      return { ...player, slot: target.slot, slotOrder: target.slotOrder };
    }
    if (player.id === target.id) {
      return { ...player, slot: source.slot, slotOrder: source.slotOrder };
    }
    return player;
  });
  const benchPlayer = benchEntrantForSubstitution(source, target);
  return benchPlayer && benchOrder !== null
    ? applyBenchOrder(swapped, benchPlayer.id, benchOrder)
    : normalizeLineupPlayers(swapped);
}

function applyBenchOrder(
  players: TeamSelectionPlayer[],
  playerId: string,
  desiredOrder: BenchSlotOrder,
): TeamSelectionPlayer[] {
  const benchPlayer = players.find((player) => player.id === playerId && player.slot === 'bench');
  if (!benchPlayer) return normalizeLineupPlayers(players);
  if (desiredOrder === 0) {
    return normalizeLineupPlayers(players.map((player) => (
      player.id === playerId ? { ...player, slotOrder: 0 } : player
    )));
  }

  const remainingOutfield = players
    .filter((player) => player.slot === 'bench' && normalizePosition(player.position) !== 'GKP' && player.id !== playerId)
    .sort(sortTeamSelectionPlayers);
  const insertAt = Math.max(0, Math.min(remainingOutfield.length, desiredOrder - 1));
  remainingOutfield.splice(insertAt, 0, benchPlayer);
  const orderById = new Map(remainingOutfield.map((player, index) => [player.id, index + 1]));
  return normalizeLineupPlayers(players.map((player) => {
    const order = orderById.get(player.id);
    return order === undefined ? player : { ...player, slotOrder: order };
  }));
}

function lineupSlotRank(slot: TeamSelectionSlot): number {
  return slot === 'starter' ? 0 : slot === 'bench' ? 1 : 2;
}

function lineupAreaLabel(player: TeamSelectionPlayer): string {
  if (player.slot === 'starter') return 'Starting XI';
  if (player.slot === 'reserve') return 'Reserves';
  return player.slotOrder === 0 ? 'Bench · GK' : `Bench · ${player.slotOrder}`;
}

export function normalizeLineupPlayers(players: TeamSelectionPlayer[]): TeamSelectionPlayer[] {
  const starters = players.filter((player) => player.slot === 'starter').sort(sortTeamSelectionPlayers);
  const bench = players.filter((player) => player.slot === 'bench').sort(sortTeamSelectionPlayers);
  const reserves = players.filter((player) => player.slot === 'reserve').sort(sortTeamSelectionPlayers);
  const fullSquad = players.length === 20;
  const captainId = fullSquad
    ? (starters.find((player) => player.captain)?.id ?? starters[0]?.id)
    : undefined;
  const viceCaptainId = fullSquad
    ? (starters.find((player) => player.viceCaptain && player.id !== captainId)?.id
      ?? starters.find((player) => player.id !== captainId)?.id)
    : undefined;

  const normalizeGroup = (group: TeamSelectionPlayer[], slot: TeamSelectionSlot) => {
    let outfieldOrder = 0;
    return group.map((player, index) => ({
      ...player,
      slot,
      slotOrder: slot === 'bench' && normalizePosition(player.position) === 'GKP'
        ? 0
        : slot === 'bench'
          ? ++outfieldOrder
          : index + 1,
      captain: fullSquad ? player.id === captainId : player.captain,
      viceCaptain: fullSquad ? player.id === viceCaptainId : player.viceCaptain,
    }));
  };

  return [
    ...normalizeGroup(starters, 'starter'),
    ...normalizeGroup(bench, 'bench'),
    ...normalizeGroup(reserves, 'reserve'),
  ];
}

function sortTeamSelectionPlayers(left: TeamSelectionPlayer, right: TeamSelectionPlayer): number {
  return left.slotOrder - right.slotOrder || left.name.localeCompare(right.name);
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TeamSelectionApiError && error.code === 'conflict') {
    const reason = typeof error.details.reason === 'string' ? error.details.reason : error.message;
    return `Lineup locked. ${reason}`;
  }
  if (error instanceof SquadApiError) return error.message;
  return fallback;
}

function formatDeadlineDate(deadlineAt: string): string {
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return 'Deadline pending';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    weekday: 'short',
  }).format(deadline);
}

function formatCountdown(deadlineAt: string, now: number): string {
  const remainingSeconds = Math.max(0, Math.floor((new Date(deadlineAt).getTime() - now) / 1000));
  if (remainingSeconds <= 0) return 'Deadline passed';
  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'GK' || normalized === 'GOALKEEPER') return 'GKP';
  if (normalized === 'DEFENDER') return 'DEF';
  if (normalized === 'MIDFIELDER') return 'MID';
  if (normalized === 'FORWARD' || normalized === 'STRIKER') return 'FWD';
  return normalized;
}

function positionLabel(position: string): string {
  const normalized = normalizePosition(position);
  if (normalized === 'GKP') return 'Goalkeeper';
  if (normalized === 'DEF') return 'Defender';
  if (normalized === 'MID') return 'Midfielder';
  if (normalized === 'FWD') return 'Forward';
  return normalized;
}

function firstNumber(...values: Array<number | null | undefined>): number | null {
  return values.find((value): value is number => typeof value === 'number') ?? null;
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function formatMetric(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(1);
}

function formatInteger(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : String(value);
}

export function formBand(value: number | null): 'negative' | 'low' | 'steady' | 'high' | 'unknown' {
  if (value === null || Number.isNaN(value)) return 'unknown';
  if (value < 0) return 'negative';
  if (value < 4) return 'low';
  if (value < 10) return 'steady';
  return 'high';
}

export function formatFixtureLabel(player: Pick<PlayerView, 'nextOpponent' | 'nextFixtureIsHome'>): string {
  if (!player.nextOpponent) return 'Next —';
  return player.nextFixtureIsHome === true
    ? player.nextOpponent.toUpperCase()
    : player.nextOpponent.toLowerCase();
}

const fixtureDifficultyLabels = ['Very easy', 'Easy', 'Balanced', 'Hard', 'Very challenging'] as const;

function normalizedFixtureDifficulty(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function fixtureOpponentClassName(value: number | null | undefined): string {
  const rating = normalizedFixtureDifficulty(value);
  return rating === null ? 'squad-page__opponent' : `squad-page__opponent squad-page__opponent--fdr-${rating}`;
}

export function fixtureDifficultyTitle(value: number | null | undefined): string | undefined {
  const rating = normalizedFixtureDifficulty(value);
  return rating === null ? undefined : `${fixtureDifficultyLabels[rating - 1]} fixture`;
}

function isAvailabilityRisk(player: PlayerView): boolean {
  return hasAvailabilityIssue({
    availability: player.availability,
    chance_of_playing_next_round: player.chanceOfPlaying,
  });
}

export function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0][0]}. ${parts.at(-1)}`;
}
