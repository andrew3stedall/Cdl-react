import type { AttackDirection, ThemePreset } from './contracts';
import { SquadPage } from './SquadPage';
import type { TeamSelectionClient } from './team-selection-api';
import './squad-workspace-page.css';

interface SquadWorkspacePageProps {
  attackDirection?: AttackDirection;
  onNavigate?: (href: string) => void;
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
}

export function SquadWorkspacePage({ attackDirection = 'up', onNavigate, preset, teamSelectionClient }: SquadWorkspacePageProps) {
  return (
    <div className="squad-workspace-page">
      <SquadPage attackDirection={attackDirection} onNavigate={onNavigate} preset={preset} teamSelectionClient={teamSelectionClient} />
    </div>
  );
}
