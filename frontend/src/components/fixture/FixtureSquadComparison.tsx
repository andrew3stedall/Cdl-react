import { type ReactNode } from 'react';

import { PlayerCard, type PlayerCardPlayer, formBand } from '../player/PlayerCard';
import type { AttackDirection } from '../../contracts';
import { fixtureDifficultyTitle } from '../../SquadPage';
import type { FixtureSquad, FixtureSquadPlayer } from '../../league-api';
import './fixture-squad-comparison.css';

export interface FixtureSquadComparisonProps {
  attackDirection: AttackDirection;
  squads: FixtureSquad[];
}

export interface FixturePitchViewProps {
  attackDirection: AttackDirection;
  bottomSquad: FixtureSquad;
  bottomStarters: FixtureSquad['starters'];
  topSquad: FixtureSquad;
  topStarters: FixtureSquad['starters'];
}

/**
 * Reusable fixture comparison parent. It owns the pitch, bench, and reserve
 * views so the same fixture presentation can be embedded outside League.
 */
export function FixtureSquadComparison({ attackDirection, squads }: FixtureSquadComparisonProps) {
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
        topSquad={topSquad}
        topStarters={topStarters}
      />
      <div className="fixture-squad-rosters">
        <FixtureRosterGroup label="Substitutes">
          <div className="fixture-squad-rosters__columns">
            <FixtureRosterColumn label="Substitutes" players={sortFixtureBench(topSquad.bench)} squad={topSquad} />
            <FixtureRosterColumn label="Substitutes" players={sortFixtureBench(bottomSquad.bench)} squad={bottomSquad} />
          </div>
        </FixtureRosterGroup>
        <FixtureRosterGroup label="Reserves">
          <div className="fixture-squad-rosters__columns">
            <FixtureRosterColumn label="Reserves" players={topSquad.reserves} squad={topSquad} />
            <FixtureRosterColumn label="Reserves" players={bottomSquad.reserves} squad={bottomSquad} />
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
          <FixtureLineupPanel players={topStarters} side="top" squad={topSquad} />
          <FixtureLineupPanel players={bottomStarters} side="bottom" squad={bottomSquad} />
        </div>
      </div>
    </article>
  );
}

export function FixtureLineupPanel({
  players,
  side,
  squad,
}: {
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
              <FixturePitchPlayer key={player.id} player={player} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function FixtureRosterColumn({
  label,
  players,
  squad,
}: {
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
                ? <FixtureRosterPlayer player={player} />
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

function FixturePitchPlayer({ player }: { player: FixtureSquadPlayer }) {
  const shirtTeam = player.club?.shortName ?? player.club?.name ?? 'unknown';
  const fixtureLabel = player.nextOpponent
    ? player.nextFixtureIsHome === true
      ? (player.nextOpponent.shortName ?? player.nextOpponent.name).toUpperCase()
      : (player.nextOpponent.shortName ?? player.nextOpponent.name).toLowerCase()
    : 'Next —';

  return (
    <div
      className={`squad-page__pitch-player fixture-squad-pitch__player position-${fixturePosition(player.position).toLowerCase()} form-band-${formBand(player.form)}`}
      data-player-id={player.id}
      title={`${player.displayName} · ${player.points} pts`}
    >
      <FixturePlayerToken fixtureLabel={fixtureLabel} player={player} shirtTeam={shirtTeam} />
    </div>
  );
}

function FixturePlayerToken({
  fixtureLabel,
  player,
  shirtTeam,
}: {
  fixtureLabel: string;
  player: FixtureSquadPlayer;
  shirtTeam: string;
}) {
  return (
    <PlayerCard
      formPosition="below"
      layout="pitch"
      player={toFixtureCardPlayer(player, fixtureLabel, shirtTeam)}
      showPositionMarker={false}
      size="md"
    />
  );
}

function FixtureRosterPlayer({ player }: { player: FixtureSquadPlayer }) {
  const fixtureLabel = player.nextOpponent
    ? player.nextFixtureIsHome === true
      ? (player.nextOpponent.shortName ?? player.nextOpponent.name).toUpperCase()
      : (player.nextOpponent.shortName ?? player.nextOpponent.name).toLowerCase()
    : 'Next —';

  return (
    <div className={`squad-page__pitch-player fixture-squad-pitch__player position-${fixturePosition(player.position).toLowerCase()} form-band-${formBand(player.form)}`} data-player-id={player.id} title={`${player.displayName} · ${player.points} pts`}>
      <FixturePlayerToken fixtureLabel={fixtureLabel} player={player} shirtTeam={player.club?.shortName ?? player.club?.name ?? 'unknown'} />
    </div>
  );
}

function toFixtureCardPlayer(player: FixtureSquadPlayer, fixtureLabel?: string, shirtTeam?: string): PlayerCardPlayer {
  const opponent = player.nextOpponent?.shortName ?? player.nextOpponent?.name;
  const label = fixtureLabel ?? (opponent ? (player.nextFixtureIsHome === true ? opponent.toUpperCase() : opponent.toLowerCase()) : 'Next —');
  return {
    captain: player.isCaptain,
    displayName: player.displayName,
    fixtures: [{ difficulty: player.nextFixtureDifficulty, label, title: fixtureDifficultyTitle(player.nextFixtureDifficulty) }],
    form: player.form,
    position: fixturePosition(player.position),
    team: shirtTeam ?? player.club?.shortName ?? player.club?.name ?? 'unknown',
    viceCaptain: player.isViceCaptain,
  };
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
