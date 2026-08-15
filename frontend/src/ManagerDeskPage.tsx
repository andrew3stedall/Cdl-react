import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Timer,
  Users,
  Zap,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { SessionState } from './contracts';
import type { LeagueClient, LeagueFixture, LeagueTableRow } from './league-api';
import { HttpLeagueClient } from './league-api';
import { ManagerAccountSection } from './ManagerAccountSection';
import {
  defaultManagerDeskClient,
  type ManagerDeskClient,
  type ManagerDeskContext,
  type ManagerDeskSnapshot,
} from './manager-desk-api';
import { availabilityIssueLabel, hasAvailabilityIssue } from './player-availability';
import type { SquadApiNotification, SquadApiPlayer, SquadApiSummary, SquadClient } from './squad-api';
import { HttpSquadClient } from './squad-api';
import type { TeamSelectionClient, TeamSelectionPlayer, TeamSelectionSnapshot } from './team-selection-api';
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

type Priority = 'critical' | 'high' | 'normal' | 'low';

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
  const [now, setNow] = useState(() => Date.now());
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { data, errors, loading } = loadState;
  const flaggedPlayers = useMemo(
    () => getStartingRisks(data?.squad.summary.players ?? [], data?.selection ?? null),
    [data],
  );
  const teamRow = findTeamRow(data?.leagueTable.rows, data?.selection.managerTeam.id, data?.selection.managerTeam.name);
  const isEditable = data?.context === 'pre_deadline' && !data.selection.fixtureLock.locked;
  const notifications = (data?.squad.notifications.notifications ?? []).filter(
    (notification) => notification.kind !== 'availability',
  );

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
          <FixtureFocus data={data} managerTeam={data.selection.managerTeam} now={now} onNavigate={onNavigate} />

          <PriorityStack
            data={data}
            flaggedPlayers={flaggedPlayers}
            isEditable={isEditable}
            notifications={notifications}
            now={now}
            onNavigate={onNavigate}
          />

          <div className="manager-desk__support-grid">
            <TeamStatusCard
              context={data.context}
              leagueRow={teamRow}
              playerCount={data.squad.summary.players.length}
              flaggedCount={flaggedPlayers.length}
              onNavigate={onNavigate}
            />
            {notifications.length > 0 ? (
              <DeskUpdatesCard notifications={notifications} onNavigate={onNavigate} />
            ) : (
              <RecentFormCard
                fixtures={data.recentFixtures}
                managerTeam={data.selection.managerTeam}
                onNavigate={onNavigate}
              />
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

function FixtureFocus({ data, managerTeam, now, onNavigate }: {
  data: ManagerDeskSnapshot;
  managerTeam: { id: string; name: string };
  now: number;
  onNavigate: (href: string) => void;
}) {
  const fixture = data.context === 'pre_deadline' ? data.nextFixture : data.currentFixture;
  const fixtures = data.context === 'pre_deadline' ? data.nextFixtures : data.currentFixtures;
  const otherFixtures = fixtures.filter((candidate) => candidate.id !== fixture?.id);

  return (
    <section aria-labelledby="manager-desk-fixture-focus-title" className={`manager-desk__fixture-focus manager-desk__fixture-focus--${data.context}`}>
      <FixtureSpotlight
        context={data.context}
        fixture={fixture}
        formFixtures={data.formFixtures}
        gameweek={fixture?.gameweek.name ?? data.gameweek.name}
        managerTeam={managerTeam}
        now={now}
        selection={data.selection}
        onNavigate={onNavigate}
      />
      <section aria-labelledby="manager-desk-other-fixtures-title" className="manager-desk__fixture-others">
        <div className="manager-desk__fixture-others-heading">
          <div>
            <p className="eyebrow">League context</p>
            <h2 id="manager-desk-other-fixtures-title">Other fixtures</h2>
          </div>
          <Button onClick={() => onNavigate('/league')} type="button" variant="ghost">
            View all <ArrowRight aria-hidden="true" size={15} />
          </Button>
        </div>
        {otherFixtures.length > 0 ? (
          <div className="manager-desk__fixture-row-list">
            {otherFixtures.map((otherFixture) => (
              <OtherFixtureRow
                context={data.context}
                fixture={otherFixture}
                formFixtures={data.formFixtures}
                key={otherFixture.id}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <p className="manager-desk__empty-message">No other fixtures are available for this gameweek.</p>
        )}
      </section>
    </section>
  );
}

function FixtureSpotlight({ context, fixture, formFixtures, gameweek, managerTeam, now, selection, onNavigate }: {
  context: ManagerDeskContext;
  fixture: LeagueFixture | null;
  formFixtures: LeagueFixture[];
  gameweek: string;
  managerTeam: { id: string; name: string };
  now: number;
  selection: TeamSelectionSnapshot;
  onNavigate: (href: string) => void;
}) {
  if (!fixture) {
    return (
      <Card className="manager-desk__fixture-spotlight manager-desk__fixture-spotlight--empty">
        <CalendarClock aria-hidden="true" size={24} />
        <div>
          <span className="manager-desk__fixture-kicker">Next fixture</span>
          <h2 id="manager-desk-fixture-focus-title">Fixture details are not available yet</h2>
          <p>Open the league view when the next schedule is published.</p>
        </div>
        <Button onClick={() => onNavigate('/league')} type="button" variant="secondary">
          View fixtures <ArrowRight aria-hidden="true" size={16} />
        </Button>
      </Card>
    );
  }

  const ownTeam = teamForFixture(fixture, managerTeam.id, managerTeam.name);
  const opponent = ownTeam ? (fixture.homeTeam.id === ownTeam.id ? fixture.awayTeam : fixture.homeTeam) : null;
  const ownScore = ownTeam ? scoreForTeam(fixture, ownTeam.id) : null;
  const opponentScore = opponent ? scoreForTeam(fixture, opponent.id) : null;
  const captain = selection.players.find((player) => player.captain);
  const starters = selection.players.filter((player) => player.slot === 'starter');
  const ownForm = ownTeam ? formForTeam(ownTeam.id, formFixtures) : [];
  const urgency = context === 'pre_deadline' ? urgencyForDeadline(fixture.gameweek.deadlineAt ?? null, now) : 'normal';

  return (
    <Card className={`manager-desk__fixture-spotlight manager-desk__fixture-spotlight--${context}`}>
      <div className="manager-desk__fixture-spotlight-topline">
        <span className="manager-desk__fixture-kicker">
          <span className={`manager-desk__status-dot manager-desk__status-dot--${context}`} aria-hidden="true" />
          {context === 'live' ? 'Live now' : context === 'finalised' ? 'Finalised' : 'Next fixture'}
        </span>
        <span className="manager-desk__fixture-gameweek">{gameweek}</span>
      </div>
      <div className="manager-desk__fixture-spotlight-teams">
        <div className="manager-desk__fixture-spotlight-team manager-desk__fixture-spotlight-team--own">
          <span className="manager-desk__fixture-badge">{getInitials(ownTeam?.name ?? managerTeam.name)}</span>
          <strong>{ownTeam?.name ?? 'Your team'}</strong>
          <small>You</small>
        </div>
        <div className="manager-desk__fixture-centre">
          {context === 'pre_deadline' ? (
            <span className="manager-desk__fixture-vs">vs</span>
          ) : (
            <div className="manager-desk__fixture-score">
              <strong>{ownScore ?? '—'}</strong>
              <span>–</span>
              <strong>{opponentScore ?? '—'}</strong>
            </div>
          )}
        </div>
        <div className="manager-desk__fixture-spotlight-team manager-desk__fixture-spotlight-team--opponent">
          <span className="manager-desk__fixture-badge manager-desk__fixture-badge--muted">{getInitials(opponent?.name ?? 'Opponent')}</span>
          <strong>{opponent?.name ?? 'Opponent'}</strong>
          <small>Opponent</small>
        </div>
      </div>

      {context === 'live' ? (
        <div className="manager-desk__fixture-insights" aria-label="Live fixture information">
          <FixtureInsight label="Live now" value={fixture.kickoffLabel || 'In progress'} />
          <FixtureInsight label="Yet to play" value={`${starters.length} XI players`} />
          <FixtureInsight label="Captain" value={captain?.name ?? 'Not set'} />
        </div>
      ) : null}

      {context === 'pre_deadline' ? (
        <div className="manager-desk__fixture-planning">
          <div>
            <span className="manager-desk__fixture-planning-label"><Clock3 aria-hidden="true" size={16} /> Deadline</span>
            <strong>{formatCountdown(fixture.gameweek.deadlineAt ?? null, now)}</strong>
            <small>{urgency === 'low' ? 'Normal planning' : urgency === 'high' ? 'Plan soon' : 'Action needed soon'}</small>
          </div>
          <div className="manager-desk__fixture-form-block">
            <span>Last 5 gameweeks</span>
            <FormBlocks form={ownForm} />
          </div>
        </div>
      ) : null}

      <div className="manager-desk__fixture-spotlight-footer">
        <span>{context === 'finalised' ? 'Scores only · gameweek complete' : context === 'live' ? 'Live scores can still change' : 'Review your XI before the deadline'}</span>
        <Button onClick={() => onNavigate(context === 'pre_deadline' ? '/team-selection' : '/league')} type="button" variant="secondary">
          {context === 'pre_deadline' ? 'Review team' : context === 'live' ? 'View live fixture' : 'View final result'}
          <ArrowRight aria-hidden="true" size={16} />
        </Button>
      </div>
    </Card>
  );
}

function FixtureInsight({ label, value }: { label: string; value: string }) {
  return <div className="manager-desk__fixture-insight"><span>{label}</span><strong>{value}</strong></div>;
}

function OtherFixtureRow({ context, fixture, formFixtures, onNavigate }: {
  context: ManagerDeskContext;
  fixture: LeagueFixture;
  formFixtures: LeagueFixture[];
  onNavigate: (href: string) => void;
}) {
  return (
    <button className="manager-desk__fixture-row" onClick={() => onNavigate('/league')} type="button">
      <span className="manager-desk__fixture-row-team">{fixture.homeTeam.shortName ?? fixture.homeTeam.name}</span>
      {context === 'pre_deadline' ? (
        <span className="manager-desk__fixture-row-form" aria-label={`${fixture.homeTeam.name} and ${fixture.awayTeam.name} last five gameweeks`}>
          <FormDots form={formForTeam(fixture.homeTeam.id, formFixtures)} />
          <span className="manager-desk__fixture-row-vs">vs</span>
          <FormDots form={formForTeam(fixture.awayTeam.id, formFixtures)} />
        </span>
      ) : (
        <strong className="manager-desk__fixture-row-score">{fixture.score.homeScore ?? '—'} – {fixture.score.awayScore ?? '—'}</strong>
      )}
      <span className="manager-desk__fixture-row-team manager-desk__fixture-row-team--away">{fixture.awayTeam.shortName ?? fixture.awayTeam.name}</span>
      <ChevronRight aria-hidden="true" size={16} />
    </button>
  );
}

function PriorityStack({ data, flaggedPlayers, isEditable, notifications, now, onNavigate }: {
  data: ManagerDeskSnapshot;
  flaggedPlayers: SquadApiPlayer[];
  isEditable: boolean;
  notifications: SquadApiNotification[];
  now: number;
  onNavigate: (href: string) => void;
}) {
  const captainRisk = flaggedPlayers.find((player) => {
    const selection = data.selection.players.find((candidate) => candidate.id === player.id);
    return selection?.captain || selection?.viceCaptain;
  });
  const drawIsOpen = data.drawDeadlineAt ? new Date(data.drawDeadlineAt).getTime() > now : false;
  const drawUrgency = drawIsOpen ? urgencyForDeadline(data.drawDeadlineAt, now) : 'low';
  const drawVisible = drawIsOpen || data.availablePlayers.length > 0 || data.interestCount > 0;
  const items: Array<{ key: string; priority: Priority; content: ReactNode }> = [];

  if (flaggedPlayers.length > 0) {
    items.push({
      key: 'injury',
      priority: captainRisk ? 'critical' : 'high',
      content: <InjuryAlertCard flaggedPlayers={flaggedPlayers} selection={data.selection} onNavigate={onNavigate} />,
    });
  }
  if (drawVisible) {
    items.push({
      key: 'draw',
      priority: drawUrgency === 'critical' ? 'critical' : drawUrgency === 'high' ? 'high' : 'low',
      content: <WaiverDrawCard availablePlayers={data.availablePlayers} deadlineAt={data.drawDeadlineAt} interestCount={data.interestCount} now={now} urgency={drawUrgency} onNavigate={onNavigate} />,
    });
  }
  if (isEditable) {
    items.push({
      key: 'lineup',
      priority: flaggedPlayers.length > 0 ? 'normal' : 'high',
      content: <LineupActionCard selection={data.selection} onNavigate={onNavigate} />,
    });
  }
  if (data.selection.fixtureLock.locked) {
    items.push({
      key: 'locked',
      priority: 'normal',
      content: <LockedStatusCard onNavigate={onNavigate} />,
    });
  }
  notifications.slice(0, 2).forEach((notification) => {
    items.push({
      key: notification.id,
      priority: 'normal',
      content: <NotificationActionCard notification={notification} onNavigate={onNavigate} />,
    });
  });

  if (items.length === 0) {
    return <section aria-label="Manager priorities" className="manager-desk__priority-stack manager-desk__priority-stack--clear"><div className="manager-desk__all-clear"><CheckCircle2 aria-hidden="true" size={20} /><div><strong>You are all caught up</strong><span>No urgent actions for this gameweek.</span></div></div></section>;
  }

  items.sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority));
  return <section aria-labelledby="manager-desk-priority-title" className="manager-desk__priority-stack"><div className="manager-desk__priority-heading"><div><p className="eyebrow">Adaptive priorities</p><h2 id="manager-desk-priority-title">What needs your attention</h2></div><span>{items.length}</span></div><div className="manager-desk__priority-list">{items.map((item) => <div className={`manager-desk__priority-item manager-desk__priority-item--${item.priority}`} key={item.key}>{item.content}</div>)}</div></section>;
}

function InjuryAlertCard({ flaggedPlayers, selection, onNavigate }: { flaggedPlayers: SquadApiPlayer[]; selection: TeamSelectionSnapshot; onNavigate: (href: string) => void }) {
  const critical = flaggedPlayers.some((player) => {
    const lineup = selection.players.find((candidate) => candidate.id === player.id);
    return lineup?.captain || lineup?.viceCaptain;
  });
  return <article className={`manager-desk__priority-card manager-desk__priority-card--injury${critical ? ' manager-desk__priority-card--critical' : ''}`}><div className="manager-desk__priority-card-heading"><span className="manager-desk__priority-icon"><ShieldAlert aria-hidden="true" size={20} /></span><div><span className="manager-desk__fixture-kicker">{critical ? 'Captaincy risk' : 'Starting XI risk'}</span><h3>{critical ? 'Your captaincy needs checking.' : 'Check squad availability.'}</h3></div></div><p>{critical ? 'Your captain or vice-captain has an availability issue. Review the lineup before the deadline.' : 'Only your starting XI is highlighted here; bench and reserve injuries stay out of the desk.'}</p><div className="manager-desk__priority-player-list">{flaggedPlayers.slice(0, 3).map((player) => { const lineup = selection.players.find((candidate) => candidate.id === player.id); return <button key={player.id} onClick={() => onNavigate('/squad')} type="button"><span className="manager-desk__shirt-placeholder">{getInitials(player.display_name)}</span><span><strong>{player.display_name}</strong><small>{lineup?.captain ? 'Captain' : lineup?.viceCaptain ? 'Vice-captain' : 'Starting XI'} · {availabilityIssueLabel(player) ?? 'Check status'}</small></span><ChevronRight aria-hidden="true" size={17} /></button>; })}</div><Button onClick={() => onNavigate('/team-selection')} type="button">Review your starting XI <ArrowRight aria-hidden="true" size={16} /></Button><Button onClick={() => onNavigate('/squad')} type="button" variant="ghost">Check squad availability</Button></article>;
}

function LockedStatusCard({ onNavigate }: { onNavigate: (href: string) => void }) {
  return <article className="manager-desk__priority-card"><div className="manager-desk__priority-card-heading"><span className="manager-desk__priority-icon"><ClipboardCheck aria-hidden="true" size={20} /></span><div><span className="manager-desk__fixture-kicker">Matchweek locked</span><h3>Locked in for this gameweek.</h3></div></div><p>The deadline has passed. Review the submitted lineup and gameweek context.</p><Button onClick={() => onNavigate('/squad')} type="button">View your team <ArrowRight aria-hidden="true" size={16} /></Button></article>;
}

function WaiverDrawCard({ availablePlayers, deadlineAt, interestCount, now, urgency, onNavigate }: { availablePlayers: SquadApiPlayer[]; deadlineAt: string | null; interestCount: number; now: number; urgency: Priority; onNavigate: (href: string) => void }) {
  const urgent = urgency === 'critical';
  const hasInterests = interestCount > 0;
  return <article className={`manager-desk__priority-card manager-desk__draw-card${urgent ? ' manager-desk__draw-card--urgent' : ''}`}><div className="manager-desk__draw-copy"><div className="manager-desk__priority-card-heading"><span className="manager-desk__priority-icon"><Users aria-hidden="true" size={20} /></span><div><span className="manager-desk__fixture-kicker">Waiver draw</span><h3>{urgent && !hasInterests ? 'No interests registered.' : 'Your next draw is approaching.'}</h3></div></div><div className="manager-desk__draw-countdown"><span>Draw in</span><strong>{formatCountdown(deadlineAt, now)}</strong></div><p>{hasInterests ? `${interestCount} interest${interestCount === 1 ? '' : 's'} registered.` : urgent ? 'Act now to give yourself a chance of adding a free agent.' : 'Register preferred free agents before the draw closes.'}</p><Button onClick={() => onNavigate('/scouting/interests')} type="button" variant={urgent ? 'primary' : 'secondary'}>{hasInterests ? 'Review interests' : 'Add interests'} <ArrowRight aria-hidden="true" size={16} /></Button></div>{availablePlayers.length > 0 ? <div className="manager-desk__draw-players"><PanelHeading icon={<Search aria-hidden="true" size={18} />} label="Available players" title="Free agents" action="View market" onAction={() => onNavigate('/scouting')} /><div className="manager-desk__available-list">{availablePlayers.slice(0, 3).map((player) => <button className="manager-desk__available-row" key={player.id} onClick={() => onNavigate('/scouting')} type="button"><span className="manager-desk__player-icon"><Star aria-hidden="true" size={17} /></span><span><strong>{player.display_name}</strong><small>{player.position} · {player.epl_team.short_name ?? player.epl_team.name}</small></span><span className="manager-desk__add-icon">+</span></button>)}</div></div> : null}</article>;
}

function LineupActionCard({ selection, onNavigate }: { selection: TeamSelectionSnapshot; onNavigate: (href: string) => void }) {
  const starters = selection.players.filter((player) => player.slot === 'starter');
  const captain = starters.find((player) => player.captain);
  return <article className="manager-desk__priority-card"><div className="manager-desk__priority-card-heading"><span className="manager-desk__priority-icon"><ClipboardCheck aria-hidden="true" size={20} /></span><div><span className="manager-desk__fixture-kicker">Matchweek setup</span><h3>Review your starting XI.</h3></div></div><p>{starters.length} starters selected{captain ? ` · Captain: ${captain.name}` : ' · Captain needed'}.</p><Button onClick={() => onNavigate('/team-selection')} type="button">Review team <ArrowRight aria-hidden="true" size={16} /></Button></article>;
}

function NotificationActionCard({ notification, onNavigate }: { notification: SquadApiNotification; onNavigate: (href: string) => void }) {
  return <article className="manager-desk__priority-card"><div className="manager-desk__priority-card-heading"><span className="manager-desk__priority-icon"><Zap aria-hidden="true" size={20} /></span><div><span className="manager-desk__fixture-kicker">Desk update</span><h3>{notification.title}</h3></div></div><p>{notification.message}</p><Button onClick={() => onNavigate(notification.action_href || '/squad')} type="button" variant="secondary">Review <ArrowRight aria-hidden="true" size={16} /></Button></article>;
}

function TeamStatusCard({ context, leagueRow, playerCount, flaggedCount, onNavigate }: { context: ManagerDeskContext; leagueRow: LeagueTableRow | null; playerCount: number; flaggedCount: number; onNavigate: (href: string) => void }) {
  return <section aria-labelledby="manager-desk-status-title" className="manager-desk__support-card"><PanelHeading icon={<ShieldCheck aria-hidden="true" size={19} />} label="Team status" title="Your season" /><strong className="manager-desk__status-value">{context === 'live' ? 'Live matchday' : leagueRow ? `Position #${leagueRow.position}` : 'Ready for the next move'}</strong><p>{playerCount} players · {flaggedCount} flagged{leagueRow ? ` · ${leagueRow.leaguePoints} league points` : ''}</p><Button onClick={() => onNavigate('/league')} type="button" variant="ghost">Open league <ArrowRight aria-hidden="true" size={16} /></Button></section>;
}

function DeskUpdatesCard({ notifications, onNavigate }: { notifications: SquadApiNotification[]; onNavigate: (href: string) => void }) {
  const notification = notifications[0];
  return <section aria-labelledby="manager-desk-updates-title" className="manager-desk__support-card"><PanelHeading icon={<Zap aria-hidden="true" size={19} />} label="Desk updates" title={notification ? notification.title : 'All clear'} /><p>{notification?.message ?? 'No new messages or trade proposals need your attention.'}</p>{notification ? <Button onClick={() => onNavigate(notification.action_href || '/squad')} type="button" variant="ghost">Review <ArrowRight aria-hidden="true" size={16} /></Button> : null}</section>;
}

function RecentFormCard({ fixtures, managerTeam, onNavigate }: { fixtures: LeagueFixture[]; managerTeam: { id: string; name: string }; onNavigate: (href: string) => void }) {
  const form = formForTeam(managerTeam.id, fixtures);
  return <section aria-labelledby="manager-desk-form-title" className="manager-desk__support-card"><PanelHeading icon={<BarChart3 aria-hidden="true" size={19} />} label="Recent form" title="Last gameweeks" />{form.length > 0 ? <FormBlocks form={form} /> : <p className="manager-desk__empty-message">No completed gameweeks to compare yet.</p>}<Button onClick={() => onNavigate('/league')} type="button" variant="ghost">Open league <ArrowRight aria-hidden="true" size={16} /></Button></section>;
}

function PanelHeading({ icon, label, title, action, onAction }: { icon: ReactNode; label: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="manager-desk__panel-heading"><div><span className="manager-desk__card-kicker">{icon} {label}</span><h2>{title}</h2></div>{action && onAction ? <Button onClick={onAction} type="button" variant="ghost">{action} <ArrowRight aria-hidden="true" size={15} /></Button> : null}</div>;
}

function FormBlocks({ form }: { form: TeamForm[] }) {
  return <div className="manager-desk__form-blocks">{form.slice(-5).map((item) => <span className={`manager-desk__form-block manager-desk__form-block--${item.result.toLowerCase()}`} key={item.key}>{item.points ?? '—'}</span>)}</div>;
}

function FormDots({ form }: { form: TeamForm[] }) {
  return <span className="manager-desk__form-dots">{Array.from({ length: 5 }, (_, index) => { const item = form.slice(-5)[index]; return <span aria-label={item ? `${item.result}${item.points === null ? '' : `, ${item.points} points`}` : 'No result'} className={`manager-desk__form-dot${item ? ` manager-desk__form-dot--${item.result.toLowerCase()}` : ''}`} key={item?.key ?? `empty-${index}`} />; })}</span>;
}

interface TeamForm {
  key: string;
  points: number | null;
  result: 'W' | 'D' | 'L' | 'P';
}

function formForTeam(teamId: string, fixtures: LeagueFixture[]): TeamForm[] {
  return fixtures
    .filter((fixture) => fixture.homeTeam.id === teamId || fixture.awayTeam.id === teamId)
    .sort((left, right) => left.gameweek.number - right.gameweek.number)
    .map((fixture) => ({
      key: fixture.id,
      points: scoreForTeam(fixture, teamId),
      result: resultForFixture(fixture, teamId),
    }));
}

function getStartingRisks(players: SquadApiPlayer[], selection: TeamSelectionSnapshot | null): SquadApiPlayer[] {
  if (!selection) return [];
  const lineupById = new Map(selection.players.map((player) => [player.id, player]));
  return players
    .filter((player) => lineupById.get(player.id)?.slot === 'starter' && hasAvailabilityIssue(player))
    .sort((left, right) => riskRank(lineupById.get(left.id)) - riskRank(lineupById.get(right.id)));
}

function riskRank(player: TeamSelectionPlayer | undefined): number {
  return player?.captain || player?.viceCaptain ? 0 : 1;
}

function priorityRank(priority: Priority): number {
  return { critical: 0, high: 1, normal: 2, low: 3 }[priority];
}

function urgencyForDeadline(deadlineAt: string | null, now: number): Priority {
  if (!deadlineAt) return 'low';
  const hours = (new Date(deadlineAt).getTime() - now) / 3_600_000;
  if (hours <= 24) return 'critical';
  if (hours <= 72) return 'high';
  return 'low';
}

function formatCountdown(deadlineAt: string | null, now: number): string {
  if (!deadlineAt) return 'To be confirmed';
  const remaining = new Date(deadlineAt).getTime() - now;
  if (!Number.isFinite(remaining)) return 'To be confirmed';
  if (remaining <= 0) return 'Closed';
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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
  const recent = league.allFixtures.fixtures.filter((fixture) => fixture.status !== 'pending');
  return { context: contextForLegacy(currentFixture, nextFixture), gameweek: selection.gameweek ?? mapSquadGameweek(squad), selection, squad: { summary: squad, notifications }, currentFixture, nextFixture, currentFixtures: league.currentFixtures.fixtures, nextFixtures: league.nextFixtures.fixtures, recentFixtures: recent.length > 0 ? recent.slice(-5) : currentFixture ? [currentFixture] : [], formFixtures: recent, leagueTable: league.table, availablePlayers: changes, drawDeadlineAt: nextFixture?.gameweek.deadlineAt ?? selection.gameweek?.deadlineAt ?? null, interestCount: 0 };
}

function contextForLegacy(currentFixture: LeagueFixture | null, nextFixture: LeagueFixture | null): ManagerDeskContext {
  if (currentFixture?.status === 'started') return 'live';
  if (currentFixture?.status === 'complete') {
    const deadline = currentFixture.gameweek.deadlineAt ? new Date(currentFixture.gameweek.deadlineAt).getTime() : null;
    if (deadline === null || Date.now() - deadline <= 86_400_000) return 'finalised';
  }
  return nextFixture ? 'pre_deadline' : 'finalised';
}

function mapSquadGameweek(squad: SquadApiSummary): TeamSelectionSnapshot['gameweek'] {
  return { id: squad.gameweek.id, name: squad.gameweek.name, number: squad.gameweek.number, deadlineAt: squad.gameweek.deadline_at ?? null };
}

function findTeamRow(rows: LeagueTableRow[] | undefined, teamId: string | undefined, teamName: string | undefined): LeagueTableRow | null { return rows?.find((row) => row.team.id === teamId || row.team.name === teamName) ?? null; }

function findManagerFixture(fixtures: LeagueFixture[], teamId: string, teamName: string): LeagueFixture | null { return fixtures.find((fixture) => Boolean(teamForFixture(fixture, teamId, teamName))) ?? fixtures[0] ?? null; }

function teamForFixture(fixture: LeagueFixture, teamId: string, teamName: string) { return [fixture.homeTeam, fixture.awayTeam].find((team) => team.id === teamId || team.name === teamName) ?? null; }

function scoreForTeam(fixture: LeagueFixture, teamId: string): number | null { return fixture.homeTeam.id === teamId ? fixture.score.homeScore : fixture.awayTeam.id === teamId ? fixture.score.awayScore : null; }

function resultForFixture(fixture: LeagueFixture, teamId: string): 'W' | 'D' | 'L' | 'P' { if (fixture.status === 'pending' || fixture.score.outcome === 'pending') return 'P'; if (fixture.score.outcome === 'draw') return 'D'; const home = fixture.homeTeam.id === teamId; return fixture.score.outcome === (home ? 'home_win' : 'away_win') ? 'W' : 'L'; }

function contextLabel(context: ManagerDeskContext): string { if (context === 'live') return 'Live now'; if (context === 'finalised') return 'Finalised'; return 'Before deadline'; }

function getInitials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CD'; }
