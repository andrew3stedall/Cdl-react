import { CarouselItem } from '../ui/carousel';
import { LeagueFixture } from './LeagueFixture';
import type { FixtureRoundGroup, GameweekGroup, GameweekState } from './league-fixture-types';

export type GameweekSectionVariant = 'focus' | 'upcoming' | 'history';

export function LeagueGameweek({ group, index, label, onOpenFixture, totalGameweeks, variant }: { group: GameweekGroup; index: number; label: string; onOpenFixture: (fixture: GameweekGroup['fixtures'][number]) => void; totalGameweeks: number; variant: GameweekSectionVariant }) {
  return (
    <CarouselItem carouselIndex={index} className="league-gameweek-carousel__item" fade totalSlides={totalGameweeks}>
      <section aria-labelledby={`league-gameweek-${variant}-${group.gameweek.id}`} className={`league-gameweek-section league-gameweek-section--${variant}`}>
        <header className="league-gameweek-section__header">
          <div>
            <p className="eyebrow">{label}</p>
            <h2 id={`league-gameweek-${variant}-${group.gameweek.id}`}><span className="league-gameweek-section__number">GW {group.gameweek.number}</span>{group.gameweek.name}</h2>
          </div>
          <GameweekStateBadge gameweek={group.gameweek} state={group.state} />
        </header>
        <div className="league-fixture-list">
          {group.fixtures.map((fixture) => <LeagueFixture compact={variant !== 'focus'} fixture={fixture} key={fixture.id} onOpen={onOpenFixture} />)}
        </div>
      </section>
    </CarouselItem>
  );
}

function GameweekStateBadge({ gameweek, state }: { gameweek: FixtureRoundGroup['gameweeks'][number]['gameweek']; state: GameweekState }) {
  if (state === 'not-started') {
    return <time className="league-gameweek-state league-gameweek-state--not-started" dateTime={gameweek.deadlineAt ?? undefined}><span aria-hidden="true" />{formatDeadline(gameweek.deadlineAt)}</time>;
  }

  const label = state === 'finished' ? 'Finalised' : 'Live';
  return <span className={`league-gameweek-state league-gameweek-state--${state}`}><span aria-hidden="true" />{label}</span>;
}

function formatDeadline(deadlineAt?: string | null): string {
  if (!deadlineAt) return 'Deadline pending';
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return 'Deadline pending';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    weekday: 'short',
  }).format(deadline);
}
