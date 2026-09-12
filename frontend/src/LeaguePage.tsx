import { type CSSProperties, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CircleAlert,
  Clock3,
  Info,
  RefreshCw,
  Table2,
  X,
} from 'lucide-react';
import type { EmblaCarouselType } from 'embla-carousel';
import useEmblaCarousel from 'embla-carousel-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { FIXTURE_REVIEW_VIEW_STORAGE_KEY, FixtureSquadComparison, FixtureSquadViewToggle, getStoredFixtureReviewView } from './components/fixture/FixtureSquadComparison';
import type { FixtureGameweekStatus, FixtureSquadView } from './components/fixture/FixtureSquadComparison';
import { managerNicknameForTeam } from './manager-nicknames';
import { PlayerChartDetailDialog } from './components/player/PlayerChartDetailDialog';
import { TeamCrest } from './components/team/TeamCrest';
import { PageHero } from './components/ui/page-hero';
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
  type LeagueTeam,
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
import { HttpTeamSelectionClient, type TeamSelectionClient } from './team-selection-api';
import './league-page.css';

const GAMEWEEK_HEIGHT_SCALE = 1.1;

const defaultLeagueClient = new HttpLeagueClient();
const defaultSquadClient = new HttpSquadClient();
const defaultTeamSelectionClient = new HttpTeamSelectionClient();

type LeagueView = 'fixtures' | 'table';
type GameweekState = 'not-started' | 'underway' | 'finished';

interface LeaguePageProps {
  attackDirection?: AttackDirection;
  currentPath?: string;
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
  squadClient?: Pick<SquadClient, 'getNotifications' | 'getPlayerHistory'>;
  teamSelectionClient?: Pick<TeamSelectionClient, 'getTeamSelection'>;
}

export function LeaguePage({ attackDirection = 'up', currentPath = window.location.pathname, leagueClient = defaultLeagueClient, onNavigate = () => undefined, squadClient = defaultSquadClient, teamSelectionClient = defaultTeamSelectionClient }: LeaguePageProps) {
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
  const [managerTeamId, setManagerTeamId] = useState<string | null>(null);
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
    let isActive = true;
    void teamSelectionClient.getTeamSelection()
      .then((selection) => {
        if (isActive) setManagerTeamId(selection.managerTeam.id);
      })
      .catch(() => {
        if (isActive) setManagerTeamId(null);
      });
    return () => {
      isActive = false;
    };
  }, [reloadKey, teamSelectionClient]);

  useEffect(() => {
    if (!selectedFixturePlayer || fixtureGameweekStatusForFixture(selectedFixturePlayer.fixture, snapshot) === 'future') {
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
  }, [selectedFixturePlayer, snapshot, squadClient]);

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

  const selectedFixturePlayerGameweekStatus = selectedFixturePlayer
    ? fixtureGameweekStatusForFixture(selectedFixturePlayer.fixture, snapshot)
    : null;

  return (
    <main aria-labelledby="league-title" className="league-page">
      <PageHero
        actions={(
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
        )}
        actionsLabel="League utilities"
        context={snapshot?.currentFixtures.gameweek?.name ?? 'Competition workspace'}
        title="League"
        titleId="league-title"
      />

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
          leagueClient={leagueClient}
          managerTeamId={managerTeamId}
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

      {selectedFixturePlayer && selectedFixturePlayerGameweekStatus === 'future' ? (
        <FixturePlayerProfileLayer
          player={selectedFixturePlayer.player}
          fixture={selectedFixturePlayer.fixture}
          onClose={() => setSelectedFixturePlayer(null)}
          squadClient={squadClient}
        />
      ) : null}
      {selectedFixturePlayer && selectedFixturePlayerGameweekStatus !== 'future' ? (
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
  leagueClient,
  managerTeamId,
  onOpenFixture,
  onReload,
  snapshot,
  view,
}: {
  leagueClient: LeagueClient;
  managerTeamId: string | null;
  onOpenFixture: (fixture: LeagueFixture) => void;
  onReload: () => void;
  snapshot: LeagueSnapshot;
  view: LeagueView;
}) {
  return view === 'table'
    ? <TableView onReload={onReload} snapshot={snapshot} />
    : <FixturesView leagueClient={leagueClient} managerTeamId={managerTeamId} onOpenFixture={onOpenFixture} snapshot={snapshot} />;
}

function FixturesView({ leagueClient, managerTeamId, onOpenFixture, snapshot }: { leagueClient: LeagueClient; managerTeamId: string | null; onOpenFixture: (fixture: LeagueFixture) => void; snapshot: LeagueSnapshot }) {
  const rounds = useMemo(() => groupFixturesByRound(snapshot), [snapshot]);
  const allFixtures = useMemo(() => fixturesFromSnapshot(snapshot), [snapshot]);
  if (rounds.length === 0) {
    return <section aria-label="League fixtures" className="league-gameweek-list"><EmptyState message="No league fixtures are available yet." /></section>;
  }

  return <section aria-label="League fixtures" className="league-fixtures-view"><RoundCarousel allFixtures={allFixtures} leagueClient={leagueClient} managerTeamId={managerTeamId} onOpenFixture={onOpenFixture} rounds={rounds} /></section>;
}

interface GameweekGroup {
  gameweek: LeagueFixture['gameweek'];
  fixtures: LeagueFixture[];
  id: string;
  isCurrent: boolean;
  isNext: boolean;
  state: GameweekState;
}

interface FixtureRoundGroup {
  gameweeks: GameweekGroup[];
  expectedGameweeks: number;
  isCurrent: boolean;
  key: string;
  label: string;
  subLabel: string;
}

function groupFixturesByRound(snapshot: LeagueSnapshot): FixtureRoundGroup[] {
  const allFixtures = fixturesFromSnapshot(snapshot);
  const currentGameweek = snapshot.currentFixtures.gameweek
    ?? snapshot.currentFixtures.fixtures[0]?.gameweek
    ?? allFixtures.find((fixture) => fixture.isCurrent)?.gameweek
    ?? null;
  const nextGameweek = snapshot.nextFixtures.gameweek
    ?? snapshot.nextFixtures.fixtures[0]?.gameweek
    ?? allFixtures.find((fixture) => fixture.isNext)?.gameweek
    ?? null;

  const roundMap = new Map<string, { descriptor: FixtureRoundDescriptor; gameweeks: Map<string, LeagueFixture[]> }>();
  for (const fixture of allFixtures) {
    const descriptor = fixtureRoundDescriptor(fixture);
    const round = roundMap.get(descriptor.key) ?? { descriptor, gameweeks: new Map<string, LeagueFixture[]>() };
    const gameweekMap = round.gameweeks;
    const fixtures = gameweekMap.get(fixture.gameweek.id) ?? [];
    fixtures.push(fixture);
    gameweekMap.set(fixture.gameweek.id, fixtures);
    roundMap.set(descriptor.key, round);
  }

  const rounds = Array.from(roundMap.values()).map(({ descriptor, gameweeks }) => {
    const mappedGameweeks = Array.from(gameweeks.entries()).map(([id, fixtures]) => {
      const gameweek = id === currentGameweek?.id
        ? currentGameweek
        : id === nextGameweek?.id
          ? nextGameweek
          : fixtures[0].gameweek;
      const hasCurrentMarker = fixtures.some((fixture) => fixture.isCurrent) || gameweek.id === currentGameweek?.id;
      const hasNextMarker = fixtures.some((fixture) => fixture.isNext) || gameweek.id === nextGameweek?.id;
      const resolvedFixtures = hasCurrentMarker && gameweek.id === currentGameweek?.id
        ? fixturesForGameweek(allFixtures, gameweek, snapshot.currentFixtures.fixtures)
        : hasNextMarker && gameweek.id === nextGameweek?.id
          ? fixturesForGameweek(allFixtures, gameweek, snapshot.nextFixtures.fixtures)
          : fixtures;
        return {
          gameweek,
          fixtures: sortFixtures(resolvedFixtures),
          id,
          isCurrent: hasCurrentMarker,
          isNext: hasNextMarker,
          state: getGameweekState(resolvedFixtures, gameweek, hasCurrentMarker),
        } satisfies GameweekGroup;
    }).sort((left, right) => left.gameweek.number - right.gameweek.number || left.gameweek.name.localeCompare(right.gameweek.name));
    return {
      gameweeks: mappedGameweeks,
      isCurrent: mappedGameweeks.some((gameweek) => gameweek.isCurrent && gameweek.state === 'underway'),
      expectedGameweeks: descriptor.expectedGameweeks,
      key: descriptor.key,
      label: descriptor.label,
      subLabel: descriptor.subLabel,
    } satisfies FixtureRoundGroup;
  });

  return rounds.sort((left, right) => firstGameweekNumber(left) - firstGameweekNumber(right) || left.label.localeCompare(right.label));
}

function fixturesFromSnapshot(snapshot: LeagueSnapshot): LeagueFixture[] {
  const fixturesById = new Map(snapshot.allFixtures.fixtures.map((fixture) => [fixture.id, fixture]));
  snapshot.currentFixtures.fixtures.forEach((fixture) => fixturesById.set(fixture.id, fixture));
  snapshot.nextFixtures.fixtures.forEach((fixture) => fixturesById.set(fixture.id, fixture));
  return [...fixturesById.values()];
}

interface FixtureRoundDescriptor {
  expectedGameweeks: number;
  key: string;
  label: string;
  subLabel: string;
}

function fixtureRoundDescriptor(fixture: LeagueFixture): FixtureRoundDescriptor {
  if (fixture.gameweek.number >= 1 && fixture.gameweek.number <= 35) {
    const roundNumber = Math.ceil(fixture.gameweek.number / 7);
    const start = (roundNumber - 1) * 7 + 1;
    const end = roundNumber * 7;
    return {
      expectedGameweeks: 7,
      key: `regular-season-round-${roundNumber}`,
      label: `Round ${roundNumber}`,
      subLabel: `Gameweeks ${start}–${end}`,
    };
  }
  const label = fixture.roundLabel || 'Competition stage';
  return {
    expectedGameweeks: 1,
    key: `stage-${roundKey(label)}`,
    label,
    subLabel: `Gameweek ${fixture.gameweek.number}`,
  };
}

function firstGameweekNumber(round: FixtureRoundGroup): number {
  return round.gameweeks[0]?.gameweek.number ?? Number.MAX_SAFE_INTEGER;
}

function roundKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'competition';
}

function fixturesForGameweek(
  allFixtures: LeagueFixture[],
  gameweek: LeagueFixture['gameweek'] | null,
  fallback: LeagueFixture[],
): LeagueFixture[] {
  const matchingFixtures = gameweek
    ? allFixtures.filter((fixture) => fixture.gameweek.id === gameweek.id)
    : [];
  return matchingFixtures.length ? matchingFixtures : uniqueFixtures(fallback);
}

function RoundCarousel({ allFixtures, leagueClient, managerTeamId, onOpenFixture, rounds }: { allFixtures: LeagueFixture[]; leagueClient: LeagueClient; managerTeamId: string | null; onOpenFixture: (fixture: LeagueFixture) => void; rounds: FixtureRoundGroup[] }) {
  const defaultSelection = useMemo(() => defaultCarouselSelection(rounds), [rounds]);
  const initialRoundIndex = defaultSelection.roundIndex;
  const initialGameweekIndex = defaultSelection.gameweekIndex;
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(initialRoundIndex);
  const [selectedGameweekIndex, setSelectedGameweekIndex] = useState(initialGameweekIndex);
  const roundOptions = useMemo(() => ({
    align: 'center' as const,
    containScroll: false as const,
    loop: false,
    startIndex: initialRoundIndex,
  }), [initialRoundIndex]);
  const [roundViewportRef, roundApi] = useEmblaCarousel(roundOptions);

  const handleRoundSelect = useCallback((api: EmblaCarouselType) => {
    setSelectedRoundIndex(api.selectedScrollSnap());
  }, []);

  const handleRoundNavigation = useCallback((roundIndex: number) => {
    roundApi?.scrollTo(roundIndex);
    setSelectedRoundIndex(roundIndex);
  }, [roundApi]);

  useScaleOpacityTween(roundApi, '.league-round-slide__content');

  useEffect(() => {
    if (!roundApi) return undefined;

    handleRoundSelect(roundApi);
    roundApi.on('select', handleRoundSelect);
    roundApi.on('reInit', handleRoundSelect);
    return () => {
      roundApi.off('select', handleRoundSelect);
      roundApi.off('reInit', handleRoundSelect);
    };
  }, [handleRoundSelect, roundApi]);

  useEffect(() => {
    if (!roundApi) return;
    const selectedRound = rounds[roundApi.selectedScrollSnap()];
    if (selectedRound?.key !== rounds[initialRoundIndex]?.key) {
      roundApi.scrollTo(initialRoundIndex, true);
    }
  }, [initialRoundIndex, roundApi, rounds]);

  useEffect(() => {
    const maximumIndex = Math.max(...rounds.map((round) => round.gameweeks.length), 1) - 1;
    setSelectedGameweekIndex((index) => Math.min(index, maximumIndex));
  }, [rounds]);

  useEffect(() => {
    setSelectedGameweekIndex(initialGameweekIndex);
  }, [initialGameweekIndex]);

  return (
    <section aria-label="Fixture rounds" aria-roledescription="carousel" className="league-round-carousel" role="region">
      <div aria-label="Fixture round slides" className="league-round-carousel__viewport" ref={roundViewportRef}>
        <div className="league-round-carousel__track">
          {rounds.map((round, roundIndex) => {
            const isSelected = roundIndex === selectedRoundIndex;
            const gameweekIndex = gameweekIndexForRound(round, selectedGameweekIndex);
            return (
              <div
                aria-current={isSelected ? 'true' : undefined}
                aria-hidden={!isSelected}
                aria-label={`${round.label} fixtures`}
                aria-roledescription="slide"
                className={`league-round-carousel__slide${isSelected ? ' is-selected' : ''}`}
                data-round-index={roundIndex}
                key={round.key}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('button, a, input, select, textarea')) return;
                  handleRoundNavigation(roundIndex);
                }}
                role="group"
              >
                <div className="league-round-slide__content">
                  <div aria-label={`${round.label} fixtures`} className="league-fixture-round" id={`league-round-panel-${round.key}`}>
                    <header className="league-fixture-round__header">
                      <div className="league-fixture-round__title">
                        {round.isCurrent ? <span aria-label="Active round" className="league-round-active-led" role="img" title="Active round" /> : null}
                        <h2>{round.label}</h2>
                      </div>
                    </header>
                    <GameweekCarousel
                    groups={round.gameweeks}
                    expectedGameweeks={round.expectedGameweeks}
                    allFixtures={allFixtures}
                    isActive={isSelected}
                    leagueClient={leagueClient}
                    managerTeamId={managerTeamId}
                    onIndexChange={(index) => {
                        if (isSelected) setSelectedGameweekIndex(index);
                      }}
                      onOpenFixture={onOpenFixture}
                      roundLabel={round.label}
                      selectedGameweekIndex={gameweekIndex}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <nav aria-label="Round navigation" className="league-round-carousel__dots">
        {rounds.map((round, roundIndex) => {
          const isSelected = roundIndex === selectedRoundIndex;
          return (
            <button
              aria-current={isSelected ? 'true' : undefined}
              aria-label={`Go to ${round.label}`}
              className={`league-round-carousel__dot${isSelected ? ' is-selected' : ''}`}
              data-round-index={roundIndex}
              key={round.key}
              onClick={() => handleRoundNavigation(roundIndex)}
              type="button"
            />
          );
        })}
      </nav>
    </section>
  );
}

interface CarouselSelection {
  gameweekIndex: number;
  roundIndex: number;
}

function defaultCarouselSelection(rounds: FixtureRoundGroup[]): CarouselSelection {
  const groups = rounds.flatMap((round, roundIndex) => round.gameweeks.map((gameweek, gameweekIndex) => ({ gameweek, gameweekIndex, roundIndex })));
  const active = groups
    .filter(({ gameweek }) => gameweek.isCurrent && gameweek.state === 'underway')
    .sort((left, right) => right.gameweek.gameweek.number - left.gameweek.gameweek.number)[0];
  const completed = groups
    .filter(({ gameweek }) => gameweek.state === 'finished')
    .sort((left, right) => right.gameweek.gameweek.number - left.gameweek.gameweek.number)[0];
  const fallback = groups
    .filter(({ gameweek }) => gameweek.isCurrent || gameweek.state === 'not-started')
    .sort((left, right) => left.gameweek.gameweek.number - right.gameweek.gameweek.number)[0]
    ?? groups[0];
  const selected = active ?? completed ?? fallback;
  return selected
    ? { gameweekIndex: selected.gameweekIndex, roundIndex: selected.roundIndex }
    : { gameweekIndex: 0, roundIndex: 0 };
}

function GameweekCarousel({ allFixtures, expectedGameweeks, groups, isActive, leagueClient, managerTeamId, onIndexChange, onOpenFixture, roundLabel, selectedGameweekIndex }: { allFixtures: LeagueFixture[]; expectedGameweeks: number; groups: GameweekGroup[]; isActive: boolean; leagueClient: LeagueClient; managerTeamId: string | null; onIndexChange: (index: number) => void; onOpenFixture: (fixture: LeagueFixture) => void; roundLabel: string; selectedGameweekIndex: number }) {
  const initialIndex = gameweekIndexForRound({ gameweeks: groups }, selectedGameweekIndex);
  // Embla reads startIndex only when it is created. Keeping that initial value
  // stable is important: updating it after every select causes a re-init that
  // can leave the visual transform and selected snap out of sync.
  const initialEmblaIndex = useRef(initialIndex).current;
  const gameweekOptions = useMemo(() => ({
    align: 'center' as const,
    axis: 'y' as const,
    containScroll: false as const,
    duration: 68,
    loop: false,
    startIndex: initialEmblaIndex,
  }), [initialEmblaIndex]);
  const [gameweekViewportRef, gameweekApi] = useEmblaCarousel(gameweekOptions);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const fixtureRows = Math.max(...groups.map((group) => group.fixtures.length), 1);
  const baseGameweekCardHeight = Math.max(11, 3.4 + fixtureRows * 4.95);
  const gameweekCardHeight = Math.round(baseGameweekCardHeight * GAMEWEEK_HEIGHT_SCALE * 100) / 100;
  const [measuredCardHeight, setMeasuredCardHeight] = useState<number | null>(null);
  const gameweekCarouselRef = useRef<HTMLElement | null>(null);
  const carouselStyle = {
    '--league-gameweek-carousel-height': measuredCardHeight ? `${measuredCardHeight}px` : `${gameweekCardHeight}rem`,
  } as CSSProperties;
  const indicatorCount = Math.max(expectedGameweeks, groups.length, 1);
  const selectedGroup = groups[selectedIndex];
  const selectedIndicatorIndex = selectedGroup ? gameweekIndicatorIndex(selectedGroup) : selectedIndex;

  const handleGameweekSelect = useCallback((api: EmblaCarouselType) => {
    const index = api.selectedScrollSnap();
    setSelectedIndex(index);
    if (isActive) onIndexChange(index);
  }, [isActive, onIndexChange]);

  useScaleOpacityTween(gameweekApi, '.league-gameweek-slide__content');

  useEffect(() => {
    if (!gameweekApi) return undefined;

    setSelectedIndex(gameweekApi.selectedScrollSnap());
    gameweekApi.on('select', handleGameweekSelect);
    gameweekApi.on('reInit', handleGameweekSelect);
    return () => {
      gameweekApi.off('select', handleGameweekSelect);
      gameweekApi.off('reInit', handleGameweekSelect);
    };
  }, [gameweekApi, handleGameweekSelect]);

  useEffect(() => {
    if (!gameweekApi) return;
    const nextIndex = gameweekIndexForRound({ gameweeks: groups }, selectedGameweekIndex);
    setSelectedIndex(nextIndex);
    if (gameweekApi.selectedScrollSnap() !== nextIndex) {
      // This is only for synchronizing a round change or reloaded fixture
      // data. User swipes and dot taps retain Embla's eased animation.
      gameweekApi.scrollTo(nextIndex, true);
    }
  }, [gameweekApi, groups.length, selectedGameweekIndex]);

  useLayoutEffect(() => {
    const carousel = gameweekCarouselRef.current;
    if (!carousel) return undefined;

    const measureCards = () => {
      const cards = Array.from(carousel.querySelectorAll<HTMLElement>('.league-gameweek-section'));
      const rootFontSize = Number.parseFloat(window.getComputedStyle(carousel).fontSize) || 16;
      const fallbackHeight = gameweekCardHeight * rootFontSize;
      const requiredHeight = Math.max(...cards.map((card) => {
        const styles = window.getComputedStyle(card);
        const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
        return card.scrollHeight - verticalPadding;
      }), fallbackHeight);

      setMeasuredCardHeight((currentHeight) => {
        if (requiredHeight <= fallbackHeight + 1) return currentHeight === null ? currentHeight : null;
        const nextHeight = Math.ceil(requiredHeight);
        return currentHeight === nextHeight ? currentHeight : nextHeight;
      });
    };

    measureCards();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measureCards);
    carousel.querySelectorAll<HTMLElement>('.league-gameweek-fixture-board, .league-fixture-list').forEach((list) => observer.observe(list));
    return () => observer.disconnect();
  }, [gameweekCardHeight, groups]);

  useEffect(() => {
    if (!gameweekApi || measuredCardHeight === null) return;
    const selectedSnap = gameweekApi.selectedScrollSnap();
    gameweekApi.reInit();
    if (gameweekApi.selectedScrollSnap() !== selectedSnap) gameweekApi.scrollTo(selectedSnap, true);
  }, [gameweekApi, measuredCardHeight]);

  if (groups.length === 0) return null;

  return (
    <section aria-label={`Gameweeks in ${roundLabel}`} className="league-gameweek-carousel" ref={gameweekCarouselRef} style={carouselStyle}>
      <div className="league-gameweek-carousel__header">
        <nav aria-label={`Gameweek navigation for ${roundLabel}`} className="league-gameweek-carousel__dots">
          {Array.from({ length: indicatorCount }, (_, indicatorIndex) => {
            const groupIndex = groups.findIndex((group) => gameweekIndicatorIndex(group) === indicatorIndex);
            const isSelected = indicatorIndex === selectedIndicatorIndex;
            return (
              <button
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`Go to ${gameweekNavigationLabel(groups, indicatorIndex)}`}
                className={`league-gameweek-carousel__dot${isSelected ? ' is-selected' : ''}`}
                data-gameweek-index={indicatorIndex}
                disabled={groupIndex < 0}
                key={`${roundLabel}-${indicatorIndex}`}
                onClick={() => {
                  if (groupIndex >= 0) gameweekApi?.scrollTo(groupIndex);
                }}
                type="button"
              />
            );
          })}
        </nav>
      </div>
      <div aria-label="Gameweek slides" className="league-gameweek-carousel__viewport" ref={gameweekViewportRef}>
        <div className="league-gameweek-carousel__track">
          {groups.map((group, index) => {
            const isSelected = index === selectedIndex;
            const sectionVariant = group.isCurrent
              ? 'focus'
              : group.state === 'finished'
                ? 'history'
                : 'upcoming';
            return (
              <div
                aria-current={isSelected ? 'true' : undefined}
                aria-label={group.gameweek.name}
                aria-roledescription="slide"
                className={`league-gameweek-carousel__slide${isSelected ? ' is-selected' : ''}`}
                data-gameweek-index={index}
                key={group.id}
                role="group"
              >
                <div className="league-gameweek-slide__content">
                  <GameweekSection
                    group={group}
                    allFixtures={allFixtures}
                    isSelected={isSelected}
                    leagueClient={leagueClient}
                    managerTeamId={managerTeamId}
                    onOpenFixture={onOpenFixture}
                    onSelectGameweek={() => gameweekApi?.scrollTo(index)}
                    variant={sectionVariant}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function gameweekIndicatorIndex(group: GameweekGroup): number {
  if (group.gameweek.number <= 35) return (group.gameweek.number - 1) % 7;
  return 0;
}

function gameweekNavigationLabel(groups: GameweekGroup[], indicatorIndex: number): string {
  const group = groups.find((candidate) => gameweekIndicatorIndex(candidate) === indicatorIndex);
  if (group) return group.gameweek.name;

  const firstGameweekNumber = groups[0]?.gameweek.number ?? 1;
  const roundStart = firstGameweekNumber <= 35
    ? Math.floor((firstGameweekNumber - 1) / 7) * 7 + 1
    : firstGameweekNumber;
  return `Gameweek ${roundStart + indicatorIndex}`;
}

function gameweekIndexForRound(round: Pick<FixtureRoundGroup, 'gameweeks'> | undefined, preferredIndex: number): number {
  if (!round || round.gameweeks.length === 0) return 0;
  return Math.min(Math.max(preferredIndex, 0), round.gameweeks.length - 1);
}

const ROUND_TWEEN_FACTOR_BASE = 0.14;
const ROUND_OPACITY_TWEEN_FACTOR_BASE = 0.45;
const ROUND_MIN_SCALE = 0.8;
const ROUND_MIN_OPACITY = 0.34;

function numberWithinRange(number: number, min: number, max: number): number {
  return Math.min(Math.max(number, min), max);
}

function useScaleOpacityTween(emblaApi: EmblaCarouselType | undefined, contentSelector: string): void {
  const scaleFactor = useRef(0);
  const opacityFactor = useRef(0);
  const tweenNodes = useRef<HTMLElement[]>([]);

  const setTweenNodes = useCallback((api: EmblaCarouselType): void => {
    tweenNodes.current = api.slideNodes().map((slideNode) => slideNode.querySelector(contentSelector) as HTMLElement);
  }, [contentSelector]);

  const setTweenFactors = useCallback((api: EmblaCarouselType): void => {
    scaleFactor.current = ROUND_TWEEN_FACTOR_BASE * api.scrollSnapList().length;
    opacityFactor.current = ROUND_OPACITY_TWEEN_FACTOR_BASE * api.scrollSnapList().length;
  }, []);

  const tweenScaleAndOpacity = useCallback((api: EmblaCarouselType): void => {
    const snapList = api.scrollSnapList();
    const scrollProgress = api.scrollProgress();

    tweenNodes.current.forEach((tweenNode, slideIndex) => {
      const scrollSnap = snapList[slideIndex];
      if (scrollSnap === undefined) return;
      const distanceFromFocus = Math.abs(scrollSnap - scrollProgress);
      const scale = numberWithinRange(1 - distanceFromFocus * scaleFactor.current, ROUND_MIN_SCALE, 1);
      const opacity = numberWithinRange(1 - distanceFromFocus * opacityFactor.current, ROUND_MIN_OPACITY, 1);
      tweenNode.style.transform = `scale(${scale})`;
      tweenNode.style.opacity = `${opacity}`;
    });
  }, []);

  useEffect(() => {
    if (!emblaApi) return undefined;

    setTweenNodes(emblaApi);
    setTweenFactors(emblaApi);
    tweenScaleAndOpacity(emblaApi);
    emblaApi.on('reInit', setTweenNodes);
    emblaApi.on('reInit', setTweenFactors);
    emblaApi.on('reInit', tweenScaleAndOpacity);
    emblaApi.on('scroll', tweenScaleAndOpacity);
    return () => {
      emblaApi.off('reInit', setTweenNodes);
      emblaApi.off('reInit', setTweenFactors);
      emblaApi.off('reInit', tweenScaleAndOpacity);
      emblaApi.off('scroll', tweenScaleAndOpacity);
    };
  }, [emblaApi, setTweenFactors, setTweenNodes, tweenScaleAndOpacity]);
}

function GameweekSection({ allFixtures, group, isSelected, leagueClient, managerTeamId, onOpenFixture, onSelectGameweek, variant }: { allFixtures: LeagueFixture[]; group: GameweekGroup; isSelected: boolean; leagueClient: LeagueClient; managerTeamId: string | null; onOpenFixture: (fixture: LeagueFixture) => void; onSelectGameweek: () => void; variant: 'focus' | 'upcoming' | 'history' }) {
  const [activeProgress, setActiveProgress] = useState<Record<string, ActiveFixtureProgress>>({});
  const positions = useMemo(() => standingsBeforeGameweek(allFixtures, group.gameweek.number), [allFixtures, group.gameweek.number]);
  const primaryFixture = useMemo(() => primaryFixtureForTeam(group.fixtures, managerTeamId), [group.fixtures, managerTeamId]);
  const otherFixtures = useMemo(() => group.fixtures.filter((fixture) => fixture.id !== primaryFixture?.id), [group.fixtures, primaryFixture?.id]);

  useEffect(() => {
    if (!isSelected || group.state !== 'underway' || !leagueClient.getFixtureSquads) {
      setActiveProgress({});
      return undefined;
    }

    let isActive = true;
    const loadProgress = async () => {
      const results = await Promise.allSettled(group.fixtures.filter((fixture) => fixture.status !== 'complete').map(async (fixture) => {
        const squads = await leagueClient.getFixtureSquads?.(fixture.id);
        return [fixture.id, squads ? activeProgressForFixture(fixture, squads) : null] as const;
      }));
      if (!isActive) return;
      const progress: Record<string, ActiveFixtureProgress> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value[1]) progress[result.value[0]] = result.value[1];
      });
      setActiveProgress(progress);
    };
    void loadProgress();
    return () => {
      isActive = false;
    };
  }, [group.fixtures, group.state, isSelected, leagueClient]);

  return (
    <section aria-labelledby={`league-gameweek-${variant}-${group.gameweek.id}`} className={`league-gameweek-section league-gameweek-section--${variant}`}>
      <header className="league-gameweek-section__header">
        <button aria-label={`Select ${group.gameweek.name}`} className="league-gameweek-section__heading" onClick={onSelectGameweek} type="button">
          <span aria-level={2} className="league-gameweek-section__title" id={`league-gameweek-${variant}-${group.gameweek.id}`} role="heading">{group.gameweek.name}</span>
        </button>
        <GameweekStateBadge gameweek={group.gameweek} state={group.state} />
      </header>
      <div className="league-gameweek-fixture-board">
        {primaryFixture ? <GameweekSpotlightFixture allFixtures={allFixtures} fixture={primaryFixture} group={group} onOpen={onOpenFixture} positions={positions} progress={activeProgress[primaryFixture.id]} /> : null}
        <div aria-label="Other fixtures" className="league-gameweek-other-fixtures">
          {otherFixtures.map((fixture) => <GameweekFixtureRow allFixtures={allFixtures} fixture={fixture} group={group} key={fixture.id} onOpen={onOpenFixture} positions={positions} progress={activeProgress[fixture.id]} />)}
        </div>
      </div>
    </section>
  );
}

interface ActiveFixtureProgress {
  away: TeamProgress;
  home: TeamProgress;
}

interface TeamProgress {
  yetToPlay: number | null;
}

function GameweekSpotlightFixture({ allFixtures, fixture, group, onOpen, positions, progress }: { allFixtures: LeagueFixture[]; fixture: LeagueFixture; group: GameweekGroup; onOpen: (fixture: LeagueFixture) => void; positions: Map<string, number>; progress?: ActiveFixtureProgress }) {
  const isUpcoming = group.state === 'not-started';
  return (
    <button aria-label={`${fixtureActionLabel(fixture)} for ${fixtureParticipantName(fixture.homeTeam)} versus ${fixtureParticipantName(fixture.awayTeam)}`} className={`league-fixture-row league-gameweek-fixture league-gameweek-fixture--spotlight league-gameweek-fixture--${group.state}`} onClick={() => onOpen(fixture)} type="button">
      {fixture.kickoffLabel ? <div className="league-gameweek-fixture__topline"><span>{fixture.kickoffLabel}</span></div> : null}
      <div className="league-gameweek-fixture__teams">
        <GameweekTeam team={fixture.homeTeam} align="home" chipNames={chipNamesForTeam(fixture, fixture.homeTeam, group.state)} position={positions.get(fixture.homeTeam.id)} progress={progress?.home} />
        <div className="league-gameweek-fixture__centre">
          {isUpcoming ? <FormComparison allFixtures={allFixtures} homeTeam={fixture.homeTeam} targetGameweek={group.gameweek.number} awayTeam={fixture.awayTeam} /> : <FixtureScoreDisplay fixture={fixture} />}
        </div>
        <GameweekTeam align="away" chipNames={chipNamesForTeam(fixture, fixture.awayTeam, group.state)} position={positions.get(fixture.awayTeam.id)} progress={progress?.away} team={fixture.awayTeam} />
      </div>
    </button>
  );
}

function GameweekFixtureRow({ allFixtures, fixture, group, onOpen, positions, progress }: { allFixtures: LeagueFixture[]; fixture: LeagueFixture; group: GameweekGroup; onOpen: (fixture: LeagueFixture) => void; positions: Map<string, number>; progress?: ActiveFixtureProgress }) {
  const isUpcoming = group.state === 'not-started';
  return (
    <button aria-label={`${fixtureActionLabel(fixture)} for ${fixtureParticipantName(fixture.homeTeam)} versus ${fixtureParticipantName(fixture.awayTeam)}`} className={`league-fixture-row league-gameweek-fixture-row league-gameweek-fixture-row--${group.state}`} onClick={() => onOpen(fixture)} type="button">
      <GameweekTeam team={fixture.homeTeam} align="home" chipNames={chipNamesForTeam(fixture, fixture.homeTeam, group.state)} position={positions.get(fixture.homeTeam.id)} progress={progress?.home} />
      <div className="league-gameweek-fixture-row__centre">
        {isUpcoming ? <FormRowSummary allFixtures={allFixtures} awayTeam={fixture.awayTeam} homeTeam={fixture.homeTeam} targetGameweek={group.gameweek.number} /> : <FixtureScoreDisplay fixture={fixture} compact />}
      </div>
      <GameweekTeam align="away" chipNames={chipNamesForTeam(fixture, fixture.awayTeam, group.state)} position={positions.get(fixture.awayTeam.id)} progress={progress?.away} team={fixture.awayTeam} />
    </button>
  );
}

function GameweekTeam({ align, chipNames, position, progress, team }: { align: 'away' | 'home'; chipNames: string[]; position?: number; progress?: TeamProgress; team: LeagueTeam }) {
  return (
    <div className={`league-gameweek-team league-gameweek-team--${align}`}>
      <span className="league-gameweek-team__position">#{position ?? '—'}</span>
      <TeamCrest className="league-gameweek-team__crest" team={team} />
      <strong>{fixtureParticipantName(team)}</strong>
      {progress ? <small className="league-gameweek-team__progress">{formatPlayersYetToPlay(progress.yetToPlay)}</small> : null}
      {chipNames.length > 0 ? <span className="league-gameweek-team__chips">{chipNames.join(' · ')}</span> : null}
    </div>
  );
}

function FixtureScoreDisplay({ compact = false, fixture }: { compact?: boolean; fixture: LeagueFixture }) {
  return <div className={`league-gameweek-score${compact ? ' league-gameweek-score--compact' : ''}`}><strong>{fixture.score.homeScore ?? '—'}</strong><span>–</span><strong>{fixture.score.awayScore ?? '—'}</strong></div>;
}

interface FormEntry {
  gameweek: number;
  key: string;
  points: number | null;
  result: 'W' | 'D' | 'L' | 'P';
}

function formGameweekNumbers(fixtures: LeagueFixture[], targetGameweek: number): Array<number | null> {
  const completedNumbers = Array.from(new Set(
    fixtures
      .filter((fixture) => fixture.status !== 'pending' && fixture.gameweek.number < targetGameweek)
      .map((fixture) => fixture.gameweek.number),
  )).sort((left, right) => left - right).slice(-5);
  return [...Array.from({ length: Math.max(0, 5 - completedNumbers.length) }, () => null), ...completedNumbers];
}

function formEntryForTeam(teamId: string, gameweek: number, fixtures: LeagueFixture[]): FormEntry | null {
  const fixture = fixtures.find((candidate) => candidate.gameweek.number === gameweek
    && candidate.status !== 'pending'
    && (candidate.homeTeam.id === teamId || candidate.awayTeam.id === teamId));
  if (!fixture) return null;
  return {
    gameweek,
    key: fixture.id,
    points: scoreForTeam(fixture, teamId),
    result: resultForFixture(fixture, teamId),
  };
}

function FormComparison({ allFixtures, awayTeam, homeTeam, targetGameweek }: { allFixtures: LeagueFixture[]; awayTeam: LeagueTeam; homeTeam: LeagueTeam; targetGameweek: number }) {
  const gameweeks = formGameweekNumbers(allFixtures, targetGameweek);
  return <div aria-label={`${fixtureParticipantName(homeTeam)} and ${fixtureParticipantName(awayTeam)} recent form`} className="league-form-comparison">{gameweeks.map((gameweek, index) => { const home = gameweek === null ? null : formEntryForTeam(homeTeam.id, gameweek, allFixtures); const away = gameweek === null ? null : formEntryForTeam(awayTeam.id, gameweek, allFixtures); return <div className="league-form-comparison__row" key={`${gameweek ?? 'empty'}-${index}`}><FormPointBlock entry={home} /><span>{gameweek === null ? '' : `GW${gameweek}`}</span><FormPointBlock entry={away} /></div>; })}</div>;
}

function FormStrip({ allFixtures, targetGameweek, team }: { allFixtures: LeagueFixture[]; targetGameweek: number; team: LeagueTeam }) {
  return <span aria-label={`${fixtureParticipantName(team)} recent form`} className="league-form-strip">{formGameweekNumbers(allFixtures, targetGameweek).map((gameweek, index) => <FormPointBlock entry={gameweek === null ? null : formEntryForTeam(team.id, gameweek, allFixtures)} key={`${gameweek ?? 'empty'}-${index}`} />)}</span>;
}

function FormRowSummary({ allFixtures, awayTeam, homeTeam, targetGameweek }: { allFixtures: LeagueFixture[]; awayTeam: LeagueTeam; homeTeam: LeagueTeam; targetGameweek: number }) {
  return <div aria-label={`${fixtureParticipantName(homeTeam)} and ${fixtureParticipantName(awayTeam)} recent form`} className="league-form-row-summary"><FormStrip allFixtures={allFixtures} targetGameweek={targetGameweek} team={homeTeam} /><span aria-hidden="true">vs</span><FormStrip allFixtures={allFixtures} targetGameweek={targetGameweek} team={awayTeam} /></div>;
}

function FormPointBlock({ entry }: { entry: FormEntry | null }) {
  return <span aria-label={entry ? `${entry.result}, ${entry.points ?? 'no'} points` : 'No result'} className={`league-form-point${entry ? ` league-form-point--${entry.result.toLowerCase()}` : ' league-form-point--empty'}`}>{entry?.points ?? ''}</span>;
}

function formatPlayersYetToPlay(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Players yet to play —';
  return `${value} player${value === 1 ? '' : 's'} yet to play`;
}

function primaryFixtureForTeam(fixtures: LeagueFixture[], managerTeamId: string | null): LeagueFixture | null {
  if (fixtures.length === 0) return null;
  return (managerTeamId
    ? fixtures.find((fixture) => fixture.homeTeam.id === managerTeamId || fixture.awayTeam.id === managerTeamId)
    : null)
    ?? fixtures.find((fixture) => [fixture.homeTeam, fixture.awayTeam].some((team) => team.managerName?.toLocaleLowerCase() === 'andrew'))
    ?? fixtures[0];
}

interface StandingAccumulator {
  team: LeagueTeam;
  leaguePoints: number;
  pointsFor: number;
  pointsAgainst: number;
}

function standingsBeforeGameweek(fixtures: LeagueFixture[], gameweekNumber: number): Map<string, number> {
  const standings = new Map<string, StandingAccumulator>();
  fixtures.forEach((fixture) => {
    [fixture.homeTeam, fixture.awayTeam].forEach((team) => {
      if (!standings.has(team.id)) standings.set(team.id, { team, leaguePoints: 0, pointsFor: 0, pointsAgainst: 0 });
    });
  });

  fixtures
    .filter((fixture) => fixture.status === 'complete' && fixture.gameweek.number < gameweekNumber && fixture.score.outcome !== 'pending')
    .sort((left, right) => left.gameweek.number - right.gameweek.number || left.id.localeCompare(right.id))
    .forEach((fixture) => {
      const home = standings.get(fixture.homeTeam.id);
      const away = standings.get(fixture.awayTeam.id);
      if (!home || !away) return;
      const homeScore = fixture.score.homeScore ?? 0;
      const awayScore = fixture.score.awayScore ?? 0;
      home.pointsFor += homeScore;
      home.pointsAgainst += awayScore;
      away.pointsFor += awayScore;
      away.pointsAgainst += homeScore;
      if (fixture.score.outcome === 'home_win') home.leaguePoints += 3;
      else if (fixture.score.outcome === 'away_win') away.leaguePoints += 3;
      else {
        home.leaguePoints += 1;
        away.leaguePoints += 1;
      }
    });

  const ordered = [...standings.values()].sort((left, right) => (
    right.leaguePoints - left.leaguePoints
    || (right.pointsFor - right.pointsAgainst) - (left.pointsFor - left.pointsAgainst)
    || right.pointsFor - left.pointsFor
  ));
  return new Map(ordered.map((standing, index) => [standing.team.id, index + 1]));
}

function chipNamesForTeam(fixture: LeagueFixture, team: LeagueTeam, state: GameweekState): string[] {
  if (state === 'not-started') return [];
  const targetName = team.name.trim().toLocaleLowerCase();
  const entry = Object.entries(fixture.score.chipsPlayed).find(([key]) => key === team.id || key === team.name || key.trim().toLocaleLowerCase() === targetName);
  return entry?.[1] ?? [];
}

function activeProgressForFixture(fixture: LeagueFixture, squads: FixtureSquad[]): ActiveFixtureProgress {
  const homeSquad = squads.find((squad) => squad.team.id === fixture.homeTeam.id);
  const awaySquad = squads.find((squad) => squad.team.id === fixture.awayTeam.id);
  return {
    home: teamProgressForSquad(homeSquad),
    away: teamProgressForSquad(awaySquad),
  };
}

function teamProgressForSquad(squad: FixtureSquad | undefined): TeamProgress {
  if (!squad) return { yetToPlay: null };
  const players = squad.starters.length > 0 ? squad.starters : squad.players;
  let yetToPlay = 0;
  let hasUnknownStart = false;
  players.forEach((player) => {
    const hasStarted = playerHasStartedFixture(player);
    if (hasStarted === null) hasUnknownStart = true;
    else if (!hasStarted) yetToPlay += 1;
  });
  return { yetToPlay: hasUnknownStart ? null : yetToPlay };
}

function playerHasStartedFixture(player: FixtureSquadPlayer): boolean | null {
  if (player.hasStartedFixture !== null && player.hasStartedFixture !== undefined) return player.hasStartedFixture;
  const kickoffs = (player.fixtureFixtures ?? [])
    .map((fixture) => fixture.kickoffAt ? Date.parse(fixture.kickoffAt) : Number.NaN)
    .filter((kickoff) => Number.isFinite(kickoff));
  if (kickoffs.length === 0) return null;
  return kickoffs.some((kickoff) => kickoff <= Date.now());
}

function fixtureActionLabel(fixture: LeagueFixture): string {
  return fixture.status === 'pending' ? 'Open preview' : fixture.status === 'started' ? 'Open live fixture' : 'Open finished fixture';
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
  const [view, setView] = useState<FixtureSquadView>(getStoredFixtureReviewView);

  useEffect(() => {
    try {
      window.localStorage.setItem(FIXTURE_REVIEW_VIEW_STORAGE_KEY, view);
    } catch {
      // The view preference is optional.
    }
  }, [view]);

  return (
    <>
      <button aria-label="Close fixture detail" className="league-drawer-backdrop" onClick={onClose} type="button" />
      <aside ref={drawerRef} aria-labelledby="fixture-detail-title" aria-modal="true" className="league-drawer league-drawer--comparison" data-gameweek-state={gameweekState} role="dialog" tabIndex={-1}>
        <header className="league-drawer__header league-drawer__header--comparison">
          <div className="league-drawer__heading">
            <p className="eyebrow">{drawerLabel}</p>
            <h2 id="fixture-detail-title">{fixtureParticipantName(fixture.homeTeam)} vs {fixtureParticipantName(fixture.awayTeam)}</h2>
            <div className="league-drawer__fixture-summary">
              <span>{fixture.gameweek.name}</span>
              <strong>{formatScore(fixture)}</strong>
              <StatusBadge status={fixture.status} />
            </div>
          </div>
          <div className="league-drawer__header-actions">
            <FixtureSquadViewToggle onViewChange={setView} view={view} />
            <Button aria-label="Close fixture detail" className="shell-icon-button" onClick={onClose} type="button" variant="ghost"><X aria-hidden="true" size={19} /></Button>
          </div>
        </header>
        <div className="league-drawer__body">
          {gameweekState === 'underway' && isPreview ? <div className="league-drawer__context"><strong>Gameweek underway</strong><span>This fixture has not started yet. Review both squads before kick-off.</span></div> : null}
          {gameweekState === 'finished' && isPreview ? <div className="league-drawer__context"><strong>Gameweek finished</strong><span>This fixture did not produce a recorded result.</span></div> : null}
          {detailStatus === 'loading' ? <p role="status">{isPreview ? 'Loading squad comparison…' : 'Loading players and points…'}</p> : null}
          {detailStatus === 'error' ? <p className="league-inline-error" role="alert">Fixture detail is temporarily unavailable.</p> : null}
          {detailStatus === 'loaded' && hasComparisonSquads ? <FixtureSquadComparison attackDirection={attackDirection} gameweekStatus={gameweekStatus} onPlayerClick={onPlayerClick} onViewChange={setView} playerInteraction={gameweekStatus === 'future' ? 'profile' : 'points'} showViewToggle={false} squads={squads} view={view} /> : null}
          {detailStatus === 'loaded' && !isPreview && !hasComparisonSquads ? <div className="league-drawer__context"><strong>Players and points are unavailable</strong><span>The fixture result is available, but its locked gameweek lineup has not been published yet.</span></div> : null}
          {detailStatus === 'loaded' && !isPreview && detail ? <FixtureScoringSummary detail={detail} fixture={fixture} gameweekState={gameweekState} /> : null}
        </div>
      </aside>
    </>
  );
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

function getGameweekState(fixtures: LeagueFixture[], gameweek?: LeagueFixture['gameweek'] | null, isCurrent = false): GameweekState {
  if (fixtures.length > 0 && fixtures.every((fixture) => fixture.status === 'complete')) return 'finished';
  if (fixtures.some((fixture) => fixture.status !== 'pending')) return 'underway';
  if (isCurrent && deadlinePassed(gameweek?.deadlineAt)) return 'underway';
  return 'not-started';
}

function gameweekStateForFixture(fixture: LeagueFixture, snapshot: LeagueSnapshot | null): GameweekState {
  if (!snapshot) return fixture.status === 'complete' ? 'finished' : fixture.status === 'started' ? 'underway' : 'not-started';
  const fixtures = fixturesFromSnapshot(snapshot)
    .filter((candidate) => candidate.gameweek.id === fixture.gameweek.id);
  return getGameweekState(fixtures.length ? fixtures : [fixture], fixture.gameweek, fixture.isCurrent || fixture.gameweek.id === snapshot.currentFixtures.gameweek?.id);
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

function GameweekStateBadge({ gameweek, state }: { gameweek: LeagueFixture['gameweek']; state: GameweekState }) {
  const deadlineLabel = formatDeadline(gameweek.deadlineAt);
  return <time aria-label={`Deadline ${deadlineLabel}`} className={`league-gameweek-state league-gameweek-state--${state}`} dateTime={gameweek.deadlineAt ?? undefined}><span aria-hidden="true" />{deadlineLabel}</time>;
}

function formatScore(fixture: LeagueFixture): string {
  if (fixture.score.homeScore === null || fixture.score.awayScore === null) return '— - —';
  return `${fixture.score.homeScore} - ${fixture.score.awayScore}`;
}

function scoreForTeam(fixture: LeagueFixture, teamId: string): number | null {
  return fixture.homeTeam.id === teamId ? fixture.score.homeScore : fixture.awayTeam.id === teamId ? fixture.score.awayScore : null;
}

function resultForFixture(fixture: LeagueFixture, teamId: string): 'W' | 'D' | 'L' | 'P' {
  if (fixture.status === 'pending' || fixture.score.outcome === 'pending') return 'P';
  if (fixture.score.outcome === 'draw') return 'D';
  const home = fixture.homeTeam.id === teamId;
  return fixture.score.outcome === (home ? 'home_win' : 'away_win') ? 'W' : 'L';
}

function formatDeadline(deadlineAt?: string | null): string {
  if (!deadlineAt) return 'Deadline pending';
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

function deadlinePassed(deadlineAt?: string | null): boolean {
  if (!deadlineAt) return false;
  const timestamp = Date.parse(deadlineAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function uniqueFixtures(fixtures: LeagueFixture[]): LeagueFixture[] {
  return fixtures.filter((fixture, index) => fixtures.findIndex((candidate) => candidate.id === fixture.id) === index);
}

function sortFixtures(fixtures: LeagueFixture[]): LeagueFixture[] {
  return [...fixtures].sort((left, right) => left.id.localeCompare(right.id));
}

function tableSourceLabel(source: string): string {
  return source === 'service-calculated' ? 'Calculated snapshot' : 'Persisted snapshot';
}

function fixtureParticipantName(team: LeagueFixture['homeTeam']): string {
  return managerNicknameForTeam(team);
}
