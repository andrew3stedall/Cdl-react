import type { ThemePreset } from './contracts';
import { SquadPage } from './SquadPage';
import { TeamSelectionPanel } from './TeamSelectionPage';
import type { TeamSelectionClient } from './team-selection-api';
import './squad-workspace-page.css';

interface SquadWorkspacePageProps {
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
}

export function SquadWorkspacePage({ preset, teamSelectionClient }: SquadWorkspacePageProps) {
  return (
    <div className="squad-workspace-page">
      <SquadPage preset={preset} />
      <section aria-label="Gameweek squad controls" className="squad-workspace-page__gameweek">
        <TeamSelectionPanel
          embedded
          preset={preset}
          teamSelectionClient={teamSelectionClient}
        />
      </section>
    </div>
  );
}
