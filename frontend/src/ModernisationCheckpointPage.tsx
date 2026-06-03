import { Card } from './components/ui/card';

interface CheckpointFeature {
  issue: number;
  title: string;
  api: string;
}

interface CheckpointContent {
  checkpoint: number;
  eyebrow: string;
  title: string;
  summary: string;
  combinedContract: string;
  status: string;
  features: CheckpointFeature[];
}

const checkpointOneFeatures: CheckpointFeature[] = [
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

const checkpointTwoFeatures: CheckpointFeature[] = [
  {
    issue: 35,
    title: 'Team selection, lineup validation, locking, and auto-adjustment',
    api: '/api/modernisation/lineups/season-team-castle/gw-2',
  },
  {
    issue: 36,
    title: 'Substitution engine with formation-preserving explanations',
    api: '/api/modernisation/substitutions/explain',
  },
  {
    issue: 37,
    title: 'Chip activation and scoring modifier impact',
    api: '/api/modernisation/chips',
  },
  {
    issue: 39,
    title: 'Fixture scoring snapshots, finalisation, and corrections',
    api: '/api/modernisation/fixture-scoring/snapshots',
  },
  {
    issue: 40,
    title: 'Live, provisional, and official league table movement',
    api: '/api/modernisation/league-table',
  },
];

const checkpointThreeFeatures: CheckpointFeature[] = [
  {
    issue: 33,
    title: 'Free agency draw processing, private preferences, and expiring rights',
    api: '/api/modernisation/free-agency/draws/draw-gw-3',
  },
  {
    issue: 31,
    title: 'Transfer and loan negotiations with approval-gated squad effects',
    api: '/api/modernisation/negotiations',
  },
  {
    issue: 46,
    title: 'Notifications, activity visibility, reminders, and watchlist alerts',
    api: '/api/modernisation/notifications',
  },
];

const checkpointContent: Record<number, CheckpointContent> = {
  1: {
    checkpoint: 1,
    eyebrow: 'Checkpoint 1',
    title: 'Modernisation foundation',
    summary: 'Initial contracts for league setup, versioned rules, approvals, FPL cache, live draft, and squad rights.',
    combinedContract: '/api/modernisation/checkpoint-1',
    status: 'API-backed fixture layer',
    features: checkpointOneFeatures,
  },
  2: {
    checkpoint: 2,
    eyebrow: 'Checkpoint 2',
    title: 'Weekly gameplay contracts',
    summary: 'Contracts for team selection, substitutions, chips, fixture scoring snapshots, and league table movement.',
    combinedContract: '/api/modernisation/checkpoint-2',
    status: 'Weekly gameplay contract layer',
    features: checkpointTwoFeatures,
  },
  3: {
    checkpoint: 3,
    eyebrow: 'Checkpoint 3',
    title: 'Squad movement contracts',
    summary: 'Contracts for free agency draws, transfers, loans, notifications, activity, and deadline reminders.',
    combinedContract: '/api/modernisation/checkpoint-3',
    status: 'Squad movement contract layer',
    features: checkpointThreeFeatures,
  },
};

interface ModernisationCheckpointPageProps {
  checkpoint?: number;
}

export function ModernisationCheckpointPage({ checkpoint = 1 }: ModernisationCheckpointPageProps) {
  const content = checkpointContent[checkpoint] ?? checkpointContent[1];

  return (
    <main aria-labelledby="modernisation-checkpoint-title" className="feature-screen">
      <header>
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 id="modernisation-checkpoint-title">{content.title}</h1>
        <p>{content.summary}</p>
      </header>

      <section aria-label="Checkpoint summary" className="squad-summary-grid">
        <Card>
          <h2>Feature issues</h2>
          <strong>{content.features.length}</strong>
        </Card>
        <Card>
          <h2>Combined contract</h2>
          <strong>{content.combinedContract}</strong>
        </Card>
        <Card>
          <h2>Implementation status</h2>
          <strong>{content.status}</strong>
        </Card>
      </section>

      <section aria-label="Checkpoint feature contracts">
        <h2>Implemented feature contracts</h2>
        <div
          role="table"
          className="squad-data-table"
          aria-label={`Checkpoint ${content.checkpoint} features`}
        >
          <div role="row" className="squad-table-row squad-table-head">
            <span role="columnheader">Issue</span>
            <span role="columnheader">Feature</span>
            <span role="columnheader">API</span>
          </div>
          {content.features.map((feature) => (
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
