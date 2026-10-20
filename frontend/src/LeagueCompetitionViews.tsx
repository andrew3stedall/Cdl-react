import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { SortableTableHead, useSortedRows } from './components/ui/sortable-table';
import type { HeadToHeadRecord, KnockoutResponse, LeagueFixture } from './league-api';

export function KnockoutView({ knockout, onOpenFixture }: { knockout: KnockoutResponse; onOpenFixture: (fixture: LeagueFixture) => void }) {
  return <div className="league-page__content">
    <h2>Knockouts</h2>
    {knockout.status === 'not_ready' ? <Card>Available after regular-season results are final.</Card> : null}
    {(knockout.brackets ?? []).map((bracket) => <Card key={bracket.id}>
      <h3>{bracket.label}</h3>
      {bracket.ties.map((tie) => <section aria-label={tie.roundLabel} className="league-knockout-tie" key={tie.id}>
        <h4>{tie.roundLabel}</h4>
        <KnockoutTieTable aggregate={tie.aggregate} goals={tie.scoringLineupGoals} teams={tie.teams} />
        <p>{tie.winner ? `Winner: ${tie.winner.name}` : tie.tiebreakStatus === 'unresolved' ? 'Tied after goals — awaiting approved tiebreak decision.' : 'Awaiting results'}</p>
        <div className="league-knockout-tie__legs">{tie.legs.map((leg) => <Button key={leg.id} onClick={() => onOpenFixture(leg.fixture)} type="button" variant="secondary">Leg {leg.legNumber} · {leg.fixture.gameweek.name}</Button>)}</div>
      </section>)}
    </Card>)}
    {!(knockout.brackets?.length) && knockout.matches.length > 0 ? knockout.matches.map((match) => <Card key={match.id}>
      <h3>{match.roundLabel}</h3><p>{match.fixture.homeTeam.name} vs {match.fixture.awayTeam.name}</p>
      <p>{match.winner ? `Winner: ${match.winner.name}` : 'Awaiting results'}</p>
      <Button onClick={() => onOpenFixture(match.fixture)} type="button" variant="secondary">Open fixture</Button>
    </Card>) : null}
    {!(knockout.brackets?.length) && !knockout.matches.length && knockout.status !== 'not_ready' ? <Card>No knockout fixtures scheduled.</Card> : null}
    {(knockout.unconfiguredBrackets ?? []).map((label) => <Card key={label}>{label}: schedule requires an approved rule.</Card>)}
  </div>;
}

export function HeadToHeadView({ records }: { records: HeadToHeadRecord[] }) {
  const { direction, onSort, sortColumn, sortedRows } = useSortedRows(records, (record, column) => {
    if (column === 'team') return record.team.name;
    if (column === 'opponent') return record.opponent.name;
    if (column === 'played') return record.played;
    if (column === 'record') return `${record.wins}-${record.draws}-${record.losses}`;
    if (column === 'for') return record.pointsFor;
    return record.pointsAgainst;
  });
  return <div className="league-page__content"><Card>
    <h2>Head-to-head</h2>
    {records.length === 0 ? <p>No completed head-to-head results.</p> : <div aria-label="Head-to-head records" className="league-table-scroll" role="region" tabIndex={0}>
      <Table className="league-table"><TableHeader><TableRow>{[['team','Team'],['opponent','Opponent'],['played','P'],['record','W-D-L'],['for','For'],['against','Against']].map(([key, label]) => <TableHead key={key}><SortableTableHead column={key} direction={direction} onSort={onSort} sortColumn={sortColumn}>{label}</SortableTableHead></TableHead>)}</TableRow></TableHeader>
        <TableBody>{sortedRows.map((record) => <TableRow key={`${record.team.id}:${record.opponent.id}`}><TableHead scope="row">{record.team.name}</TableHead><TableCell>{record.opponent.name}</TableCell><TableCell>{record.played}</TableCell><TableCell>{record.wins}-{record.draws}-{record.losses}</TableCell><TableCell>{record.pointsFor}</TableCell><TableCell>{record.pointsAgainst}</TableCell></TableRow>)}</TableBody>
      </Table>
    </div>}
  </Card></div>;
}

function KnockoutTieTable({ aggregate, goals, teams }: {
  aggregate: Record<string, number>;
  goals: Record<string, number>;
  teams: Array<{ id: string; name: string }>;
}) {
  const { direction, onSort, sortColumn, sortedRows } = useSortedRows(teams, (team, column) => column === 'team' ? team.name : column === 'aggregate' ? aggregate[team.id] : goals[team.id]);
  return <div className="league-table-scroll">
    <Table className="league-table"><TableHeader><TableRow><TableHead><SortableTableHead column="team" direction={direction} onSort={onSort} sortColumn={sortColumn}>Team</SortableTableHead></TableHead><TableHead><SortableTableHead column="aggregate" direction={direction} onSort={onSort} sortColumn={sortColumn}>Aggregate</SortableTableHead></TableHead><TableHead><SortableTableHead column="goals" direction={direction} onSort={onSort} sortColumn={sortColumn}>Goals</SortableTableHead></TableHead></TableRow></TableHeader>
      <TableBody>{sortedRows.map((team) => <TableRow key={team.id}><TableHead scope="row">{team.name}</TableHead><TableCell>{aggregate[team.id] ?? '—'}</TableCell><TableCell>{goals[team.id] ?? '—'}</TableCell></TableRow>)}</TableBody>
    </Table>
  </div>;
}
