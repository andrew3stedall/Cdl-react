export interface PlayerAvailabilityInput {
  availability?: string | null;
  availability_status?: string | null;
  chance_of_playing_next_round?: number | null;
}

export type AvailabilitySeverity = 'warning' | 'critical';

export interface AvailabilityIssue {
  label: string;
  severity: AvailabilitySeverity;
}

const FIT_STATUSES = new Set(['a', 'available', 'available_to_play', 'fit']);
const ISSUE_LABELS: Record<string, string> = {
  d: 'Doubtful',
  doubtful: 'Doubtful',
  i: 'Injured',
  injured: 'Injured',
  n: 'Not in squad',
  'not in squad': 'Not in squad',
  s: 'Suspended',
  suspended: 'Suspended',
  u: 'Unavailable',
  unavailable: 'Unavailable',
};

export function getAvailabilityIssue(player: PlayerAvailabilityInput): AvailabilityIssue | null {
  const status = (player.availability ?? player.availability_status ?? '').trim().toLowerCase();
  const statusLabel = ISSUE_LABELS[status];
  const isFitStatus = FIT_STATUSES.has(status);
  const chance = normaliseChance(player.chance_of_playing_next_round);

  // FPL's `a` status means available. A fit player should not receive a
  // positive marker; the UI reserves markers for information requiring action.
  if (chance === null && (isFitStatus || !statusLabel)) return null;
  if (chance !== null && chance >= 100 && !statusLabel) return null;

  const chanceLabel = chance !== null && chance < 100 ? `${chance}% chance` : null;
  const label = [statusLabel, chanceLabel].filter(Boolean).join(' · ') || 'Availability needs review';
  const critical = chance !== null && chance < 50
    || ['i', 'injured', 'n', 'not in squad', 's', 'suspended', 'u', 'unavailable'].includes(status);

  return { label, severity: critical ? 'critical' : 'warning' };
}

export function hasAvailabilityIssue(player: PlayerAvailabilityInput): boolean {
  return getAvailabilityIssue(player) !== null;
}

export function availabilityIssueLabel(player: PlayerAvailabilityInput): string | null {
  return getAvailabilityIssue(player)?.label ?? null;
}

export function availabilityChance(value: number | null | undefined): number | null {
  const chance = normaliseChance(value);
  return chance !== null && chance < 100 ? chance : null;
}

function normaliseChance(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
