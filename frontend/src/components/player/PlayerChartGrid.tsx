import './player-chart-grid.css';

export interface PlayerChartGridProps {
  max: number;
  step: number;
}

export function PlayerChartGrid({ max, step }: PlayerChartGridProps) {
  const ticks = chartGridTicks(max, step);

  return (
    <span aria-hidden="true" className="player-profile__chart-grid">
      {ticks.map((tick) => (
        <i
          className="player-profile__chart-gridline"
          key={tick}
          style={{ bottom: `${(tick / max) * 100}%` }}
        />
      ))}
    </span>
  );
}

export function chartGridTicks(max: number, step: number): number[] {
  if (!Number.isFinite(max) || !Number.isFinite(step) || max <= 0 || step <= 0) return [];
  return Array.from(
    { length: Math.max(0, Math.ceil(max / step) - 1) },
    (_, index) => (index + 1) * step,
  ).filter((tick) => tick < max);
}
