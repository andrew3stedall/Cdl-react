import type { AttackDirection, ThemePreset } from './contracts';
import { SquadPage } from './SquadPage';
import type { TeamSelectionClient } from './team-selection-api';
import './squad-workspace-page.css';

interface SquadWorkspacePageProps {
  attackDirection?: AttackDirection;
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
}

export function SquadWorkspacePage({ attackDirection = 'up', preset, teamSelectionClient }: SquadWorkspacePageProps) {
  return (
    <div className="squad-workspace-page">
      <SquadPage attackDirection={attackDirection} preset={preset} teamSelectionClient={teamSelectionClient} />
    </div>
  );
}
