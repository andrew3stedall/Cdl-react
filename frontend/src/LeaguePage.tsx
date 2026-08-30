import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CircleAlert,
  Clock3,
  Info,
  RefreshCw,
  Shield,
  Table2,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { FixtureSquadComparison } from './components/fixture/FixtureSquadComparison';
import type { FixtureGameweekStatus } from './components/fixture/FixtureSquadComparison';
import { LeagueFixturesCarousel } from './components/league/LeagueFixturesCarousel';
import { fixtureParticipantName } from './components/league/LeagueFixture';
import { PlayerChartDetailDialog } from './components/player/PlayerChartDetailDialog';
import type { AttackDirection } from './contracts';
import {
  formDetailSections,
  formDetailSummary,
  mapHistoryFixture,
  PlayerProfilePage,
  type ProfileFixture,
} from './PlayerProfilePage';
import {
  HttpLeagueClient,
  type FixtureDetailResponse,
  type FixtureSquad,
  type FixtureSquadPlayer,
  type LeagueClient,
  type LeagueFixture,
  type LeagueSnapshot,
  type LeagueTableRow,
} from './league-api';
import {
  HttpSquadClient,
  type SquadApiHistoryResponse,
  type SquadApiNotification,
  type SquadApiPlayer,
  type SquadClient,
} from './squad-api';
import './league-page.css';

const defaultLeagueClient = new HttpLeagueClient();
const defaultSquadClient = new HttpSquadClient();

type LeagueView = 'fixtures' | 'table';
type GameweekState = 'not-started' | 'underway' | 'finished';

interface LeaguePageProps {
  attackDirection?: AttackDirection;
  currentPath?: string;
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
  squadClient?: Pick<SquadClient, 'getNotifications' | 'getPlayerHistory'>;
}

export function LeaguePage({ attackDirection = 'up', currentPath = window.location.pathname, leagueClient = defaultLeagueClient, onNavigate = () => undefined, squadClient = defaultSquadClient }: LeaguePageProps) {
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<LeagueView>(() => leagueViewFromPath(currentPath));
  const [notifications, setNotifications] = useState<SquadApiNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<LeagueFixture | null>(null);
  const [selectedFixturePlayer, setSelectedFixturePlayer] = useState<SelectedFixturePlayer | null>(null);
  const [fixtureDetail, setFixtureDetail] = useState<FixtureDetailResponse | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [fixtureSquads, setFixtureSquads] = useState<FixtureSquad[]>([]);
  const [fixturePlayerHistory, setFixturePlayerHistory] = useState<SquadApiHistoryResponse | null>(null);
  const [fixturePlayerDetailStatus, setFixturePlayerDetailStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setView(leagueViewFromPath(currentPath));
  }, [currentPath]);

  useEffect(() => {
    let isActive = true;

    async function loadLeagueData() {
      setStatus('loading');
      try {
        const leagueSnapshot = await leagueClient.getLeagueSnapshot();
        if (isActive) {
          setSnapshot(leagueSnapshot);
          setStatus('loaded');
        }
      } catch {
        if (isActive) setStatus('error');
      }
    }

    void loadLeagueData();

    return () => {
      isActive = false;
    };
  }, [leagueClient, reloadKey]);

  useEffect(() => {
    let isActive = true;
    void squadClient.getNotifications()
      .then((response) => {
        if (isActive) setNotifications(response.notifications);
      })
      .catch(() => {
        if (isActive) setNotifications([]);
      });
    return () => {
      isActive = false;
    };
  }, [squadClient, reloadKey]);

  useEffect(() => {
    if (!selectedFixturePlayer || selectedFixturePlayer.fixture.status === 'pending') {
      setFixturePlayerHistory(null);
      setFixturePlayerDetailStatus('idle');
      return;
    }

    let isActive = true;
    setFixturePlayerHistory(null);
    setFixturePlayerDetailStatus('loading');
    void squadClient.getPlayerHistory(selectedFixturePlayer.player.id)
      .then((history) => {
        if (isActive) {
          setFixturePlayerHistory(history);
          setFixturePlayerDetailStatus('loaded');
        }
      })
      .catch(() => {
        if (isActive) setFixturePlayerDetailStatus('error');
      });

    return () => {
      isActive = false;
    };
  }, [selectedFixturePlayer, squadClient]);

  useEffect(() => {
    if (!selectedFixture) {
      setFixtureDetail(null);
      setFixtureSquads([]);
      setDetailStatus('idle');
      return;
    }

    let isActive = true;
    setDetailStatus('loading');
    setFixtureSquads([]);

    const detailPromise = selectedFixture.status !== 'pending' && selectedFixture.detailAvailable && leagueClient.getFixtureDetail
      ? leagueClient.getFixtureDetail(selectedFixture.id)
      : Promise.resolve({ fixture: selectedFixture, events: [], notes: [] });
    const squadsPromise = leagueClient.getFixtureSquads
      ? leagueClient.getFixtureSquads(selectedFixture.id)
      : Promise.resolve([]);
    void Promise.all([detailPromise, squadsPromise])
      .then(([detail, squads]) => {
        if (isActive) {
          setFixtureDetail(detail);
          setFixtureSquads(squads);
          setDetailStatus('loaded');
        }
      })
      .catch(() => {
        if (isActive) setDetailStatus('error');
      });
    return () => {
      isActive = false;
    };
  }, [leagueClient, selectedFixture]);

  useEffect(() => {
    if (!selectedFixture) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedFixturePlayer) {
          setSelectedFixturePlayer(null);
        } else {
          closeFixture();
        }
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedFixture, selectedFixturePlayer]);

  useEffect(() => {
    if (selectedFixture) drawerRef.current?.focus();
  }, [selectedFixture]);

  return (
    <main aria-labelledby="league-title" className="league-page">
      <header className="league-page__hero">
        <div className="league-page__brand-lockup">
          <span aria-hidden="true" className="league-page__brand-mark"><Shield size={25} /></span>
          <div>
            <p className="league-page__brand-name">Castle Draft League</p>
            <h1 id="league-title">League</h1>
            <p className="league-page__context-name">{snapshot?.currentFixtures.gameweek?.name ?? 'Competition workspace'}</p>
          </div>
        </div>
        <div aria-label="League utilities" className="league-page__hero-icons">
          <div aria-label="League view" className="league-page__view-toggle" role="group">
            <button aria-label="View fixtures" aria-pressed={view === 'fixtures'} onClick={() => setView('fixtures')} title="Fixtures" type="button">
              <CalendarDays aria-hidden="true" size={18} />
              <span>Fixtures</span>
            </button>
            <button aria-label="View table" aria-pressed={view === 'table'} onClick={() => setView('table')} title="Table" type="button">
              <Table2 aria-hidden="true" size={18} />
              <span>Table</span>
            </button>
          </div>
          <div className="league-page__notifications">
            <button aria-expanded={notificationsOpen} aria-label={`Notifications${notifications.length ? `, ${notifications.length} unread` : ''}`} className="league-page__icon-button" onClick={() => setNotificationsOpen((open) => !open)} title="Notifications" type="button">
              <Bell aria-hidden="true" size={20} />
              {notifications.length ? <span className="league-page__notification-count">{notifications.length}</span> : null}
            </button>
            {notificationsOpen ? <NotificationPopover notifications={notifications} onNavigate={onNavigate} /> : null}
          </div>
        </div>
      </header>

      {status === 'loading' ? <LeagueLoadingState /> : null}
      {status === 'error' ? (
        <Card className="league-state-card league-state-card--error" role="alert">
          <CircleAlert aria-hidden="true" size={19} />
          <div>
            <strong>League data is unavailable</strong>
            <p>Try the request again. No standings or results have been inferred locally.</p>
          </div>
          <Button onClick={() => setReloadKey((key) => key + 1)} type="button" variant="secondary">
            <RefreshCw aria-hidden="true" size={16} />
            Try again
          </Button>
        </Card>
      ) : null}

      {snapshot ? (
        <LeagueContent
          onOpenFixture={openFixture}
          onReload={() => setReloadKey((key) => key + 1)}
          snapshot={snapshot}
          view={view}
        />
      ) : null}

      {selectedFixture ? (
        <FixtureDetailDrawer
          detail={fixtureDetail}
          detailStatus={detailStatus}
          fixture={selectedFixture}
          attackDirection={attackDirection}
          gameweekState={gameweekStateForFixture(selectedFixture, snapshot)}
          gameweekStatus={fixtureGameweekStatusForFixture(selectedFixture, snapshot)}
          squads={fixtureSquads}
          onClose={closeFixture}
          drawerRef={drawerRef}
          onPlayerClick={openFixturePlayer}
        />
      ) : null}

      {selectedFixturePlayer?.fixture.status === 'pending' ? (
        <FixturePlayerProfileLayer
          player={selectedFixturePlayer.player}
          fixture={selectedFixturePlayer.fixture}
          onClose={() => setSelectedFixturePlayer(null)}
          squadClient={squadClient}
        />
      ) : null}
      {selectedFixturePlayer && selectedFixturePlayer.fixture.status !== 'pending' ? (
        <FixturePlayerPointsLayer
          detailStatus={fixturePlayerDetailStatus}
          fixture={selectedFixturePlayer.fixture}
          history={fixturePlayerHistory}
          onClose={() => setSelectedFixturePlayer(null)}
          player={selectedFixturePlayer.player}
        />
      ) : null}
    </main>
  );

  function openFixture(fixture: LeagueFixture) {
    setSelectedFixturePlayer(null);
    setFixturePlayerHistory(null);
    setFixturePlayerDetailStatus('idle');
    setSelectedFixture(fixture);
  }

  function closeFixture() {
    setSelectedFixture(null);
    setSelectedFixturePlayer(null);
    setFixturePlayerHistory(null);
    setFixturePlayerDetailStatus('idle');
  }

  function openFixturePlayer(player: FixtureSquadPlayer) {
    if (!selectedFixture) return;
    setSelectedFixturePlayer({ fixture: selectedFixture, player });
  }
}

interface SelectedFixturePlayer {
  fixture: LeagueFixture;
  player: FixtureSquadPlayer;
}

function FixturePlayerProfileLayer({ fixture, onClose, player, squadClient }: { fixture: LeagueFixture; onClose: () => void; player: FixtureSquadPlayer; squadClient: Pick<SquadClient, 'getPlayerHistory'> }) {
  const profilePlayer = toProfilePlayer(player);
  return <div className="league-player-profile-layer"><button aria-label="Close player profile" className="league-player-profile-backdrop" onClick={onClose} type="button" /><aside aria-label={`Player profile for ${player.displayName}`} aria-modal="true" className="league-player-profile-drawer" role="dialog"><PlayerProfilePage key={`${fixture.id}-${player.id}`} initialPlayer={profilePlayer} initialSelection={null} onClose={onClose} playerId={player.id} presentation="drawer" showActions={false} squadClient={squadClient} /></aside></div>;
}

function FixturePlayerPointsLayer({ detailStatus, fixture, history, onClose, player }: { detailStatus: 'idle' | 'loading' | 'loaded' | 'error'; fixture: LeagueFixture; history: SquadApiHistoryResponse | null; onClose: () => void; player: FixtureSquadPlayer }) {
  const fixtureHistory = history ? fixturePlayerHistoryFixture(history, fixture.gameweek.number, player.position) : null;
  if (detailStatus === 'loaded' && fixtureHistory) {
    return <PlayerChartDetailDialog kind="form" onClose={onClose} sections={formDetailSections(fixtureHistory)} subtitle={`${player.displayName} · ${fixtureParticipantName(fixture.homeTeam)} vs ${fixtureParticipantName(fixture.awayTeam)}`} summary={formDetailSummary(fixtureHistory)} title={`${fixture.gameweek.name} · ${player.displayName}`} />;
  }

  const message = detailStatus === 'loading'
    ? 'Loading the player’s scoring returns…'
    : detailStatus === 'error'
      ? 'Player scoring detail is temporarily unavailable.'
      : 'No scoring returns are available for this player in this gameweek.';
  return <div className="player-chart-detail-layer" data-fixture-player-detail-state={detailStatus}><button aria-label="Close points breakdown" className="player-chart-detail-backdrop" onClick={onClose} type="button" /><section aria-labelledby="fixture-player-detail-title" aria-modal="true" className="player-chart-detail" role="dialog"><span aria-hidden="true" className="player-chart-detail__handle" /><header className="player-chart-detail__header"><div><p className="player-chart-detail__eyebrow">Fixture detail</p><h2 id="fixture-player-detail-title">{fixture.gameweek.name} · {player.displayName}</h2><p className="player-chart-detail__subtitle">{player.displayName} · {fixtureParticipantName(fixture.homeTeam)} vs {fixtureParticipantName(fixture.awayTeam)}</p></div><button aria-label="Close points breakdown" className="player-profile__icon-button" onClick={onClose} type="button"><X aria-hidden="true" size={19} /></button></header><p className="player-chart-detail__empty" role={detailStatus === 'loading' ? 'status' : 'alert'}>{message}</p></section></div>;
}

function fixturePlayerHistoryFixture(history: SquadApiHistoryResponse, gameweek: number, position: string): ProfileFixture | null {
  const rows = history.history.filter((row) => row.gameweek === gameweek);
  if (rows.length === 0) return null;
  if (rows.length === 1) return mapHistoryFixture(rows[0], position);

  const fixtures = rows.map((row) => mapHistoryFixture(row, position));
  const minutes = rows.reduce((total, row) => total + row.minutes, 0);
  const hasPlayed = rows.some((row) => row.minutes > 0);
  return {
    fixtureId: rows.map((row) => String(row.fixture_id)).join('-'),
    gameweek,
    position,
    opponentShortName: `${rows.length} fixtures`,
    isHome: false,
    fdr: null,
    fantasyPoints: hasPlayed ? rows.reduce((total, row) => total + row.total_points, 0) : null,
    minutesPlayed: hasPlayed ? minutes : null,
    stats: fixtures.reduce((total, current) => ({
      goals: total.goals + current.stats.goals,
      assists: total.assists + current.stats.assists,
      cleanSheets: total.cleanSheets + current.stats.cleanSheets,
      saves: total.saves + current.stats.saves,
      yellowCards: total.yellowCards + current.stats.yellowCards,
      redCards: total.redCards + current.stats.redCards,
      ownGoals: (total.ownGoals ?? 0) + (current.stats.ownGoals ?? 0),
      defensiveContributions: total.defensiveContributions + current.stats.defensiveContributions,
      bonusPoints: total.bonusPoints + current.stats.bonusPoints,
    }), {
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      saves: 0,
      yellowCards: 0,
      redCards: 0,
      ownGoals: 0,
      defensiveContributions: 0,
      bonusPoints: 0,
    }),
  };
}

function toProfilePlayer(player: FixtureSquadPlayer): SquadApiPlayer {
  const club = player.club ?? { id: `club-${player.id}`, name: 'Unknown club', shortName: 'UNK' };
  const nextFixture = player.nextOpponent ? {
    fixture_id: `next-${player.id}`,
    opponent: {
      id: player.nextOpponent.id,
      name: player.nextOpponent.name,
      short_name: player.nextOpponent.shortName ?? null,
    },
    difficulty: player.nextFixtureDifficulty ?? null,
    is_home: player.nextFixtureIsHome ?? false,
    kickoff_at: null,
  } : null;
  return {
    id: player.id,
    display_name: player.displayName,
    position: player.position,
    epl_team: { id: club.id, name: club.name, short_name: club.shortName ?? null },
    status: 'available',
    points: player.points,
    form: player.form,
    value: 0,
    next_fixture: nextFixture,
    next_fixtures: nextFixture ? [nextFixture] : [],
  };
}

function LeagueContent({
  onOpenFixture,
  onReload,
  snapshot,
  view,
}: {
  onOpenFixture: (fixture: LeagueFixture) => void;
  onReload: () => void;
  snapshot: LeagueSnapshot;
  view: LeagueView;
}) {
  return view === 'table'
    ? <TableView onReload={onReload} snapshot={snapshot} />
    : <LeagueFixturesCarousel onOpenFixture={onOpenFixture} snapshot={snapshot} />;
}

function TableView({ onReload, snapshot }: { onReload: () => void; snapshot: LeagueSnapshot }) {
  return (
    <div className="league-page__content">
      <Card className="league-panel">
        <div className="league-panel__header">
          <SectionHeading eyebrow="Current standings" id="league-table-title" title="League table" />
          <span className="league-source-badge"><Table2 aria-hidden="true" size={14} /> {tableSourceLabel(snapshot.table.source)}</span>
        </div>
        <p className="league-panel__description">Points are ordered by league points, then points difference and points scored. Position movement will appear once the snapshot includes a previous-table comparison.</p>
        <div aria-label="League standings table" className="league-table-scroll" role="region" tabIndex={0}>
          <table className="league-table">
            <thead>
              <tr><th scope="col">Pos</th><th scope="col">Team</th><th scope="col">P</th><th scope="col">W-D-L</th><th scope="col">For</th><th scope="col">Against</th><th scope="col">Diff</th><th scope="col">Pts</th></tr>
            </thead>
            <tbody>
              {snapshot.table.rows.map((row) => <TableRow key={row.team.id} row={row} />)}
            </tbody>
          </table>
        </div>
        {!snapshot.table.rows.length ? <EmptyState message="The league table is empty until results are available." /> : null}
      </Card>
      <Card className="league-info-card">
        <Info aria-hidden="true" size={18} />
        <div><strong>Standings source</strong><p>{snapshot.table.source === 'service-calculated' ? 'This view is calculated from the results currently returned by the league service.' : 'This view is backed by a persisted league-table snapshot.'}</p></div>
        <Button onClick={onReload} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={15} /> Refresh table</Button>
      </Card>
    </div>
  );
}

function TableRow({ row }: { row: LeagueTableRow }) {
  return <tr><th scope="row"><span className={`league-rank league-rank--${row.position <= 3 ? row.position : 'other'}`}>{row.position}</span></th><th scope="row" className="league-table__team">{row.team.name}</th><td>{row.played}</td><td>{row.wins}-{row.draws}-{row.losses}</td><td>{row.pointsFor}</td><td>{row.pointsAgainst}</td><td>{row.pointsDifference > 0 ? '+' : ''}{row.pointsDifference}</td><td><strong>{row.leaguePoints}</strong></td></tr>;
}

function FixtureDetailDrawer({ attackDirection, detail, detailStatus, drawerRef, fixture, gameweekState, gameweekStatus, onClose, onPlayerClick, squads }: { attackDirection: AttackDirection; detail: FixtureDetailResponse | null; detailStatus: 'idle' | 'loading' | 'loaded' | 'error'; drawerRef: RefObject<HTMLElement | null>; fixture: LeagueFixture; gameweekState: GameweekState; gameweekStatus: FixtureGameweekStatus; onClose: () => void; onPlayerClick: (player: FixtureSquadPlayer) => void; squads: FixtureSquad[] }) {
  const isPreview = fixture.status === 'pending';
  const drawerLabel = isPreview ? (gameweekState === 'underway' ? 'Fixture preview' : 'Upcoming fixture') : fixture.status === 'started' ? 'Live fixture' : 'Finished fixture';
  const hasComparisonSquads = squads.length === 2;
  return <><button aria-label="Close fixture detail" className="league-drawer-backdrop" onClick={onClose} type="button" /><aside ref={drawerRef} aria-labelledby="fixture-detail-title" aria-modal="true" className="league-drawer league-drawer--comparison" data-gameweek-state={gameweekState} role="dialog" tabIndex={-1}><header className="league-drawer__header"><div><p className="eyebrow">{drawerLabel}</p><h2 id="fixture-detail-title">{fixtureParticipantName(fixture.homeTeam)} vs {fixtureParticipantName(fixture.awayTeam)}</h2></div><Button aria-label="Close fixture detail" className="shell-icon-button" onClick={onClose} type="button" variant="ghost"><X aria-hidden="true" size={19} /></Button></header><div className="league-drawer__body"><div className="league-drawer__score"><span>{fixture.gameweek.name}</span><strong>{formatScore(fixture)}</strong><StatusBadge status={fixture.status} /></div>{gameweekState === 'underway' && isPreview ? <div className="league-drawer__context"><strong>Gameweek underway</strong><span>This fixture has not started yet. Review both squads before kick-off.</span></div> : null}{gameweekState === 'finished' && isPreview ? <div className="league-drawer__context"><strong>Gameweek finished</strong><span>This fixture did not produce a recorded result.</span></div> : null}{detailStatus === 'loading' ? <p role="status">{isPreview ? 'Loading squad comparison…' : 'Loading players and points…'}</p> : null}{detailStatus === 'error' ? <p className="league-inline-error" role="alert">Fixture detail is temporarily unavailable.</p> : null}{detailStatus === 'loaded' && hasComparisonSquads ? <FixtureSquadComparison attackDirection={attackDirection} gameweekStatus={gameweekStatus} onPlayerClick={onPlayerClick} playerInteraction={isPreview ? 'profile' : 'points'} squads={squads} /> : null}{detailStatus === 'loaded' && !isPreview && !hasComparisonSquads ? <div className="league-drawer__context"><strong>Players and points are unavailable</strong><span>The fixture result is available, but its locked gameweek lineup has not been published yet.</span></div> : null}{detailStatus === 'loaded' && !isPreview && detail ? <FixtureScoringSummary detail={detail} fixture={fixture} gameweekState={gameweekState} /> : null}</div></aside></>;
}

function FixtureScoringSummary({ detail, fixture, gameweekState }: { detail: FixtureDetailResponse; fixture: LeagueFixture; gameweekState: GameweekState }) {
  const isLive = fixture.status === 'started';
  const roundFinished = gameweekState === 'finished';
  return <><div className="league-drawer__context"><strong>{roundFinished ? 'Gameweek finished' : 'Gameweek underway'}</strong><span>{roundFinished ? 'The final score and recorded scoring events are shown below.' : isLive ? 'Scores and scoring events can still change before the round is complete.' : 'This fixture has finished, but other gameweek fixtures are still being played.'}</span></div><section><h3>{isLive ? 'Live scoring' : 'Final result'}</h3><p>{detail.notes[0] ?? (isLive ? 'Live scoring detail is available for this fixture.' : 'No additional notes were supplied for this fixture.')}</p></section><section><h3>Recorded events</h3>{detail.events.length ? <ul className="league-event-list">{detail.events.map((event, index) => <li key={`${event.label}-${event.team.id}-${index}`}><span><strong>{event.label}</strong><small>{fixtureParticipantName(event.team)}</small></span><strong>{event.points > 0 ? '+' : ''}{event.points}</strong></li>)}</ul> : <p>No scoring events were supplied.</p>}</section></>;
}


function SectionHeading({ action, eyebrow, id, title }: { action?: ReactNode; eyebrow: string; id?: string; title: string }) {
  return <header className="league-section-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div>{action ? <div>{action}</div> : null}</header>;
}

function NotificationPopover({ notifications, onNavigate }: { notifications: SquadApiNotification[]; onNavigate: (href: string) => void }) {
  return <div aria-label="Notifications" className="league-page__notifications-popover" role="dialog"><div className="league-page__notifications-heading"><strong>Notifications</strong><span>{notifications.length}</span></div>{notifications.length === 0 ? <p className="league-page__empty-copy">You are all caught up.</p> : notifications.map((notification) => <a href={notification.action_href} key={notification.id} className="league-page__notification" onClick={(event) => { event.preventDefault(); onNavigate(notification.action_href); }}><strong>{notification.title}</strong><span>{notification.message}</span></a>)}</div>;
}

function StatusBadge({ status }: { status: LeagueFixture['status'] }) {
  const label = status === 'complete' ? 'Complete' : status === 'started' ? 'Live' : 'Upcoming';
  return <span className={`league-status-badge league-status-badge--${status}`}><span aria-hidden="true" />{label}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="league-empty-state"><Clock3 aria-hidden="true" size={17} /><span>{message}</span></div>;
}

function LeagueLoadingState() {
  return <div aria-label="Loading league data" className="league-loading" role="status"><span /><span /><span /></div>;
}

function leagueViewFromPath(pathname: string): LeagueView {
  if (pathname === '/league/table') return 'table';
  return 'fixtures';
}

function getGameweekState(fixtures: LeagueFixture[]): GameweekState {
  if (!fixtures.some((fixture) => fixture.status !== 'pending')) return 'not-started';
  if (fixtures.every((fixture) => fixture.status === 'complete')) return 'finished';
  return 'underway';
}

function gameweekStateForFixture(fixture: LeagueFixture, snapshot: LeagueSnapshot | null): GameweekState {
  if (!snapshot) return fixture.status === 'complete' ? 'finished' : fixture.status === 'started' ? 'underway' : 'not-started';
  const fixtures = [...snapshot.allFixtures.fixtures, ...snapshot.currentFixtures.fixtures, ...snapshot.nextFixtures.fixtures]
    .filter((candidate, index, candidates) => candidates.findIndex((item) => item.id === candidate.id) === index)
    .filter((candidate) => candidate.gameweek.id === fixture.gameweek.id);
  return getGameweekState(fixtures.length ? fixtures : [fixture]);
}

function fixtureGameweekStatusForFixture(fixture: LeagueFixture, snapshot: LeagueSnapshot | null): FixtureGameweekStatus {
  const currentGameweekNumber = snapshot?.currentFixtures.gameweek?.number
    ?? snapshot?.currentFixtures.fixtures[0]?.gameweek.number
    ?? null;

  if (currentGameweekNumber !== null) {
    if (fixture.gameweek.number < currentGameweekNumber) return 'past';
    if (fixture.gameweek.number === currentGameweekNumber) return 'current';
    return 'future';
  }

  if (fixture.status === 'complete') return 'past';
  if (fixture.status === 'started') return 'current';
  return 'future';
}

function formatScore(fixture: LeagueFixture): string {
  if (fixture.score.homeScore === null || fixture.score.awayScore === null) return '— - —';
  return `${fixture.score.homeScore} - ${fixture.score.awayScore}`;
}

function tableSourceLabel(source: string): string {
  return source === 'service-calculated' ? 'Calculated snapshot' : 'Persisted snapshot';
}
