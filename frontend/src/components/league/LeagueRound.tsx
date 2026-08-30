import { useEffect, useState, type CSSProperties } from 'react';

import type { LeagueFixture } from '../../league-api';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '../ui/carousel';
import { LeagueGameweek, type GameweekSectionVariant } from './LeagueGameweek';
import type { FixtureRoundGroup, GameweekGroup } from './league-fixture-types';

export function LeagueRound({ gameweekIndex, index, isActive, isSelected, onGameweekChange, onOpenFixture, onSelect, round, totalRounds }: { gameweekIndex: number; index: number; isActive: boolean; isSelected: boolean; onGameweekChange: (index: number) => void; onOpenFixture: (fixture: LeagueFixture) => void; onSelect: () => void; round: FixtureRoundGroup; totalRounds: number }) {
  return (
    <CarouselItem carouselIndex={index} className="league-round-carousel__item" fade totalSlides={totalRounds}>
      <div aria-label={`${round.label} fixtures`} className="league-fixture-round" id={`league-round-panel-${round.key}`}>
        <div className="league-fixture-round__summary">
          <button aria-current={isSelected ? 'true' : undefined} className={`league-round-picker__card${isSelected ? ' is-selected' : ''}${round.isCurrent ? ' is-current' : ''}`} onClick={onSelect} type="button">
            <span className="league-round-picker__card-label">{round.isCurrent ? `Live · ${round.label}` : round.label}</span>
            <strong>{round.subLabel}</strong>
            <small>{round.gameweeks.length}/{round.expectedGameweeks} gameweeks</small>
          </button>
          <span>{round.gameweeks.length} gameweeks</span>
        </div>
        <GameweekCarousel gameweekIndex={gameweekIndex} groups={round.gameweeks} isActive={isActive} onGameweekChange={onGameweekChange} onOpenFixture={onOpenFixture} />
      </div>
    </CarouselItem>
  );
}

function GameweekCarousel({ gameweekIndex, groups, isActive, onGameweekChange, onOpenFixture }: { gameweekIndex: number; groups: GameweekGroup[]; isActive: boolean; onGameweekChange: (index: number) => void; onOpenFixture: (fixture: LeagueFixture) => void }) {
  const initialIndex = Math.min(Math.max(gameweekIndex, 0), Math.max(groups.length - 1, 0));
  const [api, setApi] = useState<CarouselApi>();
  const fixtureRows = Math.max(...groups.map((group) => group.fixtures.length), 1);
  const carouselStyle = { '--league-gameweek-carousel-height': `${Math.max(21, 8.5 + fixtureRows * 4.15)}rem` } as CSSProperties;

  useEffect(() => {
    if (!api) return;
    const updateSelectedGameweek = (carouselApi: CarouselApi) => {
      if (isActive) onGameweekChange(carouselApi.selectedScrollSnap());
    };
    api.on('select', updateSelectedGameweek);
    api.on('reInit', updateSelectedGameweek);
    return () => {
      api.off('select', updateSelectedGameweek);
      api.off('reInit', updateSelectedGameweek);
    };
  }, [api, isActive, onGameweekChange]);

  useEffect(() => {
    if (api && api.selectedScrollSnap() !== initialIndex) api.scrollTo(initialIndex);
  }, [api, initialIndex]);

  return (
    <section aria-label="Gameweeks in selected round" className="league-gameweek-picker">
      <div className="league-gameweek-picker__header"><p className="eyebrow">Gameweeks</p><span>Swipe vertically to browse this round</span></div>
      <Carousel aria-label="Gameweeks" className="league-gameweek-carousel" opts={{ loop: groups.length > 1, startIndex: initialIndex }} orientation="vertical" setApi={setApi} style={carouselStyle}>
        <CarouselContent className="league-gameweek-carousel__track">
          {groups.map((group, index) => <LeagueGameweek group={group} index={index} key={group.id} label={primaryGameweekLabel(group)} onOpenFixture={onOpenFixture} totalGameweeks={groups.length} variant={gameweekVariant(group, index === initialIndex)} />)}
        </CarouselContent>
        <CarouselPrevious aria-label="Previous gameweek" />
        <CarouselNext aria-label="Next gameweek" />
      </Carousel>
    </section>
  );
}

function gameweekVariant(group: GameweekGroup, isSelected: boolean): GameweekSectionVariant {
  if (isSelected && group.isCurrent) return 'focus';
  if (group.state === 'finished') return 'history';
  return 'upcoming';
}

function primaryGameweekLabel(group: GameweekGroup): string {
  if (group.isCurrent && group.state === 'underway') return 'Live now';
  if (group.isCurrent) return 'Current gameweek';
  if (group.isNext) return 'Up next';
  if (group.state === 'finished') return 'Latest result';
  return 'Round focus';
}
