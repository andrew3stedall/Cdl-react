import type { CSSProperties } from 'react';

export const PROFILE_CHART_COLUMN_COUNT = 8;

export function chartFixtureSlots<T>(fixtures: ReadonlyArray<T | null>, slotCount = PROFILE_CHART_COLUMN_COUNT): Array<T | null> {
  const visibleSlotCount = Math.max(1, Math.floor(slotCount));
  const visibleFixtures = fixtures.slice(-visibleSlotCount);
  return [
    ...Array.from({ length: visibleSlotCount - visibleFixtures.length }, () => null),
    ...visibleFixtures,
  ];
}

export function formatOpponentLabel(shortName: string | null, isHome: boolean): string {
  if (!shortName) return '—';
  return isHome ? shortName.toUpperCase() : shortName.toLowerCase();
}

export function fdrStyleFor(value: number | null, displayMode: 'font' | 'fill'): CSSProperties {
  if (value === null || !Number.isFinite(value)) return {};
  const fdr = Math.min(5, Math.max(1, Math.round(value)));
  if (displayMode === 'fill') {
    return {
      backgroundColor: `var(--cdl-fdr-fill-${fdr})`,
      color: `var(--cdl-fdr-fill-foreground-${fdr})`,
    };
  }
  return { color: `var(--cdl-fdr-${fdr})` };
}

export function formatNullableNumber(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '—' : String(value);
}

export function barTone(value: number | null): string {
  if (value === null) return 'empty';
  if (value < 0) return 'negative';
  if (value === 0) return 'neutral';
  if (value >= 10) return 'high';
  if (value >= 5) return 'positive';
  return 'low';
}

export function formChartScaleMax(fixtures: ReadonlyArray<{ fantasyPoints: number | null }>): number {
  const largestScore = fixtures.reduce((largest, fixture) => Math.max(largest, fixture.fantasyPoints ?? 0), 0);
  return Math.max(10, Math.ceil(largestScore / 5) * 5);
}
