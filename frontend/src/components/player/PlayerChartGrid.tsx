import './player-chart-grid.css';

export interface PlayerChartGridProps {
  direction?: 'down' | 'up';
  max: number;
  step: number;
}

export function PlayerChartGrid({ direction = 'up', max, step }: PlayerChartGridProps) {
  const ticks = chartGridTicks(max, step);

  return (
    <span aria-hidden="true" className="player-profile__chart-grid">
      {ticks.map((tick) => (
        <i
          className="player-profile__chart-gridline"
          key={tick}
          style={direction === 'down' ? { top: `${(tick / max) * 100}%` } : { bottom: `${(tick / max) * 100}%` }}
        />
      ))}
    </span>
  );
}

export function PlayerChartZeroLine() {
  return <span aria-hidden="true" className="player-profile__chart-zero-line" />;
}

export function PlayerChartYAxis({ max, step }: PlayerChartGridProps) {
  return (
    <div aria-hidden="true" className="player-profile__chart-y-axis">
      <span aria-hidden="true" />
      <PlayerChartYAxisScale max={max} step={step} />
      <span aria-hidden="true" />
    </div>
  );
}

export function PlayerChartYAxisScale({ className = '', direction = 'up', max, step }: PlayerChartGridProps & { className?: string; direction?: 'down' | 'up' }) {
  return (
    <div className={`player-profile__chart-y-axis-scale player-profile__chart-y-axis-scale--${direction}${className ? ` ${className}` : ''}`} data-axis-direction={direction}>
      {chartAxisTicks(max, step).map((tick) => (
        <span
          className="player-profile__chart-y-axis-label"
          key={tick}
          style={direction === 'down' ? { top: `${(tick / max) * 100}%` } : { bottom: `${(tick / max) * 100}%` }}
        >
          {tick}
        </span>
      ))}
    </div>
  );
}

export function chartGridTicks(max: number, step: number): number[] {
  if (!Number.isFinite(max) || !Number.isFinite(step) || max <= 0 || step <= 0) return [];
  return Array.from(
    { length: Math.max(0, Math.ceil(max / step) - 1) },
    (_, index) => (index + 1) * step,
  ).filter((tick) => tick < max);
}

export function chartAxisTicks(max: number, step: number): number[] {
  if (!Number.isFinite(max) || !Number.isFinite(step) || max <= 0 || step <= 0) return [];
  return [max, ...chartGridTicks(max, step).reverse(), 0];
}
