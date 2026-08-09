import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Gauge,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { SessionState } from './contracts';
import type { LeagueClient, LeagueFixture, LeagueSnapshot } from './league-api';
import { HttpLeagueClient } from './league-api';
import { hasAvailabilityIssue } from './player-availability';
import type {
  SquadApiNotification,
  SquadApiPlayer,
  SquadApiSummary,
  SquadClient,
} from './squad-api';
import { HttpSquadClient } from './squad-api';
import type { TeamSelectionClient, TeamSelectionSnapshot } from './team-selection-api';
import { HttpTeamSelectionClient } from './team-selection-api';
import './manager-desk.css';

const defaultLeagueClient = new HttpLeagueClient();
const defaultSquadClient = new HttpSquadClient();
const defaultTeamSelectionClient = new HttpTeamSelectionClient();

interface ManagerDeskPageProps {
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
  session: SessionState;
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

interface DeskData {
  league: LeagueSnapshot | null;
  notifications: SquadApiNotification[];
  selection: TeamSelectionSnapshot | null;
  squad: SquadApiSummary | null;
}

interface LoadState {
  data: DeskData;
  errors: string[];
  loading: boolean;
}

export function ManagerDeskPage({
  leagueClient = defaultLeagueClient,
  onNavigate,
  session,
  squadClient = defaultSquadClient,
  teamSelectionClient = defaultTeamSelectionClient,
}: ManagerDeskPageProps) {
  const [loadState, setLoadState] = useState<LoadState>({
    data: { league: null, notifications: [], selection: null, squad: null },
    errors: [],
    loading: true,
  });
  const [reloadRequest, setReloadRequest] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadDesk() {
      setLoadState((current) => ({ ...current, loading: true, errors: [] }));

      const [selectionResult, leagueResult, squadResult, notificationResult] = await Promise.allSettled([
        teamSelectionClient.getTeamSelection(),
        leagueClient.getLeagueSnapshot(),
        squadClient.getSummary(),
        squadClient.getNotifications(),
      ]);

      if (!active) return;

      const errors: string[] = [];
      const selection = getFulfilled(selectionResult, 'team selection', errors);
      const league = getFulfilled(leagueResult, 'league snapshot', errors);
      const squad = getFulfilled(squadResult, 'squad summary', errors);
      const notifications = getFulfilled(notificationResult, 'manager notifications', errors)?.notifications ?? [];

      setLoadState({
        data: { league, notifications, selection, squad },
        errors,
        loading: false,
      });
    }

    void loadDesk();
    return () => {
      active = false;
    };
  }, [leagueClient, reloadRequest, squadClient, teamSelectionClient]);

  const { data, errors, loading } = loadState;
  const displayName = session.user?.displayName?.split(' ')[0] || 'Manager';
  const teamName = data.selection?.managerTeam.name ?? data.squad?.manager_team.name ?? 'Your team';
  const gameweek = data.selection?.gameweek ?? mapSquadGameweek(data.squad);
  const starters = data.selection?.players.filter((player) => player.slot === 'starter') ?? [];
  const captain = starters.find((player) => player.captain);
  const lineupLocked = data.selection?.fixtureLock.locked ?? false;
  const flaggedPlayers = useMemo(() => getFlaggedPlayers(data.squad?.players ?? []), [data.squad]);
  const teamRow = findTeamRow(data.league, data.selection?.managerTeam.id, teamName);
  const nextFixture = findNextFixture(data.league, data.selection?.managerTeam.id, teamName);
  const deadlineLabel = formatDeadline(gameweek?.deadlineAt ?? null);
  const headlineAction = lineupLocked ? 'View your team' : 'Set your team';

  return (
    <main aria-labelledby="manager-desk-title" className="feature-screen manager-desk">
      <header className="manager-desk__header">
        <div>
          <p className="eyebrow">Manager workspace</p>
          <h1 id="manager-desk-title">Managers Desk</h1>
          <p className="manager-desk__intro">
            Good to see you, {displayName}. Here is what needs your attention.
          </p>
        </div>
        <div className="manager-desk__identity" aria-label="Current team and gameweek">
          <span className="manager-desk__team-mark" aria-hidden="true">{getInitials(teamName)}</span>
          <div>
            <strong>{teamName}</strong>
            <span>{gameweek?.name ?? 'Current gameweek'}</span>
          </div>
        </div>
      </header>

      {errors.length > 0 ? (
        <div className="manager-desk__data-note" role="status">
          <CircleAlert aria-hidden="true" size={17} />
          <span>Some workspace data is unavailable. Actions shown below may be incomplete.</span>
          <Button onClick={() => setReloadRequest((request) => request + 1)} type="button" variant="ghost">
            Retry
          </Button>
        </div>
      ) : null}

      <Card className="manager-desk__hero">
        <div className="manager-desk__hero-copy">
          <div className="manager-desk__hero-kicker">
            <span className="manager-desk__status-dot" aria-hidden="true" />
            {gameweek?.name ?? 'Matchweek'}
          </div>
          <h2>{lineupLocked ? 'Your team is locked in.' : 'Your next decision is ready.'}</h2>
          <p>
            {lineupLocked
              ? 'The deadline has passed. You can still review your submitted lineup and matchweek context.'
              : 'Review your starting XI, captain and bench before the deadline.'}
          </p>
        </div>
        <div className="manager-desk__hero-action">
          <div className="manager-desk__deadline">
            <CalendarClock aria-hidden="true" size={18} />
            <span>{deadlineLabel}</span>
          </div>
          <Button onClick={() => onNavigate('/team-selection')} type="button">
            {headlineAction}
            <ArrowRight aria-hidden="true" size={17} />
          </Button>
        </div>
      </Card>

      <section aria-label="Manager snapshot" className="manager-desk__stats">
        <SnapshotCard
          detail={loading ? 'Loading…' : `${starters.length} starters${captain ? ' · Captain set' : ' · Captain needed'}`}
          icon={<ClipboardCheck aria-hidden="true" size={18} />}
          label="Team selection"
          onClick={() => onNavigate('/team-selection')}
          value={lineupLocked ? 'Locked' : 'Review XI'}
        />
        <SnapshotCard
          detail={loading ? 'Loading…' : `${data.squad?.players.length ?? '—'} players · ${flaggedPlayers.length} flagged`}
          icon={<Users aria-hidden="true" size={18} />}
          label="Squad health"
          onClick={() => onNavigate('/squad')}
          value={flaggedPlayers.length > 0 ? `${flaggedPlayers.length} to check` : 'All clear'}
          tone={flaggedPlayers.length > 0 ? 'attention' : 'positive'}
        />
        <SnapshotCard
          detail={teamRow ? `${teamRow.leaguePoints} league points · ${teamRow.pointsFor} scored` : 'League table loading'}
          icon={<Gauge aria-hidden="true" size={18} />}
          label="League position"
          onClick={() => onNavigate('/league')}
          value={teamRow ? `#${teamRow.position}` : '—'}
        />
      </section>

      <div className="manager-desk__columns">
        <section aria-labelledby="manager-desk-actions-title" className="manager-desk__section">
          <div className="manager-desk__section-heading">
            <div>
              <p className="eyebrow">Action centre</p>
              <h2 id="manager-desk-actions-title">Needs your attention</h2>
            </div>
            <span className="manager-desk__section-count">{getAttentionCount(lineupLocked, flaggedPlayers, data.notifications)}</span>
          </div>
          <div className="manager-desk__action-list">
            {!lineupLocked ? (
              <ActionCard
                description={captain ? 'Your XI is ready to review before the deadline.' : 'Choose a captain before you submit your XI.'}
                icon={<ClipboardCheck aria-hidden="true" size={19} />}
                onClick={() => onNavigate('/team-selection')}
                title={captain ? 'Review your starting XI' : 'Choose a captain'}
                tone={captain ? 'default' : 'attention'}
              />
            ) : null}
            {flaggedPlayers.length > 0 ? (
              <ActionCard
                description={`${formatPlayerNames(flaggedPlayers)} ${flaggedPlayers.length === 1 ? 'may need' : 'may need'} a closer look.`}
                icon={<CircleAlert aria-hidden="true" size={19} />}
                onClick={() => onNavigate('/squad')}
                title="Check squad availability"
                tone="attention"
              />
            ) : null}
            {data.notifications.slice(0, 2).map((notification) => (
              <ActionCard
                description={notification.message}
                icon={<Zap aria-hidden="true" size={19} />}
                key={notification.id}
                onClick={() => onNavigate(notification.action_href || '/squad')}
                title={notification.title}
                tone="default"
              />
            ))}
            {!loading && lineupLocked && flaggedPlayers.length === 0 && data.notifications.length === 0 ? (
              <div className="manager-desk__all-clear">
                <CheckCircle2 aria-hidden="true" size={20} />
                <div>
                  <strong>You are all caught up</strong>
                  <span>No urgent actions for this gameweek.</span>
                </div>
              </div>
            ) : null}
            {loading ? <div className="manager-desk__loading" role="status">Loading your manager actions…</div> : null}
          </div>
        </section>

        <section aria-labelledby="manager-desk-fixture-title" className="manager-desk__section">
          <div className="manager-desk__section-heading">
            <div>
              <p className="eyebrow">Matchweek context</p>
              <h2 id="manager-desk-fixture-title">Your next fixture</h2>
            </div>
            <ShieldCheck aria-hidden="true" className="manager-desk__heading-icon" size={20} />
          </div>
          <FixtureCard fixture={nextFixture} onNavigate={onNavigate} teamName={teamName} />
        </section>
      </div>

      <section aria-labelledby="manager-desk-quick-actions-title" className="manager-desk__section manager-desk__quick-section">
        <div className="manager-desk__section-heading">
          <div>
            <p className="eyebrow">Shortcuts</p>
            <h2 id="manager-desk-quick-actions-title">Quick actions</h2>
          </div>
        </div>
        <div className="manager-desk__quick-actions">
          <QuickAction icon={<Users aria-hidden="true" size={18} />} label="Manage squad" onClick={() => onNavigate('/squad')} />
          <QuickAction icon={<ClipboardCheck aria-hidden="true" size={18} />} label="Team selection" onClick={() => onNavigate('/team-selection')} />
          <QuickAction icon={<Zap aria-hidden="true" size={18} />} label="Scout the market" onClick={() => onNavigate('/scouting')} />
          <QuickAction icon={<ShieldCheck aria-hidden="true" size={18} />} label="View league" onClick={() => onNavigate('/league')} />
        </div>
      </section>
    </main>
  );
}

function SnapshotCard({
  detail,
  icon,
  label,
  onClick,
  tone = 'default',
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'attention' | 'default' | 'positive';
  value: string;
}) {
  return (
    <button className={`manager-desk__snapshot manager-desk__snapshot--${tone}`} onClick={onClick} type="button">
      <span className="manager-desk__snapshot-icon">{icon}</span>
      <span className="manager-desk__snapshot-label">{label}</span>
      <strong>{value}</strong>
      <span className="manager-desk__snapshot-detail">{detail}</span>
      <ChevronRight aria-hidden="true" className="manager-desk__snapshot-arrow" size={17} />
    </button>
  );
}

function ActionCard({
  description,
  icon,
  onClick,
  title,
  tone,
}: {
  description: string;
  icon: ReactNode;
  onClick: () => void;
  title: string;
  tone: 'attention' | 'default';
}) {
  return (
    <button className={`manager-desk__action manager-desk__action--${tone}`} onClick={onClick} type="button">
      <span className="manager-desk__action-icon">{icon}</span>
      <span className="manager-desk__action-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <ChevronRight aria-hidden="true" size={18} />
    </button>
  );
}

function FixtureCard({
  fixture,
  onNavigate,
  teamName,
}: {
  fixture: LeagueFixture | null;
  onNavigate: (href: string) => void;
  teamName: string;
}) {
  if (!fixture) {
    return (
      <Card className="manager-desk__fixture-card manager-desk__fixture-card--empty">
        <CalendarClock aria-hidden="true" size={22} />
        <div>
          <strong>Fixture details are not available yet</strong>
          <span>Open the league view when the next schedule is published.</span>
        </div>
        <Button onClick={() => onNavigate('/league/fixtures')} type="button" variant="secondary">
          View fixtures
          <ArrowRight aria-hidden="true" size={16} />
        </Button>
      </Card>
    );
  }

  const isHome = fixture.homeTeam.name === teamName || fixture.homeTeam.id === teamName;
  const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
  const ownTeam = isHome ? fixture.homeTeam : fixture.awayTeam;

  return (
    <Card className="manager-desk__fixture-card">
      <div className="manager-desk__fixture-meta">
        <span>{fixture.gameweek.name}</span>
        <span>{fixture.kickoffLabel}</span>
      </div>
      <div className="manager-desk__fixture-teams">
        <span className="manager-desk__fixture-team manager-desk__fixture-team--own">
          <span className="manager-desk__fixture-badge" aria-hidden="true">{getInitials(ownTeam.name)}</span>
          <strong>{ownTeam.name}</strong>
        </span>
        <span className="manager-desk__fixture-vs">vs</span>
        <span className="manager-desk__fixture-team">
          <span className="manager-desk__fixture-badge manager-desk__fixture-badge--muted" aria-hidden="true">{getInitials(opponent.name)}</span>
          <strong>{opponent.name}</strong>
        </span>
      </div>
      <Button onClick={() => onNavigate('/league/fixtures')} type="button" variant="ghost">
        Fixture details
        <ArrowRight aria-hidden="true" size={16} />
      </Button>
    </Card>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="manager-desk__quick-action" onClick={onClick} type="button">
      <span>{icon}</span>
      <strong>{label}</strong>
      <ArrowRight aria-hidden="true" size={16} />
    </button>
  );
}

function getFulfilled<T>(
  result: PromiseSettledResult<T>,
  label: string,
  errors: string[],
): T | null {
  if (result.status === 'fulfilled') return result.value;
  errors.push(label);
  return null;
}

function mapSquadGameweek(squad: SquadApiSummary | null): TeamSelectionSnapshot['gameweek'] | null {
  if (!squad) return null;
  return {
    id: squad.gameweek.id,
    name: squad.gameweek.name,
    number: squad.gameweek.number,
    deadlineAt: squad.gameweek.deadline_at ?? null,
  };
}

function getFlaggedPlayers(players: SquadApiPlayer[]): SquadApiPlayer[] {
  return players.filter(hasAvailabilityIssue);
}

function findTeamRow(league: LeagueSnapshot | null, teamId: string | undefined, teamName: string) {
  return league?.table.rows.find((row) => row.team.id === teamId || row.team.name === teamName) ?? null;
}

function findNextFixture(league: LeagueSnapshot | null, teamId: string | undefined, teamName: string): LeagueFixture | null {
  const fixtures = [...(league?.nextFixtures.fixtures ?? []), ...(league?.currentFixtures.fixtures ?? [])];
  return fixtures.find((fixture) => (
    fixture.homeTeam.id === teamId
      || fixture.awayTeam.id === teamId
      || fixture.homeTeam.name === teamName
      || fixture.awayTeam.name === teamName
  )) ?? fixtures[0] ?? null;
}

function getAttentionCount(
  lineupLocked: boolean,
  flaggedPlayers: SquadApiPlayer[],
  notifications: SquadApiNotification[],
): number {
  return (lineupLocked ? 0 : 1) + flaggedPlayers.length + notifications.length;
}

function formatPlayerNames(players: SquadApiPlayer[]): string {
  const names = players.slice(0, 2).map((player) => player.display_name);
  if (players.length > 2) return `${names.join(', ')} and ${players.length - 2} more`;
  return names.join(' and ');
}

function formatDeadline(deadlineAt: string | null): string {
  if (!deadlineAt) return 'Deadline to be confirmed';
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return 'Deadline to be confirmed';
  return `Deadline ${new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    weekday: 'short',
  }).format(deadline)}`;
}

function getInitials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';
}
