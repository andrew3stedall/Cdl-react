import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  LampDesk,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Users,
  UserRound,
  Zap,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { TeamCrest } from './components/team/TeamCrest';
import { PageHero, PageHeroControls, PageHeroNotificationButton, PageHeroViewToggle } from './components/ui/page-hero';
import type { SessionState } from './contracts';
import type { LeagueClient, LeagueFixture, LeagueTableRow } from './league-api';
import { HttpLeagueClient } from './league-api';
import { ManagerAccountSection } from './ManagerAccountSection';
import { managerNicknameForTeam } from './manager-nicknames';
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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
      <PageHero
        actions={(
          <PageHeroControls>
            <PageHeroViewToggle
              ariaLabel="Desk and profile"
              onChange={(nextPage) => {
                if (nextPage === 'profile') onNavigate('/profile');
              }}
              options={[
                { value: 'desk', label: 'Desk', icon: <LampDesk aria-hidden="true" size={17} /> },
                { value: 'profile', label: 'Profile', icon: <UserRound aria-hidden="true" size={17} /> },
              ]}
              value="desk"
            />
            <PageHeroNotificationButton
              notifications={notifications.map((notification) => ({ id: notification.id, title: notification.title, message: notification.message, actionHref: notification.action_href }))}
              onNavigate={onNavigate}
              onToggle={() => setNotificationsOpen((open) => !open)}
              open={notificationsOpen}
            />
            <ManagerAccountSection onNavigate={onNavigate} onSignOut={onSignOut} session={session} />
          </PageHeroControls>
        )}
        actionsLabel="Desk utilities"
        title="Gaffers Desk"
        titleId="manager-desk-title"
      />

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
          <FixtureFocus data={data} managerTeam={data.selection.managerTeam} onNavigate={onNavigate} />

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
      ) : loading ? <ManagerDeskLoadingState /> : null}
    </main>
  );
}

function ManagerDeskLoadingState() {
  return (
    <div aria-label="Loading manager desk" className="manager-desk__loading-state" role="status">
      <section className="manager-desk__loading-surface manager-desk__loading-surface--fixture">
        <div className="manager-desk__loading-topline">
          <span className="manager-desk__loading-line manager-desk__loading-line--short" />
          <span className="manager-desk__loading-line manager-desk__loading-line--tiny" />
        </div>
        <div className="manager-desk__loading-matchup">
          <span className="manager-desk__loading-badge" />
          <span className="manager-desk__loading-score" />
          <span className="manager-desk__loading-badge manager-desk__loading-badge--small" />
        </div>
        <div className="manager-desk__loading-insights">
          <span className="manager-desk__loading-line" />
          <span className="manager-desk__loading-line" />
          <span className="manager-desk__loading-line" />
        </div>
      </section>
      <section className="manager-desk__loading-surface manager-desk__loading-surface--priority">
        <span className="manager-desk__loading-line manager-desk__loading-line--short" />
        <span className="manager-desk__loading-line" />
      </section>
      <div className="manager-desk__loading-support-grid">
        <span className="manager-desk__loading-surface" />
        <span className="manager-desk__loading-surface" />
      </div>
    </div>
  );
}

function FixtureFocus({ data, managerTeam, onNavigate }: {
  data: ManagerDeskSnapshot;
  managerTeam: { id: string; name: string };
  onNavigate: (href: string) => void;
}) {
  const fixtures = data.context === 'pre_deadline' ? data.nextFixtures : data.currentFixtures;
  const requestedFeatured = data.context === 'pre_deadline' ? data.nextFixture : data.currentFixture;
  const featuredFixture = requestedFeatured ?? fixtures.find((candidate) => Boolean(teamForFixture(candidate, managerTeam.id, managerTeam.name))) ?? null;
  const orderedFixtures = featuredFixture
    ? [featuredFixture, ...fixtures.filter((candidate) => candidate.id !== featuredFixture.id)]
    : fixtures;
  const gameweek = featuredFixture?.gameweek.name ?? orderedFixtures[0]?.gameweek.name ?? data.gameweek.name;
  const statusLabel = data.context === 'live' ? 'Live now' : data.context === 'finalised' ? 'Finalised' : 'Next fixture';
  const showCurrentScore = data.context !== 'pre_deadline';

  return (
    <section
      aria-labelledby="manager-desk-fixture-focus-title"
      className={`manager-desk__fixture-focus manager-desk__fixture-focus--${data.context}`}
    >
      <div className="manager-desk__fixture-spotlight-topline">
        <span className="manager-desk__fixture-kicker" id="manager-desk-fixture-focus-title">
          <span className={`manager-desk__status-dot manager-desk__status-dot--${data.context}`} aria-hidden="true" />
          {statusLabel}
        </span>
        <span className="manager-desk__fixture-gameweek">{gameweek}</span>
      </div>

      {orderedFixtures.length > 0 ? (
        <div aria-label="Gameweek fixtures" className="manager-desk__fixture-list">
          {orderedFixtures.map((fixture) => (
            <FixtureMatchup
              featured={fixture.id === featuredFixture?.id}
              fixture={fixture}
              formFixtures={data.formFixtures}
              key={fixture.id}
              leagueRows={data.leagueTable.rows}
              showCurrentScore={showCurrentScore}
            />
          ))}
        </div>
      ) : (
        <div className="manager-desk__fixture-spotlight--empty">
          <CalendarClock aria-hidden="true" size={24} />
          <strong>Fixture details are not available yet</strong>
          <Button onClick={() => onNavigate('/league')} type="button" variant="secondary">
            View fixtures <ArrowRight aria-hidden="true" size={16} />
          </Button>
        </div>
      )}
    </section>
  );
}

function FixtureMatchup({ featured, fixture, formFixtures, leagueRows, showCurrentScore }: {
  featured: boolean;
  fixture: LeagueFixture;
  formFixtures: LeagueFixture[];
  leagueRows: LeagueTableRow[];
  showCurrentScore: boolean;
}) {
  const previousFixtures = formFixtures.filter((candidate) => candidate.id !== fixture.id);
  const homeForm = formForTeam(fixture.homeTeam.id, previousFixtures);
  const awayForm = formForTeam(fixture.awayTeam.id, previousFixtures);
  const gameweeks = recentComparisonGameweeks(homeForm, awayForm);
  const homeRow = findTeamRow(leagueRows, fixture.homeTeam.id, fixture.homeTeam.name);
  const awayRow = findTeamRow(leagueRows, fixture.awayTeam.id, fixture.awayTeam.name);
  const homeName = managerNicknameForTeam(fixture.homeTeam);
  const awayName = managerNicknameForTeam(fixture.awayTeam);
  const currentVisible = showCurrentScore && fixture.status !== 'pending';
  const legacyRowClass = featured ? 'manager-desk__fixture-form-row' : 'manager-desk__fixture-row-team';

  return (
    <article
      aria-label={`${homeName} versus ${awayName}`}
      className={featured ? 'manager-desk__fixture-matchup manager-desk__fixture-matchup--featured' : 'manager-desk__fixture-matchup'}
    >
      {featured ? (
        <div className="manager-desk__fixture-feature-label">
          <Star aria-hidden="true" size={16} />
          <span>Your fixture</span>
        </div>
      ) : null}

      <div className="manager-desk__fixture-board">
        <FixtureManager
          className={legacyRowClass}
          featured={featured}
          form={homeForm}
          leagueRow={homeRow}
          side="home"
          team={fixture.homeTeam}
        />

        <div className="manager-desk__fixture-comparison" aria-label="Gameweek point comparison">
          {currentVisible ? (
            <FixtureComparisonRow
              awayBonus={fixture.score.bonusPoints[fixture.awayTeam.id] ?? 0}
              awayPoints={scoreForTeam(fixture, fixture.awayTeam.id)}
              current
              homeBonus={fixture.score.bonusPoints[fixture.homeTeam.id] ?? 0}
              homePoints={scoreForTeam(fixture, fixture.homeTeam.id)}
              label={`GW${fixture.gameweek.number}`}
            />
          ) : null}
          {gameweeks.map((gameweekNumber, index) => {
            const homeItem = gameweekNumber === null ? undefined : homeForm.find((item) => item.gameweekNumber === gameweekNumber);
            const awayItem = gameweekNumber === null ? undefined : awayForm.find((item) => item.gameweekNumber === gameweekNumber);
            return (
              <FixtureComparisonRow
                awayBonus={awayItem?.bonusPoints ?? 0}
                awayPoints={awayItem?.points ?? null}
                awayResult={awayItem?.result}
                homeBonus={homeItem?.bonusPoints ?? 0}
                homePoints={homeItem?.points ?? null}
                homeResult={homeItem?.result}
                key={gameweekNumber ?? `empty-${index}`}
                label={gameweekNumber === null ? '' : `GW${gameweekNumber}`}
              />
            );
          })}
        </div>

        <FixtureManager
          className={legacyRowClass}
          featured={featured}
          form={awayForm}
          leagueRow={awayRow}
          side="away"
          team={fixture.awayTeam}
        />
      </div>
    </article>
  );
}

function FixtureManager({ className, featured, form, leagueRow, side, team }: {
  className: string;
  featured: boolean;
  form: TeamForm[];
  leagueRow: LeagueTableRow | null;
  side: 'home' | 'away';
  team: { id?: string; name: string; managerName?: string };
}) {
  const nickname = managerNicknameForTeam(team);
  const record = leagueRow
    ? `${leagueRow.wins}W ${leagueRow.draws}D ${leagueRow.losses}L`
    : recordForTeam(form);
  return (
    <div className={`manager-desk__fixture-manager manager-desk__fixture-manager--${side} ${className}`}>
      {leagueRow ? <span className="manager-desk__fixture-position">#{leagueRow.position}</span> : null}
      <TeamCrest className="manager-desk__fixture-badge" team={team} />
      <strong className="manager-desk__fixture-manager-name">{nickname}</strong>
      <span className="manager-desk__fixture-manager-record">{record}</span>
      {featured ? <span className="sr-only">Featured fixture manager</span> : null}
    </div>
  );
}

function FixtureComparisonRow({ awayBonus, awayPoints, awayResult, current = false, homeBonus, homePoints, homeResult, label }: {
  awayBonus: number;
  awayPoints: number | null;
  awayResult?: TeamForm['result'];
  current?: boolean;
  homeBonus: number;
  homePoints: number | null;
  homeResult?: TeamForm['result'];
  label: string;
}) {
  const homeDisplayResult = homeResult ?? comparisonResultForPoints(homePoints, awayPoints);
  const awayDisplayResult = awayResult ?? comparisonResultForPoints(awayPoints, homePoints);
  return (
    <div className={`manager-desk__fixture-comparison-row${current ? ' manager-desk__fixture-comparison-row--current' : ''}${label ? '' : ' manager-desk__fixture-comparison-row--empty'}`}>
      <ComparisonScore bonus={homeBonus} points={homePoints} result={homeDisplayResult} />
      <span className="manager-desk__fixture-comparison-label">{label}</span>
      <ComparisonScore bonus={awayBonus} points={awayPoints} result={awayDisplayResult} />
    </div>
  );
}

function ComparisonScore({ bonus, points, result }: {
  bonus: number;
  points: number | null;
  result: 'W' | 'D' | 'L' | 'P';
}) {
  const markerCount = Math.min(Math.abs(bonus), 3);
  const bonusLabel = bonus === 0 ? '' : `, ${bonus > 0 ? '+' : ''}${bonus} bonus point${Math.abs(bonus) === 1 ? '' : 's'}`;
  const resultLabel = result === 'P' ? 'no comparison' : result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw';
  return (
    <span
      aria-label={`${points ?? 'No'} points, ${resultLabel}${bonusLabel}`}
      className={`manager-desk__form-score manager-desk__form-score--${result.toLowerCase()}${points === null ? ' manager-desk__form-score--empty' : ''}`}
    >
      <span aria-hidden="true" className="manager-desk__form-score-markers manager-desk__form-score-markers--above">
        {bonus > 0 ? Array.from({ length: markerCount }, (_, index) => <i key={index} />) : null}
      </span>
      <strong>{points ?? ''}</strong>
      <span aria-hidden="true" className="manager-desk__form-score-markers manager-desk__form-score-markers--below">
        {bonus < 0 ? Array.from({ length: markerCount }, (_, index) => <i key={index} />) : null}
      </span>
    </span>
  );
}

function recentComparisonGameweeks(homeForm: TeamForm[], awayForm: TeamForm[]): Array<number | null> {
  const gameweeks = Array.from(new Set([...homeForm, ...awayForm].map((item) => item.gameweekNumber)))
    .sort((left, right) => left - right)
    .slice(0, 5);
  return [...Array.from({ length: Math.max(0, 5 - gameweeks.length) }, () => null), ...gameweeks];
}

function comparisonResultForPoints(points: number | null, opponentPoints: number | null): 'W' | 'D' | 'L' | 'P' {
  if (points === null || opponentPoints === null) return 'P';
  if (points === opponentPoints) return 'D';
  return points > opponentPoints ? 'W' : 'L';
}

function recordForTeam(form: TeamForm[]): string {
  const completed = form.filter((item) => item.result !== 'P');
  const wins = completed.filter((item) => item.result === 'W').length;
  const draws = completed.filter((item) => item.result === 'D').length;
  const losses = completed.filter((item) => item.result === 'L').length;
  return `${wins}W ${draws}D ${losses}L`;
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
    return <section aria-label="Manager priorities" className="manager-desk__priority-stack manager-desk__priority-stack--clear"><div className="manager-desk__all-clear"><CheckCircle2 aria-hidden="true" size={20} /><strong>All clear</strong></div></section>;
  }

  items.sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority));
  return <section aria-labelledby="manager-desk-priority-title" className="manager-desk__priority-stack"><div className="manager-desk__priority-heading"><h2 id="manager-desk-priority-title">Adaptive priorities</h2><span>{items.length}</span></div><div className="manager-desk__priority-list">{items.map((item) => <div className={`manager-desk__priority-item manager-desk__priority-item--${item.priority}`} key={item.key}>{item.content}</div>)}</div></section>;
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

interface TeamForm {
  key: string;
  gameweek: string;
  gameweekNumber: number;
  points: number | null;
  bonusPoints: number;
  result: 'W' | 'D' | 'L' | 'P';
}

function formForTeam(teamId: string, fixtures: LeagueFixture[]): TeamForm[] {
  return fixtures
    .filter((fixture) => fixture.homeTeam.id === teamId || fixture.awayTeam.id === teamId)
    .sort((left, right) => left.gameweek.number - right.gameweek.number)
    .map((fixture) => ({
      key: fixture.id,
      gameweek: fixture.gameweek.name,
      gameweekNumber: fixture.gameweek.number,
      points: scoreForTeam(fixture, teamId),
      bonusPoints: fixture.score.bonusPoints[teamId] ?? 0,
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

function getInitials(value: string): string { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CD'; }
