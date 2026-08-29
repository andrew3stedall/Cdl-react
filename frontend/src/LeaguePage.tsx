import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
import type { AttackDirection } from './contracts';
import {
  HttpLeagueClient,
  type FixtureDetailResponse,
  type FixtureSquad,
  type LeagueClient,
  type LeagueFixture,
  type LeagueSnapshot,
  type LeagueTableRow,
} from './league-api';
import { HttpSquadClient, type SquadApiNotification, type SquadClient } from './squad-api';
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
  squadClient?: Pick<SquadClient, 'getNotifications'>;
}

export function LeaguePage({ attackDirection = 'up', currentPath = window.location.pathname, leagueClient = defaultLeagueClient, onNavigate = () => undefined, squadClient = defaultSquadClient }: LeaguePageProps) {
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<LeagueView>(() => leagueViewFromPath(currentPath));
  const [notifications, setNotifications] = useState<SquadApiNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<LeagueFixture | null>(null);
  const [fixtureDetail, setFixtureDetail] = useState<FixtureDetailResponse | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [fixtureSquads, setFixtureSquads] = useState<FixtureSquad[]>([]);
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
      if (event.key === 'Escape') setSelectedFixture(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedFixture]);

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
          onOpenFixture={setSelectedFixture}
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
          onClose={() => setSelectedFixture(null)}
          drawerRef={drawerRef}
        />
      ) : null}
    </main>
  );
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
    : <FixturesView onOpenFixture={onOpenFixture} snapshot={snapshot} />;
}

function FixturesView({ onOpenFixture, snapshot }: { onOpenFixture: (fixture: LeagueFixture) => void; snapshot: LeagueSnapshot }) {
  const rounds = useMemo(() => groupFixturesByRound(snapshot), [snapshot]);
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | null>(null);
  const [selectedGameweekId, setSelectedGameweekId] = useState<string | null>(null);

  const currentRound = rounds.find((round) => round.isCurrent) ?? rounds[0] ?? null;
  const selectedRound = rounds.find((round) => round.key === selectedRoundKey) ?? currentRound;

  useEffect(() => {
    if (!selectedRound || selectedRound.key === selectedRoundKey) return;
    setSelectedRoundKey(selectedRound.key);
  }, [selectedRound, selectedRoundKey]);

  useEffect(() => {
    setSelectedGameweekId(defaultGameweekForRound(selectedRound)?.id ?? null);
  }, [selectedRound?.key]);

  if (!selectedRound) {
    return <section aria-label="League fixtures" className="league-gameweek-list"><EmptyState message="No league fixtures are available yet." /></section>;
  }

  const activeGameweek = selectedRound.gameweeks.find((group) => group.id === selectedGameweekId)
    ?? defaultGameweekForRound(selectedRound);
  const selectedRoundIndex = rounds.findIndex((round) => round.key === selectedRound.key);
  const sectionVariant = activeGameweek?.isCurrent
    ? 'focus'
    : activeGameweek?.state === 'finished'
      ? 'history'
      : 'upcoming';

  return (
    <section aria-label="League fixtures" className="league-fixtures-view">
      <RoundCarousel
        rounds={rounds}
        selectedRoundKey={selectedRound.key}
        onNext={() => setSelectedRoundKey(rounds[selectedRoundIndex + 1]?.key ?? selectedRound.key)}
        onPrevious={() => setSelectedRoundKey(rounds[selectedRoundIndex - 1]?.key ?? selectedRound.key)}
        onSelect={setSelectedRoundKey}
      />

      <div aria-label={`${selectedRound.label} fixtures`} className="league-fixture-round" id={`league-round-panel-${selectedRound.key}`}>
        <div className="league-fixture-round__summary">
          <span>{selectedRound.subLabel} · {selectedRound.gameweeks.length} of {selectedRound.expectedGameweeks} available</span>
          {activeGameweek ? <span>{activeGameweek.gameweek.name}</span> : null}
        </div>

        <GameweekCarousel
          groups={selectedRound.gameweeks}
          selectedGameweekId={activeGameweek?.id ?? null}
          onSelect={setSelectedGameweekId}
        />

        {activeGameweek ? <GameweekSection group={activeGameweek} label={primaryGameweekLabel(activeGameweek)} onOpenFixture={onOpenFixture} variant={sectionVariant} /> : null}
      </div>
    </section>
  );
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
  const allFixtures = uniqueFixtures([
    ...snapshot.allFixtures.fixtures,
    ...snapshot.currentFixtures.fixtures,
    ...snapshot.nextFixtures.fixtures,
  ]);
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
        state: getGameweekState(resolvedFixtures),
      } satisfies GameweekGroup;
    }).sort((left, right) => left.gameweek.number - right.gameweek.number || left.gameweek.name.localeCompare(right.gameweek.name));
    return {
      gameweeks: mappedGameweeks,
      isCurrent: mappedGameweeks.some((gameweek) => gameweek.isCurrent),
      expectedGameweeks: descriptor.expectedGameweeks,
      key: descriptor.key,
      label: descriptor.label,
      subLabel: descriptor.subLabel,
    } satisfies FixtureRoundGroup;
  });

  return rounds.sort((left, right) => firstGameweekNumber(left) - firstGameweekNumber(right) || left.label.localeCompare(right.label));
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

function defaultGameweekForRound(round: FixtureRoundGroup): GameweekGroup | null {
  return round.gameweeks.find((gameweek) => gameweek.isCurrent)
    ?? round.gameweeks.find((gameweek) => gameweek.isNext)
    ?? round.gameweeks.find((gameweek) => gameweek.state === 'not-started')
    ?? round.gameweeks[round.gameweeks.length - 1]
    ?? null;
}

function primaryGameweekLabel(group: GameweekGroup): string {
  if (group.isCurrent && group.state === 'underway') return 'Live now';
  if (group.isCurrent) return 'Current gameweek';
  if (group.isNext) return 'Up next';
  if (group.state === 'finished') return 'Latest result';
  return 'Round focus';
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

function RoundCarousel({ rounds, selectedRoundKey, onNext, onPrevious, onSelect }: { rounds: FixtureRoundGroup[]; selectedRoundKey: string; onNext: () => void; onPrevious: () => void; onSelect: (key: string) => void }) {
  const selectedIndex = rounds.findIndex((round) => round.key === selectedRoundKey);
  return <section aria-label="Fixture rounds" aria-roledescription="carousel" className="league-round-picker" role="region">
    <div className="league-round-picker__header">
      <div><p className="eyebrow">Fixture rounds</p><h2>{rounds[selectedIndex]?.label ?? 'Fixture rounds'}</h2></div>
      <span>{selectedIndex + 1} of {rounds.length}</span>
    </div>
    <div className="league-round-picker__carousel">
      <button aria-label="Previous round" className="league-round-picker__control" disabled={selectedIndex <= 0} onClick={onPrevious} type="button"><ChevronLeft aria-hidden="true" size={17} /></button>
      <div aria-label="Rounds" className="league-round-picker__track">
        {rounds.map((round) => <button aria-current={round.key === selectedRoundKey ? 'true' : undefined} className={`league-round-picker__card${round.key === selectedRoundKey ? ' is-selected' : ''}${round.isCurrent ? ' is-current' : ''}`} key={round.key} onClick={() => onSelect(round.key)} type="button"><span className="league-round-picker__card-label">{round.isCurrent ? `Live · ${round.label}` : round.label}</span><strong>{round.subLabel}</strong><small>{round.gameweeks.length}/{round.expectedGameweeks} gameweeks</small></button>)}
      </div>
      <button aria-label="Next round" className="league-round-picker__control" disabled={selectedIndex < 0 || selectedIndex >= rounds.length - 1} onClick={onNext} type="button"><ChevronRight aria-hidden="true" size={17} /></button>
    </div>
  </section>;
}

function GameweekCarousel({ groups, selectedGameweekId, onSelect }: { groups: GameweekGroup[]; selectedGameweekId: string | null; onSelect: (id: string) => void }) {
  return <section aria-label="Gameweeks in selected round" className="league-gameweek-picker"><div className="league-gameweek-picker__header"><p className="eyebrow">Gameweeks</p><span>Choose one round at a time</span></div><div aria-label="Gameweeks" className="league-gameweek-picker__track">{groups.map((group) => <button aria-current={group.id === selectedGameweekId ? 'true' : undefined} className={`league-gameweek-picker__item league-gameweek-picker__item--${group.state}${group.id === selectedGameweekId ? ' is-selected' : ''}`} key={group.id} onClick={() => onSelect(group.id)} type="button"><strong>GW {group.gameweek.number}</strong><small>{gameweekPickerLabel(group)}</small></button>)}</div></section>;
}

function gameweekPickerLabel(group: GameweekGroup): string {
  if (group.isCurrent) return 'Live';
  if (group.isNext) return 'Next';
  if (group.state === 'finished') return 'Final';
  return 'Upcoming';
}

function GameweekSection({ group, label, onOpenFixture, variant }: { group: GameweekGroup; label: string; onOpenFixture: (fixture: LeagueFixture) => void; variant: 'focus' | 'upcoming' | 'history' }) {
  return (
    <section aria-labelledby={`league-gameweek-${variant}-${group.gameweek.id}`} className={`league-gameweek-section league-gameweek-section--${variant}`}>
      <header className="league-gameweek-section__header">
        <div>
          <p className="eyebrow">{label}</p>
          <h2 id={`league-gameweek-${variant}-${group.gameweek.id}`}>{group.gameweek.name}</h2>
        </div>
        <GameweekStateBadge gameweek={group.gameweek} state={group.state} />
      </header>
      <div className="league-fixture-list">
        {group.fixtures.map((fixture) => <FixtureListRow compact={variant !== 'focus'} fixture={fixture} key={fixture.id} onOpen={onOpenFixture} />)}
      </div>
    </section>
  );
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

function FixtureListRow({ compact = false, fixture, onOpen }: { compact?: boolean; fixture: LeagueFixture; onOpen: (fixture: LeagueFixture) => void }) {
  const action = fixture.status === 'pending' ? 'Open preview' : fixture.status === 'started' ? 'Open live fixture' : 'Open finished fixture';
  return (
    <button aria-label={`${action} for ${fixtureParticipantName(fixture.homeTeam)} versus ${fixtureParticipantName(fixture.awayTeam)}`} className={`league-fixture-row${compact ? ' league-fixture-row--compact' : ''}`} onClick={() => onOpen(fixture)} type="button">
      <FixtureTeams fixture={fixture} compact />
      <ChevronRight aria-hidden="true" className="league-fixture-row__arrow" size={17} />
    </button>
  );
}

function FixtureTeams({ compact = false, fixture }: { compact?: boolean; fixture: LeagueFixture }) {
  return (
    <div className={`league-fixture-teams${compact ? ' league-fixture-teams--compact' : ''}`}>
      <div className="league-team-line"><span className="league-team-mark">{teamInitials(fixture.homeTeam)}</span><strong>{fixtureParticipantName(fixture.homeTeam)}</strong></div>
      <div className="league-score"><strong>{fixture.score.homeScore ?? '—'}</strong><span>{' - '}</span><strong>{fixture.score.awayScore ?? '—'}</strong></div>
      <div className="league-team-line league-team-line--away"><strong>{fixtureParticipantName(fixture.awayTeam)}</strong><span className="league-team-mark">{teamInitials(fixture.awayTeam)}</span></div>
    </div>
  );
}

function TableRow({ row }: { row: LeagueTableRow }) {
  return <tr><th scope="row"><span className={`league-rank league-rank--${row.position <= 3 ? row.position : 'other'}`}>{row.position}</span></th><th scope="row" className="league-table__team">{row.team.name}</th><td>{row.played}</td><td>{row.wins}-{row.draws}-{row.losses}</td><td>{row.pointsFor}</td><td>{row.pointsAgainst}</td><td>{row.pointsDifference > 0 ? '+' : ''}{row.pointsDifference}</td><td><strong>{row.leaguePoints}</strong></td></tr>;
}

function FixtureDetailDrawer({ attackDirection, detail, detailStatus, drawerRef, fixture, gameweekState, gameweekStatus, onClose, squads }: { attackDirection: AttackDirection; detail: FixtureDetailResponse | null; detailStatus: 'idle' | 'loading' | 'loaded' | 'error'; drawerRef: RefObject<HTMLElement | null>; fixture: LeagueFixture; gameweekState: GameweekState; gameweekStatus: FixtureGameweekStatus; onClose: () => void; squads: FixtureSquad[] }) {
  const isPreview = fixture.status === 'pending';
  const drawerLabel = isPreview ? (gameweekState === 'underway' ? 'Fixture preview' : 'Upcoming fixture') : fixture.status === 'started' ? 'Live fixture' : 'Finished fixture';
  const hasComparisonSquads = squads.length === 2;
  return <><button aria-label="Close fixture detail" className="league-drawer-backdrop" onClick={onClose} type="button" /><aside ref={drawerRef} aria-labelledby="fixture-detail-title" aria-modal="true" className="league-drawer league-drawer--comparison" data-gameweek-state={gameweekState} role="dialog" tabIndex={-1}><header className="league-drawer__header"><div><p className="eyebrow">{drawerLabel}</p><h2 id="fixture-detail-title">{fixtureParticipantName(fixture.homeTeam)} vs {fixtureParticipantName(fixture.awayTeam)}</h2></div><Button aria-label="Close fixture detail" className="shell-icon-button" onClick={onClose} type="button" variant="ghost"><X aria-hidden="true" size={19} /></Button></header><div className="league-drawer__body"><div className="league-drawer__score"><span>{fixture.gameweek.name}</span><strong>{formatScore(fixture)}</strong><StatusBadge status={fixture.status} /></div>{gameweekState === 'underway' && isPreview ? <div className="league-drawer__context"><strong>Gameweek underway</strong><span>This fixture has not started yet. Review both squads before kick-off.</span></div> : null}{gameweekState === 'finished' && isPreview ? <div className="league-drawer__context"><strong>Gameweek finished</strong><span>This fixture did not produce a recorded result.</span></div> : null}{detailStatus === 'loading' ? <p role="status">{isPreview ? 'Loading squad comparison…' : 'Loading players and points…'}</p> : null}{detailStatus === 'error' ? <p className="league-inline-error" role="alert">Fixture detail is temporarily unavailable.</p> : null}{detailStatus === 'loaded' && hasComparisonSquads ? <FixtureSquadComparison attackDirection={attackDirection} gameweekStatus={gameweekStatus} squads={squads} /> : null}{detailStatus === 'loaded' && !isPreview && !hasComparisonSquads ? <div className="league-drawer__context"><strong>Players and points are unavailable</strong><span>The fixture result is available, but its locked gameweek lineup has not been published yet.</span></div> : null}{detailStatus === 'loaded' && !isPreview && detail ? <FixtureScoringSummary detail={detail} fixture={fixture} gameweekState={gameweekState} /> : null}</div></aside></>;
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

function GameweekStateBadge({ gameweek, state }: { gameweek: LeagueFixture['gameweek']; state: GameweekState }) {
  if (state === 'not-started') {
    return <time className="league-gameweek-state league-gameweek-state--not-started" dateTime={gameweek.deadlineAt ?? undefined}><span aria-hidden="true" />{formatDeadline(gameweek.deadlineAt)}</time>;
  }

  const label = state === 'finished' ? 'Finalised' : 'Live';
  return <span className={`league-gameweek-state league-gameweek-state--${state}`}><span aria-hidden="true" />{label}</span>;
}

function formatScore(fixture: LeagueFixture): string {
  if (fixture.score.homeScore === null || fixture.score.awayScore === null) return '— - —';
  return `${fixture.score.homeScore} - ${fixture.score.awayScore}`;
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

function uniqueFixtures(fixtures: LeagueFixture[]): LeagueFixture[] {
  return fixtures.filter((fixture, index) => fixtures.findIndex((candidate) => candidate.id === fixture.id) === index);
}

function sortFixtures(fixtures: LeagueFixture[]): LeagueFixture[] {
  return [...fixtures].sort((left, right) => left.id.localeCompare(right.id));
}

function tableSourceLabel(source: string): string {
  return source === 'service-calculated' ? 'Calculated snapshot' : 'Persisted snapshot';
}

function teamInitials(team: LeagueFixture['homeTeam']): string {
  return fixtureParticipantName(team).slice(0, 3).toUpperCase();
}

function fixtureParticipantName(team: LeagueFixture['homeTeam']): string {
  return team.managerName ?? team.name;
}
