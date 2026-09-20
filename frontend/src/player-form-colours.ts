export type PlayerFormColour = 'empty' | '1' | '2' | '3' | '4' | '5';

/**
 * Classify one fixture using the same score bands as the five-dot form history.
 * A player who did not play remains ungraded, even when the recorded score is 0.
 */
export function playerFormColour(points: number | null | undefined, minutes: number | null | undefined): PlayerFormColour {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return 'empty';
  const score = typeof points === 'number' && Number.isFinite(points) ? points : 0;
  if (score <= 0) return '1';
  if (score <= 2) return '2';
  if (score <= 4) return '3';
  if (score <= 6) return '4';
  return '5';
}
