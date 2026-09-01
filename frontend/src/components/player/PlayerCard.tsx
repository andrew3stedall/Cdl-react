import { type HTMLAttributes } from 'react';

import { officialFplShirtUrl } from '../../fpl-shirt-assets';
import './player-card.css';

export interface PlayerCardFixture {
  label: string;
  difficulty?: number | null;
  title?: string;
}

export interface PlayerCardPlayer {
  displayName: string;
  team: string;
  position?: string | null;
  form?: number | null;
  fixtures?: readonly PlayerCardFixture[];
  captain?: boolean;
  viceCaptain?: boolean;
  availabilityChance?: number | null;
}

export type PlayerCardLayout = 'pitch' | 'list' | 'token';
export type PlayerCardSize = 'xs' | 'sm' | 'md' | 'lg';
export type PlayerCardFormPosition = 'below' | 'beside' | 'hidden';

export interface PlayerCardProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  player: PlayerCardPlayer;
  layout?: PlayerCardLayout;
  size?: PlayerCardSize;
  formPosition?: PlayerCardFormPosition;
  points?: number | null;
  pointsMultiplier?: number | null;
  showOpponent?: boolean;
  showPositionMarker?: boolean;
  ariaLabel?: string;
}

export function PlayerCard({
  ariaLabel,
  className = '',
  formPosition = 'hidden',
  layout = 'list',
  player,
  points = null,
  pointsMultiplier = null,
  showOpponent = true,
  showPositionMarker = false,
  size = 'sm',
  ...rest
}: PlayerCardProps) {
  const formClass = `form-band-${formBand(player.form)}`;
  const classes = [
    'player-card',
    `player-card--${layout}`,
    `player-card--size-${size}`,
    `player-card--form-${formPosition}`,
    points !== null && points !== undefined ? 'player-card--has-points' : '',
    formClass,
    className,
  ].filter(Boolean).join(' ');

  return (
    <span aria-label={ariaLabel} className={classes} {...rest}>
      <PlayerToken points={points} pointsMultiplier={pointsMultiplier} player={player} showOpponent={showOpponent} showPositionMarker={showPositionMarker} />
      {formPosition !== 'hidden' ? <FormDots className="player-card__form" value={player.form} /> : null}
    </span>
  );
}

export function OpponentFdrBadge({
  className = '',
  difficulty,
  label,
  title,
}: {
  className?: string;
  difficulty?: number | null;
  label: string;
  title?: string;
}) {
  const rating = typeof difficulty === 'number' && Number.isFinite(difficulty)
    ? Math.min(5, Math.max(1, Math.round(difficulty)))
    : null;
  return (
    <span
      className={`player-card__opponent${rating === null ? '' : ` player-card__opponent--fdr-${rating}`}${className ? ` ${className}` : ''}`}
      title={title}
    >
      {label}
    </span>
  );
}

function PlayerToken({ points, pointsMultiplier, player, showOpponent, showPositionMarker }: { points: number | null; pointsMultiplier: number | null; player: PlayerCardPlayer; showOpponent: boolean; showPositionMarker: boolean }) {
  const fixtures = player.fixtures ?? [];
  const chance = player.availabilityChance;
  const hasAvailabilityWarning = typeof chance === 'number' && Number.isFinite(chance) && chance < 100;
  const positionClass = player.position ? ` position-${normalizePosition(player.position).toLowerCase()}` : '';

  return (
    <span aria-label={`Shirt for ${player.displayName}`} className={`player-card__token${showOpponent ? ' player-card__token--with-opponent' : ''}${positionClass}`} role="img">
      {showPositionMarker && player.position ? <PositionMarker position={player.position} /> : null}
      <span aria-hidden="true" className="player-card__shirt-crop">
        <TeamShirt large team={player.team} />
      </span>
      {points !== null && points !== undefined ? <strong aria-label={`${points}${pointsMultiplier && pointsMultiplier > 1 ? ` points multiplied by ${pointsMultiplier}` : ' fantasy points'}`} className="player-card__points">{points}{pointsMultiplier && pointsMultiplier > 1 ? ` ×${pointsMultiplier}` : ''}</strong> : null}
      <strong className="player-card__name">{shortPlayerName(player.displayName)}</strong>
      {showOpponent ? (
        <small
          className={`player-card__opponents ${fixtures.length > 1 ? 'player-card__opponents--multiple' : 'player-card__opponents--single'}`}
          data-fixture-count={fixtures.length}
          title={fixtures.length === 1 ? fixtures[0]?.title : 'Next gameweek fixtures'}
        >
          {fixtures.length > 0
            ? fixtures.map((fixture) => <span className={fixtureClassName(fixture.difficulty)} key={`${fixture.label}-${fixture.difficulty ?? 'unknown'}`} title={fixture.title}>{fixture.label}</span>)
            : <span className="player-card__opponent player-card__opponent--placeholder">Next —</span>}
        </small>
      ) : null}
      {player.captain ? <span aria-label="Captain" className="player-card__role">C</span> : null}
      {player.viceCaptain ? <span aria-label="Vice-captain" className="player-card__role player-card__role--vice">VC</span> : null}
      {hasAvailabilityWarning ? <span aria-label={`${chance}% chance of playing`} className="player-card__availability squad-page__availability-flag"><span aria-hidden="true" className="squad-page__availability-chance">{chance}</span></span> : null}
    </span>
  );
}

export function TeamShirt({ className = '', large = false, team }: { className?: string; large?: boolean; team: string }) {
  const fallback = `/team-shirts/${team.trim().toLowerCase()}.svg`;
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`player-card__shirt ${large ? 'large' : ''} ${className}`.trim()}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = '/team-shirts/unknown.svg';
      }}
      src={officialFplShirtUrl(team, large) ?? fallback}
    />
  );
}

export function FormDots({ className = '', value }: { className?: string; value: number | null | undefined }) {
  const active = value === null || value === undefined || Number.isNaN(value) ? 0 : Math.max(0, Math.min(5, Math.round(value / 2)));
  const band = formBand(value ?? null);
  return (
    <span aria-hidden="true" className={`player-card__form-dots ${className} form-band-${band}`.trim()}>
      {Array.from({ length: 5 }, (_, index) => <i className={index < active ? 'active' : ''} key={index} />)}
    </span>
  );
}

export function PositionMarker({ position }: { position: string }) {
  return <span aria-hidden="true" className={`player-card__position-marker position-${normalizePosition(position).toLowerCase()}`} title={`${positionLabel(position)} player`} />;
}

export function formBand(value: number | null | undefined): 'negative' | 'low' | 'steady' | 'high' | 'unknown' {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  if (value < 0) return 'negative';
  if (value < 4) return 'low';
  if (value < 10) return 'steady';
  return 'high';
}

export function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0][0]}. ${parts.at(-1)}`;
}

function fixtureClassName(value: number | null | undefined): string {
  const rating = typeof value === 'number' && Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : null;
  return rating === null ? 'player-card__opponent' : `player-card__opponent player-card__opponent--fdr-${rating}`;
}

function normalizePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'GK' || normalized === 'GOALKEEPER') return 'GKP';
  if (normalized === 'DEFENDER') return 'DEF';
  if (normalized === 'MIDFIELDER') return 'MID';
  if (normalized === 'FORWARD' || normalized === 'STRIKER') return 'FWD';
  return normalized;
}

function positionLabel(position: string): string {
  return ({ GKP: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' } as Record<string, string>)[normalizePosition(position)] ?? position;
}
