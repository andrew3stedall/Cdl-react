import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { HeadToHeadRecord, KnockoutResponse, LeagueFixture } from './league-api';

export function KnockoutView({ knockout, onOpenFixture }: { knockout: KnockoutResponse; onOpenFixture: (fixture: LeagueFixture) => void }) {
  return <div className="league-page__content">
    <h2>Knockouts</h2>
    {knockout.status === 'not_ready' ? <Card>Available after regular-season results are final.</Card> : null}
    {(knockout.brackets ?? []).map((bracket) => <Card key={bracket.id}>
      <h3>{bracket.label}</h3>
      {bracket.ties.map((tie) => <section aria-label={tie.roundLabel} className="league-knockout-tie" key={tie.id}>
        <h4>{tie.roundLabel}</h4>
        <div className="league-table-scroll">
          <table className="league-table"><thead><tr><th scope="col">Team</th><th scope="col">Aggregate</th><th scope="col">Goals</th></tr></thead>
            <tbody>{tie.teams.map((team) => <tr key={team.id}><th scope="row">{team.name}</th><td>{tie.aggregate[team.id] ?? '—'}</td><td>{tie.scoringLineupGoals[team.id] ?? '—'}</td></tr>)}</tbody>
          </table>
        </div>
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
  return <div className="league-page__content"><Card>
    <h2>Head-to-head</h2>
    {records.length === 0 ? <p>No completed head-to-head results.</p> : <div aria-label="Head-to-head records" className="league-table-scroll" role="region" tabIndex={0}>
      <table className="league-table"><thead><tr><th scope="col">Team</th><th scope="col">Opponent</th><th scope="col">P</th><th scope="col">W-D-L</th><th scope="col">For</th><th scope="col">Against</th></tr></thead>
        <tbody>{records.map((record) => <tr key={`${record.team.id}:${record.opponent.id}`}><th scope="row">{record.team.name}</th><td>{record.opponent.name}</td><td>{record.played}</td><td>{record.wins}-{record.draws}-{record.losses}</td><td>{record.pointsFor}</td><td>{record.pointsAgainst}</td></tr>)}</tbody>
      </table>
    </div>}
  </Card></div>;
}
