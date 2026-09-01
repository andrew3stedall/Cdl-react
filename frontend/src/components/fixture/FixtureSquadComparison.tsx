import { type ReactNode, useEffect, useState } from 'react';
import { List } from 'lucide-react';

import { FormDots, OpponentFdrBadge, PlayerCard, TeamShirt, type PlayerCardPlayer, formBand } from '../player/PlayerCard';
import type { AttackDirection } from '../../contracts';
import { fixtureDifficultyTitle } from '../../SquadPage';
import type { FixturePlayerFixture, FixtureSquad, FixtureSquadPlayer } from '../../league-api';
import './fixture-squad-comparison.css';

export interface FixtureSquadComparisonProps {
  attackDirection: AttackDirection;
  gameweekStatus: FixtureGameweekStatus;
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  playerInteraction?: FixturePlayerInteraction;
  squads: FixtureSquad[];
}

export type FixtureGameweekStatus = 'past' | 'current' | 'future';
export type FixturePlayerInteraction = 'points' | 'profile';
export type FixtureSquadView = 'pitch' | 'list';

export interface FixturePitchViewProps {
  attackDirection: AttackDirection;
  bottomSquad: FixtureSquad;
  bottomStarters: FixtureSquad['starters'];
  gameweekStatus: FixtureGameweekStatus;
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  playerInteraction?: FixturePlayerInteraction;
  topSquad: FixtureSquad;
  topStarters: FixtureSquad['starters'];
}

const FIXTURE_REVIEW_VIEW_STORAGE_KEY = 'cdl:fixture-review-view';
const fixtureListPositionOrder = ['GKP', 'DEF', 'MID', 'FWD'] as const;

function getStoredFixtureReviewView(): FixtureSquadView {
  try {
    return window.localStorage.getItem(FIXTURE_REVIEW_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'pitch';
  } catch {
    return 'pitch';
  }
}

/**
 * Reusable fixture comparison parent. It owns the pitch/list switch, pitch,
 * bench, and reserve views so the same fixture presentation can be embedded
 * outside League.
 */
export function FixtureSquadComparison({ attackDirection, gameweekStatus, now: nowOverride, onPlayerClick, playerInteraction = 'points', squads }: FixtureSquadComparisonProps) {
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [view, setView] = useState<FixtureSquadView>(getStoredFixtureReviewView);
  const userSquad = squads.find((squad) => squad.isUserTeam) ?? squads[0];
  const opponentSquad = squads.find((squad) => !squad.isUserTeam && squad.team.id !== userSquad?.team.id) ?? squads[1];

  useEffect(() => {
    if (gameweekStatus !== 'current' || nowOverride !== undefined) return undefined;
    const timer = window.setInterval(() => setClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [gameweekStatus, nowOverride]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FIXTURE_REVIEW_VIEW_STORAGE_KEY, view);
    } catch {
      // Local view preference is optional.
    }
  }, [view]);

  if (!userSquad || !opponentSquad) return null;

  const now = nowOverride ?? clockNow;
  const userOnTop = attackDirection === 'down';
  const topSquad = userOnTop ? userSquad : opponentSquad;
  const bottomSquad = userOnTop ? opponentSquad : userSquad;
  const topStarters = topSquad.starters;
  const bottomStarters = bottomSquad.starters;

  return (
    <section aria-label="Squad comparison" className="fixture-squad-comparison">
      <div className="fixture-squad-comparison__toolbar">
        <div aria-label="Fixture squad view" className="fixture-squad-comparison__view-toggle" role="group">
          <button
            aria-label="View as pitch"
            aria-pressed={view === 'pitch'}
            onClick={() => setView('pitch')}
            title="Pitch view"
            type="button"
          >
            <SoccerPitchIcon />
          </button>
          <button
            aria-label="View as list"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            title="List view"
            type="button"
          >
            <List aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      {view === 'pitch' ? (
        <>
          <FixturePitchView
            attackDirection={attackDirection}
            bottomSquad={bottomSquad}
            bottomStarters={bottomStarters}
            gameweekStatus={gameweekStatus}
            now={now}
            onPlayerClick={onPlayerClick}
            playerInteraction={playerInteraction}
            topSquad={topSquad}
            topStarters={topStarters}
          />
          <div className="fixture-squad-rosters">
            <FixtureRosterGroup label="Substitutes">
              <div className="fixture-squad-rosters__columns">
                <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Substitutes" now={now} onPlayerClick={onPlayerClick} playerInteraction={playerInteraction} players={sortFixtureBench(topSquad.bench)} squad={topSquad} />
                <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Substitutes" now={now} onPlayerClick={onPlayerClick} playerInteraction={playerInteraction} players={sortFixtureBench(bottomSquad.bench)} squad={bottomSquad} />
              </div>
            </FixtureRosterGroup>
            <FixtureRosterGroup label="Reserves">
              <div className="fixture-squad-rosters__columns">
                <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Reserves" now={now} onPlayerClick={onPlayerClick} playerInteraction={playerInteraction} players={topSquad.reserves} squad={topSquad} />
                <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Reserves" now={now} onPlayerClick={onPlayerClick} playerInteraction={playerInteraction} players={bottomSquad.reserves} squad={bottomSquad} />
              </div>
            </FixtureRosterGroup>
          </div>
        </>
      ) : (
        <FixtureListView
          gameweekStatus={gameweekStatus}
          now={now}
          onPlayerClick={onPlayerClick}
          playerInteraction={playerInteraction}
          squads={[topSquad, bottomSquad]}
        />
      )}
    </section>
  );
}

function SoccerPitchIcon() {
  return (
    <svg aria-hidden="true" className="fixture-squad-comparison__pitch-icon" viewBox="0 0 24 24" fill="none">
      <rect height="18" rx="1.5" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="3" />
      <path d="M12 3v18M3 8h4.2v8H3M21 8h-4.2v8H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function FixtureListView({
  gameweekStatus,
  now,
  onPlayerClick,
  playerInteraction = 'points',
  squads,
}: {
  gameweekStatus: FixtureGameweekStatus;
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  playerInteraction?: FixturePlayerInteraction;
  squads: FixtureSquad[];
}) {
  return (
    <div aria-label="Fixture squad list" className="fixture-squad-list">
      {squads.map((squad) => (
        <FixtureListTeam
          gameweekStatus={gameweekStatus}
          key={squad.team.id}
          now={now}
          onPlayerClick={onPlayerClick}
          playerInteraction={playerInteraction}
          squad={squad}
        />
      ))}
    </div>
  );
}

function FixtureListTeam({
  gameweekStatus,
  now,
  onPlayerClick,
  playerInteraction,
  squad,
}: {
  gameweekStatus: FixtureGameweekStatus;
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  playerInteraction: FixturePlayerInteraction;
  squad: FixtureSquad;
}) {
  const groups = [
    { key: 'starters', label: 'Starting XI', players: sortFixtureListPlayers(squad.starters) },
    { key: 'bench', label: 'Substitutes', players: sortFixtureBench(squad.bench) },
    { key: 'reserves', label: 'Reserves', players: sortFixtureListPlayers(squad.reserves) },
  ] as const;

  return (
    <section aria-label={`${fixtureTeamDisplayName(squad.team)} list`} className="fixture-squad-list__team">
      <header className="fixture-squad-list__team-header">
        <strong>{fixtureTeamDisplayName(squad.team)}</strong>
        <span>{squad.players.length} players</span>
      </header>
      {groups.map((group) => (
        <section className="fixture-squad-list__group" key={group.key}>
          <header className="fixture-squad-list__group-header">
            <span>{group.label}</span>
            <span>{group.players.length}</span>
          </header>
          <div className="fixture-squad-list__players">
            {group.players.map((player, index) => (
              <FixtureListPlayer
                gameweekStatus={gameweekStatus}
                key={player.id}
                now={now}
                onPlayerClick={onPlayerClick}
                player={player}
                playerInteraction={playerInteraction}
                slotLabel={group.key === 'bench' ? fixtureRosterSlotLabel('Substitutes', index) : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function FixtureListPlayer({
  gameweekStatus,
  now,
  onPlayerClick,
  player,
  playerInteraction,
  slotLabel,
}: {
  gameweekStatus: FixtureGameweekStatus;
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  player: FixtureSquadPlayer;
  playerInteraction: FixturePlayerInteraction;
  slotLabel?: string;
}) {
  const showPoints = shouldShowFixturePoints(gameweekStatus, player, now);
  const showForm = gameweekStatus === 'future';
  const fixtures = fixtureCardFixtures(player);
  const firstFixture = fixtures[0] ?? null;
  const metric = showPoints ? 'points' : showForm ? 'form' : 'pending';
  const content = (
    <>
      <span className="fixture-squad-list__shirt">
        <TeamShirt team={player.club?.shortName ?? player.club?.name ?? 'unknown'} />
      </span>
      <span className="fixture-squad-list__identity">
        <span className="fixture-squad-list__name-row">
          {slotLabel ? <span className="fixture-squad-list__slot">{slotLabel}</span> : null}
          <strong>{player.displayName}</strong>
          {player.isCaptain ? <span className="fixture-squad-list__role">C</span> : null}
          {player.isViceCaptain ? <span className="fixture-squad-list__role fixture-squad-list__role--vice">VC</span> : null}
        </span>
        <small>
          <span>{fixturePosition(player.position)}</span>
          {firstFixture ? <OpponentFdrBadge difficulty={firstFixture.difficulty} label={firstFixture.label} title={firstFixture.title} /> : null}
        </small>
      </span>
      <span className="fixture-squad-list__metric" data-fixture-list-metric={metric}>
        {showPoints ? (
          <>
            <strong>{player.points ?? 0}</strong>
            <small>pts</small>
          </>
        ) : showForm ? (
          <>
            <FormDots value={player.form} />
            <small>form</small>
          </>
        ) : (
          <span aria-label="Fixture not started">—</span>
        )}
      </span>
    </>
  );

  if (!onPlayerClick) {
    return (
      <div className={`fixture-squad-list__player position-${fixturePosition(player.position).toLowerCase()}`} data-player-id={player.id}>
        {content}
      </div>
    );
  }

  return (
    <button
      aria-label={`View ${player.displayName} ${playerInteraction === 'points' ? 'points breakdown' : 'player profile'}`}
      className={`fixture-squad-list__player fixture-squad-list__player--button position-${fixturePosition(player.position).toLowerCase()}`}
      data-player-id={player.id}
      onClick={() => onPlayerClick(player)}
      type="button"
    >
      {content}
    </button>
  );
}

export function sortFixtureListPlayers(players: FixtureSquadPlayer[]): FixtureSquadPlayer[] {
  return players
    .map((player, index) => ({ index, player }))
    .sort((left, right) => {
      const leftPosition = fixtureListPositionOrder.indexOf(fixturePosition(left.player.position) as (typeof fixtureListPositionOrder)[number]);
      const rightPosition = fixtureListPositionOrder.indexOf(fixturePosition(right.player.position) as (typeof fixtureListPositionOrder)[number]);
      const leftRank = leftPosition === -1 ? fixtureListPositionOrder.length : leftPosition;
      const rightRank = rightPosition === -1 ? fixtureListPositionOrder.length : rightPosition;
      return leftRank === rightRank ? left.index - right.index : leftRank - rightRank;
    })
    .map(({ player }) => player);
}

/**
 * Reusable pitch parent with an independent, contained Starting XI panel for
 * each team. Both panels intentionally share the same row and player spacing.
 */
export function FixturePitchView({
  attackDirection,
  bottomSquad,
  bottomStarters,
  gameweekStatus,
  now,
  onPlayerClick,
  playerInteraction = 'points',
  topSquad,
  topStarters,
}: FixturePitchViewProps) {
  return (
    <article
      className="fixture-squad-pitch"
      data-bottom-attack-direction="up"
      data-bottom-team-role={bottomSquad.isUserTeam ? 'user' : 'opponent'}
      data-top-attack-direction="down"
      data-top-team-role={topSquad.isUserTeam ? 'user' : 'opponent'}
    >
      <div
        aria-label={`${fixtureTeamDisplayName(topSquad.team)} and ${fixtureTeamDisplayName(bottomSquad.team)} pitch`}
        className="fixture-squad-pitch__field"
        data-attack-direction={attackDirection}
      >
        <div aria-hidden="true" className="fixture-squad-pitch__markings"><span /><span /><span /><span /></div>
        <div className="fixture-squad-pitch__halves">
          <FixtureLineupPanel gameweekStatus={gameweekStatus} now={now} onPlayerClick={onPlayerClick} playerInteraction={playerInteraction} players={topStarters} side="top" squad={topSquad} />
          <FixtureLineupPanel gameweekStatus={gameweekStatus} now={now} onPlayerClick={onPlayerClick} playerInteraction={playerInteraction} players={bottomStarters} side="bottom" squad={bottomSquad} />
        </div>
      </div>
    </article>
  );
}

export function FixtureLineupPanel({
  gameweekStatus,
  now,
  onPlayerClick,
  playerInteraction = 'points',
  players,
  side,
  squad,
}: {
  gameweekStatus: FixtureGameweekStatus;
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  playerInteraction?: FixturePlayerInteraction;
  players: FixtureSquad['starters'];
  side: 'top' | 'bottom';
  squad: FixtureSquad;
}) {
  const positions = side === 'top' ? ['GKP', 'DEF', 'MID', 'FWD'] : ['FWD', 'MID', 'DEF', 'GKP'];

  return (
    <section
      aria-label={`${fixtureTeamDisplayName(squad.team)} starting XI`}
      className={`fixture-squad-pitch__lineup-panel fixture-squad-pitch__lineup-panel--${side}`}
    >
      <header className="fixture-squad-pitch__lineup-panel-header">
        <strong>{fixtureTeamDisplayName(squad.team)}</strong>
        <span>Starting XI</span>
      </header>
      <div className="fixture-squad-pitch__lineup">
        {positions.map((position) => (
          <div className={`fixture-squad-pitch__row position-${position.toLowerCase()}`} data-position={position} key={position}>
            {players.filter((player) => fixturePosition(player.position) === position).map((player) => (
              <FixturePitchPlayer gameweekStatus={gameweekStatus} key={player.id} now={now} onPlayerClick={onPlayerClick} player={player} playerInteraction={playerInteraction} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function FixtureRosterColumn({
  gameweekStatus,
  label,
  now,
  onPlayerClick,
  playerInteraction = 'points',
  players,
  squad,
}: {
  gameweekStatus: FixtureGameweekStatus;
  label: 'Substitutes' | 'Reserves';
  now?: number;
  onPlayerClick?: (player: FixtureSquadPlayer) => void;
  playerInteraction?: FixturePlayerInteraction;
  players: FixtureSquadPlayer[];
  squad: FixtureSquad;
}) {
  const rowCount = label === 'Substitutes' ? 5 : 4;

  return (
    <section aria-label={`${fixtureTeamDisplayName(squad.team)} ${label.toLowerCase()}`} className="fixture-squad-roster">
      <header><strong>{fixtureTeamDisplayName(squad.team)}</strong></header>
      <ol>
        {Array.from({ length: rowCount }, (_, index) => {
          const player = players[index];
          return (
            <li className={player ? '' : 'is-empty'} key={player?.id ?? `${squad.team.id}-${label}-${index}`}>
              <span className="fixture-squad-roster__number">{fixtureRosterSlotLabel(label, index)}</span>
              {player
                ? <FixtureRosterPlayer gameweekStatus={gameweekStatus} now={now} onPlayerClick={onPlayerClick} player={player} playerInteraction={playerInteraction} />
                : <span className="fixture-squad-roster__empty">Empty slot</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function fixtureRosterSlotLabel(label: 'Substitutes' | 'Reserves', index: number): string {
  if (label === 'Substitutes' && index === 0) return 'GK';
  return String(label === 'Substitutes' ? index : index + 1);
}

/**
 * The first bench slot is always the goalkeeper. The four outfield slots keep
 * the order supplied by the saved lineup, which is the user's substitution
 * priority order.
 */
export function sortFixtureBench(players: FixtureSquadPlayer[]): FixtureSquadPlayer[] {
  return players
    .map((player, index) => ({ index, player }))
    .sort((left, right) => {
      const leftIsGoalkeeper = fixturePosition(left.player.position) === 'GKP';
      const rightIsGoalkeeper = fixturePosition(right.player.position) === 'GKP';
      if (leftIsGoalkeeper !== rightIsGoalkeeper) return leftIsGoalkeeper ? -1 : 1;
      return left.index - right.index;
    })
    .map(({ player }) => player);
}

function FixturePitchPlayer({ gameweekStatus, now, onPlayerClick, player, playerInteraction }: { gameweekStatus: FixtureGameweekStatus; now?: number; onPlayerClick?: (player: FixtureSquadPlayer) => void; player: FixtureSquadPlayer; playerInteraction: FixturePlayerInteraction }) {
  const shirtTeam = player.club?.shortName ?? player.club?.name ?? 'unknown';
  const showPoints = shouldShowFixturePoints(gameweekStatus, player, now);
  const showForm = gameweekStatus === 'future';
  const token = <FixturePlayerToken player={player} shirtTeam={shirtTeam} showForm={showForm} showPoints={showPoints} size="md" />;

  return (
    <div
      className={`squad-page__pitch-player fixture-squad-pitch__player position-${fixturePosition(player.position).toLowerCase()} form-band-${formBand(player.form)}`}
      data-player-id={player.id}
      data-points-visible={showPoints ? 'true' : 'false'}
      title={`${player.displayName} · ${player.points} pts`}
    >
      {onPlayerClick ? <button aria-label={`View ${player.displayName} ${playerInteraction === 'points' ? 'points breakdown' : 'player profile'}`} className="fixture-squad-player-button" onClick={() => onPlayerClick(player)} type="button">{token}</button> : token}
    </div>
  );
}

function FixturePlayerToken({
  player,
  shirtTeam,
  showForm,
  showPoints,
  size,
}: {
  player: FixtureSquadPlayer;
  shirtTeam: string;
  showForm: boolean;
  showPoints: boolean;
  size: 'sm' | 'md';
}) {
  const indicatorValue = showPoints ? player.points : player.form;
  const indicatorType = showPoints ? 'points' : showForm ? 'form' : undefined;
  return (
    <PlayerCard
      data-fixture-metric={indicatorType}
      formPosition={showForm || showPoints ? 'below' : 'hidden'}
      layout="pitch"
      player={toFixtureCardPlayer(player, shirtTeam, indicatorValue)}
      points={showPoints ? player.points : null}
      showPositionMarker={false}
      size={size}
    />
  );
}

function FixtureRosterPlayer({ gameweekStatus, now, onPlayerClick, player, playerInteraction }: { gameweekStatus: FixtureGameweekStatus; now?: number; onPlayerClick?: (player: FixtureSquadPlayer) => void; player: FixtureSquadPlayer; playerInteraction: FixturePlayerInteraction }) {
  const showPoints = shouldShowFixturePoints(gameweekStatus, player, now);
  const showForm = gameweekStatus === 'future';
  const token = <FixturePlayerToken player={player} shirtTeam={player.club?.shortName ?? player.club?.name ?? 'unknown'} showForm={showForm} showPoints={showPoints} size="sm" />;
  return (
    <div className={`squad-page__pitch-player fixture-squad-pitch__player compact position-${fixturePosition(player.position).toLowerCase()} form-band-${formBand(player.form)}`} data-player-id={player.id} data-points-visible={showPoints ? 'true' : 'false'} title={`${player.displayName} · ${player.points} pts`}>
      {onPlayerClick ? <button aria-label={`View ${player.displayName} ${playerInteraction === 'points' ? 'points breakdown' : 'player profile'}`} className="fixture-squad-player-button" onClick={() => onPlayerClick(player)} type="button">{token}</button> : token}
    </div>
  );
}

function toFixtureCardPlayer(player: FixtureSquadPlayer, shirtTeam?: string, indicatorValue: number | null | undefined = player.form): PlayerCardPlayer {
  return {
    captain: player.isCaptain,
    displayName: player.displayName,
    fixtures: fixtureCardFixtures(player),
    form: indicatorValue,
    position: fixturePosition(player.position),
    team: shirtTeam ?? player.club?.shortName ?? player.club?.name ?? 'unknown',
    viceCaptain: player.isViceCaptain,
  };
}

export function shouldShowFixturePoints(gameweekStatus: FixtureGameweekStatus, player: FixtureSquadPlayer, now = Date.now()): boolean {
  if (gameweekStatus === 'past') return true;
  if (gameweekStatus !== 'current') return false;
  return (player.fixtureFixtures ?? []).some((fixture) => {
    if (!fixture.kickoffAt) return false;
    const kickoff = Date.parse(fixture.kickoffAt);
    return Number.isFinite(kickoff) && kickoff <= now;
  });
}

function fixtureCardFixtures(player: FixtureSquadPlayer): NonNullable<PlayerCardPlayer['fixtures']> {
  const fixtureFixtures = player.fixtureFixtures ?? legacyFixtureFallback(player);
  return fixtureFixtures.map((fixture) => ({
    difficulty: fixture.difficulty,
    label: formatFixtureOpponent(fixture.opponent, fixture.isHome),
    title: fixtureDifficultyTitle(fixture.difficulty),
  }));
}

function legacyFixtureFallback(player: FixtureSquadPlayer): FixturePlayerFixture[] {
  if (!player.nextOpponent && player.nextFixtureDifficulty === undefined) return [];
  return [{
    fixtureId: 'legacy-next-fixture',
    gameweek: null,
    opponent: player.nextOpponent ?? { id: 'unknown-opponent', name: 'Next opponent', shortName: 'NEXT' },
    difficulty: player.nextFixtureDifficulty,
    isHome: player.nextFixtureIsHome === true,
  }];
}

function formatFixtureOpponent(opponent: FixturePlayerFixture['opponent'], isHome: boolean): string {
  const label = opponent.shortName ?? opponent.name;
  return isHome ? label.toUpperCase() : label.toLowerCase();
}

function fixturePosition(position: string): string {
  const normalized = position.trim().toUpperCase();
  if (normalized === 'GK' || normalized === 'GOALKEEPER') return 'GKP';
  if (normalized === 'DEFENDER') return 'DEF';
  if (normalized === 'MIDFIELDER') return 'MID';
  if (normalized === 'FORWARD' || normalized === 'STRIKER') return 'FWD';
  return normalized;
}

function fixtureTeamDisplayName(team: FixtureSquad['team']): string {
  return team.managerName ?? team.name;
}

function FixtureRosterGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="fixture-squad-rosters__group">
      <p className="eyebrow">{label}</p>
      {children}
    </div>
  );
}
