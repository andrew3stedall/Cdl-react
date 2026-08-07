import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronRight,
  CirclePoundSterling,
  LayoutGrid,
  List,
  Search,
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
import './squad-page.css';

interface SquadPageProps {
  preset: ThemePreset;
}

type SquadView = 'pitch' | 'list';
type PositionFilter = 'all' | 'GKP' | 'DEF' | 'MID' | 'FWD';
type DrawerMode = 'player' | 'compare' | 'trade' | 'profile' | null;
type PlayerStatus = 'owned' | 'available' | 'interested' | 'trade_target';

type ColumnKey = 'points' | 'form' | 'value' | 'status';

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
const positionOptions: Array<{ label: string; value: PositionFilter }> = [
  { label: 'All players', value: 'all' },
  { label: 'Goalkeepers', value: 'GKP' },
  { label: 'Defenders', value: 'DEF' },
  { label: 'Midfielders', value: 'MID' },
  { label: 'Forwards', value: 'FWD' },
];

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
      points: existing?.points ?? 0,
      form: existing?.form ?? null,
      value: existing?.value ?? 0,
      selectedByPercent: existing?.selectedByPercent ?? null,
      draftTeam: existing?.draftTeam ?? null,
      slot: player.slot,
      slotOrder: player.slotOrder,
      captain: player.captain,
      viceCaptain: player.viceCaptain,
    } satisfies PlayerView;
  });

  return [...positioned, ...roster.filter((player) => !lineupIds.has(player.id))];
}

export function SquadPage({ preset }: SquadPageProps) {
  const [squadView, setSquadView] = useState<SquadView>(getStoredView);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [squadPlayers, setSquadPlayers] = useState<PlayerView[]>([]);
  const [scoutingPool, setScoutingPool] = useState<PlayerView[]>([]);
  const [trades, setTrades] = useState<TradeApiResponse[]>([]);
  const [managerTeam, setManagerTeam] = useState<TeamRef>({ id: '', name: 'Current team', shortName: '' });
  const [gameweek, setGameweek] = useState('Gameweek');
  const [lineupAvailable, setLineupAvailable] = useState(false);
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
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>({
    points: true,
    form: true,
    value: true,
    status: true,
  });
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const teamSelectionClient = new HttpTeamSelectionClient();
    void Promise.all([
      fetch('/api/squad/summary', { credentials: 'include' }),
      fetch('/api/scouting/players', { credentials: 'include' }),
      fetch('/api/trades', { credentials: 'include' }),
      teamSelectionClient.getTeamSelection().catch(() => null),
    ])
      .then(async ([summaryResponse, scoutingResponse, tradeResponse, lineup]) => {
        if (!summaryResponse.ok || !scoutingResponse.ok || !tradeResponse.ok) {
          const unauthorized = [summaryResponse, scoutingResponse, tradeResponse]
            .some((response) => response.status === 401);
          throw new Error(unauthorized ? 'Sign in to manage your squad.' : 'Unable to load your squad.');
        }
        const [summary, scouting, persistedTrades] = await Promise.all([
          summaryResponse.json() as Promise<SquadSummaryApiResponse>,
          scoutingResponse.json() as Promise<ScoutingApiResponse>,
          tradeResponse.json() as Promise<{ trades?: TradeApiResponse[] }>,
        ]);
        return { summary, scouting, persistedTrades, lineup };
      })
      .then(({ summary, scouting, persistedTrades, lineup }) => {
        const roster = summary.players.map(mapPlayer);
        const hasLineup = Boolean(lineup?.players.length);
        setSquadPlayers(mergeLineupPlayers(roster, lineup?.players ?? null));
        setScoutingPool(scouting.players.map(mapPlayer));
        setManagerTeam({
          id: summary.manager_team.id,
          name: summary.manager_team.name,
          shortName: summary.manager_team.short_name ?? summary.manager_team.name,
        });
        setGameweek(summary.gameweek.name);
        setTrades(persistedTrades.trades ?? []);
        setLineupAvailable(hasLineup);
        if (!hasLineup) setSquadView('list');
        setStatus(
          hasLineup
            ? `${summary.manager_team.name} squad ready for review.`
            : `${summary.manager_team.name} squad loaded. Open Matchweek to set a lineup.`,
        );
      })
      .catch((error: Error) => setStatus(error.message));
  }, []);

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
  const listPlayers = positionFilter === 'all'
    ? visibleSquadPlayers
    : visibleSquadPlayers.filter((player) => player.position === positionFilter);
  const squadValue = visibleSquadPlayers.reduce((total, player) => total + player.value, 0);
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

  return (
    <main aria-labelledby="squad-title" className="squad-page" data-density={preset.tokens.density}>
      <header className="squad-page__header">
        <div className="squad-page__title-lockup">
          <span aria-hidden="true" className="squad-page__mark"><Users size={23} /></span>
          <div>
            <p className="eyebrow">Season squad</p>
            <h1 id="squad-title">Squad</h1>
            <p>{managerTeam.name} · {gameweek}</p>
          </div>
        </div>
        <div className="squad-page__header-actions">
          <a className="squad-page__link-button" href="/team-selection">Open Matchweek</a>
          <Button onClick={() => setChangesPanelOpen((open) => !open)} type="button" variant="secondary">
            Squad changes
            {stagedChangeCount > 0 ? <span className="squad-page__count">{stagedChangeCount}</span> : null}
          </Button>
        </div>
      </header>

      <p className="squad-page__status" role="status">{status}</p>

      {proposedTradeCount > 0 ? (
        <section aria-label="Squad attention" className="squad-page__attention">
          <div>
            <p className="eyebrow">Needs attention</p>
            <h2>{proposedTradeCount} proposed {proposedTradeCount === 1 ? 'trade' : 'trades'} to review</h2>
            <p>Trade activity belongs in Market; Squad only surfaces it when it may affect your roster.</p>
          </div>
          <a className="squad-page__link-button" href="/scouting">Review in Market</a>
        </section>
      ) : null}

      <section aria-label="Squad summary" className="squad-page__summary">
        <SummaryMetric icon={<Users aria-hidden="true" size={17} />} label="In squad" value={String(visibleSquadPlayers.length)} />
        <SummaryMetric icon={<CirclePoundSterling aria-hidden="true" size={17} />} label="Squad value" value={`£${squadValue.toFixed(1)}m`} />
        <SummaryMetric icon={<ArrowRightLeft aria-hidden="true" size={17} />} label="Staged changes" value={String(stagedChangeCount)} />
      </section>

      <div className={`squad-page__workspace ${changesPanelOpen ? 'has-changes-panel' : ''}`}>
        <section className="squad-page__roster-card">
          <div className="squad-page__roster-header">
            <div>
              <p className="eyebrow">Current squad</p>
              <h2>Season-long roster</h2>
              <p>Review squad health here. Make weekly lineup changes in Matchweek.</p>
            </div>
            <div aria-label="Squad view" className="squad-page__view-toggle" role="group">
              <button
                aria-pressed={squadView === 'pitch'}
                disabled={!lineupAvailable}
                onClick={() => setSquadView('pitch')}
                type="button"
              >
                <LayoutGrid aria-hidden="true" size={16} />
                Pitch
              </button>
              <button aria-pressed={squadView === 'list'} onClick={() => setSquadView('list')} type="button">
                <List aria-hidden="true" size={16} />
                List
              </button>
            </div>
          </div>

          {squadView === 'pitch' && lineupAvailable ? (
            <SquadPitch onSelect={openPlayer} players={visibleSquadPlayers} />
          ) : (
            <SquadList
              columns={columns}
              columnsOpen={columnsOpen}
              onColumnsOpenChange={setColumnsOpen}
              onColumnToggle={(column) => setColumns((current) => ({ ...current, [column]: !current[column] }))}
              onPositionChange={setPositionFilter}
              onSelect={openPlayer}
              players={listPlayers}
              positionFilter={positionFilter}
            />
          )}
        </section>

        <aside aria-label="Squad changes" className="squad-page__changes-panel">
          <header>
            <div>
              <p className="eyebrow">Draw changes</p>
              <h2>Squad changes</h2>
            </div>
            <button aria-label="Collapse squad changes" className="squad-page__icon-button" onClick={() => setChangesPanelOpen(false)} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </header>

          <section className="squad-page__change-section">
            <div className="squad-page__change-heading"><h3>Available to Add</h3><span>{drawWins.length}</span></div>
            {drawWins.length === 0 ? (
              <div className="squad-page__empty-change">
                <p>No draw wins are waiting to be added.</p>
                <a href="/scouting">Open Market</a>
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
        </aside>
      </div>

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
            <header>
              <div><p className="eyebrow">Review changes</p><h2 id="squad-change-review-title">Submit squad changes</h2></div>
              <button aria-label="Close squad change review" className="squad-page__icon-button" onClick={() => setConfirmationOpen(false)} type="button"><X size={18} /></button>
            </header>
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
    </main>
  );
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <Card className="squad-page__summary-card"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></Card>;
}

function SquadPitch({ players, onSelect }: { players: PlayerView[]; onSelect: (player: PlayerView) => void }) {
  const starters = players.filter((player) => player.slot === 'starter').sort(sortBySlot);
  const bench = players.filter((player) => player.slot === 'bench' || player.slot === 'reserve').sort(sortBySlot);
  const rows = pitchPositionOrder
    .map((position) => ({ position, players: starters.filter((player) => player.position === position) }))
    .filter((row) => row.players.length > 0);

  return (
    <section aria-label="Squad pitch" className="squad-page__pitch-shell">
      <div className="squad-page__pitch">
        <div aria-hidden="true" className="squad-page__pitch-markings"><span /><span /><span /><span /></div>
        <div className="squad-page__pitch-lineup">
          {rows.map((row) => (
            <div className="squad-page__pitch-row" key={row.position}>
              {row.players.map((player) => <PitchCard key={player.id} onSelect={onSelect} player={player} />)}
            </div>
          ))}
        </div>
      </div>
      <section aria-label="Bench" className="squad-page__bench">
        <header><h3>Bench</h3><span>{bench.length} players</span></header>
        <div>{bench.map((player) => <PitchCard compact key={player.id} onSelect={onSelect} player={player} />)}</div>
      </section>
    </section>
  );
}

function PitchCard({ compact = false, onSelect, player }: { compact?: boolean; onSelect: (player: PlayerView) => void; player: PlayerView }) {
  return (
    <button aria-label={`View ${player.displayName} details`} className={`squad-page__pitch-player ${compact ? 'compact' : ''}`} onClick={() => onSelect(player)} type="button">
      <span className="squad-page__position">{player.position}</span>
      <span className="squad-page__club">{player.team}</span>
      <strong>{player.displayName}</strong>
      <small>{formatMetric(player.form)} form</small>
      {player.captain ? <span className="squad-page__captain">C</span> : null}
      {player.viceCaptain ? <span className="squad-page__captain">VC</span> : null}
    </button>
  );
}

function SquadList({
  columns,
  columnsOpen,
  onColumnsOpenChange,
  onColumnToggle,
  onPositionChange,
  onSelect,
  players,
  positionFilter,
}: {
  columns: Record<ColumnKey, boolean>;
  columnsOpen: boolean;
  onColumnsOpenChange: (open: boolean) => void;
  onColumnToggle: (column: ColumnKey) => void;
  onPositionChange: (position: PositionFilter) => void;
  onSelect: (player: PlayerView) => void;
  players: PlayerView[];
  positionFilter: PositionFilter;
}) {
  return (
    <div className="squad-page__list">
      <div className="squad-page__list-toolbar">
        <div aria-label="Squad positions" className="squad-page__position-tabs" role="tablist">
          {positionOptions.map((option) => (
            <button aria-selected={positionFilter === option.value} key={option.value} onClick={() => onPositionChange(option.value)} role="tab" type="button">{option.label}</button>
          ))}
        </div>
        <div className="squad-page__columns">
          <Button onClick={() => onColumnsOpenChange(!columnsOpen)} type="button" variant="secondary">Columns</Button>
          {columnsOpen ? (
            <div className="squad-page__columns-menu">
              {(Object.keys(columns) as ColumnKey[]).map((column) => (
                <label key={column}><input checked={columns[column]} onChange={() => onColumnToggle(column)} type="checkbox" /> {columnLabel(column)}</label>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div aria-label="Squad players table" className="squad-page__table-scroll" role="region" tabIndex={0}>
        <table>
          <thead><tr><th>Player</th><th>Position</th><th>Club</th>{columns.form ? <th>Form</th> : null}{columns.points ? <th>Points</th> : null}{columns.value ? <th>Value</th> : null}{columns.status ? <th>Status</th> : null}<th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td><button className="squad-page__player-link" onClick={() => onSelect(player)} type="button"><PlayerIdentity player={player} /></button></td>
                <td><span className="squad-page__position">{player.position}</span></td>
                <td>{player.team}</td>
                {columns.form ? <td>{formatMetric(player.form)}</td> : null}
                {columns.points ? <td><strong>{player.points}</strong></td> : null}
                {columns.value ? <td>£{player.value.toFixed(1)}m</td> : null}
                {columns.status ? <td><StatusBadge status={player.status} /></td> : null}
                <td><button aria-label={`View ${player.displayName} details`} className="squad-page__icon-button" onClick={() => onSelect(player)} type="button"><ChevronRight size={18} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DrawerLayer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="squad-page__drawer-layer"><button aria-label="Close drawer" className="squad-page__backdrop" onClick={onClose} type="button" />{children}</div>;
}

function DrawerHeader({ eyebrow, onClose, title }: { eyebrow: string; onClose: () => void; title: string }) {
  return <header className="squad-page__drawer-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button aria-label="Close drawer" className="squad-page__icon-button" onClick={onClose} type="button"><X size={18} /></button></header>;
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
      <DrawerHeader eyebrow="Squad player" onClose={onClose} title={player.displayName} />
      <PlayerIdentity player={player} large />
      <div className="squad-page__drawer-metrics"><Metric label="Form" value={formatMetric(player.form)} /><Metric label="Season points" value={String(player.points)} /><Metric label="Value" value={`£${player.value.toFixed(1)}m`} /></div>
      <section className="squad-page__drawer-section"><h3>Current status</h3><StatusBadge status={player.status} /><p>{statusDescription(player)}</p></section>
      <div className="squad-page__drawer-actions">
        <Button onClick={onCompare} type="button"><Search size={15} />Compare</Button>
        <Button onClick={onRelease} type="button" variant="secondary">Release to free agency</Button>
        <Button onClick={onTrade} type="button" variant="secondary"><ArrowRightLeft size={15} />Draft trade</Button>
        <Button onClick={onProfile} type="button" variant="secondary">Full profile</Button>
      </div>
    </>
  );
}

function ProfileDrawer({ onClose, player }: { onClose: () => void; player: PlayerView }) {
  return (
    <>
      <DrawerHeader eyebrow="Player profile" onClose={onClose} title={player.displayName} />
      <PlayerIdentity player={player} large />
      <div className="squad-page__profile-grid">
        <Metric label="Position" value={player.position} />
        <Metric label="Club" value={player.team} />
        <Metric label="Season points" value={String(player.points)} />
        <Metric label="Form" value={formatMetric(player.form)} />
        <Metric label="Value" value={`£${player.value.toFixed(1)}m`} />
        <Metric label="FPL selected" value={player.selectedByPercent === null ? '—' : `${player.selectedByPercent.toFixed(1)}%`} />
      </div>
      <section className="squad-page__drawer-section"><h3>Ownership</h3><p>{player.draftTeam ? `Owned by ${player.draftTeam.name}.` : statusDescription(player)}</p></section>
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
      <DrawerHeader eyebrow="Compare" onClose={onClose} title="Player comparison" />
      <p className="squad-page__drawer-copy">Compare up to three players. Players stay in the order you select them.</p>
      <div className="squad-page__compare-grid">
        {players.map((player, index) => (
          <article className="squad-page__compare-card" key={player.id}>
            <div className="squad-page__compare-order">{index + 1}</div>
            <PlayerIdentity player={player} />
            <div className="squad-page__compare-metrics"><Metric label="Points" value={String(player.points)} /><Metric label="Form" value={formatMetric(player.form)} /><Metric label="Value" value={`£${player.value.toFixed(1)}m`} /></div>
            <details><summary>Advanced metrics</summary><p>Ownership: {player.selectedByPercent === null ? '—' : `${player.selectedByPercent.toFixed(1)}%`}</p><p>Squad status: {formatStatus(player.status)}</p></details>
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
      <DrawerHeader eyebrow="Draft trade" onClose={onClose} title="Start a trade" />
      <section className="squad-page__drawer-section"><h3>You would offer</h3><PlayerIdentity player={source} large /></section>
      <label className="squad-page__field"><span>Other manager</span><select onChange={(event) => onTeamChange(event.target.value)} value={teamId}><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {teamId ? (
        <section className="squad-page__search-add">
          <label><Search size={16} /><span className="sr-only">Search trade targets</span><input aria-label="Search trade targets" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search their players" value={query} /></label>
          {query.trim() ? <div className="squad-page__search-results">{candidates.map((player) => <button key={player.id} onClick={() => onTargetChange(player)} type="button"><PlayerIdentity player={player} /><span>Select</span></button>)}</div> : null}
        </section>
      ) : null}
      {target ? <section className="squad-page__drawer-section"><h3>Target</h3><PlayerIdentity player={target} large /><div className="squad-page__trade-guidance"><span>Trade-value guidance</span><strong>Not enough data</strong><details><summary>Evidence available</summary><p>{source.displayName}: {source.points} points, {formatMetric(source.form)} form.</p><p>{target.displayName}: {target.points} points, {formatMetric(target.form)} form.</p><p>Projection, positional scarcity and league-demand signals are required before rating the trade.</p></details></div></section> : null}
      <a className={`squad-page__link-button ${target ? '' : 'disabled'}`} aria-disabled={!target} href={target ? '/scouting' : undefined}>Continue in Market</a>
    </>
  );
}

function PlayerIdentity({ large = false, player }: { large?: boolean; player: PlayerView }) {
  return <span className={`squad-page__identity ${large ? 'large' : ''}`}><span className="squad-page__avatar">{initials(player.displayName)}</span><span><strong>{player.displayName}</strong><small>{player.position} · {player.team}</small></span></span>;
}

function StatusBadge({ status }: { status: PlayerStatus }) {
  return <span className={`squad-page__status-badge status-${status}`}>{formatStatus(status)}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="squad-page__metric"><span>{label}</span><strong>{value}</strong></div>;
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
  return player.displayName.toLowerCase().includes(normalized) || player.team.toLowerCase().includes(normalized);
}

function sortBySlot(left: PlayerView, right: PlayerView): number {
  return (left.slotOrder ?? 0) - (right.slotOrder ?? 0);
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  return normalized === 'GK' ? 'GKP' : normalized;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function formatMetric(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

function formatStatus(status: PlayerStatus): string {
  if (status === 'owned') return 'In squad';
  if (status === 'trade_target') return 'Trade target';
  if (status === 'interested') return 'Interest';
  return 'Available';
}

function statusDescription(player: PlayerView): string {
  if (player.draftTeam) return `Currently owned by ${player.draftTeam.name}.`;
  if (player.status === 'owned') return 'This player is in your current season squad.';
  if (player.status === 'trade_target') return 'This player is associated with a trade target.';
  if (player.status === 'interested') return 'This player is registered as an Interest.';
  return 'This player is not currently assigned to a draft squad.';
}

function columnLabel(column: ColumnKey): string {
  if (column === 'points') return 'Season points';
  if (column === 'form') return 'Form';
  if (column === 'value') return 'Value';
  return 'Status';
}
