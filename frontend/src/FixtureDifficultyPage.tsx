import { useEffect, useState } from 'react';

import { Card } from './components/ui/card';
import { Select } from './components/ui/select';
import type {
  FdrClient,
  FdrCombinedResponse,
  FdrFilters,
  FdrFixtureCell,
  FdrScaleStep,
  FdrViewResponse,
} from './fdr-api';
import { HttpFdrClient } from './fdr-api';
import './fdr.css';

const defaultFdrClient = new HttpFdrClient();
const defaultFilters: FdrFilters = {
  season: '2025/26',
  teamId: null,
  gameweekStart: 12,
  gameweekEnd: 16,
};

interface FixtureDifficultyPageProps {
  fdrClient?: FdrClient;
}

export function FixtureDifficultyPage({ fdrClient = defaultFdrClient }: FixtureDifficultyPageProps) {
  const [data, setData] = useState<FdrCombinedResponse | null>(null);
  const [filters, setFilters] = useState<FdrFilters>(defaultFilters);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let isActive = true;

    async function loadFdr() {
      setStatus('loading');
      try {
        const response = await fdrClient.getFdr(filters);
        if (isActive) {
          setData(response);
          setStatus('loaded');
        }
      } catch {
        if (isActive) {
          setStatus('error');
        }
      }
    }

    void loadFdr();

    return () => {
      isActive = false;
    };
  }, [fdrClient, filters]);

  const availableTeams = data?.attack.availableTeams ?? [];
  const availableGameweeks = data?.attack.availableGameweeks ?? [];
  const updateFilters = (nextFilters: Partial<FdrFilters>) => {
    setFilters((current) => ({ ...current, ...nextFilters }));
  };

  return (
    <main aria-labelledby="fdr-title" className="feature-screen fdr-page">
      <header>
        <p className="eyebrow">Fixture Difficulty Ratings</p>
        <h1 id="fdr-title">Attack and defence FDR</h1>
        <p>Compare fixture difficulty by team, gameweek range, and attacking or defensive view.</p>
      </header>

      {status === 'loading' ? <p role="status">Loading fixture difficulty ratings</p> : null}
      {status === 'error' ? <p role="alert">Unable to load fixture difficulty ratings.</p> : null}

      <section aria-label="FDR filters" className="fdr-filters">
        <Select
          label="Team"
          onChange={(event) => {
            updateFilters({ teamId: event.target.value || null });
          }}
          options={[
            { label: 'All teams', value: '' },
            ...availableTeams.map((team) => ({ label: team.name, value: team.id })),
          ]}
          value={filters.teamId ?? ''}
        />
        <Select
          label="Start gameweek"
          onChange={(event) => {
            updateFilters({ gameweekStart: Number(event.target.value) });
          }}
          options={availableGameweeks.map((gameweek) => ({
            label: gameweek.name,
            value: String(gameweek.number),
          }))}
          value={String(filters.gameweekStart)}
        />
        <Select
          label="End gameweek"
          onChange={(event) => {
            updateFilters({ gameweekEnd: Number(event.target.value) });
          }}
          options={availableGameweeks.map((gameweek) => ({
            label: gameweek.name,
            value: String(gameweek.number),
          }))}
          value={String(filters.gameweekEnd)}
        />
      </section>

      {data ? (
        <>
          <RatingLegend scales={data.scales} />
          <FdrTable title="Attack FDR" response={data.attack} />
          <FdrTable title="Defence FDR" response={data.defence} />
        </>
      ) : null}
    </main>
  );
}

function RatingLegend({ scales }: { scales: FdrScaleStep[] }) {
  return (
    <Card className="fdr-legend" aria-label="FDR rating legend">
      <h2>Rating scale</h2>
      <div className="fdr-legend-items">
        {scales.map((scale) => (
          <span className={`fdr-rating fdr-rating-${scale.rating}`} key={scale.rating}>
            {scale.rating} - {scale.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

function FdrTable({ title, response }: { title: string; response: FdrViewResponse }) {
  const gameweeks = response.availableGameweeks;

  return (
    <Card className="fdr-table-card">
      <header>
        <p className="eyebrow">{response.view}</p>
        <h2>{title}</h2>
      </header>
      <div className="fdr-table-scroll">
        <table className="fdr-table">
          <thead>
            <tr>
              <th className="fdr-team-column">Team</th>
              {gameweeks.map((gameweek) => (
                <th key={gameweek.id}>GW{gameweek.number}</th>
              ))}
              <th>Avg</th>
            </tr>
          </thead>
          <tbody>
            {response.rows.map((row) => (
              <tr key={row.team.id}>
                <th className="fdr-team-column" scope="row">
                  {row.team.shortName ?? row.team.name}
                </th>
                {gameweeks.map((gameweek) => (
                  <td key={gameweek.id}>
                    <FixtureCell fixture={findFixture(row.fixtures, gameweek.number)} />
                  </td>
                ))}
                <td>{row.averageRating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FixtureCell({ fixture }: { fixture?: FdrFixtureCell }) {
  if (!fixture) {
    return <span className="fdr-empty-cell">-</span>;
  }

  return (
    <span className={`fdr-cell fdr-rating-${fixture.rating}`} title={`${fixture.abbreviation}: ${fixture.rating}`}>
      <strong>{fixture.abbreviation}</strong>
      <small>{fixture.rating}</small>
    </span>
  );
}

function findFixture(fixtures: FdrFixtureCell[], gameweekNumber: number): FdrFixtureCell | undefined {
  return fixtures.find((fixture) => fixture.gameweek.number === gameweekNumber);
}
