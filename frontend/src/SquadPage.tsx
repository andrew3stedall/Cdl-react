import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRightLeft,
  Bell,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  CirclePlus,
  Crown,
  Filter,
  Home,
  Layers,
  LayoutGrid,
  List,
  LockKeyhole,
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
import type { ThemePreset } from './contracts';
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

interface SquadPageProps {
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
}

type SquadView = 'pitch' | 'list';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type DrawerMode = 'player' | 'compare' | 'trade' | 'profile' | null;
type PlayerStatus = 'owned' | 'available' | 'interested' | 'trade_target';
type SortKey = 'points' | 'form' | 'xg' | 'xa';

interface TeamRef {
  id: string;
  name: string;
  shortName: string;
}

interface PlayerView {
  id: string;
  displayName: string;
  position: string;
  team: string;
  status: PlayerStatus;
  points: number;
  form: number | null;
  value: number;
  selectedByPercent: number | null;
  draftTeam: TeamRef | null;
  xg: number | null;
  xa: number | null;
  nextOpponent: string | null;
  availability: string | null;
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
  epl_team: { id?: string; name: string; short_name?: string | null };
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
  chance_of_playing_next_round?: number | null;
}

interface SquadSummaryApiResponse {
  manager_team: { id: string; name: string; short_name?: string | null };
  gameweek: { name: string };
  players: PlayerApiResponse[];
}

interface ScoutingApiResponse {
  players: PlayerApiResponse[];
}

interface TradeApiResponse {
  id: string;
  status: string;
}

const pitchPositionOrder = ['GKP', 'DEF', 'MID', 'FWD'];
const teamShirtCodes = new Set([
  'ars', 'avl', 'bou', 'bre', 'bha', 'che', 'cov', 'cry', 'eve', 'ful',
  'hul', 'ips', 'lee', 'liv', 'mci', 'mun', 'new', 'nfo', 'sun', 'tot',
]);
const positionOptions: Array<{ shortLabel: string; value: PositionFilter }> = [
  { shortLabel: 'All', value: 'all' },
  { shortLabel: 'GKP', value: 'GKP' },
  { shortLabel: 'DEF', value: 'DEF' },
  { shortLabel: 'MID', value: 'MID' },
  { shortLabel: 'FWD', value: 'FWD' },
];
const defaultTeamSelectionClient = new HttpTeamSelectionClient();

function getStoredView(): SquadView {
  try {
    return window.localStorage.getItem('cdl:squad-view') === 'list' ? 'list' : 'pitch';
  } catch {
    return 'pitch';
  }
}

function mapPlayer(player: PlayerApiResponse): PlayerView {
  return {
    id: player.id,
    displayName: player.display_name,
    position: normalizePosition(player.position),
    team: player.epl_team.short_name ?? player.epl_team.name,
    status: player.status,
    points: player.points,
    form: typeof player.form === 'number' ? player.form : null,
    value: player.value,
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
    nextOpponent: player.next_opponent ?? null,
    availability: player.availability ?? null,
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
    points: 0,
    form: null,
    value: 0,
    selectedByPercent: null,
    draftTeam: null,
    xg: null,
    xa: null,
    nextOpponent: null,
    availability: null,
    chanceOfPlaying: null,
    slot: player.slot,
    slotOrder: player.slotOrder,
    captain: player.captain,
    viceCaptain: player.viceCaptain,
  };
}

async function fetchOptionalJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { credentials: 'include' });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
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
      points: existing?.points ?? 0,
      form: existing?.form ?? null,
      value: existing?.value ?? 0,
      selectedByPercent: existing?.selectedByPercent ?? null,
      draftTeam: existing?.draftTeam ?? null,
      xg: existing?.xg ?? null,
      xa: existing?.xa ?? null,
      nextOpponent: existing?.nextOpponent ?? null,
      availability: existing?.availability ?? null,
      chanceOfPlaying: existing?.chanceOfPlaying ?? null,
      slot: player.slot,
      slotOrder: player.slotOrder,
      captain: player.captain,
      viceCaptain: player.viceCaptain,
    } satisfies PlayerView;
  });

  return [...positioned, ...roster.filter((player) => !lineupIds.has(player.id))];
}

export function SquadPage({ preset, teamSelectionClient = defaultTeamSelectionClient }: SquadPageProps) {
  const [squadView, setSquadView] = useState<SquadView>(getStoredView);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [squadPlayers, setSquadPlayers] = useState<PlayerView[]>([]);
  const [scoutingPool, setScoutingPool] = useState<PlayerView[]>([]);
  const [trades, setTrades] = useState<TradeApiResponse[]>([]);
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
  const [comparePlayers, setComparePlayers] = useState<PlayerView[]>([]);
  const [compareQuery, setCompareQuery] = useState('');
  const [tradeSource, setTradeSource] = useState<PlayerView | null>(null);
  const [tradeTeamId, setTradeTeamId] = useState('');
  const [tradeTarget, setTradeTarget] = useState<PlayerView | null>(null);
  const [tradeQuery, setTradeQuery] = useState('');
  const [stagedRemovalIds, setStagedRemovalIds] = useState<Set<string>>(() => new Set());
  const [stagedAdditionIds] = useState<Set<string>>(() => new Set());
  const [changesPanelOpen, setChangesPanelOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void Promise.all([
      fetchOptionalJson<SquadSummaryApiResponse>('/api/squad/summary'),
      fetchOptionalJson<ScoutingApiResponse>('/api/scouting/players'),
      fetchOptionalJson<{ trades?: TradeApiResponse[] }>('/api/trades'),
      teamSelectionClient.getTeamSelection().catch(() => null),
    ])
      .then(([summary, scouting, persistedTrades, lineup]) => {
        if (!summary && !lineup) throw new Error('Unable to load your squad.');
        const roster = summary?.players.map(mapPlayer)
          ?? lineup?.players.map(mapTeamSelectionPlayer)
          ?? [];
        const hasLineup = Boolean(lineup?.players.length);
        setTeamSelection(lineup);
        setSquadPlayers(mergeLineupPlayers(roster, lineup?.players ?? null));
        setScoutingPool(scouting?.players.map(mapPlayer) ?? []);
        setManagerTeam({
          id: summary?.manager_team.id ?? lineup?.managerTeam.id ?? '',
          name: summary?.manager_team.name ?? lineup?.managerTeam.name ?? 'Current team',
          shortName: summary?.manager_team.short_name
            ?? lineup?.managerTeam.shortName
            ?? lineup?.managerTeam.name
            ?? '',
        });
        setGameweek(lineup?.gameweek.name ?? summary?.gameweek.name ?? 'Gameweek');
        setTrades(persistedTrades?.trades ?? []);
        setLineupAvailable(hasLineup);
        setLineupDirty(false);
        if (!hasLineup) setSquadView('list');
        setStatus(
          hasLineup
            ? `${summary?.manager_team.name ?? lineup?.managerTeam.name} squad ready for review.`
            : `${summary?.manager_team.name ?? 'Your'} squad loaded.`,
        );
      })
      .catch((error: Error) => setStatus(error.message));
  }, [teamSelectionClient]);

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
  const drawWins: PlayerView[] = [];
  const stagedAdditionPlayers = drawWins.filter((player) => stagedAdditionIds.has(player.id));
  const listPlayers = useMemo(() => {
    const filtered = visibleSquadPlayers
      .filter((player) => positionFilter === 'all' || player.position === positionFilter)
      .filter((player) => matchesQuery(player, query));
    return [...filtered].sort((left, right) => compareListPlayers(left, right, sortKey));
  }, [positionFilter, query, sortKey, visibleSquadPlayers]);
  const positionCounts = useMemo(() => ({
    all: visibleSquadPlayers.length,
    GKP: visibleSquadPlayers.filter((player) => player.position === 'GKP').length,
    DEF: visibleSquadPlayers.filter((player) => player.position === 'DEF').length,
    MID: visibleSquadPlayers.filter((player) => player.position === 'MID').length,
    FWD: visibleSquadPlayers.filter((player) => player.position === 'FWD').length,
  }), [visibleSquadPlayers]);
  const proposedTradeCount = trades.filter((trade) => trade.status === 'proposed').length;
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
  function closeDrawer() {
    setDrawerMode(null);
    setSelectedPlayer(null);
    setCompareQuery('');
    setTradeQuery('');
  }

  function openPlayer(player: PlayerView) {
    setSelectedPlayer(player);
    setDrawerMode('player');
  }

  function openProfile(player: PlayerView) {
    setSelectedPlayer(player);
    setDrawerMode('profile');
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

  function stageRemoval(player: PlayerView) {
    setStagedRemovalIds((current) => new Set([...current, player.id]));
    setChangesPanelOpen(true);
    closeDrawer();
    setStatus(`${player.displayName} staged for removal.`);
  }

  function restorePlayer(player: PlayerView) {
    setStagedRemovalIds((current) => {
      const next = new Set(current);
      next.delete(player.id);
      return next;
    });
    setStatus(`${player.displayName} restored to the squad.`);
  }

  function movePlayer(playerId: string, slot: TeamSelectionSlot) {
    if (!teamSelection || lineupLocked) return;
    const player = teamSelection.players.find((candidate) => candidate.id === playerId);
    if (!player || player.slot === slot) return;
    const players = normalizeLineupPlayers(
      teamSelection.players.map((candidate) =>
        candidate.id === playerId ? { ...candidate, slot } : candidate,
      ),
    );
    setTeamSelection((current) => current ? { ...current, players } : current);
    setSquadPlayers((current) => mergeLineupPlayers(current, players));
    setLineupDirty(true);
    setStatus(`${player.name} moved to ${slotLabel(slot)}. Save lineup to validate server-side.`);
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
      setTeamSelection(updated);
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
      setTeamSelection(updated);
      setStatus(`${chip.name} chip state updated.`);
    } catch (error) {
      setStatus(apiErrorMessage(error, 'Unable to update the chip.'));
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
              <LayoutGrid aria-hidden="true" size={18} />
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
          <span aria-label="Notifications placeholder" className="squad-page__utility-placeholder" role="img" title="Notifications API not connected"><Bell size={20} /></span>
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
          {(teamSelection?.chips ?? []).map((chip) => (
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
          <a href="/scouting">Review</a>
        </section>
      ) : null}

      <section className="squad-page__roster-card">
        {squadView === 'pitch' && lineupAvailable ? (
          <SquadPitch onSelect={openPlayer} players={visibleSquadPlayers} />
        ) : (
          <SquadList
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            onPositionChange={setPositionFilter}
            onQueryChange={setQuery}
            onSelect={openPlayer}
            onSortChange={setSortKey}
            locked={lineupLocked}
            onMove={movePlayer}
            lineupEnabled={Boolean(teamSelection)}
            players={listPlayers}
            positionCounts={positionCounts}
            positionFilter={positionFilter}
            query={query}
            sortKey={sortKey}
          />
        )}
      </section>

      <aside aria-label="Squad changes" className={`squad-page__changes-panel ${changesPanelOpen ? 'is-open' : ''}`}>
        <button className="squad-page__changes-toggle" onClick={() => setChangesPanelOpen((open) => !open)} type="button">
          <span className="squad-page__changes-icon"><ArrowRightLeft size={19} /></span>
          <span><strong>Squad Changes</strong><small>{stagedChangeCount > 0 ? `${stagedChangeCount} pending changes` : 'No pending changes'}</small></span>
          <ChevronDown aria-hidden="true" className={changesPanelOpen ? 'is-open' : ''} size={20} />
        </button>

        {changesPanelOpen ? (
          <div className="squad-page__changes-body">
            <section className="squad-page__change-section">
              <div className="squad-page__change-heading"><h3>Available to Add</h3><span>{drawWins.length}</span></div>
              {drawWins.length === 0 ? (
                <div className="squad-page__api-placeholder">
                  <CirclePlus aria-hidden="true" size={18} />
                  <div><strong>Awaiting draw-rights API</strong><span>Draw-won players will appear here when the persistent manager endpoint is available.</span></div>
                </div>
              ) : null}
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

            <Button disabled={stagedChangeCount === 0} onClick={() => setConfirmationOpen(true)} type="button">
              Submit Squad Changes
            </Button>
          </div>
        ) : null}
      </aside>

      {drawerMode ? (
        <DrawerLayer onClose={closeDrawer}>
          <aside className="squad-page__drawer" ref={drawerRef} tabIndex={-1}>
            {drawerMode === 'player' && selectedPlayer ? (
              <PlayerDrawer
                onClose={closeDrawer}
                onCompare={() => startCompare(selectedPlayer)}
                onProfile={() => openProfile(selectedPlayer)}
                onRelease={() => stageRemoval(selectedPlayer)}
                onTrade={() => startTrade(selectedPlayer)}
                player={selectedPlayer}
              />
            ) : null}
            {drawerMode === 'profile' && selectedPlayer ? <ProfileDrawer onClose={closeDrawer} player={selectedPlayer} /> : null}
            {drawerMode === 'compare' ? (
              <CompareDrawer
                candidates={comparisonCandidates}
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
              />
            ) : null}
          </aside>
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
              <Button disabled={validationMessages.length > 0} type="button">Confirm Changes</Button>
            </footer>
          </section>
        </div>
      ) : null}

      <nav aria-label="Squad mobile navigation" className="squad-page__mobile-nav">
        <a href="/dashboard"><Home size={19} /><span>Home</span></a>
        <a aria-current="page" href="/squad-management"><Shield size={19} /><span>Squad</span></a>
        <a href="/scouting"><Search size={19} /><span>Market</span></a>
        <a href="/team-selection"><CalendarDays size={19} /><span>Matchweek</span></a>
        <a href="/league"><Trophy size={19} /><span>League</span></a>
      </nav>
    </main>
  );
}

function SquadPitch({ players, onSelect }: { players: PlayerView[]; onSelect: (player: PlayerView) => void }) {
  const starters = players.filter((player) => player.slot === 'starter').sort(sortBySlot);
  const bench = players.filter((player) => player.slot === 'bench').sort(sortBySlot);
  const reserves = players.filter((player) => player.slot === 'reserve').sort(sortBySlot);
  const rows = pitchPositionOrder
    .map((position) => ({ position, players: starters.filter((player) => player.position === position) }))
    .filter((row) => row.players.length > 0);
  const formation = ['DEF', 'MID', 'FWD']
    .map((position) => starters.filter((player) => player.position === position).length)
    .join('-');

  return (
    <section aria-label="Squad pitch" className="squad-page__pitch-shell">
      <div className="squad-page__pitch">
        <div className="squad-page__formation">{formation}</div>
        <div aria-hidden="true" className="squad-page__pitch-markings"><span /><span /><span /><span /></div>
        <div className="squad-page__pitch-lineup">
          {rows.map((row) => (
            <div className={`squad-page__pitch-row position-${row.position.toLowerCase()}`} key={row.position}>
              {row.players.map((player) => <PitchCard key={player.id} onSelect={onSelect} player={player} />)}
            </div>
          ))}
        </div>
      </div>
      <section aria-label="Bench" className="squad-page__bench">
        <header><h3>Bench</h3><span>1 GK + 4 ordered substitutes</span></header>
        <div>{bench.map((player) => <PitchCard benchOrder={player.slotOrder} compact key={player.id} onSelect={onSelect} player={player} />)}</div>
      </section>
      <section aria-label="Reserves" className="squad-page__reserves">
        <header><h3>Reserves</h3><span>{reserves.length} players</span></header>
        <div>{reserves.map((player) => <PitchCard compact key={player.id} onSelect={onSelect} player={player} />)}</div>
      </section>
    </section>
  );
}

function PitchCard({ benchOrder, compact = false, onSelect, player }: { benchOrder?: number; compact?: boolean; onSelect: (player: PlayerView) => void; player: PlayerView }) {
  return (
    <button aria-label={`View ${player.displayName} details`} className={`squad-page__pitch-player ${compact ? 'compact' : ''}`} onClick={() => onSelect(player)} type="button">
      <TeamShirt team={player.team} />
      <strong>{shortPlayerName(player.displayName)}</strong>
      <small className={player.nextOpponent ? '' : 'is-placeholder'}>{player.nextOpponent ? `vs ${player.nextOpponent}` : 'Next —'}</small>
      <div className="squad-page__player-form"><FormDots value={player.form} /><b>{formatMetric(player.form)}</b></div>
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
  if (name.includes('captain')) return <Crown aria-hidden="true" size={18} />;
  return <WandSparkles aria-hidden="true" size={18} />;
}

function SquadList({
  filtersOpen,
  lineupEnabled,
  locked,
  onFiltersOpenChange,
  onMove,
  onPositionChange,
  onQueryChange,
  onSelect,
  onSortChange,
  players,
  positionCounts,
  positionFilter,
  query,
  sortKey,
}: {
  filtersOpen: boolean;
  lineupEnabled: boolean;
  locked: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  onMove: (playerId: string, slot: TeamSelectionSlot) => void;
  onPositionChange: (position: PositionFilter) => void;
  onQueryChange: (query: string) => void;
  onSelect: (player: PlayerView) => void;
  onSortChange: (sort: SortKey) => void;
  players: PlayerView[];
  positionCounts: Record<PositionFilter, number>;
  positionFilter: PositionFilter;
  query: string;
  sortKey: SortKey;
}) {
  const groups = lineupGroups(players);
  return (
    <div className="squad-page__list">
      <div className="squad-page__list-controls">
        <label className="squad-page__search"><Search size={18} /><span className="sr-only">Search squad players</span><input aria-label="Search squad players" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search players..." value={query} /></label>
        <button aria-expanded={filtersOpen} aria-label="Advanced squad filters" className="squad-page__filter-button" onClick={() => onFiltersOpenChange(!filtersOpen)} type="button"><Filter size={18} /></button>
        <label className="squad-page__sort"><span className="sr-only">Sort squad</span><select aria-label="Sort squad" onChange={(event) => onSortChange(event.target.value as SortKey)} value={sortKey}><option value="points">Sort: Points</option><option value="form">Sort: Form</option><option value="xg">Sort: xG</option><option value="xa">Sort: xA</option></select><ChevronDown aria-hidden="true" size={16} /></label>
      </div>

      {filtersOpen ? (
        <div className="squad-page__filter-placeholder">
          <SlidersHorizontal size={17} />
          <span>Advanced availability and fixture filters need the Squad analytics API.</span>
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
                  <col className="next" />
                  <col className="points" />
                  <col className="form" />
                  <col className="expected" />
                  <col className="availability" />
                  <col className="action" />
                </colgroup>
                <thead><tr><th>Player</th><th>Next</th><th className="sorted">Pts <ArrowDown size={11} /></th><th>Form</th><th>xG / xA</th><th><span className="sr-only">Availability</span><CircleCheck aria-hidden="true" size={13} /></th><th><span className="sr-only">Move</span></th></tr></thead>
                <tbody>
                  {group.players.map((player) => (
                    <tr className={`squad-page__player-row position-${player.position.toLowerCase()}`} key={player.id}>
                      <td>
                        <button className="squad-page__player-link" onClick={() => onSelect(player)} type="button">
                          <PlayerIdentity player={player} showMeta={false} />
                          {player.captain ? <span className="squad-page__row-badge">C</span> : null}
                          {player.viceCaptain ? <span className="squad-page__row-badge vice">VC</span> : null}
                        </button>
                      </td>
                      <td><span className={`squad-page__next-opponent ${player.nextOpponent ? '' : 'is-placeholder'}`}>{player.nextOpponent ? `vs ${player.nextOpponent}` : 'Next —'}</span></td>
                      <td><strong>{player.points}</strong></td>
                      <td className="metric-accent">{formatMetric(player.form)}</td>
                      <td><span className="squad-page__expected"><span>{formatMetric(player.xg)}</span><span>{formatMetric(player.xa)}</span></span></td>
                      <td><AvailabilityFlag inline player={player} /></td>
                      <td>
                        {lineupEnabled ? (
                          <label className="squad-page__move-select">
                            <span className="sr-only">Move {player.displayName}</span>
                            <select aria-label={`Move ${player.displayName}`} disabled={locked} onChange={(event) => onMove(player.id, event.target.value as TeamSelectionSlot)} value={player.slot ?? 'reserve'}>
                              <option value="starter">XI</option>
                              <option value="bench">Bench</option>
                              <option value="reserve">Res.</option>
                            </select>
                            <ChevronDown aria-hidden="true" size={12} />
                          </label>
                        ) : (
                          <button aria-label={`View ${player.displayName} details`} className="squad-page__icon-button" onClick={() => onSelect(player)} type="button"><ChevronRight size={16} /></button>
                        )}
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
      <div><h2>{title}</h2>{player ? <p><span className={`squad-page__position position-${player.position.toLowerCase()}`}>{player.position}</span> · <span className={player.nextOpponent ? '' : 'is-placeholder'}>{player.nextOpponent ? `vs ${player.nextOpponent}` : 'Next fixture —'}</span></p> : null}</div>
      <button aria-label="Close drawer" className="squad-page__icon-button" onClick={onClose} type="button"><X size={19} /></button>
    </header>
  );
}

function PlayerDrawer({
  onClose,
  onCompare,
  onProfile,
  onRelease,
  onTrade,
  player,
}: {
  onClose: () => void;
  onCompare: () => void;
  onProfile: () => void;
  onRelease: () => void;
  onTrade: () => void;
  player: PlayerView;
}) {
  return (
    <>
      <span aria-hidden="true" className="squad-page__sheet-handle" />
      <DrawerHeader onClose={onClose} player={player} title={player.displayName} />
      <div className="squad-page__drawer-metrics">
        <Metric label="Total Points" value={String(player.points)} />
        <Metric dots label="Form (Last 5)" value={formatMetric(player.form)} />
        <Metric placeholder={player.xg === null} label="xG" value={formatMetric(player.xg)} />
        <Metric placeholder={player.xa === null} label="xA" value={formatMetric(player.xa)} />
      </div>
      <section className="squad-page__trade-guidance">
        <div><strong>Trade value guidance</strong><span className="squad-page__api-chip">API needed</span></div>
        <p>Projection, positional scarcity and league-demand signals are not exposed yet.</p>
        <div className="squad-page__guidance-evidence"><span>Projection <b>—</b></span><span>Recent form <b>{formatMetric(player.form)}</b></span><span>Scarcity <b>—</b></span></div>
      </section>
      <div className="squad-page__drawer-actions">
        <button onClick={onCompare} type="button"><span className="action-icon"><Search size={18} /></span><span><strong>Compare</strong><small>Compare {shortPlayerName(player.displayName)} with other players</small></span><ChevronRight size={19} /></button>
        <button onClick={onRelease} type="button"><span className="action-icon danger"><CircleMinus size={18} /></span><span><strong>Release to Free Agency</strong><small>Stage removal from your squad</small></span><ChevronRight size={19} /></button>
        <button onClick={onTrade} type="button"><span className="action-icon"><ArrowRightLeft size={18} /></span><span><strong>Draft Trade</strong><small>Start a proposal to another manager</small></span><ChevronRight size={19} /></button>
        <button onClick={onProfile} type="button"><span className="action-icon"><Users size={18} /></span><span><strong>Full Profile</strong><small>View detailed stats and history</small></span><ChevronRight size={19} /></button>
      </div>
    </>
  );
}

function ProfileDrawer({ onClose, player }: { onClose: () => void; player: PlayerView }) {
  return (
    <>
      <span aria-hidden="true" className="squad-page__sheet-handle" />
      <DrawerHeader onClose={onClose} player={player} title={player.displayName} />
      <div className="squad-page__profile-grid">
        <Metric label="Position" value={player.position} />
        <Metric label="Club" value={player.team} />
        <Metric label="Season points" value={String(player.points)} />
        <Metric label="Form" value={formatMetric(player.form)} />
        <Metric placeholder={player.xg === null} label="xG" value={formatMetric(player.xg)} />
        <Metric placeholder={player.xa === null} label="xA" value={formatMetric(player.xa)} />
      </div>
      <section className="squad-page__drawer-section"><h3>Ownership</h3><p>{player.draftTeam ? `Owned by ${player.draftTeam.name}.` : statusDescription(player)}</p></section>
      <section className="squad-page__api-placeholder"><CircleAlert size={18} /><div><strong>Full profile API incomplete</strong><span>Fixtures, availability history, xG/xA history and projections are placeholders until their contracts exist.</span></div></section>
    </>
  );
}

function CompareDrawer({
  candidates,
  onAdd,
  onClose,
  onQueryChange,
  onRemove,
  players,
  query,
}: {
  candidates: PlayerView[];
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
            <div className="squad-page__compare-metrics"><Metric label="Points" value={String(player.points)} /><Metric label="Form" value={formatMetric(player.form)} /><Metric placeholder={player.xg === null} label="xG" value={formatMetric(player.xg)} /><Metric placeholder={player.xa === null} label="xA" value={formatMetric(player.xa)} /></div>
            {index > 0 ? <button className="squad-page__text-button" onClick={() => onRemove(player.id)} type="button">Remove</button> : null}
          </article>
        ))}
      </div>
      {players.length < 3 ? (
        <section className="squad-page__search-add">
          <label><Search size={16} /><span className="sr-only">Search comparison players</span><input aria-label="Search comparison players" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search player or club" value={query} /></label>
          {query.trim() ? <div className="squad-page__search-results">{candidates.map((player) => <button key={player.id} onClick={() => onAdd(player)} type="button"><PlayerIdentity player={player} /><span>Add</span></button>)}</div> : null}
        </section>
      ) : null}
    </>
  );
}

function TradeDrawer({
  candidates,
  onClose,
  onQueryChange,
  onTargetChange,
  onTeamChange,
  query,
  source,
  target,
  teams,
  teamId,
}: {
  candidates: PlayerView[];
  onClose: () => void;
  onQueryChange: (query: string) => void;
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
      <section className="squad-page__drawer-section"><h3>You would offer</h3><PlayerIdentity large player={source} /></section>
      <label className="squad-page__field"><span>Other manager</span><select onChange={(event) => onTeamChange(event.target.value)} value={teamId}><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {teamId ? (
        <section className="squad-page__search-add">
          <label><Search size={16} /><span className="sr-only">Search trade targets</span><input aria-label="Search trade targets" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search their players" value={query} /></label>
          {query.trim() ? <div className="squad-page__search-results">{candidates.map((player) => <button key={player.id} onClick={() => onTargetChange(player)} type="button"><PlayerIdentity player={player} /><span>Select</span></button>)}</div> : null}
        </section>
      ) : null}
      {target ? <section className="squad-page__drawer-section"><h3>Target</h3><PlayerIdentity large player={target} /><div className="squad-page__trade-guidance"><div><strong>Trade-value guidance</strong><span className="squad-page__api-chip">API needed</span></div><p>{source.displayName}: {source.points} pts · {formatMetric(source.form)} form. {target.displayName}: {target.points} pts · {formatMetric(target.form)} form.</p></div></section> : null}
      <a className={`squad-page__market-link ${target ? '' : 'disabled'}`} aria-disabled={!target} href={target ? '/scouting' : undefined}>Continue in Market</a>
    </>
  );
}

function PlayerIdentity({ large = false, player, showMeta = true }: { large?: boolean; player: PlayerView; showMeta?: boolean }) {
  return (
    <span className={`squad-page__identity ${large ? 'large' : ''}`}>
      <TeamShirt large={large} team={player.team} />
      <span><strong>{player.displayName}</strong>{showMeta ? <small><span className={`squad-page__position position-${player.position.toLowerCase()}`}>{player.position}</span> · <span className={player.nextOpponent ? '' : 'is-placeholder'}>{player.nextOpponent ? `vs ${player.nextOpponent}` : 'Next —'}</span></small> : null}</span>
    </span>
  );
}

function TeamShirt({ large = false, team }: { large?: boolean; team: string }) {
  const normalized = team.trim().toLowerCase();
  const src = teamShirtCodes.has(normalized) ? `/team-shirts/${normalized}.svg` : '/team-shirts/unknown.svg';
  return <img alt="" aria-hidden="true" className={`squad-page__shirt ${large ? 'large' : ''}`} src={src} />;
}

function AvailabilityFlag({ inline = false, player }: { inline?: boolean; player: PlayerView }) {
  const label = availabilityLabel(player);
  if (!label) return null;
  const tone = player.chanceOfPlaying !== null && player.chanceOfPlaying < 75 ? 'warning' : 'fit';
  return <span aria-label={`Availability: ${label}`} className={`squad-page__availability-flag ${tone} ${inline ? 'inline' : ''}`} title={`Availability: ${label}`}>{tone === 'fit' ? <CircleCheck size={13} /> : <CircleAlert size={13} />}</span>;
}

function Metric({ dots = false, label, placeholder = false, value }: { dots?: boolean; label: string; placeholder?: boolean; value: string }) {
  return <div className={`squad-page__metric ${placeholder ? 'is-placeholder' : ''}`}><span>{label}</span><strong>{value}</strong>{dots ? <FormDots value={Number(value)} /> : null}{placeholder ? <small>API needed</small> : null}</div>;
}

function FormDots({ value }: { value: number | null }) {
  const active = value === null || Number.isNaN(value) ? 0 : Math.max(0, Math.min(5, Math.round(value / 2)));
  return <span aria-hidden="true" className="squad-page__form-dots">{Array.from({ length: 5 }, (_, index) => <i className={index < active ? 'active' : ''} key={index} />)}</span>;
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

function selectionIsValid(players: TeamSelectionPlayer[]): boolean {
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

  const countPosition = (position: string) => starters.filter((player) => normalizePosition(player.position) === position).length;
  if (countPosition('GKP') !== 1) return false;
  if (countPosition('DEF') < 3 || countPosition('DEF') > 5) return false;
  if (countPosition('MID') < 2 || countPosition('MID') > 5) return false;
  if (countPosition('FWD') < 1 || countPosition('FWD') > 3) return false;

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

function normalizeLineupPlayers(players: TeamSelectionPlayer[]): TeamSelectionPlayer[] {
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

function slotLabel(slot: TeamSelectionSlot): string {
  if (slot === 'starter') return 'starter';
  if (slot === 'bench') return 'bench';
  return 'reserves';
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TeamSelectionApiError && error.code === 'conflict') {
    const reason = typeof error.details.reason === 'string' ? error.details.reason : error.message;
    return `Lineup locked. ${reason}`;
  }
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

function firstNumber(...values: Array<number | null | undefined>): number | null {
  return values.find((value): value is number => typeof value === 'number') ?? null;
}

function formatMetric(value: number | null): string {
  return value === null || Number.isNaN(value) ? '—' : value.toFixed(1);
}

function availabilityLabel(player: PlayerView): string | null {
  if (player.chanceOfPlaying !== null) return player.chanceOfPlaying >= 100 ? 'Fit' : `${player.chanceOfPlaying}%`;
  return player.availability;
}

function statusDescription(player: PlayerView): string {
  if (player.status === 'owned') return 'In your season-long squad.';
  if (player.status === 'available') return 'Available in the player pool.';
  if (player.status === 'interested') return 'Registered as an Interest.';
  return 'Currently targeted in trade activity.';
}

function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0][0]}. ${parts.at(-1)}`;
}
