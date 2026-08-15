import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  Search,
  ShieldCheck,
  Star,
  Timer,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { SessionState } from './contracts';
import type { LeagueClient, LeagueFixture, LeagueTableRow } from './league-api';
import { HttpLeagueClient } from './league-api';
import { ManagerAccountSection } from './ManagerAccountSection';
import { defaultManagerDeskClient, type ManagerDeskClient, type ManagerDeskContext, type ManagerDeskSnapshot } from './manager-desk-api';
import { hasAvailabilityIssue } from './player-availability';
import type { SquadApiNotification, SquadApiPlayer, SquadApiSummary, SquadClient } from './squad-api';
import { HttpSquadClient } from './squad-api';
import type { TeamSelectionClient, TeamSelectionSnapshot } from './team-selection-api';
import { HttpTeamSelectionClient } from './team-selection-api';
import './manager-desk.css';

const defaultLeagueClient = new HttpLeagueClient();
const defaultSquadClient = new HttpSquadClient();
const defaultTeamSelectionClient = new HttpTeamSelectionClient();

interface ManagerDeskPageProps {
  deskClient?: ManagerDeskClient;
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  session: SessionState;
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

interface LoadState {
  data: ManagerDeskSnapshot | null;
  errors: string[];
  loading: boolean;
}

export function ManagerDeskPage({
  deskClient,
  leagueClient,
  onNavigate,
  onSignOut,
  session,
  squadClient,
  teamSelectionClient,
}: ManagerDeskPageProps) {
  const [loadState, setLoadState] = useState<LoadState>({ data: null, errors: [], loading: true });
  const [reloadRequest, setReloadRequest] = useState(0);
  const legacyClientsSupplied = Boolean(leagueClient || squadClient || teamSelectionClient);

  useEffect(() => {
    let active = true;

    async function loadDesk() {
      setLoadState((current) => ({ ...current, loading: true, errors: [] }));
      try {
        const snapshot = deskClient || !legacyClientsSupplied
          ? await (deskClient ?? defaultManagerDeskClient).getDesk()
          : await loadLegacyDesk(
            leagueClient ?? defaultLeagueClient,
            squadClient ?? defaultSquadClient,
            teamSelectionClient ?? defaultTeamSelectionClient,
          );
        if (active) setLoadState({ data: snapshot, errors: [], loading: false });
      } catch {
        if (active) setLoadState({ data: null, errors: ['manager desk'], loading: false });
      }
    }

    void loadDesk();
    return () => {
      active = false;
    };
  }, [deskClient, leagueClient, legacyClientsSupplied, reloadRequest, squadClient, teamSelectionClient]);

  const { data, errors, loading } = loadState;
  const flaggedPlayers = useMemo(
    () => getFlaggedPlayers(data?.squad.summary.players ?? []),
    [data],
  );
  const teamRow = findTeamRow(data?.leagueTable.rows, data?.selection.managerTeam.id, data?.selection.managerTeam.name);
  const isEditable = data?.context === 'pre_deadline' && !data.selection.fixtureLock.locked;
  const notifications = data?.squad.notifications.notifications ?? [];

  return (
    <main aria-labelledby="manager-desk-title" className="feature-screen manager-desk">
      <header className="manager-desk__header">
        <div>
          <h1 id="manager-desk-title">Gaffers Desk</h1>
          {data ? (
            <div className="manager-desk__season-line">
              <span>{data.gameweek.name}</span>
              <span aria-hidden="true">·</span>
              <span>{contextLabel(data.context)}</span>
            </div>
          ) : null}
        </div>
        <ManagerAccountSection onNavigate={onNavigate} onSignOut={onSignOut} session={session} />
      </header>

      {errors.length > 0 ? (
        <div className="manager-desk__data-note" role="status">
          <CircleAlert aria-hidden="true" size={17} />
          <span>Some desk data is unavailable. Actions shown below may be incomplete.</span>
          <Button onClick={() => setReloadRequest((request) => request + 1)} type="button" variant="ghost">
            Retry
          </Button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="manager-desk__primary-grid">
            <DecisionCard
              context={data.context}
              flaggedPlayers={flaggedPlayers}
              fixture={data.currentFixture}
              gameweek={data.gameweek.name}
              isEditable={isEditable}
              onNavigate={onNavigate}
              selection={data.selection}
            />
            <NextFixtureCard
              context={data.context}
              fixture={data.nextFixture ?? data.currentFixture}
              onNavigate={onNavigate}
            />
          </div>

          <section aria-label="Manager snapshot" className="manager-desk__stats">
            <SnapshotCard
              detail={`${data.selection.players.filter((player) => player.slot === 'starter').length} starters${data.selection.players.some((player) => player.captain) ? ' · Captain set' : ' · Captain needed'}`}
              icon={<ClipboardCheck aria-hidden="true" size={18} />}
              label="Team selection"
              onClick={() => onNavigate('/team-selection')}
              tone={isEditable ? 'attention' : 'default'}
              value={isEditable ? 'Review XI' : 'Locked in'}
            />
            <SnapshotCard
              detail={`${data.squad.summary.players.length} players · ${flaggedPlayers.length} flagged`}
              icon={<Users aria-hidden="true" size={18} />}
              label="Squad health"
              onClick={() => onNavigate('/squad')}
              tone={flaggedPlayers.length > 0 ? 'attention' : 'positive'}
              value={flaggedPlayers.length > 0 ? `${flaggedPlayers.length} to check` : 'All clear'}
            />
            <SnapshotCard
              detail={teamRow ? `${teamRow.leaguePoints} league points · ${teamRow.pointsFor} scored` : 'League table loading'}
              icon={<Gauge aria-hidden="true" size={18} />}
              label="League position"
              onClick={() => onNavigate('/league')}
              value={teamRow ? `#${teamRow.position}` : '—'}
            />
          </section>

          <div className="manager-desk__content-grid">
            <ActionCentre
              flaggedPlayers={flaggedPlayers}
              isEditable={isEditable}
              notifications={notifications}
              onNavigate={onNavigate}
            />
            <RecentFormCard
              fixtures={data.recentFixtures}
              managerTeam={data.selection.managerTeam}
              onNavigate={onNavigate}
            />
            {data.availablePlayers.length > 0 ? (
              <AvailablePlayersCard availablePlayers={data.availablePlayers} onNavigate={onNavigate} />
            ) : (
              <TeamStatusCard context={data.context} leagueRow={teamRow} onNavigate={onNavigate} />
            )}
            {data.context === 'live' && data.currentFixtures.length > 1 ? (
              <OtherFixturesCard
                fixtures={data.currentFixtures}
                managerFixtureId={data.currentFixture?.id ?? null}
                onNavigate={onNavigate}
              />
            ) : (
              <DeskUpdatesCard notifications={notifications} onNavigate={onNavigate} />
            )}
          </div>
        </>
      ) : loading ? (
        <Card className="manager-desk__loading" role="status">
          <Timer aria-hidden="true" size={20} />
          <span>Loading your manager desk…</span>
        </Card>
      ) : null}
    </main>
  );
}

function DecisionCard({ context, flaggedPlayers, fixture, gameweek, isEditable, onNavigate, selection }: {
  context: ManagerDeskContext;
  flaggedPlayers: SquadApiPlayer[];
  fixture: LeagueFixture | null;
  gameweek: string;
  isEditable: boolean;
  onNavigate: (href: string) => void;
  selection: TeamSelectionSnapshot;
}) {
  const ownTeam = fixture ? teamForFixture(fixture, selection.managerTeam.id, selection.managerTeam.name) : null;
  const opponent = fixture && ownTeam ? (fixture.homeTeam.id === ownTeam.id ? fixture.awayTeam : fixture.homeTeam) : null;
  const urgent = flaggedPlayers.length > 0 && isEditable;
  const locked = !isEditable;

  if (context === 'live' || context === 'finalised') {
    const ownScore = fixture && ownTeam ? scoreForTeam(fixture, ownTeam.id) : null;
    const opponentScore = fixture && opponent ? scoreForTeam(fixture, opponent.id) : null;
    return (
      <Card className={`manager-desk__decision-card manager-desk__decision-card--${context}`}>
        <div className="manager-desk__card-topline">
          <span className="manager-desk__card-kicker"><span className="manager-desk__status-dot" aria-hidden="true" />{context === 'live' ? `${gameweek} · Live now` : `${gameweek} · Finalised`}</span>
          <Trophy aria-hidden="true" size={20} />
        </div>
        <h2>{ownTeam?.name ?? 'Your fixture'} <span>vs</span> {opponent?.name ?? 'opponent'}</h2>
        <div className="manager-desk__score-line"><strong>{ownScore ?? '—'}</strong><span>–</span><strong>{opponentScore ?? '—'}</strong></div>
        <p>{context === 'live' ? 'Your head-to-head is in progress. Keep an eye on the live score.' : 'The gameweek is complete. Review the result and prepare for what comes next.'}</p>
        <Button onClick={() => onNavigate('/league')} type="button" variant="secondary">
          {context === 'live' ? 'View live fixture' : 'View final result'}
          <ArrowRight aria-hidden="true" size={17} />
        </Button>
      </Card>
    );
  }

  return (
    <Card className={`manager-desk__decision-card${urgent ? ' manager-desk__decision-card--urgent' : ''}`}>
      <div className="manager-desk__card-topline">
        <span className="manager-desk__card-kicker">{urgent ? <CircleAlert aria-hidden="true" size={20} /> : <ClipboardCheck aria-hidden="true" size={20} />}{urgent ? 'Urgent · Squad issue' : `${gameweek} · Next decision`}</span>
        <span className="manager-desk__card-state">{urgent ? 'Review now' : 'Before deadline'}</span>
      </div>
      <h2>{urgent ? 'Your starting XI needs attention.' : locked ? 'Your team is locked in.' : 'Your next decision is ready.'}</h2>
      <p>{urgent ? `${flaggedPlayers.length} player${flaggedPlayers.length === 1 ? '' : 's'} in your squad may not be available.` : locked ? 'The deadline has passed. Review your submitted lineup and gameweek context.' : 'Review your starting XI, captain and bench before the deadline.'}</p>
      {urgent ? (
        <div className="manager-desk__issue-list">
          {flaggedPlayers.slice(0, 3).map((player) => (
            <button key={player.id} onClick={() => onNavigate('/squad')} type="button">
              <span className="manager-desk__shirt-placeholder">{getInitials(player.display_name)}</span>
              <strong>{player.display_name}</strong>
              <span>{availabilityLabel(player)}</span>
              <ChevronRight aria-hidden="true" size={17} />
            </button>
          ))}
        </div>
      ) : null}
      <Button onClick={() => onNavigate(isEditable ? '/team-selection' : '/squad')} type="button">
        {urgent ? 'Review team' : locked ? 'View your team' : 'Set your team'}
        <ArrowRight aria-hidden="true" size={17} />
      </Button>
    </Card>
  );
}

function NextFixtureCard({ context, fixture, onNavigate }: { context: ManagerDeskContext; fixture: LeagueFixture | null; onNavigate: (href: string) => void }) {
  if (!fixture) {
    return (
      <Card className="manager-desk__fixture-card manager-desk__fixture-card--empty">
        <CalendarClock aria-hidden="true" size={21} />
        <div><span className="manager-desk__card-kicker">Next fixture</span><strong>Fixture details are not available yet</strong><span>Open the league view when the next schedule is published.</span></div>
        <Button onClick={() => onNavigate('/league')} type="button" variant="secondary">View fixtures <ArrowRight aria-hidden="true" size={16} /></Button>
      </Card>
    );
  }

  const isNext = context !== 'pre_deadline' || fixture.isNext;
  return (
    <Card className="manager-desk__fixture-card">
      <div className="manager-desk__card-topline"><span className="manager-desk__card-kicker"><CalendarClock aria-hidden="true" size={19} /> {isNext ? 'Next fixture' : 'Current fixture'}</span><span className="manager-desk__fixture-gameweek">{fixture.gameweek.name}</span></div>
      <div className="manager-desk__fixture-teams">
        <span className="manager-desk__fixture-team"><span className="manager-desk__fixture-badge">{getInitials(fixture.homeTeam.name)}</span><strong>{fixture.homeTeam.name}</strong></span>
        <span className="manager-desk__fixture-vs">vs</span>
        <span className="manager-desk__fixture-team manager-desk__fixture-team--right"><strong>{fixture.awayTeam.name}</strong><span className="manager-desk__fixture-badge manager-desk__fixture-badge--muted">{getInitials(fixture.awayTeam.name)}</span></span>
      </div>
      <div className="manager-desk__fixture-footer"><span><Timer aria-hidden="true" size={17} /> {context === 'pre_deadline' ? formatDeadline(fixture.gameweek.deadlineAt ?? null) : fixture.kickoffLabel}</span><Button onClick={() => onNavigate('/league')} type="button" variant="ghost">Details <ArrowRight aria-hidden="true" size={16} /></Button></div>
    </Card>
  );
}

function SnapshotCard({ detail, icon, label, onClick, tone = 'default', value }: { detail: string; icon: ReactNode; label: string; onClick: () => void; tone?: 'attention' | 'default' | 'positive'; value: string }) {
  return <button className={`manager-desk__snapshot manager-desk__snapshot--${tone}`} onClick={onClick} type="button"><span className="manager-desk__snapshot-icon">{icon}</span><span className="manager-desk__snapshot-label">{label}</span><strong>{value}</strong><span className="manager-desk__snapshot-detail">{detail}</span><ChevronRight aria-hidden="true" className="manager-desk__snapshot-arrow" size={17} /></button>;
}

function ActionCentre({ flaggedPlayers, isEditable, notifications, onNavigate }: { flaggedPlayers: SquadApiPlayer[]; isEditable: boolean; notifications: SquadApiNotification[]; onNavigate: (href: string) => void }) {
  const attentionCount = (isEditable ? 1 : 0) + flaggedPlayers.length + notifications.length;
  return (
    <section aria-labelledby="manager-desk-actions-title" className="manager-desk__panel manager-desk__panel--actions">
      <div className="manager-desk__section-heading"><div><p className="eyebrow">Action centre</p><h2 id="manager-desk-actions-title">Needs your attention</h2></div><span className="manager-desk__section-count">{attentionCount}</span></div>
      <div className="manager-desk__action-list">
        {isEditable ? <ActionCard description={flaggedPlayers.length > 0 ? 'Check the flagged players before you submit.' : 'Your XI is ready to review before the deadline.'} icon={<ClipboardCheck aria-hidden="true" size={19} />} onClick={() => onNavigate('/team-selection')} title="Review your starting XI" tone={flaggedPlayers.length > 0 ? 'attention' : 'default'} /> : null}
        {flaggedPlayers.length > 0 ? <ActionCard description={`${formatPlayerNames(flaggedPlayers)} ${flaggedPlayers.length === 1 ? 'may need' : 'may need'} a closer look.`} icon={<CircleAlert aria-hidden="true" size={19} />} onClick={() => onNavigate('/squad')} title="Check squad availability" tone="attention" /> : null}
        {notifications.slice(0, 2).map((notification) => <ActionCard description={notification.message} icon={<Zap aria-hidden="true" size={19} />} key={notification.id} onClick={() => onNavigate(notification.action_href || '/squad')} title={notification.title} tone="default" />)}
        {attentionCount === 0 ? <div className="manager-desk__all-clear"><CheckCircle2 aria-hidden="true" size={20} /><div><strong>You are all caught up</strong><span>No urgent actions for this gameweek.</span></div></div> : null}
      </div>
    </section>
  );
}

function ActionCard({ description, icon, onClick, title, tone }: { description: string; icon: ReactNode; onClick: () => void; title: string; tone: 'attention' | 'default' }) {
  return <button className={`manager-desk__action manager-desk__action--${tone}`} onClick={onClick} type="button"><span className="manager-desk__action-icon">{icon}</span><span className="manager-desk__action-copy"><strong>{title}</strong><span>{description}</span></span><ChevronRight aria-hidden="true" size={18} /></button>;
}

function RecentFormCard({ fixtures, managerTeam, onNavigate }: { fixtures: LeagueFixture[]; managerTeam: { id: string; name: string }; onNavigate: (href: string) => void }) {
  return (
    <section aria-labelledby="manager-desk-form-title" className="manager-desk__panel">
      <PanelHeading icon={<BarChart3 aria-hidden="true" size={19} />} label="Recent form" title="Last gameweeks" />
      {fixtures.length > 0 ? <div className="manager-desk__form-list">{fixtures.slice(-5).map((fixture) => { const own = teamForFixture(fixture, managerTeam.id, managerTeam.name); const opponent = own && fixture.homeTeam.id === own.id ? fixture.awayTeam : own ? fixture.homeTeam : null; const ownScore = own ? scoreForTeam(fixture, own.id) : null; const opponentScore = opponent ? scoreForTeam(fixture, opponent.id) : null; const result = resultForFixture(fixture, own?.id ?? managerTeam.id); return <button className="manager-desk__form-row" key={fixture.id} onClick={() => onNavigate('/league')} type="button"><span className={`manager-desk__result manager-desk__result--${result.toLowerCase()}`}>{result}</span><span><strong>{fixture.gameweek.name.replace('Gameweek ', 'GW')}</strong><small>{opponent?.shortName ?? opponent?.name ?? 'Fixture'}</small></span><strong className="manager-desk__form-score">{ownScore ?? '—'}–{opponentScore ?? '—'}</strong><ChevronRight aria-hidden="true" size={16} /></button>; })}</div> : <EmptyPanelMessage message="No completed gameweeks to compare yet." />}
    </section>
  );
}

function AvailablePlayersCard({ availablePlayers, onNavigate }: { availablePlayers: SquadApiPlayer[]; onNavigate: (href: string) => void }) {
  return <section aria-labelledby="manager-desk-available-title" className="manager-desk__panel"><PanelHeading icon={<Search aria-hidden="true" size={19} />} label="Available players" title="Market watch" action="View market" onAction={() => onNavigate('/scouting')} /><div className="manager-desk__available-list">{availablePlayers.map((player) => <button className="manager-desk__available-row" key={player.id} onClick={() => onNavigate('/scouting')} type="button"><span className="manager-desk__player-icon"><Star aria-hidden="true" size={18} /></span><span><strong>{player.display_name}</strong><small>{player.position} · {player.epl_team.short_name ?? player.epl_team.name}</small></span><span className="manager-desk__add-icon">+</span></button>)}</div></section>;
}

function TeamStatusCard({ context, leagueRow, onNavigate }: { context: ManagerDeskContext; leagueRow: LeagueTableRow | null; onNavigate: (href: string) => void }) {
  return <section aria-labelledby="manager-desk-status-title" className="manager-desk__panel manager-desk__panel--status"><PanelHeading icon={<ShieldCheck aria-hidden="true" size={19} />} label="Team status" title="Your season" /><strong className="manager-desk__status-value">{context === 'live' ? 'Live matchday' : leagueRow ? `Position #${leagueRow.position}` : 'Ready for the next move'}</strong><p>{leagueRow ? `${leagueRow.leaguePoints} league points · ${leagueRow.pointsFor} points scored` : 'Your latest league context will appear here.'}</p><Button onClick={() => onNavigate('/league')} type="button" variant="ghost">Open league <ArrowRight aria-hidden="true" size={16} /></Button></section>;
}

function DeskUpdatesCard({ notifications, onNavigate }: { notifications: SquadApiNotification[]; onNavigate: (href: string) => void }) {
  const notification = notifications[0];
  return <section aria-labelledby="manager-desk-updates-title" className="manager-desk__panel manager-desk__panel--updates"><PanelHeading icon={<Zap aria-hidden="true" size={19} />} label="Desk updates" title={notification ? notification.title : 'All clear'} /><p>{notification?.message ?? 'No new messages or trade proposals need your attention.'}</p>{notification ? <Button onClick={() => onNavigate(notification.action_href || '/squad')} type="button" variant="ghost">Review <ArrowRight aria-hidden="true" size={16} /></Button> : null}</section>;
}

function OtherFixturesCard({ fixtures, managerFixtureId, onNavigate }: { fixtures: LeagueFixture[]; managerFixtureId: string | null; onNavigate: (href: string) => void }) {
  const others = fixtures.filter((fixture) => fixture.id !== managerFixtureId);
  return <section aria-labelledby="manager-desk-other-fixtures-title" className="manager-desk__panel manager-desk__panel--other-fixtures"><PanelHeading icon={<Users aria-hidden="true" size={19} />} label="Other fixtures" title="Live league scores" action="View all" onAction={() => onNavigate('/league')} /><div className="manager-desk__other-fixture-list">{others.map((fixture) => <button className="manager-desk__other-fixture-row" key={fixture.id} onClick={() => onNavigate('/league')} type="button"><span>{fixture.homeTeam.shortName ?? getInitials(fixture.homeTeam.name)}</span><strong>{fixture.score.homeScore ?? '—'} – {fixture.score.awayScore ?? '—'}</strong><span>{fixture.awayTeam.shortName ?? getInitials(fixture.awayTeam.name)}</span><ChevronRight aria-hidden="true" size={16} /></button>)}</div></section>;
}

function PanelHeading({ icon, label, title, action, onAction }: { icon: ReactNode; label: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="manager-desk__panel-heading"><div><span className="manager-desk__card-kicker">{icon} {label}</span><h2>{title}</h2></div>{action && onAction ? <Button onClick={onAction} type="button" variant="ghost">{action} <ArrowRight aria-hidden="true" size={15} /></Button> : null}</div>;
}

function EmptyPanelMessage({ message }: { message: string }) {
  return <p className="manager-desk__empty-message">{message}</p>;
}

async function loadLegacyDesk(leagueClient: LeagueClient, squadClient: SquadClient, teamSelectionClient: TeamSelectionClient): Promise<ManagerDeskSnapshot> {
  const [selectionResult, leagueResult, squadResult, notificationResult, changesResult] = await Promise.allSettled([teamSelectionClient.getTeamSelection(), leagueClient.getLeagueSnapshot(), squadClient.getSummary(), squadClient.getNotifications(), squadClient.getChanges()]);
  if (selectionResult.status !== 'fulfilled' || leagueResult.status !== 'fulfilled' || squadResult.status !== 'fulfilled') throw new Error('Legacy desk data is incomplete.');
  const selection = selectionResult.value;
  const league = leagueResult.value;
  const squad = squadResult.value;
  const notifications = notificationResult.status === 'fulfilled' ? notificationResult.value : { notifications: [], proposed_trade_count: 0 };
  const changes = changesResult.status === 'fulfilled' ? changesResult.value.available_to_add : [];
  const currentFixture = findManagerFixture(league.currentFixtures.fixtures, selection.managerTeam.id, selection.managerTeam.name);
  const nextFixture = findManagerFixture(league.nextFixtures.fixtures, selection.managerTeam.id, selection.managerTeam.name);
  const current = currentFixture ? league.currentFixtures.fixtures : league.currentFixtures.fixtures;
  const next = nextFixture ? league.nextFixtures.fixtures : league.nextFixtures.fixtures;
  const recent = league.allFixtures.fixtures.filter((fixture) => fixture.status !== 'pending');
  return { context: currentFixture?.status === 'started' ? 'live' : currentFixture?.status === 'complete' ? 'finalised' : 'pre_deadline', gameweek: selection.gameweek ?? mapSquadGameweek(squad), selection, squad: { summary: squad, notifications }, currentFixture, nextFixture, currentFixtures: current, nextFixtures: next, recentFixtures: recent.length > 0 ? recent.slice(-5) : currentFixture ? [currentFixture] : [], leagueTable: league.table, availablePlayers: changes };
}

function mapSquadGameweek(squad: SquadApiSummary): TeamSelectionSnapshot['gameweek'] {
  return { id: squad.gameweek.id, name: squad.gameweek.name, number: squad.gameweek.number, deadlineAt: squad.gameweek.deadline_at ?? null };
}

function getFlaggedPlayers(players: SquadApiPlayer[]): SquadApiPlayer[] { return players.filter(hasAvailabilityIssue); }

function findTeamRow(rows: LeagueTableRow[] | undefined, teamId: string | undefined, teamName: string | undefined): LeagueTableRow | null { return rows?.find((row) => row.team.id === teamId || row.team.name === teamName) ?? null; }

function findManagerFixture(fixtures: LeagueFixture[], teamId: string, teamName: string): LeagueFixture | null { return fixtures.find((fixture) => Boolean(teamForFixture(fixture, teamId, teamName))) ?? fixtures[0] ?? null; }

function teamForFixture(fixture: LeagueFixture, teamId: string, teamName: string) { return [fixture.homeTeam, fixture.awayTeam].find((team) => team.id === teamId || team.name === teamName) ?? null; }

function scoreForTeam(fixture: LeagueFixture, teamId: string): number | null { return fixture.homeTeam.id === teamId ? fixture.score.homeScore : fixture.awayTeam.id === teamId ? fixture.score.awayScore : null; }

function resultForFixture(fixture: LeagueFixture, teamId: string): 'W' | 'D' | 'L' { if (fixture.score.outcome === 'draw') return 'D'; const home = fixture.homeTeam.id === teamId; return fixture.score.outcome === (home ? 'home_win' : 'away_win') ? 'W' : 'L'; }

function availabilityLabel(player: SquadApiPlayer): string { if (player.availability_status === 'suspended') return 'Suspended'; if (player.availability_status === 'injured') return 'Injured'; if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) return `${player.chance_of_playing_next_round}% chance`; return player.availability_news || 'Check status'; }

function formatPlayerNames(players: SquadApiPlayer[]): string { const names = players.slice(0, 2).map((player) => player.display_name); if (players.length > 2) return `${names.join(', ')} and ${players.length - 2} more`; return names.join(' and '); }

function formatDeadline(deadlineAt: string | null): string { if (!deadlineAt) return 'Deadline to be confirmed'; const deadline = new Date(deadlineAt); if (Number.isNaN(deadline.getTime())) return 'Deadline to be confirmed'; return `Deadline ${new Intl.DateTimeFormat(undefined, { day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'short', weekday: 'short' }).format(deadline)}`; }

function contextLabel(context: ManagerDeskContext): string { if (context === 'live') return 'Live now'; if (context === 'finalised') return 'Finalised'; return 'Before deadline'; }

function getInitials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CD'; }
