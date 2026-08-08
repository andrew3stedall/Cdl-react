import { useEffect, useState } from 'react';
import { BadgeCheck, CircleAlert, LockKeyhole } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { ThemePreset } from './contracts';
import {
  HttpTeamSelectionClient,
  TeamSelectionApiError,
  type TeamSelectionClient,
  type TeamSelectionFixture,
  type TeamSelectionFixtureSummary,
  type TeamSelectionPlayer,
  type TeamSelectionSlot,
  type TeamSelectionSnapshot,
} from './team-selection-api';
import './team-selection.css';

const defaultTeamSelectionClient = new HttpTeamSelectionClient();

interface TeamSelectionPageProps {
  preset: ThemePreset;
  teamSelectionClient?: TeamSelectionClient;
}

interface TeamSelectionPanelProps extends TeamSelectionPageProps {
  embedded?: boolean;
}

export function TeamSelectionPage(props: TeamSelectionPageProps) {
  return (
    <main className="feature-screen team-selection-page" data-density={props.preset.tokens.density}>
      <TeamSelectionPanel {...props} />
    </main>
  );
}

export function TeamSelectionPanel({
  embedded = false,
  preset,
  teamSelectionClient = defaultTeamSelectionClient,
}: TeamSelectionPanelProps) {
  const [snapshot, setSnapshot] = useState<TeamSelectionSnapshot | null>(null);
  const [fixtureSummary, setFixtureSummary] = useState<TeamSelectionFixtureSummary | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [message, setMessage] = useState('Loading team selection.');

  useEffect(() => {
    let isActive = true;

    async function loadTeamSelection() {
      setLoadState('loading');
      try {
        const [loaded, loadedFixtureSummary] = await Promise.all([
          teamSelectionClient.getTeamSelection(),
          teamSelectionClient.getFixtureSummary(),
        ]);
        if (isActive) {
          setSnapshot(loaded);
          setFixtureSummary(loadedFixtureSummary);
          setMessage(
            loaded.fixtureLock.locked
              ? `Lineup locked. ${loaded.fixtureLock.reason ?? 'The gameweek deadline has passed.'}`
              : 'Team selection loaded.',
          );
          setLoadState('loaded');
        }
      } catch {
        if (isActive) {
          setLoadState('error');
        }
      }
    }

    void loadTeamSelection();
    return () => {
      isActive = false;
    };
  }, [teamSelectionClient]);

  const players = snapshot?.players ?? [];
  const chips = snapshot?.chips ?? [];
  const locked = snapshot?.fixtureLock.locked ?? false;
  const starters = players.filter((player) => player.slot === 'starter');
  const bench = players.filter((player) => player.slot === 'bench');
  const reserves = players.filter((player) => player.slot === 'reserve');
  const activeChip = chips.find((chip) => chip.status === 'active');
  const valid = selectionIsValid(players);
  const Heading = embedded ? 'h2' : 'h1';
  const headingId = embedded ? 'squad-lineup-title' : 'team-selection-title';

  const movePlayer = (playerId: string, slot: TeamSelectionSlot) => {
    if (locked) return;
    setSnapshot((current) =>
      current
        ? {
            ...current,
            players: current.players.map((player) =>
              player.id === playerId ? { ...player, slot } : player,
            ),
          }
        : current,
    );
    setMessage(`Player moved to ${slot}. Save lineup to validate server-side.`);
  };

  const toggleChip = async (chipId: string) => {
    if (!snapshot || locked) return;
    const chip = chips.find((candidate) => candidate.id === chipId);
    if (!chip) return;
    if (chip.status === 'used') {
      setMessage('Used chips cannot be activated. See /rules#chip-usage.');
      return;
    }
    if (chip.status !== 'active' && activeChip) {
      setMessage('Only one chip can be active at a time. See /rules#chip-usage.');
      return;
    }

    try {
      const updated = await teamSelectionClient.updateChip(chip.id, chip.status !== 'active');
      setSnapshot(updated);
      setMessage(`${chip.name} chip state updated.`);
    } catch (error) {
      setMessage(apiErrorMessage(error, 'Unable to update the chip.'));
    }
  };

  const saveLineup = async () => {
    if (!snapshot || locked) return;
    if (!valid) {
      setMessage('Invalid lineup. Review /rules#lineup-validation.');
      return;
    }

    try {
      const updated = await teamSelectionClient.saveLineup(players);
      setSnapshot(updated);
      setMessage('Lineup saved and validated.');
    } catch (error) {
      setMessage(apiErrorMessage(error, 'Unable to save the lineup.'));
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className={embedded ? 'team-selection-page team-selection-panel' : 'team-selection-content'}
      data-density={preset.tokens.density}
    >
      <header>
        <p className="eyebrow">Gameweek lineup</p>
        <Heading id={headingId}>Lineup, chips, bench, and reserves</Heading>
        <p>Manage the current gameweek without leaving Squad.</p>
      </header>

      {loadState === 'loading' ? <p role="status">Loading team selection.</p> : null}
      {loadState === 'error' ? <p role="alert">Unable to load team selection from the API.</p> : null}

      {snapshot ? (
        <>
          <p role="status" className="team-selection-status">
            {locked ? (
              <LockKeyhole aria-hidden="true" size={16} />
            ) : valid ? (
              <BadgeCheck aria-hidden="true" size={16} />
            ) : (
              <CircleAlert aria-hidden="true" size={16} />
            )}
            {message}
          </p>

          {locked ? (
            <section aria-label="Lineup lock" className="team-selection-card lineup-lock-notice">
              <h2>View-only lineup</h2>
              <p>{snapshot.fixtureLock.reason ?? 'The gameweek deadline has passed.'}</p>
              <p>{snapshot.gameweek.name} can no longer be changed.</p>
              <a href="/rules#lineup-locking">Lineup locking rules</a>
            </section>
          ) : null}

          <section aria-label="Chip selector" className="team-selection-grid">
            {chips.map((chip) => (
              <Card className="team-selection-card" key={chip.id}>
                <h2>{chip.name}</h2>
                <p className={`chip-status ${chip.status}`}>{chip.status}</p>
                <Button
                  disabled={locked}
                  onClick={() => void toggleChip(chip.id)}
                  type="button"
                  variant={chip.status === 'active' ? 'secondary' : 'ghost'}
                >
                  {chip.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
                <a href="/rules#chip-usage">Chip rules</a>
              </Card>
            ))}
          </section>

          <section aria-label="Team pitch" className="team-selection-layout">
            <Card className="team-selection-card pitch-panel">
              <h2>Starters</h2>
              <PlayerTable disabled={locked} players={starters} onMove={movePlayer} />
              <Button disabled={locked} onClick={() => void saveLineup()} type="button">Save lineup</Button>
            </Card>
            <Card className="team-selection-card">
              <h2>Bench</h2>
              <PlayerTable disabled={locked} players={bench} onMove={movePlayer} />
              <h2>Reserves</h2>
              <PlayerTable disabled={locked} players={reserves} onMove={movePlayer} />
            </Card>
          </section>

          {fixtureSummary ? (
            <section aria-label="Fixture and table summaries" className="team-selection-grid">
              <FixtureSummaryCard
                fixtures={fixtureSummary.cdlFixtures}
                heading="CDL Fixtures"
                table={fixtureSummary.cdlTable}
              />
              <FixtureSummaryCard
                fixtures={fixtureSummary.eplFixtures}
                heading="EPL Fixtures"
                table={fixtureSummary.eplTable}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function selectionIsValid(players: TeamSelectionPlayer[]): boolean {
  const starters = players.filter((player) => player.slot === 'starter');
  const bench = players.filter((player) => player.slot === 'bench');
  const reserves = players.filter((player) => player.slot === 'reserve');
  if (players.length !== 20) {
    return starters.length === 3 && bench.length === 1 && reserves.length === 1;
  }
  if (starters.length !== 11 || bench.length !== 5 || reserves.length !== 4) return false;

  const countPosition = (position: string) => starters.filter((player) => player.position === position).length;
  if (countPosition('GKP') !== 1) return false;
  if (countPosition('DEF') < 3 || countPosition('DEF') > 5) return false;
  if (countPosition('MID') < 2 || countPosition('MID') > 5) return false;
  if (countPosition('FWD') < 1 || countPosition('FWD') > 3) return false;

  const benchGoalkeepers = bench.filter((player) => player.position === 'GKP');
  const benchOutfield = bench.filter((player) => player.position !== 'GKP');
  return benchGoalkeepers.length === 1
    && benchGoalkeepers[0].slotOrder === 0
    && benchOutfield.length === 4
    && benchOutfield.map((player) => player.slotOrder).sort((left, right) => left - right).join(',') === '1,2,3,4';
}

interface FixtureSummaryCardProps {
  fixtures: TeamSelectionFixture[];
  heading: string;
  table: TeamSelectionFixtureSummary['cdlTable'];
}

function FixtureSummaryCard({ fixtures, heading, table }: FixtureSummaryCardProps) {
  return (
    <Card className="team-selection-card">
      <h2>{heading}</h2>
      {fixtures.length > 0 ? (
        fixtures.map((fixture) => (
          <p key={fixture.id}>
            {fixture.homeTeam.name} vs {fixture.awayTeam.name}
          </p>
        ))
      ) : (
        <p>No fixtures scheduled.</p>
      )}
      <p>{heading.startsWith('CDL') ? 'CDL' : 'EPL'} table: {table.map((team) => team.name).join(', ')}</p>
    </Card>
  );
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TeamSelectionApiError && error.code === 'conflict') {
    const reason = typeof error.details.reason === 'string' ? error.details.reason : error.message;
    return `Lineup locked. ${reason}`;
  }
  return fallback;
}

interface PlayerTableProps {
  disabled: boolean;
  players: TeamSelectionPlayer[];
  onMove: (playerId: string, slot: TeamSelectionSlot) => void;
}

function PlayerTable({ disabled, players, onMove }: PlayerTableProps) {
  return (
    <div className="team-selection-table" role="table">
      <div className="team-selection-row team-selection-head" role="row">
        <span className="team-selection-player" role="columnheader">Player</span>
        <span className="team-selection-position" role="columnheader">Pos</span>
        <span className="team-selection-team" role="columnheader">Team</span>
        <span className="team-selection-move" role="columnheader">Move</span>
      </div>
      {players.map((player) => (
        <div className="team-selection-row" key={player.id} role="row">
          <span className="team-selection-player" role="cell">
            {player.name}
            {player.captain ? ' (C)' : ''}
            {player.viceCaptain ? ' (VC)' : ''}
          </span>
          <span className="team-selection-position" role="cell">{player.position}</span>
          <span className="team-selection-team" role="cell">{player.team}</span>
          <span className="team-selection-move" role="cell">
            <select
              aria-label={`Move ${player.name}`}
              disabled={disabled}
              onChange={(event) => onMove(player.id, event.target.value as TeamSelectionSlot)}
              value={player.slot}
            >
              <option value="starter">Starter</option>
              <option value="bench">Bench</option>
              <option value="reserve">Reserve</option>
            </select>
          </span>
        </div>
      ))}
    </div>
  );
}
