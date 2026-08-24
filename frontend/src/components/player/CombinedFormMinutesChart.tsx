import type { CSSProperties } from 'react';

import { PlayerChartGrid } from './PlayerChartGrid';
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
  onFixtureClick,
  windowLabel = 'latest ten',
}: {
  fixtures: CombinedFormMinutesFixture[];
  fdrDisplayMode: 'font' | 'fill';
  onFixtureClick?: (fixture: CombinedFormMinutesFixture) => void;
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
      data-minutes-y-axis-tick-step="30"
      data-minutes-y-axis-threshold="60"
      data-y-axis-max={formMax}
      data-y-axis-min={`-${minutesMax}`}
      data-y-axis-tick-step="5"
      role="group"
    >
      <div className="player-profile__combined-chart-columns">
        {fixtures.map((fixture, index) => (
          <CombinedChartColumn
            fixture={fixture}
            formMax={formMax}
            fdrDisplayMode={fdrDisplayMode}
            key={fixture.fixtureId}
            minutesMax={minutesMax}
            onFixtureClick={onFixtureClick}
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
  onFixtureClick,
  style,
}: {
  fixture: CombinedFormMinutesFixture;
  formMax: number;
  fdrDisplayMode: 'font' | 'fill';
  minutesMax: number;
  onFixtureClick?: (fixture: CombinedFormMinutesFixture) => void;
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
          <PlayerChartGrid max={formMax} step={5} />
          <button
            aria-label={`View ${formatOpponentLabel(fixture.opponentShortName, fixture.isHome)} form details: ${formatNullableNumber(fixture.fantasyPoints)} points`}
            className={`player-profile__combined-bar player-profile__combined-bar--${pointsTone}`}
            onClick={() => onFixtureClick?.(fixture)}
            style={{ '--bar-height': `${pointsHeight}%` } as CSSProperties}
            type="button"
          >
            <PlayerStatIcons position={fixture.position} stats={fixture.stats} />
          </button>
        </div>
      </div>
      <span className="player-profile__combined-opponent" style={fdrStyleFor(fixture.fdr, fdrDisplayMode)}>
        {formatOpponentLabel(fixture.opponentShortName, fixture.isHome)}
      </span>
      <div className="player-profile__combined-negative">
        <div className="player-profile__combined-track player-profile__combined-track--negative">
          <PlayerChartGrid max={minutesMax} step={30} />
          <div aria-hidden="true" className="player-profile__combined-threshold-line" />
          <button
            aria-label={`View ${formatOpponentLabel(fixture.opponentShortName, fixture.isHome)} minutes details: ${formatNullableNumber(fixture.minutesPlayed)} minutes`}
            className="player-profile__combined-bar player-profile__combined-bar--minutes"
            onClick={() => onFixtureClick?.(fixture)}
            style={{ '--bar-height': `${minutesHeight}%` } as CSSProperties}
            type="button"
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
