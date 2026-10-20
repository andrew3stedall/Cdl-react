Warning: truncated output (original token count: 21673)
Total output lines: 1676

import { type CSSProperties, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
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
import { LeagueManagementIcon } from './components/league/LeagueManagementIcon';
import { HeadToHeadView, KnockoutView } from './LeagueCompetitionViews';
import { managerNicknameForTeam } from './manager-nicknames';
import { invalidateData, subscribeDataFreshness } from './data-freshness';
import { invalidateQueryCache } from './query-cache';
import { PlayerChartDetailDialog } from './components/player/PlayerChartDetailDialog';
import { TeamCrest } from './components/team/TeamCrest';
import { LeagueTeamShowcase } from './components/team/LeagueTeamShowcase';
import { PageHero, PageHeroControls, PageHeroViewToggle } from './components/ui/page-hero';
import { useModalLifecycle } from './components/ui/sheet';
import type { AttackDirection } from './contracts';
import type { SessionState } from './contracts';
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
  type LeagueManagementInvite,
  type LeagueManagementTeam,
  type LeagueTeam,
  type LeagueSnapshot,
  type LeagueSnapshotView,
  type LeagueTableRow,
} from './league-api';
import {
  HttpSquadClient,
  type SquadApiHistoryResponse,
  type SquadApiPlayer,
  type SquadClient,
} from './squad-api';
import { HttpTeamSelectionClient, type TeamSelectionClient } from './team-selection-api';
import './league-page.css';

const GAMEWEEK_HEIGHT_SCALE = 1.1;

const defaultLeagueClient = new HttpLeagueClient();
const defaultSquadClient = new HttpSquadClient();
const defaultTeamSelectionClient = new HttpTeamSelectionClient();

type LeagueView = 'fixtures' | 'table' | 'teams' | 'manage' | 'knockout' | 'head-to-head';
type GameweekState = 'not-started' | 'underway' | 'finished';

interface LeaguePageProps {
  attackDirection?: AttackDirection;
  currentPath?: string;
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
  session?: SessionState;
  squadClient?: Pick<SquadClient, 'getNotifications' | 'getPlayerHistory'>;
  teamSelectionClient?: Pick<TeamSelectionClient, 'getTeamSelection'>;
}

export function LeaguePage({ attackDirection = 'up', currentPath = window.location.pathname, leagueClient = defaultLeagueClient, onNavigate, session, squadClient = defaultSquadClient, teamSelectionClient = defaultTeamSelectionClient }: LeaguePageProps) {
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const loadedSnapshotViewRef = useRef<LeagueSnapshotView | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<LeagueView>(() => leagueViewFromPath(currentPath));
  const [selectedFixture, setSelectedFixture] = useState<LeagueFixture | null>(null);
  const [selectedFixturePlayer, setSelectedFixturePlayer] = useState<SelectedFixturePlayer | null>(null);
  const [fixtureDetail, setFixtureDetail] = useState<FixtureDetailResponse | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [detailRetryKey, setDetailRetryKey] = useState(0);
  const [squadReadError, setSquadReadError] = useState(false);
  const [detailReadError, setDetailReadError] = useState(false);
  const [fixtureSquads, setFixtureSquads] = useState<FixtureSquad[]>([]);
  const [fixturePlayerHistory, setFixturePlayerHistory] = useState<SquadApiHistoryResponse | null>(null);
  const [fixturePlayerDetailStatus, setFixturePlayerDetailStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [managerTeamId, setManagerTeamId] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setView(leagueViewFromPath(currentPath));
  }, [currentPath]);

  useEffect(() => subscribeDataFreshness('league', ['league', 'squad', 'lineup', 'trade', 'global'], () => {
    setReloadKey((current) => current + 1);
  }), []);

  useEffect(() => {
    let isActive = true;

    if (view === 'manage') {
      setSnapshot(null);
      setStatus('loaded');
      return () => { isActive = false; };
    }

    const snapshotView: LeagueSnapshotView = view === 'table' || view === 'teams' || view === 'knockout' || view === 'head-to-head' ? (view === 'teams' ? 'table' : view) : 'fixtures';
    const hasCachedView = loadedSnapshotViewRef.current === snapshotView;
    if (!hasCachedView) setStatus('loading');

    async function loadLeagueData() {
      try {
        const leagueSnapshot = await leagueClient.getLeagueSnapshot(snapshotView);
        if (isActive) {
          setSnapshot(leagueSnapshot);
          loadedSnapshotViewRef.current = snapshotView;
          setStatus('loaded');
        }
      } catch {
        if (isActive && !hasCachedView) setStatus('error');
      }
    }

    void loadLeagueData();

    return () => {
      isActive = false;
    };
  }, [leagueClient, reloadKey, view]);

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
    setSquadReadError(false);
    setDetailReadError(false);

    const detailPromise = selectedFixture.status !== 'pending' && selectedFixture.detailAvailable && leagueClient.getFixtureDetail
      ? leagueClient.getFixtureDetail(selectedFixture.id)
      : Promise.resolve({ fixture: selectedFixture, events: [], notes: [] });
    const squadsPromise = leagueClient.getFixtureSquads
      ? leagueClient.getFixtureSquads(selectedFixture.id)
      : Promise.resolve([]);
    void Promise.allSettled([detailPromise, squadsPromise])
      .then(([detailResult, squadsResult]) => {
        if (!isActive) return;
        if (detailResult.status === 'fulfilled') setFixtureDetail(detailResult.value);
        else setDetailReadError(true);
        if (squadsResult.status === 'fulfilled') setFixtureSquads(squadsResult.value);
        else setSquadReadError(true);
        setDetailStatus(detailResult.status === 'rejected' && squadsResult.status === 'rejected' ? 'error' : 'loaded');
      });
    return () => {
      isActive = false;
    };
  }, [detailRetryKey, leagueClient, selectedFixture]);

  const selectedFixturePlayerGameweekStatus = selectedFixturePlayer
    ? fixtureGameweekStatusForFixture(selectedFixturePlayer.fixture, snapshot)
    : null;
  const isCommissioner = Boolean(
    session?.user?.roles.some((role) => role === 'commissioner' || role === 'admin'),
  );

  return (
    <main aria-labelledby="league-title" className="league-page">
      <PageHero
        actions={(
          <PageHeroControls>
            <Button aria-label="Open analytics" onClick={() => onNavigate('/analytics')} type="button" variant="secondary"><ChartNoAxesCombined aria-hidden="true" size={16} />Analytics</Button>
            <PageHeroViewToggle
              ariaLabel="League view"
              onChange={(nextView) => {
                const next = nextView as LeagueView;
                setView(next);
                onNavigate(next === 'fixtures' ? '/league' : `/league/${next}`);
              }}
              options={[
                { ariaLabel: 'View fixtures', value: 'fixtures', label: 'Fixtures', icon: <CalendarDays aria-hidden="true" size={18} /> },
                { ariaLabel: 'View table', value: 'table', label: 'Table', icon: <Table2 aria-hidden="true" size={18} /> },
                ...(isCommissioner
                  ? [{ ariaLabel: 'View commissioner management', value: 'manage', label: 'Manage', icon: <LeagueManagementIcon size={18} /> }]
                  : []),
              ]}
              value={view === 'knockout' || view === 'head-to-head' || view === 'teams' ? 'table' : view}
            />
          </PageHeroControls>
        )}
        actionsLabel="League utilities"
        onNavigate={onNavigate}
        title="League"
        titleId="league-title"
      />

      <nav aria-label="League workspaces" className="league-workspace-shortcuts">
        <Button onClick={() => onNavigate('/league/draft')} type="button" variant="secondary">Live draft</Button>
      </nav>

      {view === 'table' || view === 'teams' || view === 'knockout' || view === 'head-to-head' ? <nav aria-label="League competitions" className="league-competition-tabs">{([
        ['table', 'Table'],
        ['teams', 'Teams'],
        ['knockout', 'Knockouts'],
        ['head-to-head', 'Head-to-head'],
      ] as Array<[LeagueView, string]>).map(([destination, label]) => <Button aria-current={view === destination ? 'page' : undefined} key={destination} onClick={() => { setView(destination); onNavigate(destination === 'table' ? '/league/table' : `/league/${destination}`); }} type="button" variant={view === destination ? 'secondary' : 'ghost'}>{label}</Button>)}</nav> : null}

      {status === 'loading' ? <LeagueLoadingState /> : null}
      {status === 'error' ? (
        <Card className="league-state-card league-state-card--error" role="alert">
          <CircleAlert aria-hidden="true" size={19} />
          <div>
            <strong>League data is unavailable</strong>
            <p>Try the request again. No standings or results have been inferred locally.</p>
          </div>
          <Button onClick={() => { invalidateQueryCache(); setReloadKey((key) => key + 1); }} type="button" variant="secondary">
            <RefreshCw aria-hidden="true" size={16} />
            Try again
          </Button>
        </Card>
      ) : null}

      {view === 'manage' && isCommissioner ? <CommissionerManagementView leagueClient={leagueClient} /> : null}
      {snapshot && view !== 'manage' ? (
        <LeagueContent
          leagueClient={leagueClient}
          managerTeamId={managerTeamId}
          onOpenFixture={openFixture}
          onReload={() => { invalidateQueryCache(); setReloadKey((key) => key + 1); }}
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
          squadReadError={squadReadError}
          detailReadError={detailReadError}
          onClose={() => { if (selectedFixturePlayer) setSelectedFixturePlayer(null); else closeFixture(); }}
          isOpen={!selectedFixturePlayer}
          onRetry={() => setDetailRetryKey((key) => key + 1)}
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
    form_history: player.formHistory ?? [],
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
  if (view === 'table') return <TableView onReload={onReload} snapshot={snapshot} />;
  if (view === 'teams') return <LeagueTeamShowcase rows={snapshot.table.rows} />;
  if (view === 'knockout') return snapshot.failedReads?.includes('knockout') ? <LeagueDataError label="Knockout fixtures" onReload={onReload} /> : <KnockoutView knockout={snapshot.knockout} onOpenFixture={onOpenFixture} />;
  if (view === 'head-to-head') return snapshot.failedReads?.includes('head-to-head') ? <LeagueDataError label="Head-to-head records" onReload={onReload} /> : <HeadToHeadView records={snapshot.headToHead.records} />;
  return <><LeagueReadWarning failedReads={snapshot.failedReads ?? []} onReload={onReload} /><FixturesView leagueClient={leagueClient} managerTeamId={managerTeamId} onOpenFixture={onOpenFixture} snapshot={snapshot} /></>;
}

function LeagueDataError({ label, onReload }: { label: string; onReload: () => void }) {
  return <Card className="league-state-card league-state-card--error" role="alert"><CircleAlert aria-hidden="true" size={18} /><div><strong>{label} unavailable</strong></div><Button onClick={onReload} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={16} />Retry</Button></Card>;
}

function LeagueReadWarning({ failedReads, onReload }: { failedReads: string[]; onReload: () => void }) {
  if (!failedReads.length) return null;
  return <Card className="league-state-card league-state-card--error" role="alert"><CircleAlert aria-hidden="true" size={18} /><div><strong>Some fixture data is unavailable</strong><p>{failedReads.join(', ')} could not load.</p></div><Button onClick={onReload} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={16} />Retry</Button></Card>;
}

function CommissionerManagementView({ leagueClient }: { leagueClient: LeagueClient }) {
  const [management, setManagement] = useState<{ leagueName: string; availableTeamCount: number; teams: LeagueManagementTeam[] } | null>(null);
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'idle' | 'creating' | 'created' | 'error'>>({});
  const [copyStatus, setCopyStatus] = useState<Record<string, 'idle' | 'copied' | 'error'>>({});
  const [pendingInvites, setPendingInvites] = useState<LeagueManagementInvite[]>([]);
  const [pendingInviteStatus, setPendingInviteStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [pendingInviteRefresh, setPendingInviteRefresh] = useState(0);
  const [pendingInviteAction, setPendingInviteAction] = useState<string | null>(null);
  const [pendingInviteNotice, setPendingInviteNotice] = useState('');

  useEffect(() => subscribeDataFreshness('league', ['league'], () => {
    setPendingInviteRefresh((current) => current + 1);
  }), []);

  useEffect(() => {
    if (!leagueClient.getLeagueManagementInvites) {
      setPendingInviteStatus('unavailable');
      return undefined;
    }
    let active = true;
    setPendingInviteStatus('loading');
    void leagueClient.getLeagueManagementInvites()
      .then((result) => {
        if (active) {
          setPendingInvites(result);
          setPendingInviteStatus('ready');
        }
      })
      .catch(() => {
        if (active) setPendingInviteStatus('error');
      });
    return () => { active = false; };
  }, [leagueClient, pendingInviteRefresh]);

  useEffect(() => {
    if (!leagueClient.getLeagueManagement) {
      setManagement({ leagueName: 'CDL', availableTeamCount: 0, teams: [] });
      setStatus('ready');
      return;
    }
    let active = true;
    setStatus('loading');
    void leagueClient.getLeagueManagement()
      .then((result) => {
        if (active) {
          setManagement({ ...result, teams: re…9673 tokens truncated…on">#{position ?? '—'}</span>
      <TeamCrest className="league-gameweek-team__crest" team={team} />
      <strong>{fixtureParticipantName(team)}</strong>
      {progress ? <small className="league-gameweek-team__progress">{formatPlayersYetToPlay(progress.yetToPlay)}</small> : null}
      {chipNames.length > 0 ? <span className="league-gameweek-team__chips">{chipNames.join(' · ')}</span> : null}
    </div>
  );
}

function FixtureScoreDisplay({ compact = false, fixture }: { compact?: boolean; fixture: LeagueFixture }) {
  const homeResult = resultForFixture(fixture, fixture.homeTeam.id);
  const awayResult = resultForFixture(fixture, fixture.awayTeam.id);
  return <div className={`league-gameweek-score${compact ? ' league-gameweek-score--compact' : ''}`}><strong className={scoreResultClass(homeResult)}>{fixture.score.homeScore ?? '—'}</strong><span>–</span><strong className={scoreResultClass(awayResult)}>{fixture.score.awayScore ?? '—'}</strong></div>;
}

function scoreResultClass(result: 'W' | 'D' | 'L' | 'P'): string {
  return result === 'P' ? '' : `league-gameweek-score__value--${result.toLowerCase()}`;
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
  if (snapshot.failedReads?.includes('table')) {
    return <Card className="league-state-card league-state-card--error" role="alert"><CircleAlert aria-hidden="true" size={18} /><div><strong>Standings are unavailable</strong><p>Fixture and commissioner data can still load independently.</p></div><Button onClick={onReload} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={16} />Retry table</Button></Card>;
  }
  return (
    <div className="league-page__content">
      <Card className="league-panel">
        <div className="league-panel__header">
          <SectionHeading eyebrow="Current standings" id="league-table-title" title="League table" />
          <div className="league-panel__actions"><span className="league-source-badge"><Table2 aria-hidden="true" size={14} /> {tableSourceLabel(snapshot.table.source)}</span><Button onClick={onReload} type="button" variant="secondary"><RefreshCw aria-hidden="true" size={15} /> Refresh</Button></div>
        </div>
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
    </div>
  );
}

function TableRow({ row }: { row: LeagueTableRow }) {
  return <tr><th scope="row"><span className={`league-rank league-rank--${row.position <= 3 ? row.position : 'other'}`}>{row.position}</span></th><th scope="row" className="league-table__team">{row.team.name}</th><td>{row.played}</td><td>{row.wins}-{row.draws}-{row.losses}</td><td>{row.pointsFor}</td><td>{row.pointsAgainst}</td><td>{row.pointsDifference > 0 ? '+' : ''}{row.pointsDifference}</td><td><strong>{row.leaguePoints}</strong></td></tr>;
}

function FixtureDetailDrawer({ attackDirection, detail, detailStatus, detailReadError, drawerRef, fixture, gameweekState, gameweekStatus, isOpen, onClose, onPlayerClick, onRetry, squadReadError, squads }: { attackDirection: AttackDirection; detail: FixtureDetailResponse | null; detailStatus: 'idle' | 'loading' | 'loaded' | 'error'; detailReadError: boolean; drawerRef: RefObject<HTMLElement | null>; fixture: LeagueFixture; gameweekState: GameweekState; gameweekStatus: FixtureGameweekStatus; isOpen: boolean; onClose: () => void; onPlayerClick: (player: FixtureSquadPlayer) => void; onRetry: () => void; squadReadError: boolean; squads: FixtureSquad[] }) {
  useModalLifecycle(drawerRef, isOpen, onClose);
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
          {detailStatus === 'error' ? <p className="league-inline-error" role="alert">Fixture data is temporarily unavailable. <Button onClick={onRetry} type="button" variant="secondary">Retry</Button></p> : null}
          {detailReadError && detailStatus === 'loaded' ? <p className="league-inline-error" role="alert">Score detail is unavailable. <Button onClick={onRetry} type="button" variant="secondary">Retry</Button></p> : null}
          {squadReadError && detailStatus === 'loaded' ? <p className="league-inline-error" role="alert">Lineups are unavailable. <Button onClick={onRetry} type="button" variant="secondary">Retry</Button></p> : null}
          {detailStatus === 'loaded' && hasComparisonSquads ? <FixtureSquadComparison attackDirection={attackDirection} gameweekStatus={gameweekStatus} onPlayerClick={onPlayerClick} onViewChange={setView} playerInteraction={gameweekStatus === 'future' ? 'profile' : 'points'} showViewToggle={false} squads={squads} view={view} /> : null}
          {detailStatus === 'loaded' && isPreview && !hasComparisonSquads && !squadReadError ? <div className="league-drawer__context"><strong>{squads.length === 1 ? 'One lineup is available' : 'Lineups unavailable'}</strong><span>{squads.length === 1 ? 'The other manager’s lineup has not been published yet.' : 'Lineups will appear when managers publish them.'}</span></div> : null}
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

function StatusBadge({ status }: { status: LeagueFixture['status'] }) {
  const label = status === 'complete' ? 'Complete' : status === 'started' ? 'Live' : 'Upcoming';
  return <span className={`league-status-badge league-status-badge--${status}`}><span aria-hidden="true" />{label}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="league-empty-state"><Clock3 aria-hidden="true" size={17} /><span>{message}</span></div>;
}

function LeagueLoadingState() {
  return (
    <div aria-label="Loading league data" className="league-loading" role="status">
      <section aria-hidden="true" className="league-loading__round">
        <header className="league-loading__round-header">
          <span className="league-loading__line league-loading__line--round" />
          <span className="league-loading__dots"><i /><i /><i /></span>
        </header>
        <div className="league-loading__gameweek">
          <div className="league-loading__gameweek-header">
            <span className="league-loading__line league-loading__line--gameweek" />
            <span className="league-loading__badge" />
          </div>
          <div className="league-loading__spotlight">
            <span className="league-loading__crest" />
            <span className="league-loading__score" />
            <span className="league-loading__crest league-loading__crest--away" />
          </div>
          <div className="league-loading__fixture-rows"><span /><span /><span /></div>
        </div>
      </section>
      <span className="league-loading__round-dot" />
    </div>
  );
}

function leagueViewFromPath(pathname: string): LeagueView {
  if (pathname === '/league/table') return 'table';
  if (pathname === '/league/teams') return 'teams';
  if (pathname === '/league/manage') return 'manage';
  if (pathname === '/league/knockout') return 'knockout';
  if (pathname === '/league/head-to-head') return 'head-to-head';
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

function formatInviteDate(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 'date unavailable';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(created);
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
