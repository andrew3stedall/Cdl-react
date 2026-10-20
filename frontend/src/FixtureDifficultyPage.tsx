import { useEffect, useState } from 'react';

import { Card } from './components/ui/card';
import { PageHero } from './components/ui/page-hero';
import { Select } from './components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { SortableTableHead, useSortedRows } from './components/ui/sortable-table';
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
  onNavigate?: (href: string) => void;
}

export function FixtureDifficultyPage({ fdrClient = defaultFdrClient, onNavigate }: FixtureDifficultyPageProps) {
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
      <PageHero actions={null} actionsLabel="Page actions" onNavigate={onNavigate} title="Fixture difficulty" titleId="fdr-title" />

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
  const { direction, onSort, sortColumn, sortedRows } = useSortedRows(response.rows, (row, column) => {
    if (column === 'team') return row.team.shortName ?? row.team.name;
    if (column === 'average') return row.averageRating;
    const gameweek = Number(column.replace('gameweek-', ''));
    return row.fixtures.find((fixture) => fixture.gameweek.number === gameweek)?.rating;
  });

  return (
    <Card className="fdr-table-card">
      <header>
        <p className="eyebrow">{response.view}</p>
        <h2>{title}</h2>
      </header>
      <div aria-label={`${title} table`} className="fdr-table-scroll" role="region" tabIndex={0}>
        <Table className="fdr-table">
          <TableHeader>
            <TableRow>
              <TableHead className="fdr-team-column"><SortableTableHead column="team" direction={direction} onSort={onSort} sortColumn={sortColumn}>Team</SortableTableHead></TableHead>
              {gameweeks.map((gameweek) => (
                <TableHead key={gameweek.id}><SortableTableHead column={`gameweek-${gameweek.number}`} direction={direction} onSort={onSort} sortColumn={sortColumn}>GW{gameweek.number}</SortableTableHead></TableHead>
              ))}
              <TableHead><SortableTableHead column="average" direction={direction} onSort={onSort} sortColumn={sortColumn}>Avg</SortableTableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.team.id}>
                <TableHead className="fdr-team-column" scope="row">
                  {row.team.shortName ?? row.team.name}
                </TableHead>
                {gameweeks.map((gameweek) => (
                  <TableCell key={gameweek.id}>
                    <FixtureCell fixture={findFixture(row.fixtures, gameweek.number)} />
                  </TableCell>
                ))}
                <TableCell>{row.averageRating}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
