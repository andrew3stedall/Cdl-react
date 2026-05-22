import { useEffect, useState } from 'react';

import { HttpLeagueClient, type LeagueClient, type LeagueFixture, type LeagueSnapshot } from './league-api';

const defaultLeagueClient = new HttpLeagueClient();

interface LeaguePageProps {
  leagueClient?: LeagueClient;
}

export function LeaguePage({ leagueClient = defaultLeagueClient }: LeaguePageProps) {
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

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
        if (isActive) {
          setStatus('error');
        }
      }
    }

    void loadLeagueData();

    return () => {
      isActive = false;
    };
  }, [leagueClient]);

  return (
    <main aria-labelledby="league-title" className="feature-screen">
      <header>
        <p className="eyebrow">Castle Draft League</p>
        <h1 id="league-title">League Fixtures and Table</h1>
        <p>Current fixtures, upcoming fixtures, standings, knockout, and head-to-head context.</p>
      </header>

      {status === 'loading' ? <p role="status">Loading league data</p> : null}
      {status === 'error' ? (
        <p role="alert">Unable to load league data from the league API.</p>
      ) : null}
      {snapshot ? <LeagueContent snapshot={snapshot} /> : null}
    </main>
  );
}

function LeagueContent({ snapshot }: { snapshot: LeagueSnapshot }) {
  return (
    <>
      <section aria-label="Current fixtures">
        <h2>Current fixtures</h2>
        <p>{snapshot.currentFixtures.gameweek?.name ?? 'Current gameweek'}</p>
        <FixtureTable fixtures={snapshot.currentFixtures.fixtures} />
      </section>

      <section aria-label="Upcoming fixtures">
        <h2>Upcoming fixtures</h2>
        <p>{snapshot.nextFixtures.gameweek?.name ?? 'Next gameweek'}</p>
        <FixtureTable fixtures={snapshot.nextFixtures.fixtures} />
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
            {snapshot.table.rows.map((row) => (
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
          {snapshot.allFixtures.fixtures.map((fixture) => (
            <li key={fixture.id}>
              {fixture.roundLabel}: {fixture.homeTeam.shortName ?? fixture.homeTeam.name} vs{' '}
              {fixture.awayTeam.shortName ?? fixture.awayTeam.name} - {formatScore(fixture)}
              {fixture.detailAvailable ? ' - Detail available' : ''}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Knockout and head-to-head">
        <h2>Knockout</h2>
        {snapshot.knockout.matches.length > 0 ? (
          <ul>
            {snapshot.knockout.matches.map((match) => (
              <li key={match.id}>
                {match.roundLabel}: {match.fixture.homeTeam.name} vs {match.fixture.awayTeam.name}
              </li>
            ))}
          </ul>
        ) : (
          <p>No knockout matches available.</p>
        )}
        <h2>Head-to-head</h2>
        {snapshot.headToHead.records.length > 0 ? (
          <ul>
            {snapshot.headToHead.records.map((record) => (
              <li key={`${record.team.id}-${record.opponent.id}`}>
                {record.team.name} vs {record.opponent.name}: {record.wins}-{record.draws}-
                {record.losses}, {record.pointsFor} points for and {record.pointsAgainst} against.
              </li>
            ))}
          </ul>
        ) : (
          <p>No head-to-head records available.</p>
        )}
      </section>
    </>
  );
}

function FixtureTable({ fixtures }: { fixtures: LeagueFixture[] }) {
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
        {fixtures.map((fixture) => (
          <tr key={fixture.id}>
            <td>{fixture.roundLabel}</td>
            <td>{fixture.homeTeam.name}</td>
            <td>{fixture.awayTeam.name}</td>
            <td>{formatScore(fixture)}</td>
            <td>{fixture.status}</td>
            <td>{fixture.detailAvailable ? 'Available' : 'Pending'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatScore(fixture: LeagueFixture): string {
  if (fixture.score.homeScore === null || fixture.score.awayScore === null) {
    return 'Pending';
  }

  return `${fixture.score.homeScore} - ${fixture.score.awayScore}`;
}
