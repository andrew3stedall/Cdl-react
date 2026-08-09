import type { ThemePreset } from './contracts';
import { SquadPage } from './SquadPage';
import type { TeamSelectionClient } from './team-selection-api';
import './squad-workspace-page.css';

interface SquadWorkspacePageProps {
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
}

export function SquadWorkspacePage({ preset, teamSelectionClient }: SquadWorkspacePageProps) {
  return (
    <div className="squad-workspace-page">
      <SquadPage preset={preset} teamSelectionClient={teamSelectionClient} />
    </div>
  );
}
