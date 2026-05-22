interface Team {
  id: string;
  name: string;
  shortName: string;
}

interface Fixture {
  id: string;
  round: string;
  home: Team;
  away: Team;
  status: 'pending' | 'started' | 'complete';
  score: string;
  current?: boolean;
  next?: boolean;
  detailAvailable?: boolean;
}

interface TableRow {
  position: number;
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  leaguePoints: number;
}

const teams = {
  castle: { id: 'castle', name: 'Castle United', shortName: 'CAS' },
  drafton: { id: 'drafton', name: 'Drafton Rovers', shortName: 'DRA' },
  keepers: { id: 'keepers', name: 'Keeper City', shortName: 'KPR' },
  wildcards: { id: 'wildcards', name: 'Wildcard Athletic', shortName: 'WCA' },
};

const fixtures: Fixture[] = [
  {
    id: 'fixture-1201',
    round: 'Gameweek 12',
    home: teams.castle,
    away: teams.drafton,
    status: 'started',
    score: '58 - 52',
    current: true,
    detailAvailable: true,
  },
  {
    id: 'fixture-1202',
    round: 'Gameweek 12',
    home: teams.keepers,
    away: teams.wildcards,
    status: 'pending',
    score: 'Pending',
    current: true,
  },
  {
    id: 'fixture-1301',
    round: 'Gameweek 13',
    home: teams.drafton,
    away: teams.keepers,
    status: 'pending',
    score: 'Pending',
    next: true,
  },
  {
    id: 'fixture-1302',
    round: 'Gameweek 13',
    home: teams.wildcards,
    away: teams.castle,
    status: 'pending',
    score: 'Pending',
    next: true,
  },
  {
    id: 'fixture-sf-01',
    round: 'Semi Final',
    home: teams.castle,
    away: teams.keepers,
    status: 'pending',
    score: 'Pending',
  },
];

const tableRows: TableRow[] = [
  {
    position: 1,
    team: teams.castle,
    played: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    pointsFor: 58,
    pointsAgainst: 52,
    pointsDifference: 6,
    leaguePoints: 3,
  },
  {
    position: 2,
    team: teams.keepers,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointsDifference: 0,
    leaguePoints: 0,
  },
  {
    position: 3,
    team: teams.wildcards,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointsDifference: 0,
    leaguePoints: 0,
  },
  {
    position: 4,
    team: teams.drafton,
    played: 1,
    wins: 0,
    draws: 0,
    losses: 1,
    pointsFor: 52,
    pointsAgainst: 58,
    pointsDifference: -6,
    leaguePoints: 0,
  },
];

export function LeaguePage() {
  return (
    <main aria-labelledby="league-title" className="feature-screen">
      <header>
        <p className="eyebrow">Castle Draft League</p>
        <h1 id="league-title">League Fixtures and Table</h1>
        <p>Current fixtures, upcoming fixtures, standings, knockout, and head-to-head context.</p>
      </header>

      <section aria-label="Current fixtures">
        <h2>Current fixtures</h2>
        <FixtureTable fixtures={fixtures.filter((fixture) => fixture.current)} />
      </section>

      <section aria-label="Upcoming fixtures">
        <h2>Upcoming fixtures</h2>
        <FixtureTable fixtures={fixtures.filter((fixture) => fixture.next)} />
      </section>

      <section aria-label="League standings">
        <h2>League standings</h2>
        <table>
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>PF</th>
              <th>PA</th>
              <th>+/-</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.team.id}>
                <td>{row.position}</td>
                <td>{row.team.name}</td>
                <td>{row.played}</td>
                <td>{row.wins}</td>
                <td>{row.draws}</td>
                <td>{row.losses}</td>
                <td>{row.pointsFor}</td>
                <td>{row.pointsAgainst}</td>
                <td>{row.pointsDifference}</td>
                <td>{row.leaguePoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="All fixtures">
        <h2>All fixtures</h2>
        <ul>
          {fixtures.map((fixture) => (
            <li key={fixture.id}>
              {fixture.round}: {fixture.home.shortName} vs {fixture.away.shortName} - {fixture.score}
              {fixture.detailAvailable ? ' - Detail available' : ''}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Knockout and head-to-head">
        <h2>Knockout</h2>
        <p>Semi Final: Castle United vs Keeper City</p>
        <h2>Head-to-head</h2>
        <p>Castle United lead Drafton Rovers 1-0-0, 58 points for and 52 against.</p>
      </section>
    </main>
  );
}

function FixtureTable({ fixtures: rows }: { fixtures: Fixture[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Round</th>
          <th>Home</th>
          <th>Away</th>
          <th>Score</th>
          <th>Status</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((fixture) => (
          <tr key={fixture.id}>
            <td>{fixture.round}</td>
            <td>{fixture.home.name}</td>
            <td>{fixture.away.name}</td>
            <td>{fixture.score}</td>
            <td>{fixture.status}</td>
            <td>{fixture.detailAvailable ? 'Available' : 'Pending'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
