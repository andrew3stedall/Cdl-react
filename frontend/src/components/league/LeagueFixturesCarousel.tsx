import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { Carousel, CarouselContent, CarouselNext, CarouselPrevious, type CarouselApi } from '../ui/carousel';
import type { LeagueFixture, LeagueSnapshot } from '../../league-api';
import { LeagueRound } from './LeagueRound';
import type { FixtureRoundGroup, GameweekGroup, GameweekState } from './league-fixture-types';

export function LeagueFixturesCarousel({ onOpenFixture, snapshot }: { onOpenFixture: (fixture: LeagueFixture) => void; snapshot: LeagueSnapshot }) {
  const rounds = useMemo(() => groupFixturesByRound(snapshot), [snapshot]);
  const defaultRound = rounds.find((round) => round.isCurrent) ?? rounds[0] ?? null;
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | null>(defaultRound?.key ?? null);
  const defaultGameweekIndex = defaultRound ? gameweekIndexForRound(defaultRound, defaultGameweekForRound(defaultRound)) : 0;
  const [selectedGameweekIndex, setSelectedGameweekIndex] = useState(defaultGameweekIndex);

  useEffect(() => {
    setSelectedRoundKey((currentKey) => rounds.some((round) => round.key === currentKey) ? currentKey : defaultRound?.key ?? null);
  }, [defaultRound?.key, rounds]);

  useEffect(() => {
    const maxGameweekIndex = Math.max(...rounds.map((round) => round.gameweeks.length - 1), 0);
    setSelectedGameweekIndex((currentIndex) => Math.min(currentIndex, maxGameweekIndex));
  }, [rounds]);

  if (!rounds.length) {
    return <section aria-label="League fixtures" className="league-gameweek-list"><div className="league-empty-state"><span>No league fixtures are available yet.</span></div></section>;
  }

  const selectedRoundIndex = Math.max(0, rounds.findIndex((round) => round.key === selectedRoundKey));
  return (
    <section aria-label="League fixtures" className="league-fixtures-view">
      <RoundCarousel
        onOpenFixture={onOpenFixture}
        onSelect={setSelectedRoundKey}
        onSelectGameweek={setSelectedGameweekIndex}
        rounds={rounds}
        selectedGameweekIndex={selectedGameweekIndex}
        selectedRoundKey={rounds[selectedRoundIndex]?.key ?? rounds[0].key}
      />
    </section>
  );
}

function RoundCarousel({ onOpenFixture, onSelect, onSelectGameweek, rounds, selectedGameweekIndex, selectedRoundKey }: { onOpenFixture: (fixture: LeagueFixture) => void; onSelect: (key: string) => void; onSelectGameweek: (index: number) => void; rounds: FixtureRoundGroup[]; selectedGameweekIndex: number; selectedRoundKey: string }) {
  const selectedIndex = Math.max(0, rounds.findIndex((round) => round.key === selectedRoundKey));
  const [api, setApi] = useState<CarouselApi>();
  const fixtureRows = Math.max(...rounds.flatMap((round) => round.gameweeks.map((group) => group.fixtures.length)), 1);
  const carouselStyle = { '--league-round-carousel-height': `${Math.max(27, 14 + fixtureRows * 4.15)}rem` } as CSSProperties;

  useEffect(() => {
    if (api && api.selectedScrollSnap() !== selectedIndex) api.scrollTo(selectedIndex);
  }, [api, selectedIndex]);

  useEffect(() => {
    if (!api) return;
    const updateSelectedRound = (carouselApi: CarouselApi) => {
      const round = rounds[carouselApi.selectedScrollSnap()];
      if (round && round.key !== selectedRoundKey) onSelect(round.key);
    };
    updateSelectedRound(api);
    api.on('select', updateSelectedRound);
    api.on('reInit', updateSelectedRound);
    return () => {
      api.off('select', updateSelectedRound);
      api.off('reInit', updateSelectedRound);
    };
  }, [api, onSelect, rounds, selectedRoundKey]);

  return (
    <section aria-label="Fixture rounds" className="league-round-picker">
      <div className="league-round-picker__header">
        <div><p className="eyebrow">Fixture rounds</p><h2>{rounds[selectedIndex]?.label ?? 'Fixture rounds'}</h2></div>
        <span>{selectedIndex + 1} of {rounds.length}</span>
      </div>
      <Carousel aria-label="Rounds" className="league-round-carousel" opts={{ loop: rounds.length > 1, startIndex: selectedIndex }} setApi={setApi} style={carouselStyle}>
        <CarouselContent className="league-round-carousel__track">
          {rounds.map((round, index) => <LeagueRound
            gameweekIndex={selectedGameweekIndex}
            index={index}
            isActive={round.key === selectedRoundKey}
            isSelected={round.key === selectedRoundKey}
            key={round.key}
            onGameweekChange={onSelectGameweek}
            onOpenFixture={onOpenFixture}
            onSelect={() => api?.scrollTo(index)}
            round={round}
            totalRounds={rounds.length}
          />)}
        </CarouselContent>
        <CarouselPrevious aria-label="Previous round" />
        <CarouselNext aria-label="Next round" />
      </Carousel>
      <span className="league-round-picker__hint">Swipe horizontally to move between rounds</span>
    </section>
  );
}

function groupFixturesByRound(snapshot: LeagueSnapshot): FixtureRoundGroup[] {
  const allFixtures = uniqueFixtures([...snapshot.allFixtures.fixtures, ...snapshot.currentFixtures.fixtures, ...snapshot.nextFixtures.fixtures]);
  const currentGameweek = snapshot.currentFixtures.gameweek ?? snapshot.currentFixtures.fixtures[0]?.gameweek ?? allFixtures.find((fixture) => fixture.isCurrent)?.gameweek ?? null;
  const nextGameweek = snapshot.nextFixtures.gameweek ?? snapshot.nextFixtures.fixtures[0]?.gameweek ?? allFixtures.find((fixture) => fixture.isNext)?.gameweek ?? null;
  const roundMap = new Map<string, { descriptor: FixtureRoundDescriptor; gameweeks: Map<string, LeagueFixture[]> }>();

  for (const fixture of allFixtures) {
    const descriptor = fixtureRoundDescriptor(fixture);
    const round = roundMap.get(descriptor.key) ?? { descriptor, gameweeks: new Map<string, LeagueFixture[]>() };
    const fixtures = round.gameweeks.get(fixture.gameweek.id) ?? [];
    fixtures.push(fixture);
    round.gameweeks.set(fixture.gameweek.id, fixtures);
    roundMap.set(descriptor.key, round);
  }

  const rounds = Array.from(roundMap.values()).map(({ descriptor, gameweeks }) => {
    const mappedGameweeks = Array.from(gameweeks.entries()).map(([id, fixtures]) => {
      const gameweek = id === currentGameweek?.id ? currentGameweek : id === nextGameweek?.id ? nextGameweek : fixtures[0].gameweek;
      const hasCurrentMarker = fixtures.some((fixture) => fixture.isCurrent) || gameweek.id === currentGameweek?.id;
      const hasNextMarker = fixtures.some((fixture) => fixture.isNext) || gameweek.id === nextGameweek?.id;
      const resolvedFixtures = hasCurrentMarker && gameweek.id === currentGameweek?.id
        ? fixturesForGameweek(allFixtures, gameweek, snapshot.currentFixtures.fixtures)
        : hasNextMarker && gameweek.id === nextGameweek?.id
          ? fixturesForGameweek(allFixtures, gameweek, snapshot.nextFixtures.fixtures)
          : fixtures;
      return { gameweek, fixtures: sortFixtures(resolvedFixtures), id, isCurrent: hasCurrentMarker, isNext: hasNextMarker, state: getGameweekState(resolvedFixtures) } satisfies GameweekGroup;
    }).sort((left, right) => left.gameweek.number - right.gameweek.number || left.gameweek.name.localeCompare(right.gameweek.name));
    return { gameweeks: mappedGameweeks, isCurrent: mappedGameweeks.some((gameweek) => gameweek.isCurrent), expectedGameweeks: descriptor.expectedGameweeks, key: descriptor.key, label: descriptor.label, subLabel: descriptor.subLabel } satisfies FixtureRoundGroup;
  });

  return rounds.sort((left, right) => firstGameweekNumber(left) - firstGameweekNumber(right) || left.label.localeCompare(right.label));
}

interface FixtureRoundDescriptor {
  expectedGameweeks: number;
  key: string;
  label: string;
  subLabel: string;
}

function fixtureRoundDescriptor(fixture: LeagueFixture): FixtureRoundDescriptor {
  if (fixture.gameweek.number >= 1 && fixture.gameweek.number <= 35) {
    const roundNumber = Math.ceil(fixture.gameweek.number / 7);
    const start = (roundNumber - 1) * 7 + 1;
    const end = roundNumber * 7;
    return { expectedGameweeks: 7, key: `regular-season-round-${roundNumber}`, label: `Round ${roundNumber}`, subLabel: `Gameweeks ${start}–${end}` };
  }
  const label = fixture.roundLabel || 'Competition stage';
  return { expectedGameweeks: 1, key: `stage-${roundKey(label)}`, label, subLabel: `Gameweek ${fixture.gameweek.number}` };
}

function defaultGameweekForRound(round: FixtureRoundGroup): GameweekGroup | null {
  return round.gameweeks.find((gameweek) => gameweek.isCurrent) ?? round.gameweeks.find((gameweek) => gameweek.isNext) ?? round.gameweeks.find((gameweek) => gameweek.state === 'not-started') ?? round.gameweeks[round.gameweeks.length - 1] ?? null;
}

function gameweekIndexForRound(round: FixtureRoundGroup, gameweek: GameweekGroup | null): number {
  const index = gameweek ? round.gameweeks.findIndex((candidate) => candidate.id === gameweek.id) : -1;
  return index >= 0 ? index : 0;
}

function firstGameweekNumber(round: FixtureRoundGroup): number {
  return round.gameweeks[0]?.gameweek.number ?? Number.MAX_SAFE_INTEGER;
}

function roundKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'competition';
}

function fixturesForGameweek(allFixtures: LeagueFixture[], gameweek: LeagueFixture['gameweek'] | null, fallback: LeagueFixture[]): LeagueFixture[] {
  const matchingFixtures = gameweek ? allFixtures.filter((fixture) => fixture.gameweek.id === gameweek.id) : [];
  return matchingFixtures.length ? matchingFixtures : uniqueFixtures(fallback);
}

function getGameweekState(fixtures: LeagueFixture[]): GameweekState {
  if (!fixtures.some((fixture) => fixture.status !== 'pending')) return 'not-started';
  if (fixtures.every((fixture) => fixture.status === 'complete')) return 'finished';
  return 'underway';
}

function uniqueFixtures(fixtures: LeagueFixture[]): LeagueFixture[] {
  return fixtures.filter((fixture, index) => fixtures.findIndex((candidate) => candidate.id === fixture.id) === index);
}

function sortFixtures(fixtures: LeagueFixture[]): LeagueFixture[] {
  return [...fixtures].sort((left, right) => left.id.localeCompare(right.id));
}
