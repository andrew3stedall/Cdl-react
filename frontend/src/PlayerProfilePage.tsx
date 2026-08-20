import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CircleAlert,
  CircleX,
  Ellipsis,
  Footprints,
  Shield,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';

import { Button } from './components/ui/button';
import {
  applySubstitution,
  getSubstitutionOptions,
  shortPlayerName,
  TeamShirt,
  type SubstitutionOption,
} from './SquadPage';
import { getAvailabilityIssue, type AvailabilityIssue } from './player-availability';
import {
  HttpSquadClient,
  type SquadApiHistoryResponse,
  type SquadApiOpponentDefensiveHistory,
  type SquadApiPlayer,
  type SquadApiSummary,
  type SquadClient,
} from './squad-api';
import {
  HttpTeamSelectionClient,
  type TeamSelectionClient,
  type TeamSelectionPlayer,
  type TeamSelectionSnapshot,
} from './team-selection-api';
import { useOptionalThemePreset } from './theme-preset-provider';
import './player-profile.css';

const defaultSquadClient = new HttpSquadClient();
const defaultTeamSelectionClient = new HttpTeamSelectionClient();
const FAVOURITES_STORAGE_KEY = 'cdl:favourite-players';

interface PlayerProfilePageProps {
  initialPlayer?: SquadApiPlayer;
  initialSelection?: TeamSelectionSnapshot | null;
  onClose?: () => void;
  onNavigate?: (href: string) => void;
  onCompare?: () => void;
  onSquadChange?: (summary: SquadApiSummary) => void;
  onSelectionChange?: (selection: TeamSelectionSnapshot) => void;
  onTrade?: () => void;
  playerId: string;
  presentation?: 'page' | 'drawer';
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

type ProfileSquadStatus = TeamSelectionPlayer['slot'] | null;
type Captaincy = 'captain' | 'vice_captain' | null;
type ActionSheet = 'bench' | 'remove' | null;
type PendingAction = 'history' | 'lineup' | 'remove' | 'favourite' | null;

interface ProfileFixture {
  fixtureId: string;
  gameweek: number;
  opponentShortName: string | null;
  isHome: boolean;
  fdr: number | null;
  fantasyPoints: number | null;
  minutesPlayed: number | null;
  stats: {
    goals: number;
    assists: number;
    cleanSheets: number;
    defensiveContributions: number;
    bonusPoints: number;
  };
}

export function PlayerProfilePage({
  initialPlayer,
  initialSelection,
  onClose,
  onNavigate,
  onCompare,
  onSquadChange,
  onSelectionChange,
  onTrade,
  playerId,
  presentation = 'page',
  squadClient = defaultSquadClient,
  teamSelectionClient = defaultTeamSelectionClient,
}: PlayerProfilePageProps) {
  const themePreset = useOptionalThemePreset();
  const fdrDisplayMode = themePreset?.fdrDisplayMode ?? 'font';
  const [player, setPlayer] = useState<SquadApiPlayer | null>(initialPlayer ?? null);
  const [history, setHistory] = useState<SquadApiHistoryResponse | null>(null);
  const [selection, setSelection] = useState<TeamSelectionSnapshot | null>(initialSelection ?? null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [actionSheet, setActionSheet] = useState<ActionSheet>(null);
  const [selectedSubstitution, setSelectedSubstitution] = useState<SubstitutionOption | null>(null);
  const [replacementPlayers, setReplacementPlayers] = useState<SquadApiPlayer[]>([]);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [favourite, setFavourite] = useState(() => readFavourite(playerId));

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    setHistoryError(null);
    setSelectionError(null);
    setNotice(null);
    void Promise.allSettled([
      initialPlayer ? Promise.resolve(initialPlayer) : squadClient.getPlayer(playerId),
      squadClient.getPlayerHistory(playerId),
      initialSelection !== undefined ? Promise.resolve(initialSelection) : teamSelectionClient.getTeamSelection(),
    ]).then(([playerResult, historyResult, selectionResult]) => {
      if (!mounted) return;
      if (playerResult.status === 'fulfilled') {
        setPlayer(playerResult.value);
      } else {
        setLoadError(playerResult.reason instanceof Error ? playerResult.reason.message : 'Player could not be loaded.');
      }
      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value);
      } else {
        setHistoryError(historyResult.reason instanceof Error ? historyResult.reason.message : 'Player history is unavailable.');
      }
      if (selectionResult.status === 'fulfilled') {
        setSelection(selectionResult.value);
      } else {
        setSelectionError(selectionResult.reason instanceof Error ? selectionResult.reason.message : 'Squad status is unavailable.');
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [playerId, squadClient, teamSelectionClient]);

  useEffect(() => {
    setFavourite(readFavourite(playerId));
  }, [playerId]);

  const selectedLineupPlayer = selection?.players.find((candidate) => candidate.id === playerId) ?? null;
  const squadStatus: ProfileSquadStatus = selectedLineupPlayer?.slot ?? null;
  const captaincy: Captaincy = selectedLineupPlayer?.captain
    ? 'captain'
    : selectedLineupPlayer?.viceCaptain
      ? 'vice_captain'
      : null;
  const formFixtures = useMemo(
    () => (history?.history ?? []).map(mapHistoryFixture).slice(-10),
    [history],
  );
  const nextFixture = history?.fixtures[0] ?? null;
  const defensiveHistory = history?.opponent_defensive_history ?? [];
  const substitutionOptions = useMemo(
    () => selection && selectedLineupPlayer
      ? getSubstitutionOptions(selection.players, selectedLineupPlayer.id)
      : [],
    [selectedLineupPlayer, selection],
  );
  const selectedReplacement = replacementPlayers.find((candidate) => candidate.id === replacementId) ?? null;
  const availability = player ? availabilityInfo(player) : null;
  const isLocked = selection?.fixtureLock.locked ?? true;

  function goBack() {
    if (onClose) {
      onClose();
      return;
    }
    if (onNavigate) {
      onNavigate('/squad');
      return;
    }
    window.history.back();
  }

  function toggleFavourite() {
    const next = !favourite;
    setFavourite(next);
    writeFavourite(playerId, next);
    setNotice(next ? 'Player added to favourites.' : 'Player removed from favourites.');
  }

  function openBenchActions() {
    setSelectedSubstitution(null);
    setActionSheet('bench');
  }

  async function saveLineup(nextPlayers: TeamSelectionPlayer[], successMessage: string) {
    setPendingAction('lineup');
    setNotice(null);
    try {
      const updated = await teamSelectionClient.saveLineup(nextPlayers);
      setSelection(updated);
      onSelectionChange?.(updated);
      setActionSheet(null);
      setSelectedSubstitution(null);
      setNotice(successMessage);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to update the lineup.');
    } finally {
      setPendingAction(null);
    }
  }

  function changeCaptaincy(role: 'captain' | 'vice_captain') {
    if (!selection || !selectedLineupPlayer || selectedLineupPlayer.slot !== 'starter' || isLocked) return;
    const currentCaptain = selection.players.find((candidate) => candidate.captain);
    const currentVice = selection.players.find((candidate) => candidate.viceCaptain);
    if (role === 'captain' && currentCaptain?.id === playerId) return;
    if (role === 'vice_captain' && currentVice?.id === playerId) return;

    const nextPlayers = selection.players.map((candidate) => {
      if (role === 'captain') {
        return {
          ...candidate,
          captain: candidate.id === playerId,
          viceCaptain: candidate.id === playerId
            ? false
            : candidate.id === currentCaptain?.id,
        };
      }
      return {
        ...candidate,
        viceCaptain: candidate.id === playerId,
        captain: candidate.id === playerId
          ? false
          : candidate.id === currentVice?.id,
      };
    });
    void saveLineup(nextPlayers, role === 'captain' ? 'Captaincy updated.' : 'Vice-captaincy updated.');
  }

  async function openRemoveActions() {
    setActionSheet('remove');
    setReplacementPlayers([]);
    setReplacementId(null);
    setPendingAction('remove');
    setNotice(null);
    try {
      const changes = await squadClient.getChanges();
      const availablePlayers = Array.isArray(changes.available_to_add) ? changes.available_to_add : [];
      setReplacementPlayers(availablePlayers);
      if (availablePlayers.length === 0) {
        setNotice('No active replacement rights are available. Squad removal requires a replacement.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Available replacements could not be loaded.');
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmRemoval() {
    if (!selectedReplacement || !player) return;
    setPendingAction('remove');
    setNotice(null);
    try {
      const updatedSummary = await squadClient.applyChanges([selectedReplacement.id], [player.id]);
      const updatedSelection = await teamSelectionClient.getTeamSelection();
      setSelection(updatedSelection);
      onSelectionChange?.(updatedSelection);
      onSquadChange?.(updatedSummary);
      setActionSheet(null);
      setNotice(`${player.display_name} was removed and replaced by ${selectedReplacement.display_name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to remove this player.');
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmSubstitution() {
    if (!selection || !selectedLineupPlayer || !selectedSubstitution || isLocked) return;
    const benchOrder = selectedSubstitution.defaultBenchOrder ?? selectedSubstitution.benchOrders[0] ?? null;
    const nextPlayers = applySubstitution(
      selection.players,
      selectedLineupPlayer.id,
      selectedSubstitution.target.id,
      benchOrder,
    );
    await saveLineup(nextPlayers, `${player?.display_name ?? 'Player'} moved to the bench.`);
  }

  if (loading) {
    return <ProfileState title="Loading player profile…" />;
  }
  if (loadError || !player) {
    return <ProfileState error={loadError ?? 'Player could not be found.'} onBack={goBack} title="Player profile unavailable" />;
  }

  const titleName = shortPlayerName(player.display_name);
  const opponentName = nextFixture?.opponent_name ?? nextFixture?.opponent_short_name ?? 'Opponent';
  const opponentShortName = nextFixture?.opponent_short_name ?? opponentName;

  return (
    <main
      aria-labelledby="player-profile-title"
      className={`player-profile${presentation === 'drawer' ? ' player-profile--drawer' : ''}`}
      data-presentation={presentation}
    >
      {presentation === 'drawer' ? <span aria-hidden="true" className="player-profile__sheet-handle" /> : null}
      <header className="player-profile__mobile-header">
        <button aria-label={presentation === 'drawer' ? 'Close player profile' : 'Back to squad'} className="player-profile__icon-button" onClick={goBack} type="button">
          {presentation === 'drawer' ? <X aria-hidden="true" size={20} /> : <ArrowLeft aria-hidden="true" size={20} />}
        </button>
        <h1 id="player-profile-title">{titleName}</h1>
        <div className="player-profile__overflow-wrap">
          <button
            aria-expanded={overflowOpen}
            aria-label="Open player actions"
            className="player-profile__icon-button"
            onClick={() => setOverflowOpen((current) => !current)}
            type="button"
          >
            <Ellipsis aria-hidden="true" size={21} />
          </button>
          {overflowOpen ? (
            <div className="player-profile__overflow-menu" role="menu">
              <button onClick={goBack} role="menuitem" type="button">Return to squad</button>
              <button onClick={toggleFavourite} role="menuitem" type="button">{favourite ? 'Remove favourite' : 'Add favourite'}</button>
              {onCompare ? <button onClick={onCompare} role="menuitem" type="button">Compare player</button> : null}
              {onTrade ? <button onClick={onTrade} role="menuitem" type="button">Draft trade</button> : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="player-profile__content">
      <section aria-label="Player identity" className="player-profile__card player-profile__identity-card">
        <div className="player-profile__identity-main">
          <div aria-label={`Portrait for ${player.display_name}`} className="player-profile__portrait" role="img">
            {initials(player.display_name)}
          </div>
          <div className="player-profile__identity-copy">
            <div className="player-profile__identity-heading">
              <div>
                <h2>{player.display_name}</h2>
                <p>{player.position} <span aria-hidden="true">·</span> {player.epl_team.short_name ?? player.epl_team.name}</p>
              </div>
              <button
                aria-label={favourite ? `Remove ${player.display_name} from favourites` : `Add ${player.display_name} to favourites`}
                aria-pressed={favourite}
                className={`player-profile__favourite${favourite ? ' is-active' : ''}`}
                onClick={toggleFavourite}
                type="button"
              >
                <Star aria-hidden="true" fill={favourite ? "currentColor" : "none"} size={20} />
              </button>
            </div>
            <div className="player-profile__identity-tags">
              <TeamShirt team={player.epl_team.short_name ?? player.epl_team.name} />
              <span className="player-profile__tag player-profile__tag--status">{squadStatusLabel(squadStatus)}</span>
              {captaincy === 'captain' ? <span className="player-profile__tag player-profile__tag--captain">Captain</span> : null}
              {captaincy === 'vice_captain' ? <span className="player-profile__tag player-profile__tag--vice">Vice-captain</span> : null}
              {availability ? <AvailabilityTag issue={availability.issue} status={availability.status} /> : null}
            </div>
          </div>
        </div>
        {selectionError ? <p className="player-profile__inline-error" role="alert">{selectionError}</p> : null}
      </section>

      <ChartCard title="Form" className="player-profile__chart-card--full">
        {historyError ? <ChartEmpty message={`Form history unavailable: ${historyError}`} /> : formFixtures.length > 0 ? <FormChart fixtures={formFixtures} fdrDisplayMode={fdrDisplayMode} /> : <ChartEmpty message="No completed FPL fixture history is available." />}
      </ChartCard>

      <ChartCard compact title="Minutes played">
        {historyError ? <ChartEmpty message={`Minutes history unavailable: ${historyError}`} /> : formFixtures.length > 0 ? <MinutesChart fixtures={formFixtures} fdrDisplayMode={fdrDisplayMode} /> : <ChartEmpty message="No completed FPL fixture history is available." />}
      </ChartCard>

      <section aria-labelledby="next-fixture-title" className="player-profile__card player-profile__next-fixture">
        <div className="player-profile__card-heading">
          <h2 id="next-fixture-title">Next fixture</h2>
          {nextFixture?.gameweek ? <span className="player-profile__muted-label">GW {nextFixture.gameweek}</span> : null}
        </div>
        {nextFixture ? (
          <div className="player-profile__fixture-summary">
            <TeamShirt large team={opponentShortName} />
            <div>
              <strong>{opponentShortName.toUpperCase()} ({nextFixture.is_home ? 'H' : 'A'})</strong>
              <div className="player-profile__fdr-pair">
                <FdrBadge label={`FDR for ${player.display_name}`} value={nextFixture.difficulty} displayMode={fdrDisplayMode} />
                <FdrBadge label={`FDR for ${player.epl_team.short_name ?? player.epl_team.name}`} value={nextFixture.opponent_difficulty ?? null} displayMode={fdrDisplayMode} />
              </div>
            </div>
            <div className="player-profile__fixture-labels">
              <span>Player FDR: {formatNullableNumber(nextFixture.difficulty)}</span>
              <span>Opponent FDR: {formatNullableNumber(nextFixture.opponent_difficulty ?? null)}</span>
            </div>
          </div>
        ) : <ChartEmpty message="No upcoming fixture is available in the FPL cache." />}
      </section>

      <ChartCard title={`Points against ${opponentName} — last 10 fixtures`} className="player-profile__chart-card--full">
        {defensiveHistory.length > 0 ? <DefensiveChart fixtures={defensiveHistory} fdrDisplayMode={fdrDisplayMode} /> : <ChartEmpty message="No cached defensive history is available for the next opponent." />}
      </ChartCard>

      {notice ? <p className="player-profile__notice" role="status">{notice}</p> : null}
      </div>

      <div aria-label="Squad-management actions" className="player-profile__action-bar" role="toolbar">
        <ActionButton
          disabled={isLocked || squadStatus !== 'starter' || substitutionOptions.length === 0 || pendingAction !== null}
          icon={Shield}
          label="Move to bench"
          onClick={openBenchActions}
        />
        <ActionButton
          danger
          disabled={player.status !== 'owned' || pendingAction !== null}
          icon={CircleX}
          label={pendingAction === 'remove' ? 'Loading…' : 'Remove'}
          onClick={() => void openRemoveActions()}
        />
        <ActionButton
          active={captaincy === 'captain'}
          disabled={isLocked || squadStatus !== 'starter' || captaincy === 'captain' || pendingAction !== null}
          icon={Target}
          label="Make captain"
          onClick={() => changeCaptaincy('captain')}
        />
        <ActionButton
          active={captaincy === 'vice_captain'}
          disabled={isLocked || squadStatus !== 'starter' || captaincy === 'vice_captain' || pendingAction !== null}
          icon={Trophy}
          label="Vice-captain"
          onClick={() => changeCaptaincy('vice_captain')}
        />
      </div>

      {actionSheet === 'bench' ? (
        <ActionDialog labelledBy="player-profile-bench-title" onClose={() => setActionSheet(null)} title="Move to bench">
          <p>Choose an eligible replacement for {player.display_name}. The current bench player will move into the Starting XI.</p>
          <div className="player-profile__action-options">
            {substitutionOptions.length === 0 ? <ChartEmpty message="No legal replacements are available for this formation." /> : substitutionOptions.map((option) => (
              <button
                aria-pressed={selectedSubstitution?.target.id === option.target.id}
                className="player-profile__action-option"
                key={option.target.id}
                onClick={() => setSelectedSubstitution(option)}
                type="button"
              >
                <span><strong>{option.target.name}</strong><small>{option.target.position} · {option.target.slot === 'bench' ? 'Bench' : 'Reserves'}</small></span>
                <span aria-hidden="true">{selectedSubstitution?.target.id === option.target.id ? 'Selected' : 'Select'}</span>
              </button>
            ))}
          </div>
          <div className="player-profile__dialog-actions">
            <Button onClick={() => setActionSheet(null)} type="button" variant="ghost">Cancel</Button>
            <Button disabled={!selectedSubstitution || pendingAction !== null} onClick={() => void confirmSubstitution()} type="button">Confirm move</Button>
          </div>
        </ActionDialog>
      ) : null}

      {actionSheet === 'remove' ? (
        <ActionDialog labelledBy="player-profile-remove-title" onClose={() => setActionSheet(null)} title="Remove player">
          <p>Removing a player changes your season-long squad. Select the active replacement required by the squad rules before confirming.</p>
          <div className="player-profile__action-options">
            {replacementPlayers.length === 0 && pendingAction !== 'remove' ? <ChartEmpty message="No active replacement rights are available." /> : null}
            {replacementPlayers.map((replacement) => (
              <button
                aria-pressed={replacementId === replacement.id}
                className="player-profile__action-option"
                key={replacement.id}
                onClick={() => setReplacementId(replacement.id)}
                type="button"
              >
                <span><strong>{replacement.display_name}</strong><small>{replacement.position} · {replacement.epl_team.short_name ?? replacement.epl_team.name}</small></span>
                <span aria-hidden="true">{replacementId === replacement.id ? 'Selected' : 'Select'}</span>
              </button>
            ))}
          </div>
          <div className="player-profile__dialog-actions">
            <Button onClick={() => setActionSheet(null)} type="button" variant="ghost">Cancel</Button>
            <Button className="player-profile__danger-button" disabled={!selectedReplacement || pendingAction !== null} onClick={() => void confirmRemoval()} type="button" variant="primary">Confirm removal</Button>
          </div>
        </ActionDialog>
      ) : null}
    </main>
  );
}

function ChartCard({ children, className = '', compact = false, title }: { children: ReactNode; className?: string; compact?: boolean; title: string }) {
  return <section aria-labelledby={title.replace(/\s+/g, '-').toLowerCase()} className={`player-profile__card player-profile__chart-card${compact ? ' player-profile__chart-card--compact' : ''} ${className}`.trim()}><div className="player-profile__card-heading"><h2 id={title.replace(/\s+/g, '-').toLowerCase()}>{title}</h2></div>{children}</section>;
}

function FormChart({ fixtures, fdrDisplayMode }: { fixtures: ProfileFixture[]; fdrDisplayMode: 'font' | 'fill' }) {
  const maxValue = Math.max(1, ...fixtures.map((fixture) => Math.abs(fixture.fantasyPoints ?? 0)));
  return <div aria-label="Fantasy points over the latest ten fixtures" className="player-profile__chart" data-chart-kind="form" role="img"><div className="player-profile__chart-columns">{fixtures.map((fixture) => <ChartColumn fixture={fixture} fdrDisplayMode={fdrDisplayMode} maxValue={maxValue} key={fixture.fixtureId} value={fixture.fantasyPoints} valueLabel={formatNullableNumber(fixture.fantasyPoints)} />)}</div></div>;
}

function MinutesChart({ fixtures, fdrDisplayMode }: { fixtures: ProfileFixture[]; fdrDisplayMode: 'font' | 'fill' }) {
  return <div aria-label="Minutes played over the latest ten fixtures" className="player-profile__chart player-profile__chart--minutes" data-chart-kind="minutes" role="img"><div className="player-profile__chart-columns">{fixtures.map((fixture) => <ChartColumn compact fixture={fixture} fdrDisplayMode={fdrDisplayMode} maxValue={90} key={fixture.fixtureId} minutes value={fixture.minutesPlayed} valueLabel={formatNullableNumber(fixture.minutesPlayed)} />)}</div></div>;
}

function DefensiveChart({ fixtures, fdrDisplayMode }: { fixtures: SquadApiOpponentDefensiveHistory[]; fdrDisplayMode: 'font' | 'fill' }) {
  const maxValue = Math.max(1, ...fixtures.map((fixture) => Math.max(fixture.total_points_conceded ?? 0, (fixture.attacking_asset_points ?? 0) + (fixture.defensive_asset_points ?? 0))));
  return <><div aria-label="Attacking and defensive fantasy points conceded by the opponent" className="player-profile__chart player-profile__chart--defensive" data-chart-kind="opponent-defence" role="img"><div className="player-profile__chart-columns">{fixtures.map((fixture) => <DefensiveColumn fixture={fixture} fdrDisplayMode={fdrDisplayMode} maxValue={maxValue} key={String(fixture.fixture_id)} />)}</div></div><div className="player-profile__legend"><span><i className="player-profile__legend-swatch player-profile__legend-swatch--attack" />Attacking assets</span><span><i className="player-profile__legend-swatch player-profile__legend-swatch--defence" />Defensive assets</span></div></>;
}

function ChartColumn({ compact = false, fixture, fdrDisplayMode, maxValue, minutes = false, value, valueLabel }: { compact?: boolean; fixture: ProfileFixture; fdrDisplayMode: 'font' | 'fill'; maxValue: number; minutes?: boolean; value: number | null; valueLabel: string }) {
  const fdrStyle = fdrStyleFor(fixture.fdr, fdrDisplayMode);
  const height = value === null ? 0 : Math.max(value === 0 ? 5 : 8, (Math.abs(value) / maxValue) * 100);
  return <div className={`player-profile__chart-column${compact ? ' is-compact' : ''}`}><span className={`player-profile__chart-value${value === null ? ' is-empty' : ''}`}>{valueLabel}</span><div className="player-profile__bar-track">{minutes ? <div aria-hidden="true" className="player-profile__threshold-line" /> : null}<div className={`player-profile__bar player-profile__bar--${barTone(value)}`} style={{ '--bar-height': `${height}%` } as CSSProperties}>{minutes ? null : <StatIcons fixture={fixture} />}</div></div><span className="player-profile__opponent-label" style={fdrStyle}>{formatOpponentLabel(fixture.opponentShortName, fixture.isHome)}</span></div>;
}

function DefensiveColumn({ fixture, fdrDisplayMode, maxValue }: { fixture: SquadApiOpponentDefensiveHistory; fdrDisplayMode: 'font' | 'fill'; maxValue: number }) {
  const total = fixture.total_points_conceded ?? ((fixture.attacking_asset_points ?? 0) + (fixture.defensive_asset_points ?? 0));
  const attack = fixture.attacking_asset_points ?? 0;
  const defence = fixture.defensive_asset_points ?? 0;
  const totalHeight = total === 0 ? 5 : Math.max(8, (total / maxValue) * 100);
  const attackHeight = total > 0 ? (attack / total) * 100 : 0;
  const defenceHeight = total > 0 ? (defence / total) * 100 : 0;
  return <div className="player-profile__chart-column"><span className={`player-profile__chart-value${fixture.total_points_conceded === null || fixture.total_points_conceded === undefined ? ' is-empty' : ''}`}>{formatNullableNumber(fixture.total_points_conceded)}</span><div className="player-profile__bar-track"><div className="player-profile__bar player-profile__bar--stacked" style={{ '--bar-height': `${totalHeight}%` } as CSSProperties}><span className="player-profile__bar-segment player-profile__bar-segment--attack" style={{ '--segment-height': `${attackHeight}%` } as CSSProperties} /><span className="player-profile__bar-segment player-profile__bar-segment--defence" style={{ '--segment-height': `${defenceHeight}%` } as CSSProperties} /></div></div><span className="player-profile__opponent-label" style={fdrStyleFor(fixture.difficulty ?? null, fdrDisplayMode)}>{formatOpponentLabel(fixture.opponent_short_name ?? null, fixture.is_home)}</span></div>;
}

function StatIcons({ fixture }: { fixture: ProfileFixture }) {
  const stats: Array<{ key: string; label: string; value: number; icon: LucideIcon }> = [
    { key: 'goals', label: 'Goals scored', value: fixture.stats.goals, icon: Target },
    { key: 'assists', label: 'Assists', value: fixture.stats.assists, icon: Footprints },
    { key: 'clean-sheets', label: 'Clean sheets', value: fixture.stats.cleanSheets, icon: ShieldCheck },
    { key: 'defensive-contributions', label: 'Defensive contributions', value: fixture.stats.defensiveContributions, icon: Shield },
    { key: 'bonus', label: 'Bonus points', value: fixture.stats.bonusPoints, icon: Trophy },
  ];
  return <span className="player-profile__stat-icons">{stats.filter((stat) => stat.value > 0).map((stat) => <span aria-label={`${stat.label}: ${stat.value}`} className="player-profile__stat-icon" key={stat.key} role="img" title={`${stat.label}: ${stat.value}`}><stat.icon aria-hidden="true" size={11} />{stat.value > 1 ? <b className="player-profile__stat-multiplier">×{stat.value}</b> : null}</span>)}</span>;
}

function FdrBadge({ displayMode, label, value }: { displayMode: 'font' | 'fill'; label: string; value: number | null }) {
  return <span aria-label={`${label}: ${formatNullableNumber(value)}`} className="player-profile__fdr-badge" data-fdr={value ?? 'none'} style={fdrStyleFor(value, displayMode)}>{formatNullableNumber(value)}</span>;
}

function AvailabilityTag({ issue, status }: { issue: AvailabilityIssue; status: string }) {
  const Icon = issue.severity === 'critical' ? CircleX : CircleAlert;
  return <span className={`player-profile__tag player-profile__tag--availability player-profile__tag--${issue.severity}`} title={issue.label}><Icon aria-hidden="true" size={13} />{status}</span>;
}

function ActionButton({ active = false, danger = false, disabled, icon: Icon, label, onClick }: { active?: boolean; danger?: boolean; disabled: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`player-profile__action${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={onClick} type="button"><Icon aria-hidden="true" size={17} /><span>{label}</span></button>;
}

function ActionDialog({ children, labelledBy, onClose, title }: { children: ReactNode; labelledBy: string; onClose: () => void; title: string }) {
  return <div className="player-profile__dialog-layer"><button aria-label="Close action dialog" className="player-profile__dialog-backdrop" onClick={onClose} type="button" /><section aria-labelledby={labelledBy} aria-modal="true" className="player-profile__dialog" role="dialog"><header><h2 id={labelledBy}>{title}</h2><button aria-label="Close action dialog" className="player-profile__icon-button" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button></header><div>{children}</div></section></div>;
}

function ChartCardState({ error, onBack, title }: { error?: string; onBack?: () => void; title: string }) {
  return <main className="player-profile__state"><h1>{title}</h1>{error ? <p role="alert">{error}</p> : null}{onBack ? <Button onClick={onBack} type="button" variant="secondary"><ArrowLeft aria-hidden="true" size={16} />Back to squad</Button> : null}</main>;
}

function ProfileState({ error, onBack, title }: { error?: string; onBack?: () => void; title: string }) {
  return <ChartCardState error={error} onBack={onBack} title={title} />;
}

function ChartEmpty({ message }: { message: string }) {
  return <p className="player-profile__chart-empty" role="status">{message}</p>;
}

function mapHistoryFixture(row: SquadApiHistoryResponse['history'][number]): ProfileFixture {
  return {
    fixtureId: String(row.fixture_id),
    gameweek: row.gameweek,
    opponentShortName: row.opponent_short_name ?? null,
    isHome: row.was_home,
    fdr: row.difficulty ?? null,
    fantasyPoints: row.minutes > 0 ? row.total_points : null,
    minutesPlayed: row.minutes > 0 ? row.minutes : null,
    stats: {
      goals: row.goals_scored,
      assists: row.assists,
      cleanSheets: row.clean_sheets,
      defensiveContributions: row.defensive_contributions ?? 0,
      bonusPoints: row.bonus,
    },
  };
}

function availabilityInfo(player: SquadApiPlayer): { issue: AvailabilityIssue; status: string } | null {
  const issue = getAvailabilityIssue({
    availability_status: player.availability_status,
    chance_of_playing_next_round: player.chance_of_playing_next_round,
  });
  if (!issue) return null;
  const rawStatus = (player.availability_status ?? '').toLowerCase();
  const status = rawStatus === 'd' || (issue.severity === 'warning' && player.chance_of_playing_next_round !== null)
    ? 'Doubtful'
    : rawStatus === 'i'
      ? 'Injured'
      : rawStatus === 's'
        ? 'Suspended'
        : issue.label.split(' · ')[0];
  return { issue, status };
}

function squadStatusLabel(status: ProfileSquadStatus): string {
  if (status === 'starter') return 'Starting XI';
  if (status === 'bench') return 'Bench';
  if (status === 'reserve') return 'Reserves';
  return 'Squad status unavailable';
}

function formatOpponentLabel(shortName: string | null, isHome: boolean): string {
  if (!shortName) return '—';
  return isHome ? shortName.toUpperCase() : shortName.toLowerCase();
}

function barTone(value: number | null): string {
  if (value === null) return 'empty';
  if (value < 0) return 'negative';
  if (value === 0) return 'neutral';
  if (value >= 10) return 'high';
  if (value >= 5) return 'positive';
  return 'low';
}

function fdrStyleFor(value: number | null, displayMode: 'font' | 'fill'): CSSProperties {
  if (value === null || !Number.isFinite(value)) return {};
  const fdr = Math.min(5, Math.max(1, Math.round(value)));
  if (displayMode === 'fill') {
    return {
      backgroundColor: `var(--cdl-fdr-fill-${fdr})`,
      color: `var(--cdl-fdr-fill-foreground-${fdr})`,
    };
  }
  return { color: `var(--cdl-fdr-${fdr})` };
}

function formatNullableNumber(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value) ? '—' : String(value);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PL';
}

function readFavourite(playerId: string): boolean {
  try {
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) && ids.includes(playerId);
  } catch {
    return false;
  }
}

function writeFavourite(playerId: string, favourite: boolean) {
  try {
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const ids = new Set<string>(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
    if (favourite) ids.add(playerId);
    else ids.delete(playerId);
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Favourites are an optional local preference and must not block squad actions.
  }
}
