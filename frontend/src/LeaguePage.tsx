import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  Info,
  Medal,
  RefreshCw,
  Swords,
  Table2,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Select } from './components/ui/select';
import type { AttackDirection } from './contracts';
import { FormDots, formBand, shortPlayerName, TeamShirt } from './SquadPage';
import {
  HttpLeagueClient,
  type FixtureDetailResponse,
  type FixtureSquad,
  type LeagueClient,
  type LeagueFixture,
  type LeagueSnapshot,
  type LeagueTableRow,
} from './league-api';
import './league-page.css';

const defaultLeagueClient = new HttpLeagueClient();

type LeagueView = 'overview' | 'fixtures' | 'table' | 'knockout' | 'head-to-head';
type FixtureFilter = 'all' | 'current' | 'complete' | 'pending';

interface LeaguePageProps {
  attackDirection?: AttackDirection;
  currentPath?: string;
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
}

export function LeaguePage({ attackDirection = 'up', currentPath = window.location.pathname, leagueClient = defaultLeagueClient, onNavigate = () => undefined }: LeaguePageProps) {
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedFixture, setSelectedFixture] = useState<LeagueFixture | null>(null);
  const [fixtureDetail, setFixtureDetail] = useState<FixtureDetailResponse | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [fixtureSquads, setFixtureSquads] = useState<FixtureSquad[]>([]);
  const drawerRef = useRef<HTMLElement | null>(null);
  const view = leagueViewFromPath(currentPath);

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
    if (!selectedFixture) {
      setFixtureDetail(null);
      setFixtureSquads([]);
      setDetailStatus('idle');
      return;
    }

    let isActive = true;
    setDetailStatus('loading');
    setFixtureSquads([]);

    const detailPromise = selectedFixture.status !== 'pending' && leagueClient.getFixtureDetail
      ? leagueClient.getFixtureDetail(selectedFixture.id)
      : Promise.resolve({ fixture: selectedFixture, events: [], notes: [] });
    const squadsPromise = selectedFixture.status === 'pending' && leagueClient.getFixtureSquads
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

  const title = leagueViewTitle(view);
  const subtitle = leagueViewSubtitle(view);

  return (
    <main aria-labelledby="league-title" className="feature-screen league-page">
      <header className="league-page__header">
        <div>
          <p className="eyebrow">Competition workspace</p>
          <h1 id="league-title">{title}</h1>
          <p className="league-page__intro">{subtitle}</p>
        </div>
        {snapshot ? <LeaguePulse snapshot={snapshot} /> : null}
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
          onNavigate={onNavigate}
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
  onNavigate,
  onReload,
  snapshot,
  view,
}: {
  onOpenFixture: (fixture: LeagueFixture) => void;
  onNavigate: (href: string) => void;
  onReload: () => void;
  snapshot: LeagueSnapshot;
  view: LeagueView;
}) {
  if (view === 'fixtures') {
    return <FixturesView onOpenFixture={onOpenFixture} snapshot={snapshot} />;
  }
  if (view === 'table') {
    return <TableView onReload={onReload} snapshot={snapshot} />;
  }
  if (view === 'knockout') {
    return <KnockoutView onOpenFixture={onOpenFixture} snapshot={snapshot} />;
  }
  if (view === 'head-to-head') {
    return <HeadToHeadView snapshot={snapshot} />;
  }
  return <OverviewView onNavigate={onNavigate} snapshot={snapshot} />;
}

function OverviewView({
  onNavigate,
  snapshot,
}: {
  onNavigate: (href: string) => void;
  snapshot: LeagueSnapshot;
}) {
  const currentFixtures = snapshot.currentFixtures.fixtures;
  const nextFixtures = snapshot.nextFixtures.fixtures;
  const leader = snapshot.table.rows[0];
  const completedFixtures = snapshot.allFixtures.fixtures.filter((fixture) => fixture.status === 'complete').length;
  const detailCount = snapshot.allFixtures.fixtures.filter((fixture) => fixture.detailAvailable).length;
  const focus = currentFixtures.length
    ? {
      action: 'Review fixtures',
      detail: `${currentFixtures.length} fixture${currentFixtures.length === 1 ? '' : 's'} are in play. Open the Fixtures tab when you want the round-by-round detail.`,
      href: '/league/fixtures',
      title: 'The current round is in play',
    }
    : nextFixtures.length
      ? {
        action: 'View upcoming fixtures',
        detail: 'The next round is set. Open the Fixtures tab to review the schedule and previous results.',
        href: '/league/fixtures',
        title: 'Your next league round is set',
      }
      : {
        action: 'Open league table',
        detail: 'There is no active schedule to review. Open the Table tab to see the current standings.',
        href: '/league/table',
        title: 'The competition is between rounds',
      };

  return (
    <div className="league-page__content">
      <Card className="league-hero">
        <div className="league-hero__copy">
          <p className="league-hero__kicker"><span className="league-pulse-dot" /> League pulse</p>
          <h2>{focus.title}</h2>
          <p>{focus.detail}</p>
        </div>
        <div className="league-hero__action">
          <span className="league-hero__meta"><CalendarDays aria-hidden="true" size={15} /> {gameweekLabel(snapshot.currentFixtures, 'Current gameweek')}</span>
          <LeagueNavLink className="ui-button ui-button-primary" href={focus.href} onNavigate={onNavigate}>
            {focus.action} <ArrowRight aria-hidden="true" size={16} />
          </LeagueNavLink>
        </div>
      </Card>

      <section aria-label="League snapshot" className="league-stat-grid">
        <MetricCard icon={<CalendarDays aria-hidden="true" size={17} />} label="Next round" value={gameweekLabel(snapshot.nextFixtures, 'Not scheduled')} detail={`${nextFixtures.length} fixture${nextFixtures.length === 1 ? '' : 's'} listed`} />
        <MetricCard icon={<Medal aria-hidden="true" size={17} />} label="Table leader" value={leader?.team.name ?? 'No table yet'} detail={leader ? `${leader.leaguePoints} league points` : 'Awaiting results'} />
        <MetricCard icon={<Swords aria-hidden="true" size={17} />} label="Results recorded" value={`${completedFixtures}`} detail={`${detailCount} fixture detail${detailCount === 1 ? '' : 's'} available`} />
      </section>

      <Card className="league-focus-card">
        <div>
          <p className="eyebrow">Choose a competition view</p>
          <h2>Open a tab when you are ready to go deeper</h2>
          <p>Overview stays lightweight; fixtures, standings, knockout and head-to-head details appear only in their selected views.</p>
        </div>
        <LeagueNavLink className="league-text-link" href={focus.href} onNavigate={onNavigate}>
          {focus.action} <ChevronRight aria-hidden="true" size={15} />
        </LeagueNavLink>
      </Card>
    </div>
  );
}

function FixturesView({ onOpenFixture, snapshot }: { onOpenFixture: (fixture: LeagueFixture) => void; snapshot: LeagueSnapshot }) {
  const [filter, setFilter] = useState<FixtureFilter>('all');
  const filteredFixtures = useMemo(
    () => snapshot.allFixtures.fixtures.filter((fixture) => {
      if (filter === 'current') return fixture.isCurrent;
      if (filter === 'complete') return fixture.status === 'complete' || fixture.status === 'started';
      if (filter === 'pending') return fixture.status === 'pending';
      return true;
    }),
    [filter, snapshot.allFixtures.fixtures],
  );

  return (
    <div className="league-page__content">
      <div className="league-page__columns">
        <FixtureGroup fixtures={snapshot.currentFixtures.fixtures} gameweek={snapshot.currentFixtures.gameweek?.name ?? 'Current gameweek'} onOpenFixture={onOpenFixture} title="Current fixtures" />
        <FixtureGroup fixtures={snapshot.nextFixtures.fixtures} gameweek={snapshot.nextFixtures.gameweek?.name ?? 'Next gameweek'} onOpenFixture={onOpenFixture} title="Upcoming fixtures" />
      </div>

      <Card className="league-panel">
        <div className="league-panel__header">
          <SectionHeading eyebrow="Competition history" id="all-fixtures-title" title="All fixtures" />
          <Select
            aria-label="Filter fixtures"
            label="Show"
            onChange={(event) => setFilter(event.target.value as FixtureFilter)}
            options={[
              { label: 'All fixtures', value: 'all' },
              { label: 'Current round', value: 'current' },
              { label: 'Results', value: 'complete' },
              { label: 'Upcoming', value: 'pending' },
            ]}
            value={filter}
          />
        </div>
        <div aria-label="All fixtures" className="league-fixture-list">
          {filteredFixtures.length ? filteredFixtures.map((fixture) => <FixtureListRow fixture={fixture} key={fixture.id} onOpen={onOpenFixture} />) : <EmptyState message="No fixtures match this filter." />}
        </div>
      </Card>
    </div>
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

function KnockoutView({ onOpenFixture, snapshot }: { onOpenFixture: (fixture: LeagueFixture) => void; snapshot: LeagueSnapshot }) {
  const rounds = snapshot.knockout.rounds.length ? snapshot.knockout.rounds : ['Upcoming bracket'];
  return (
    <div className="league-page__content">
      <Card className="league-panel">
        <SectionHeading eyebrow="Competition route" id="knockout-title" title="Knockout bracket" />
        <p className="league-panel__description">Follow each tie from its round fixture to the winner path. Aggregate and tiebreaker detail will be shown when the competition feed supplies it.</p>
        {snapshot.knockout.matches.length ? (
          <div className="league-bracket" aria-label="Knockout bracket">
            {rounds.map((round) => {
              const matches = snapshot.knockout.matches.filter((match) => match.roundLabel === round);
              return <div className="league-bracket__round" key={round}><p className="eyebrow">{round}</p>{matches.length ? matches.map((match) => <KnockoutMatchCard key={match.id} match={match} onOpenFixture={onOpenFixture} />) : <EmptyState message="No match recorded in this round." />}</div>;
            })}
          </div>
        ) : <EmptyState message="No knockout matches are available yet." />}
      </Card>
    </div>
  );
}

function HeadToHeadView({ snapshot }: { snapshot: LeagueSnapshot }) {
  return (
    <div className="league-page__content">
      <Card className="league-panel">
        <SectionHeading eyebrow="Matchup history" id="head-to-head-title" title="Head-to-head records" />
        <p className="league-panel__description">Review the results and scoring margins between teams across recorded fixtures.</p>
        {snapshot.headToHead.records.length ? (
          <div className="league-h2h-grid">
            {snapshot.headToHead.records.map((record) => <HeadToHeadCard key={`${record.team.id}-${record.opponent.id}`} record={record} />)}
          </div>
        ) : <EmptyState message="Head-to-head records will appear after results are recorded." />}
      </Card>
    </div>
  );
}

function FixtureGroup({ fixtures, gameweek, onOpenFixture, title }: { fixtures: LeagueFixture[]; gameweek: string; onOpenFixture: (fixture: LeagueFixture) => void; title: string }) {
  return (
    <section aria-labelledby={`${title.toLowerCase().replaceAll(' ', '-')}-title`} className="league-section">
      <SectionHeading eyebrow={gameweek} id={`${title.toLowerCase().replaceAll(' ', '-')}-title`} title={title} />
      <div className="league-fixture-stack">
        {fixtures.length ? fixtures.map((fixture) => <FixtureCard fixture={fixture} key={fixture.id} onOpen={onOpenFixture} />) : <EmptyState message={`No ${title.toLowerCase()} available.`} />}
      </div>
    </section>
  );
}

function FixtureCard({ fixture, onOpen }: { fixture: LeagueFixture; onOpen: (fixture: LeagueFixture) => void }) {
  return (
    <Card className="league-fixture-card">
      <div className="league-fixture-card__meta"><span>{fixture.roundLabel}</span><span>{fixture.kickoffLabel}</span></div>
      <FixtureTeams fixture={fixture} />
      <div className="league-fixture-card__footer"><StatusBadge status={fixture.status} /><span className="league-fixture-card__outcome">{outcomeLabel(fixture)}</span><Button aria-label={`${fixture.status === 'pending' ? 'Compare squads' : 'View details'} for ${fixture.homeTeam.name} versus ${fixture.awayTeam.name}`} onClick={() => onOpen(fixture)} type="button" variant="ghost">{fixture.status === 'pending' ? 'Compare squads' : 'View detail'} <ChevronRight aria-hidden="true" size={15} /></Button></div>
    </Card>
  );
}

function FixtureListRow({ fixture, onOpen }: { fixture: LeagueFixture; onOpen: (fixture: LeagueFixture) => void }) {
  return (
    <article className="league-fixture-row">
      <div className="league-fixture-row__round"><strong>{fixture.gameweek.name}</strong><span>{fixture.roundLabel}</span></div>
      <FixtureTeams fixture={fixture} compact />
      <div className="league-fixture-row__result"><strong>{formatScore(fixture)}</strong><StatusBadge status={fixture.status} /></div>
      <Button aria-label={`${fixture.status === 'pending' ? 'Compare squads' : 'View details'} for ${fixture.homeTeam.name} versus ${fixture.awayTeam.name}`} onClick={() => onOpen(fixture)} type="button" variant="ghost"><ChevronRight aria-hidden="true" size={17} /></Button>
    </article>
  );
}

function FixtureTeams({ compact = false, fixture }: { compact?: boolean; fixture: LeagueFixture }) {
  return (
    <div className={`league-fixture-teams${compact ? ' league-fixture-teams--compact' : ''}`}>
      <div className="league-team-line"><span className="league-team-mark">{teamInitials(fixture.homeTeam)}</span><strong>{compact ? (fixture.homeTeam.shortName ?? fixture.homeTeam.name) : fixture.homeTeam.name}</strong></div>
      <div className="league-score"><strong>{fixture.score.homeScore ?? '—'}</strong><span>{' - '}</span><strong>{fixture.score.awayScore ?? '—'}</strong></div>
      <div className="league-team-line league-team-line--away"><strong>{compact ? (fixture.awayTeam.shortName ?? fixture.awayTeam.name) : fixture.awayTeam.name}</strong><span className="league-team-mark">{teamInitials(fixture.awayTeam)}</span></div>
    </div>
  );
}

function TableRow({ row }: { row: LeagueTableRow }) {
  return <tr><th scope="row"><span className={`league-rank league-rank--${row.position <= 3 ? row.position : 'other'}`}>{row.position}</span></th><th scope="row" className="league-table__team">{row.team.name}</th><td>{row.played}</td><td>{row.wins}-{row.draws}-{row.losses}</td><td>{row.pointsFor}</td><td>{row.pointsAgainst}</td><td>{row.pointsDifference > 0 ? '+' : ''}{row.pointsDifference}</td><td><strong>{row.leaguePoints}</strong></td></tr>;
}

function KnockoutMatchCard({ match, onOpenFixture }: { match: LeagueSnapshot['knockout']['matches'][number]; onOpenFixture: (fixture: LeagueFixture) => void }) {
  const { fixture } = match;
  return <article className="league-knockout-match"><div className="league-knockout-match__teams"><div><span>{fixture.homeTeam.shortName ?? fixture.homeTeam.name}</span><strong>{fixture.score.homeScore ?? '—'}</strong></div><div><span>{fixture.awayTeam.shortName ?? fixture.awayTeam.name}</span><strong>{fixture.score.awayScore ?? '—'}</strong></div></div><div className="league-knockout-match__footer"><span>{match.winner ? `Winner: ${match.winner.shortName ?? match.winner.name}` : 'Tie not decided'}</span>{fixture.detailAvailable ? <Button aria-label={`View knockout fixture ${fixture.id}`} onClick={() => onOpenFixture(fixture)} type="button" variant="ghost"><ChevronRight aria-hidden="true" size={15} /></Button> : null}</div></article>;
}

function HeadToHeadCard({ record }: { record: LeagueSnapshot['headToHead']['records'][number] }) {
  return <article className="league-h2h-card"><div className="league-h2h-card__header"><div><strong>{record.team.shortName ?? record.team.name}</strong><span>vs</span><strong>{record.opponent.shortName ?? record.opponent.name}</strong></div><Swords aria-hidden="true" size={17} /></div><div className="league-h2h-card__score"><strong>{record.pointsFor}</strong><span>points for</span><strong>{record.pointsAgainst}</strong><span>against</span></div><div className="league-h2h-card__footer"><span>{record.played} played</span><span>{record.wins}W · {record.draws}D · {record.losses}L</span></div></article>;
}

function FixtureDetailDrawer({ attackDirection, detail, detailStatus, drawerRef, fixture, onClose, squads }: { attackDirection: AttackDirection; detail: FixtureDetailResponse | null; detailStatus: 'idle' | 'loading' | 'loaded' | 'error'; drawerRef: RefObject<HTMLElement | null>; fixture: LeagueFixture; onClose: () => void; squads: FixtureSquad[] }) {
  return <><button aria-label="Close fixture detail" className="league-drawer-backdrop" onClick={onClose} type="button" /><aside ref={drawerRef} aria-labelledby="fixture-detail-title" aria-modal="true" className="league-drawer league-drawer--comparison" role="dialog" tabIndex={-1}><header className="league-drawer__header"><div><p className="eyebrow">{fixture.status === 'pending' ? 'Upcoming fixture' : 'Fixture detail'}</p><h2 id="fixture-detail-title">{fixture.homeTeam.name} vs {fixture.awayTeam.name}</h2></div><Button aria-label="Close fixture detail" className="shell-icon-button" onClick={onClose} type="button" variant="ghost"><X aria-hidden="true" size={19} /></Button></header><div className="league-drawer__body"><div className="league-drawer__score"><span>{fixture.gameweek.name}</span><strong>{formatScore(fixture)}</strong><StatusBadge status={fixture.status} /></div>{detailStatus === 'loading' ? <p role="status">Loading squad comparison…</p> : null}{detailStatus === 'error' ? <p className="league-inline-error" role="alert">Squad comparison is temporarily unavailable.</p> : null}{detailStatus === 'loaded' && fixture.status === 'pending' && squads.length === 2 ? <SquadComparison attackDirection={attackDirection} squads={squads} /> : null}{detailStatus === 'loaded' && fixture.status !== 'pending' && detail ? <><section><h3>Scoring notes</h3><p>{detail.notes[0] ?? 'No notes were supplied for this fixture.'}</p></section><section><h3>Recorded events</h3>{detail.events.length ? <ul className="league-event-list">{detail.events.map((event, index) => <li key={`${event.label}-${event.team.id}-${index}`}><span><strong>{event.label}</strong><small>{event.team.name}</small></span><strong>{event.points > 0 ? '+' : ''}{event.points}</strong></li>)}</ul> : <p>No scoring events were supplied.</p>}</section></> : null}</div></aside></>;
}

function SquadComparison({ attackDirection, squads }: { attackDirection: AttackDirection; squads: FixtureSquad[] }) {
  const userSquad = squads.find((squad) => squad.isUserTeam) ?? squads[0];
  const opponentSquad = squads.find((squad) => !squad.isUserTeam && squad.team.id !== userSquad?.team.id) ?? squads[1];
  const [predictedIds, setPredictedIds] = useState<Set<string>>(() => new Set(opponentSquad?.starters.map((player) => player.id) ?? []));

  useEffect(() => {
    setPredictedIds(new Set(opponentSquad?.starters.map((player) => player.id) ?? []));
  }, [opponentSquad?.team.id]);

  if (!userSquad || !opponentSquad) return null;

  const opponentPlayers = opponentSquad.players.length ? opponentSquad.players : [...opponentSquad.starters, ...opponentSquad.bench];
  const predictedPlayers = opponentPlayers.filter((player) => predictedIds.has(player.id));
  const userOnTop = attackDirection === 'down';
  const topSquad = userOnTop ? userSquad : opponentSquad;
  const bottomSquad = userOnTop ? opponentSquad : userSquad;
  const topStarters = topSquad === opponentSquad ? predictedPlayers : userSquad.starters;
  const bottomStarters = bottomSquad === opponentSquad ? predictedPlayers : userSquad.starters;

  function togglePredictedPlayer(player: FixtureSquad['starters'][number]) {
    setPredictedIds((current) => {
      const next = new Set(current);
      if (next.has(player.id)) {
        next.delete(player.id);
        return next;
      }
      if (next.size >= 11 || positionCount(next, opponentPlayers, player.position) >= positionMaximum(player.position)) return current;
      next.add(player.id);
      return next;
    });
  }

  return <section aria-label="Squad comparison" className="fixture-squad-comparison"><p className="league-panel__description">Your saved Starting XI faces their squad. Select the eleven players you think they will start.</p><div className="fixture-squad-comparison__pitches"><FixtureComparisonPitch attackDirection="down" isUserTeam={topSquad.isUserTeam} squad={topSquad} starters={topStarters} /><FixtureComparisonPitch attackDirection="up" isUserTeam={bottomSquad.isUserTeam} squad={bottomSquad} starters={bottomStarters} /></div><OpponentPrediction squad={opponentSquad} players={opponentPlayers} predictedIds={predictedIds} onToggle={togglePredictedPlayer} /></section>;
}

function FixtureComparisonPitch({ attackDirection, isUserTeam, squad, starters }: { attackDirection: AttackDirection; isUserTeam: boolean; squad: FixtureSquad; starters: FixtureSquad['starters'] }) {
  const positions = attackDirection === 'down' ? ['GKP', 'DEF', 'MID', 'FWD'] : ['FWD', 'MID', 'DEF', 'GKP'];
  const formation = ['DEF', 'MID', 'FWD'].map((position) => starters.filter((player) => player.position === position).length).join('-');
  return (
    <article className={`fixture-squad-pitch fixture-squad-pitch--${isUserTeam ? 'user' : 'opponent'}`} data-attack-direction={attackDirection} data-team-role={isUserTeam ? 'user' : 'opponent'}>
      <header><strong>{squad.team.name}</strong><span>{isUserTeam ? 'Your Starting XI' : 'Predicted XI'}</span></header>
      <div aria-label={`${squad.team.name} pitch`} className={`fixture-squad-pitch__field attack-${attackDirection}`}>
        <div aria-hidden="true" className="fixture-squad-pitch__markings"><span /><span /><span /><span /></div>
        <div className="fixture-squad-pitch__formation">{formation}</div>
        <div className="fixture-squad-pitch__lineup">
          {positions.map((position) => (
            <div className={`fixture-squad-pitch__row position-${position.toLowerCase()}`} data-position={position} key={position}>
              {starters.filter((player) => player.position === position).map((player) => {
                const shirtTeam = player.club?.shortName ?? player.club?.name ?? squad.team.shortName ?? squad.team.name;
                const clubCode = player.club?.shortName ?? player.club?.name ?? squad.team.shortName ?? squad.team.name;
                return (
                  <div className={`squad-page__pitch-player fixture-squad-pitch__player position-${player.position.toLowerCase()} form-band-${formBand(player.form)}`} data-player-id={player.id} key={player.id} title={`${player.displayName} · ${player.points} pts`}>
                    <span aria-hidden="true" className="squad-page__pitch-shirt-crop"><TeamShirt large team={shirtTeam} /></span>
                    <strong className="squad-page__pitch-player-name">{shortPlayerName(player.displayName)}</strong>
                    <span className="squad-page__pitch-player-form"><FormDots value={player.form} /></span>
                    <small>{clubCode}</small>
                    {player.isCaptain ? <span className="squad-page__captain">C</span> : null}
                    {player.isViceCaptain ? <span className="squad-page__captain vice">VC</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <footer><strong>{isUserTeam ? '11 selected' : `${starters.length} of 11 predicted`}</strong><span>{attackDirection === 'up' ? 'Attacking up' : 'Attacking down'}</span></footer>
    </article>
  );
}

function OpponentPrediction({ onToggle, players, predictedIds, squad }: { onToggle: (player: FixtureSquad['starters'][number]) => void; players: FixtureSquad['players']; predictedIds: Set<string>; squad: FixtureSquad }) {
  const counts = positionCounts(predictedIds, players);
  const isLegal = predictedIds.size === 11 && Object.entries(counts).every(([position, count]) => count >= positionMinimum(position) && count <= positionMaximum(position));
  return <section aria-label={`${squad.team.name} lineup prediction`} className="fixture-lineup-prediction"><header><div><p className="eyebrow">Opponent squad</p><h3>Predict their XI</h3></div><strong>{predictedIds.size}/11</strong></header><p className="fixture-lineup-prediction__hint">Tap players to add or remove them from the predicted Starting XI.</p><div className="fixture-lineup-prediction__status" data-valid={isLegal ? 'true' : 'false'}>{isLegal ? 'Valid Starting XI' : 'Choose a legal formation to complete your prediction.'}</div><div className="fixture-lineup-prediction__players">{['FWD', 'MID', 'DEF', 'GKP'].map((position) => <div className="fixture-lineup-prediction__group" key={position}><strong>{positionLabel(position)}s</strong><div>{players.filter((player) => player.position === position).map((player) => { const selected = predictedIds.has(player.id); const canAdd = selected || (predictedIds.size < 11 && counts[position] < positionMaximum(position)); return <button aria-label={`${selected ? 'Remove' : 'Add'} ${player.displayName} ${selected ? 'from' : 'to'} predicted XI`} aria-pressed={selected} className={`fixture-lineup-prediction__player${selected ? ' is-selected' : ''}`} disabled={!canAdd} key={player.id} onClick={() => onToggle(player)} title={selected ? `Remove ${player.displayName} from predicted XI` : `Add ${player.displayName} to predicted XI`} type="button"><span>{player.displayName}</span><small>{selected ? 'Starting' : 'Available'}</small></button>; })}</div></div>)}</div></section>;
}

function positionCounts(ids: Set<string>, players: FixtureSquad['players']): Record<string, number> {
  return players.reduce<Record<string, number>>((counts, player) => {
    if (ids.has(player.id)) counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function positionCount(ids: Set<string>, players: FixtureSquad['players'], position: string): number {
  return positionCounts(ids, players)[position] ?? 0;
}

function positionMinimum(position: string): number {
  return { GKP: 1, DEF: 3, MID: 2, FWD: 1 }[position] ?? 0;
}

function positionMaximum(position: string): number {
  return { GKP: 1, DEF: 5, MID: 5, FWD: 3 }[position] ?? 0;
}

function positionLabel(position: string): string {
  return { GKP: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' }[position] ?? position;
}

function LeaguePulse({ snapshot }: { snapshot: LeagueSnapshot }) {
  const current = snapshot.currentFixtures.gameweek;
  return <div className="league-page__pulse"><span className="league-page__pulse-label">Live context</span><strong>{current?.name ?? 'No active gameweek'}</strong><span>{snapshot.currentFixtures.fixtures.length ? `${snapshot.currentFixtures.fixtures.length} fixture${snapshot.currentFixtures.fixtures.length === 1 ? '' : 's'} in view` : 'No current fixtures'}</span></div>;
}

function MetricCard({ detail, icon, label, value }: { detail: string; icon: ReactNode; label: string; value: string }) {
  return <Card className="league-metric-card"><span className="league-metric-card__icon">{icon}</span><span className="league-metric-card__label">{label}</span><strong>{value}</strong><span className="league-metric-card__detail">{detail}</span></Card>;
}

function LeagueNavLink({ children, className, href, onNavigate }: { children: ReactNode; className: string; href: string; onNavigate: (href: string) => void }) {
  return <a className={className} href={href} onClick={(event) => { event.preventDefault(); onNavigate(href); }}>{children}</a>;
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
  return <div aria-label="Loading league data" className="league-loading" role="status"><span /><span /><span /></div>;
}

function leagueViewFromPath(pathname: string): LeagueView {
  if (pathname === '/league/fixtures') return 'fixtures';
  if (pathname === '/league/table') return 'table';
  if (pathname === '/league/knockout') return 'knockout';
  if (pathname === '/league/head-to-head') return 'head-to-head';
  return 'overview';
}

function leagueViewTitle(view: LeagueView): string {
  if (view === 'fixtures') return 'Fixtures & results';
  if (view === 'table') return 'League table';
  if (view === 'knockout') return 'Knockout competition';
  if (view === 'head-to-head') return 'Head-to-head records';
  return 'League fixtures and results';
}

function leagueViewSubtitle(view: LeagueView): string {
  if (view === 'fixtures') return 'Move from the current round to the next one, then open any started fixture for its scoring context.';
  if (view === 'table') return 'See who is leading, how the standings are ordered, and what the current result snapshot represents.';
  if (view === 'knockout') return 'Follow the competition route, tie by tie, as results and winners are confirmed.';
  if (view === 'head-to-head') return 'Compare the recorded results and scoring margins behind each manager matchup.';
  return 'Understand what is happening in the competition and where to look next.';
}

function gameweekLabel(response: LeagueSnapshot['currentFixtures'], fallback: string): string {
  return response.gameweek?.name ?? fallback;
}

function formatScore(fixture: LeagueFixture): string {
  if (fixture.score.homeScore === null || fixture.score.awayScore === null) return 'Pending';
  return `${fixture.score.homeScore} - ${fixture.score.awayScore}`;
}

function outcomeLabel(fixture: LeagueFixture): string {
  if (fixture.score.outcome === 'draw') return 'Draw';
  if (fixture.score.outcome === 'home_win') return `${fixture.homeTeam.shortName ?? fixture.homeTeam.name} lead`;
  if (fixture.score.outcome === 'away_win') return `${fixture.awayTeam.shortName ?? fixture.awayTeam.name} lead`;
  return 'Awaiting result';
}

function tableSourceLabel(source: string): string {
  return source === 'service-calculated' ? 'Calculated snapshot' : 'Persisted snapshot';
}

function teamInitials(team: LeagueFixture['homeTeam']): string {
  return (team.shortName ?? team.name).slice(0, 3).toUpperCase();
}
