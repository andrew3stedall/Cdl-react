import { Card } from './components/ui/card';

interface CheckpointFeature {
  issue: number;
  title: string;
  api: string;
}

const features: CheckpointFeature[] = [
  {
    issue: 27,
    title: 'League, season, team, membership, and invitation model',
    api: '/api/modernisation/league-setup',
  },
  {
    issue: 28,
    title: 'League configuration and rule versioning',
    api: '/api/modernisation/rule-versions',
  },
  {
    issue: 29,
    title: 'Permissions, approvals, corrections, and audit',
    api: '/api/modernisation/approvals',
  },
  {
    issue: 34,
    title: 'FPL data access, cache, fetch log, and source freshness',
    api: '/api/modernisation/fpl/freshness',
  },
  {
    issue: 32,
    title: 'Live draft room, preselection, autopick, and commissioner controls',
    api: '/api/modernisation/draft-room',
  },
  {
    issue: 30,
    title: 'Squad rights, active assignments, history, and availability reasons',
    api: '/api/modernisation/squad/active',
  },
];

export function ModernisationCheckpointPage() {
  return (
    <main aria-labelledby="modernisation-checkpoint-title" className="feature-screen">
      <header>
        <p className="eyebrow">Checkpoint 1</p>
        <h1 id="modernisation-checkpoint-title">Modernisation foundation</h1>
        <p>
          Initial contracts for league setup, versioned rules, approvals, FPL cache,
          live draft, and squad rights.
        </p>
      </header>

      <section aria-label="Checkpoint summary" className="squad-summary-grid">
        <Card>
          <h2>Feature issues</h2>
          <strong>{features.length}</strong>
        </Card>
        <Card>
          <h2>Combined contract</h2>
          <strong>/api/modernisation/checkpoint-1</strong>
        </Card>
        <Card>
          <h2>Implementation status</h2>
          <strong>API-backed fixture layer</strong>
        </Card>
      </section>

      <section aria-label="Checkpoint feature contracts">
        <h2>Implemented feature contracts</h2>
        <div role="table" className="squad-data-table" aria-label="Checkpoint 1 features">
          <div role="row" className="squad-table-row squad-table-head">
            <span role="columnheader">Issue</span>
            <span role="columnheader">Feature</span>
            <span role="columnheader">API</span>
          </div>
          {features.map((feature) => (
            <div role="row" className="squad-table-row" key={feature.issue}>
              <span role="cell">#{feature.issue}</span>
              <span role="cell">{feature.title}</span>
              <span role="cell"><code>{feature.api}</code></span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
