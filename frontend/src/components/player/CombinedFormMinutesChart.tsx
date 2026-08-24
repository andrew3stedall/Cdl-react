import type { CSSProperties } from 'react';

import { PlayerStatIcons, type PlayerStatSummary } from './PlayerStatIcons';
import {
  barTone,
  chartColumnStyle,
  fdrStyleFor,
  formChartScaleMax,
  formatNullableNumber,
  formatOpponentLabel,
} from './player-chart-utils';
import './combined-form-minutes-chart.css';

export interface CombinedFormMinutesFixture {
  fixtureId: string;
  position: string | null;
  opponentShortName: string | null;
  isHome: boolean;
  fdr: number | null;
  fantasyPoints: number | null;
  minutesPlayed: number | null;
  stats: PlayerStatSummary;
}

export function CombinedFormMinutesChart({
  fixtures,
  fdrDisplayMode,
  windowLabel = 'latest ten',
}: {
  fixtures: CombinedFormMinutesFixture[];
  fdrDisplayMode: 'font' | 'fill';
  windowLabel?: string;
}) {
  const formMax = formChartScaleMax(fixtures);
  const minutesMax = 90;

  return (
    <div
      aria-label={`Fantasy points above the zero line and minutes played below it over the ${windowLabel} fixtures`}
      className="player-profile__combined-chart"
      data-chart-kind="combined-form-minutes"
      data-minutes-y-axis-max={minutesMax}
      data-minutes-y-axis-min="0"
      data-minutes-y-axis-threshold="60"
      data-y-axis-max={formMax}
      data-y-axis-min={`-${minutesMax}`}
      role="img"
    >
      <div className="player-profile__combined-chart-columns">
        {fixtures.map((fixture, index) => (
          <CombinedChartColumn
            fixture={fixture}
            formMax={formMax}
            fdrDisplayMode={fdrDisplayMode}
            key={fixture.fixtureId}
            minutesMax={minutesMax}
            style={chartColumnStyle(index, fixtures.length)}
          />
        ))}
      </div>
    </div>
  );
}

function CombinedChartColumn({
  fixture,
  formMax,
  fdrDisplayMode,
  minutesMax,
  style,
}: {
  fixture: CombinedFormMinutesFixture;
  formMax: number;
  fdrDisplayMode: 'font' | 'fill';
  minutesMax: number;
  style?: CSSProperties;
}) {
  const pointsHeight = chartBarHeight(fixture.fantasyPoints, formMax);
  const minutesHeight = chartBarHeight(fixture.minutesPlayed, minutesMax);
  const pointsTone = barTone(fixture.fantasyPoints);

  return (
    <div className="player-profile__combined-chart-column" style={style}>
      <div className="player-profile__combined-positive">
        <span className={`player-profile__chart-value${fixture.fantasyPoints === null ? ' is-empty' : ''}`}>
          {formatNullableNumber(fixture.fantasyPoints)}
        </span>
        <div className="player-profile__combined-track player-profile__combined-track--positive">
          <div
            className={`player-profile__combined-bar player-profile__combined-bar--${pointsTone}`}
            style={{ '--bar-height': `${pointsHeight}%` } as CSSProperties}
          >
            <PlayerStatIcons position={fixture.position} stats={fixture.stats} />
          </div>
        </div>
      </div>
      <span className="player-profile__combined-opponent" style={fdrStyleFor(fixture.fdr, fdrDisplayMode)}>
        {formatOpponentLabel(fixture.opponentShortName, fixture.isHome)}
      </span>
      <div className="player-profile__combined-negative">
        <div className="player-profile__combined-track player-profile__combined-track--negative">
          <div aria-hidden="true" className="player-profile__combined-threshold-line" />
          <div
            className="player-profile__combined-bar player-profile__combined-bar--minutes"
            style={{ '--bar-height': `${minutesHeight}%` } as CSSProperties}
          />
        </div>
        <span className={`player-profile__chart-value${fixture.minutesPlayed === null ? ' is-empty' : ''}`}>
          {formatNullableNumber(fixture.minutesPlayed)}
        </span>
      </div>
    </div>
  );
}

function chartBarHeight(value: number | null, maxValue: number): number {
  if (value === null) return 0;
  if (value === 0) return 5;
  return Math.max(8, (Math.abs(value) / maxValue) * 100);
}
