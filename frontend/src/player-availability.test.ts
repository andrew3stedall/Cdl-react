import { describe, expect, test } from 'vitest';

import { availabilityIssueLabel, getAvailabilityIssue, hasAvailabilityIssue } from './player-availability';

describe('player availability interpretation', () => {
  test('does not create a marker for the FPL available status', () => {
    expect(hasAvailabilityIssue({ availability_status: 'a' })).toBe(false);
    expect(hasAvailabilityIssue({ availability_status: 'available', chance_of_playing_next_round: 100 })).toBe(false);
    expect(getAvailabilityIssue({ availability_status: 'a', chance_of_playing_next_round: null })).toBeNull();
  });

  test('creates a warning for a reduced chance of playing', () => {
    expect(getAvailabilityIssue({ availability_status: 'a', chance_of_playing_next_round: 75 })).toEqual({
      label: '75% chance',
      severity: 'warning',
    });
  });

  test('combines a known issue status with its chance and escalates severe statuses', () => {
    expect(availabilityIssueLabel({ availability_status: 'd', chance_of_playing_next_round: 75 })).toBe('Doubtful · 75% chance');
    expect(getAvailabilityIssue({ availability_status: 'i' })).toEqual({
      label: 'Injured',
      severity: 'critical',
    });
  });
});
