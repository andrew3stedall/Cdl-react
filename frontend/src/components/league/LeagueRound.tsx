import type { FixtureRoundGroup } from './league-fixture-types';

import { CarouselItem } from '../ui/carousel';

export function LeagueRound({ index, isSelected, onSelect, round, totalRounds }: { index: number; isSelected: boolean; onSelect: () => void; round: FixtureRoundGroup; totalRounds: number }) {
  return (
    <CarouselItem carouselIndex={index} className="league-round-carousel__item" fade totalSlides={totalRounds}>
      <button aria-current={isSelected ? 'true' : undefined} className={`league-round-picker__card${isSelected ? ' is-selected' : ''}${round.isCurrent ? ' is-current' : ''}`} onClick={onSelect} type="button">
        <span className="league-round-picker__card-label">{round.isCurrent ? `Live · ${round.label}` : round.label}</span>
        <strong>{round.subLabel}</strong>
        <small>{round.gameweeks.length}/{round.expectedGameweeks} gameweeks</small>
      </button>
    </CarouselItem>
  );
}
