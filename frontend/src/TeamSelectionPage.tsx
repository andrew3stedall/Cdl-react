import type { ThemePreset } from './contracts';
import { SquadPage } from './SquadPage';
import type { TeamSelectionClient } from './team-selection-api';

interface TeamSelectionPageProps {
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
}

/**
 * Compatibility export for callers that still import the former standalone
 * Team Selection page. The rendered experience is now the canonical Squad
 * workspace so the lineup is not duplicated below it.
 */
export function TeamSelectionPage({ preset, teamSelectionClient }: TeamSelectionPageProps) {
  return <SquadPage preset={preset} teamSelectionClient={teamSelectionClient} />;
}

/** Compatibility export for the former embedded panel. */
export function TeamSelectionPanel({ preset, teamSelectionClient }: TeamSelectionPageProps & { embedded?: boolean }) {
  return <SquadPage preset={preset} teamSelectionClient={teamSelectionClient} />;
}
