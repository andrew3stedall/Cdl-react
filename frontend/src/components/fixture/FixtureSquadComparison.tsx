import { type ReactNode } from 'react';

import { PlayerCard, type PlayerCardPlayer, formBand } from '../player/PlayerCard';
import type { AttackDirection } from '../../contracts';
import { fixtureDifficultyTitle } from '../../SquadPage';
import type { FixturePlayerFixture, FixtureSquad, FixtureSquadPlayer } from '../../league-api';
import './fixture-squad-comparison.css';

export interface FixtureSquadComparisonProps {
  attackDirection: AttackDirection;
  gameweekStatus: FixtureGameweekStatus;
  squads: FixtureSquad[];
}

export type FixtureGameweekStatus = 'past' | 'current' | 'future';

export interface FixturePitchViewProps {
  attackDirection: AttackDirection;
  bottomSquad: FixtureSquad;
  bottomStarters: FixtureSquad['starters'];
  gameweekStatus: FixtureGameweekStatus;
  topSquad: FixtureSquad;
  topStarters: FixtureSquad['starters'];
}

/**
 * Reusable fixture comparison parent. It owns the pitch, bench, and reserve
 * views so the same fixture presentation can be embedded outside League.
 */
export function FixtureSquadComparison({ attackDirection, gameweekStatus, squads }: FixtureSquadComparisonProps) {
  const userSquad = squads.find((squad) => squad.isUserTeam) ?? squads[0];
  const opponentSquad = squads.find((squad) => !squad.isUserTeam && squad.team.id !== userSquad?.team.id) ?? squads[1];

  if (!userSquad || !opponentSquad) return null;

  const userOnTop = attackDirection === 'down';
  const topSquad = userOnTop ? userSquad : opponentSquad;
  const bottomSquad = userOnTop ? opponentSquad : userSquad;
  const topStarters = topSquad.starters;
  const bottomStarters = bottomSquad.starters;

  return (
    <section aria-label="Squad comparison" className="fixture-squad-comparison">
      <FixturePitchView
        attackDirection={attackDirection}
        bottomSquad={bottomSquad}
        bottomStarters={bottomStarters}
        gameweekStatus={gameweekStatus}
        topSquad={topSquad}
        topStarters={topStarters}
      />
      <div className="fixture-squad-rosters">
        <FixtureRosterGroup label="Substitutes">
          <div className="fixture-squad-rosters__columns">
            <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Substitutes" players={sortFixtureBench(topSquad.bench)} squad={topSquad} />
            <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Substitutes" players={sortFixtureBench(bottomSquad.bench)} squad={bottomSquad} />
          </div>
        </FixtureRosterGroup>
        <FixtureRosterGroup label="Reserves">
          <div className="fixture-squad-rosters__columns">
            <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Reserves" players={topSquad.reserves} squad={topSquad} />
            <FixtureRosterColumn gameweekStatus={gameweekStatus} label="Reserves" players={bottomSquad.reserves} squad={bottomSquad} />
          </div>
        </FixtureRosterGroup>
      </div>
    </section>
  );
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
          <FixtureLineupPanel gameweekStatus={gameweekStatus} players={topStarters} side="top" squad={topSquad} />
          <FixtureLineupPanel gameweekStatus={gameweekStatus} players={bottomStarters} side="bottom" squad={bottomSquad} />
        </div>
      </div>
    </article>
  );
}

export function FixtureLineupPanel({
  gameweekStatus,
  players,
  side,
  squad,
}: {
  gameweekStatus: FixtureGameweekStatus;
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
              <FixturePitchPlayer gameweekStatus={gameweekStatus} key={player.id} player={player} />
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
  players,
  squad,
}: {
  gameweekStatus: FixtureGameweekStatus;
  label: 'Substitutes' | 'Reserves';
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
              <span className="fixture-squad-roster__number">{index + 1}</span>
              {player
                ? <FixtureRosterPlayer gameweekStatus={gameweekStatus} player={player} />
                : <span className="fixture-squad-roster__empty">Empty slot</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
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

function FixturePitchPlayer({ gameweekStatus, player }: { gameweekStatus: FixtureGameweekStatus; player: FixtureSquadPlayer }) {
  const shirtTeam = player.club?.shortName ?? player.club?.name ?? 'unknown';

  return (
    <div
      className={`squad-page__pitch-player fixture-squad-pitch__player position-${fixturePosition(player.position).toLowerCase()} form-band-${formBand(player.form)}`}
      data-player-id={player.id}
      title={`${player.displayName} · ${player.points} pts`}
    >
      <FixturePlayerToken gameweekStatus={gameweekStatus} player={player} shirtTeam={shirtTeam} />
    </div>
  );
}

function FixturePlayerToken({
  gameweekStatus,
  player,
  shirtTeam,
}: {
  gameweekStatus: FixtureGameweekStatus;
  player: FixtureSquadPlayer;
  shirtTeam: string;
}) {
  return (
    <PlayerCard
      formPosition={gameweekStatus === 'future' ? 'below' : 'hidden'}
      layout="pitch"
      player={toFixtureCardPlayer(player, shirtTeam)}
      showPositionMarker={false}
      size="md"
    />
  );
}

function FixtureRosterPlayer({ gameweekStatus, player }: { gameweekStatus: FixtureGameweekStatus; player: FixtureSquadPlayer }) {
  return (
    <div className={`squad-page__pitch-player fixture-squad-pitch__player position-${fixturePosition(player.position).toLowerCase()} form-band-${formBand(player.form)}`} data-player-id={player.id} title={`${player.displayName} · ${player.points} pts`}>
      <FixturePlayerToken gameweekStatus={gameweekStatus} player={player} shirtTeam={player.club?.shortName ?? player.club?.name ?? 'unknown'} />
    </div>
  );
}

function toFixtureCardPlayer(player: FixtureSquadPlayer, shirtTeam?: string): PlayerCardPlayer {
  return {
    captain: player.isCaptain,
    displayName: player.displayName,
    fixtures: fixtureCardFixtures(player),
    form: player.form,
    position: fixturePosition(player.position),
    team: shirtTeam ?? player.club?.shortName ?? player.club?.name ?? 'unknown',
    viceCaptain: player.isViceCaptain,
  };
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
