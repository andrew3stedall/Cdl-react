import type { AttackDirection, ThemePreset } from './contracts';
import { SquadPage } from './SquadPage';
import type { SquadClient } from './squad-api';
import type { TeamSelectionClient } from './team-selection-api';
import './squad-workspace-page.css';

interface SquadWorkspacePageProps {
  attackDirection?: AttackDirection;
  onNavigate?: (href: string) => void;
  preset: ThemePreset;
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

export function SquadWorkspacePage({ attackDirection = 'up', onNavigate, preset, squadClient, teamSelectionClient }: SquadWorkspacePageProps) {
  return (
    <div className="squad-workspace-page">
      <SquadPage attackDirection={attackDirection} onNavigate={onNavigate} preset={preset} squadClient={squadClient} teamSelectionClient={teamSelectionClient} />
    </div>
  );
}
