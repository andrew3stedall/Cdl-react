import type { CSSProperties } from 'react';

import { PlayerChartGrid, PlayerChartYAxisScale, PlayerChartZeroLine } from './PlayerChartGrid';
import { PlayerStatIcons, type PlayerStatSummary } from './PlayerStatIcons';
import {
  barTone,
  chartFixtureSlots,
  fdrStyleFor,
  formChartScaleMax,
  formatNullableNumber,
  formatOpponentLabel,
  PROFILE_CHART_COLUMN_COUNT,
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
  fixtureCount = PROFILE_CHART_COLUMN_COUNT,
  onFixtureClick,
  windowLabel = 'latest eight',
}: {
  fixtures: ReadonlyArray<CombinedFormMinutesFixture | null>;
  fdrDisplayMode: 'font' | 'fill';
  fixtureCount?: number;
  onFixtureClick?: (fixture: CombinedFormMinutesFixture) => void;
  windowLabel?: string;
}) {
  const formMax = formChartScaleMax(fixtures.filter((fixture): fixture is CombinedFormMinutesFixture => fixture !== null));
  const minutesMax = 90;
  const slots = chartFixtureSlots(fixtures, fixtureCount);
  const slotCount = slots.length;

  return (
    <div
      aria-label={`Fantasy points above the zero line and minutes played below it over the ${windowLabel} fixtures`}
      className="player-profile__combined-chart"
      data-chart-kind="combined-form-minutes"
      data-minutes-y-axis-max={minutesMax}
      data-minutes-y-axis-min="0"
      data-minutes-y-axis-tick-step="30"
      data-minutes-y-axis-threshold="60"
      data-fixture-count={slotCount}
      data-y-axis-max={formMax}
      data-y-axis-min={`-${minutesMax}`}
      data-y-axis-tick-step="5"
      role="group"
      style={{ '--combined-chart-column-count': slotCount } as CSSProperties}
    >
      <div className="player-profile__combined-chart-layout">
        <div aria-hidden="true" className="player-profile__combined-chart-y-axis">
          <PlayerChartYAxisScale className="player-profile__combined-chart-y-axis-scale--positive" max={formMax} step={5} />
          <PlayerChartYAxisScale className="player-profile__combined-chart-y-axis-scale--negative" direction="down" max={minutesMax} step={30} />
        </div>
        <div className="player-profile__combined-chart-plot">
          <div className="player-profile__combined-chart-grid player-profile__combined-chart-grid--positive">
            <PlayerChartGrid max={formMax} step={5} />
            <PlayerChartZeroLine />
          </div>
          <div className="player-profile__combined-chart-grid player-profile__combined-chart-grid--negative">
            <PlayerChartGrid direction="down" max={minutesMax} step={30} />
            <PlayerChartZeroLine />
          </div>
          <div className="player-profile__combined-chart-columns">
            {slots.map((fixture, index) => (
              <CombinedChartColumn
                fixture={fixture}
                formMax={formMax}
                fdrDisplayMode={fdrDisplayMode}
                key={`${fixture?.fixtureId ?? 'empty'}-${index}`}
                minutesMax={minutesMax}
                onFixtureClick={onFixtureClick}
              />
            ))}
          </div>
        </div>
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
  fixture: CombinedFormMinutesFixture | null;
  formMax: number;
  fdrDisplayMode: 'font' | 'fill';
  minutesMax: number;
  onFixtureClick?: (fixture: CombinedFormMinutesFixture) => void;
  style?: CSSProperties;
}) {
  const pointsHeight = fixture ? chartBarHeight(fixture.fantasyPoints, formMax) : 100;
  const minutesHeight = fixture ? chartBarHeight(fixture.minutesPlayed, minutesMax) : 100;
  const pointsTone = barTone(fixture?.fantasyPoints ?? null);

  return (
    <div className="player-profile__combined-chart-column" style={style}>
      <div className="player-profile__combined-positive">
        <span className={`player-profile__chart-value${fixture?.fantasyPoints === null || !fixture ? ' is-empty' : ''}`}>
          {formatNullableNumber(fixture?.fantasyPoints)}
        </span>
        <div className="player-profile__combined-track player-profile__combined-track--positive">
          {fixture ? <button
              aria-label={`View ${formatOpponentLabel(fixture.opponentShortName, fixture.isHome)} form details: ${formatNullableNumber(fixture.fantasyPoints)} points`}
              className={`player-profile__combined-bar player-profile__combined-bar--${pointsTone}`}
              onClick={() => onFixtureClick?.(fixture)}
              style={{ '--bar-height': `${pointsHeight}%` } as CSSProperties}
              type="button"
            >
              <PlayerStatIcons position={fixture.position} stats={fixture.stats} />
            </button> : <span aria-hidden="true" className="player-profile__combined-bar player-profile__combined-bar--empty" style={{ '--bar-height': `${pointsHeight}%` } as CSSProperties} />}
        </div>
      </div>
      <span className="player-profile__combined-opponent" style={fdrStyleFor(fixture?.fdr ?? null, fdrDisplayMode)}>
        {fixture ? formatOpponentLabel(fixture.opponentShortName, fixture.isHome) : ''}
      </span>
      <div className="player-profile__combined-negative">
        <div className="player-profile__combined-track player-profile__combined-track--negative">
          <div aria-hidden="true" className="player-profile__combined-threshold-line" />
          {fixture ? <button
              aria-label={`View ${formatOpponentLabel(fixture.opponentShortName, fixture.isHome)} minutes details: ${formatNullableNumber(fixture.minutesPlayed)} minutes`}
              className="player-profile__combined-bar player-profile__combined-bar--minutes"
              onClick={() => onFixtureClick?.(fixture)}
              style={{ '--bar-height': `${minutesHeight}%` } as CSSProperties}
              type="button"
            /> : <span aria-hidden="true" className="player-profile__combined-bar player-profile__combined-bar--empty player-profile__combined-bar--minutes" style={{ '--bar-height': `${minutesHeight}%` } as CSSProperties} />}
        </div>
        <span className={`player-profile__chart-value${fixture?.minutesPlayed === null || !fixture ? ' is-empty' : ''}`}>
          {formatNullableNumber(fixture?.minutesPlayed)}
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
