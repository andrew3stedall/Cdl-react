import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CircleX,
  Ellipsis,
  Repeat2,
  X,
  type LucideIcon,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { OpponentFdrBadge, PlayerCard, type PlayerCardPlayer } from './components/player/PlayerCard';
import { CombinedFormMinutesChart, type CombinedFormMinutesFixture } from './components/player/CombinedFormMinutesChart';
import { PlayerChartGrid, PlayerChartYAxis, PlayerChartZeroLine } from './components/player/PlayerChartGrid';
import {
  PlayerChartDetailDialog,
  type PlayerChartDetailSection,
  type PlayerChartDetailSummaryItem,
} from './components/player/PlayerChartDetailDialog';
import { earnedDefensiveContributionPoints, PlayerStatIcons, type PlayerStatSummary } from './components/player/PlayerStatIcons';
import {
  chartFixtureSlots,
  fdrStyleFor,
  formatNullableNumber,
  formatOpponentLabel,
  PROFILE_CHART_COLUMN_COUNT,
} from './components/player/player-chart-utils';
import {
  fixtureDifficultyTitle,
  applySubstitution,
  getSubstitutionOptions,
  type SubstitutionOption,
} from './SquadPage';
import { availabilityChance, getAvailabilityIssue, type AvailabilityIssue } from './player-availability';
import {
  HttpSquadClient,
  type SquadApiHistoryResponse,
  type SquadApiOpponentDefensiveHistory,
  type SquadApiNextFixture,
  type SquadApiPlayer,
  type SquadApiUpcomingFixture,
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

interface PlayerProfilePageProps {
  initialPlayer?: SquadApiPlayer;
  initialSelection?: TeamSelectionSnapshot | null;
  onClose?: () => void;
  onNavigate?: (href: string) => void;
  onCompare?: () => void;
  onStartSubstitution?: () => void;
  onSquadChange?: (summary: SquadApiSummary) => void;
  onSelectionChange?: (selection: TeamSelectionSnapshot, options?: { persisted?: boolean }) => void;
  onTrade?: () => void;
  playerId: string;
  presentation?: 'page' | 'drawer';
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

type ProfileSquadStatus = TeamSelectionPlayer['slot'] | null;
type Captaincy = 'captain' | 'vice_captain' | null;
type ActionSheet = 'bench' | 'remove' | null;
type PendingAction = 'history' | 'lineup' | 'remove' | null;

type ProfileFixture = CombinedFormMinutesFixture & { gameweek: number };
type ChartDetailSelection =
  | { kind: 'form'; fixture: ProfileFixture; playerName?: string }
  | { kind: 'opponent'; fixture: SquadApiOpponentDefensiveHistory; playerName?: string };

interface ProfileNextFixture {
  fixture_id: number | string;
  gameweek?: number | null;
  opponent_team_id: number | string;
  opponent_name?: string | null;
  opponent_short_name?: string | null;
  difficulty?: number | null;
  is_home: boolean;
  opponent_difficulty?: number | null;
}

export function PlayerProfilePage({
  initialPlayer,
  initialSelection,
  onClose,
  onNavigate,
  onCompare,
  onStartSubstitution,
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
  const [chartDetail, setChartDetail] = useState<ChartDetailSelection | null>(null);

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

  const selectedLineupPlayer = selection?.players.find((candidate) => candidate.id === playerId) ?? null;
  const squadStatus: ProfileSquadStatus = selectedLineupPlayer?.slot ?? null;
  const captaincy: Captaincy = selectedLineupPlayer?.captain
    ? 'captain'
    : selectedLineupPlayer?.viceCaptain
      ? 'vice_captain'
      : null;
  const playerPosition = player?.position ?? null;
  const formFixtures = useMemo(
    () => (history?.history ?? []).map((row) => mapHistoryFixture(row, playerPosition)).slice(-10),
    [history, playerPosition],
  );
  const nextFixtures = useMemo(
    () => selectNextGameweekFixtures(
      player?.next_fixtures !== undefined && player.next_fixtures !== null
        ? player.next_fixtures
        : player?.next_fixture
          ? [player.next_fixture]
          : history?.fixtures ?? [],
    ),
    [history, player],
  );
  const defensiveHistoryGroups = useMemo(
    () => history?.opponent_defensive_histories?.length
      ? history.opponent_defensive_histories
      : nextFixtures.length > 0 && history?.opponent_defensive_history?.length
        ? [{
            opponent_team_id: nextFixtures[0].opponent_team_id,
            opponent_name: nextFixtures[0].opponent_name,
            opponent_short_name: nextFixtures[0].opponent_short_name,
            fixtures: history.opponent_defensive_history,
          }]
        : [],
    [history, nextFixtures],
  );
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
      if (candidate.id === playerId) {
        return {
          ...candidate,
          captain: role === 'captain',
          viceCaptain: role === 'vice_captain',
        };
      }
      if (role === 'captain') {
        return {
          ...candidate,
          captain: false,
          viceCaptain: candidate.id === currentCaptain?.id && currentVice?.id === playerId
            ? true
            : candidate.viceCaptain,
        };
      }
      return {
        ...candidate,
        viceCaptain: false,
        captain: candidate.id === currentVice?.id && currentCaptain?.id === playerId
          ? true
          : candidate.captain,
      };
    });
    const nextSelection = { ...selection, players: nextPlayers };
    if (onSelectionChange) {
      setSelection(nextSelection);
      onSelectionChange(nextSelection, { persisted: false });
      setNotice(role === 'captain' ? 'Captaincy staged. Save lineup to apply this change.' : 'Vice-captaincy staged. Save lineup to apply this change.');
      return;
    }
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
    await saveLineup(nextPlayers, `${player?.display_name ?? 'Player'} swapped with ${selectedSubstitution.target.name}.`);
  }

  if (loading) {
    return <ProfileState title="Loading player profile…" />;
  }
  if (loadError || !player) {
    return <ProfileState error={loadError ?? 'Player could not be found.'} onBack={goBack} title="Player profile unavailable" />;
  }

  const availabilityNews = (availability !== null || availabilityChance(player.chance_of_playing_next_round) !== null)
    ? player.availability_news?.trim() || null
    : null;

  return (
    <main
      aria-label={`Player profile for ${player.display_name}`}
      className={`player-profile${presentation === 'drawer' ? ' player-profile--drawer' : ''}`}
      data-presentation={presentation}
    >
      {presentation === 'drawer' ? <span aria-hidden="true" className="player-profile__sheet-handle" /> : null}
      <header className="player-profile__mobile-header">
        <button aria-label={presentation === 'drawer' ? 'Close player profile' : 'Back to squad'} className="player-profile__icon-button" onClick={goBack} type="button">
          {presentation === 'drawer' ? <X aria-hidden="true" size={20} /> : <ArrowLeft aria-hidden="true" size={20} />}
        </button>
        <PlayerCard
          ariaLabel={`Player card for ${player.display_name}`}
          className="player-profile__header-player-card"
          formPosition="hidden"
          layout="token"
          player={toPlayerCardPlayer(player, nextFixtures, captaincy)}
          size="md"
        />
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
              {onCompare ? <button onClick={onCompare} role="menuitem" type="button">Compare player</button> : null}
              {onTrade ? <button onClick={onTrade} role="menuitem" type="button">Draft trade</button> : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="player-profile__content">
      {availabilityNews ? (
        <PlayerAvailabilityNews chance={player.chance_of_playing_next_round} news={availabilityNews} />
      ) : null}
      {selectionError ? <p className="player-profile__inline-error" role="alert">{selectionError}</p> : null}

      <ChartCard compact title="Form & minutes">
        {historyError ? <ChartEmpty message={`Form and minutes history unavailable: ${historyError}`} /> : formFixtures.length > 0 ? <CombinedFormMinutesChart fixtures={formFixtures} fdrDisplayMode={fdrDisplayMode} onFixtureClick={(fixture) => setChartDetail({ kind: 'form', fixture: fixture as ProfileFixture })} /> : <ChartEmpty message="No completed FPL fixture history is available." />}
      </ChartCard>

      {defensiveHistoryGroups.length > 0 ? defensiveHistoryGroups.map((group) => {
        const groupOpponent = group.opponent_name ?? group.opponent_short_name ?? 'Opponent';
        const upcomingFixture = nextFixtures.find((fixture) => String(fixture.opponent_team_id) === String(group.opponent_team_id));
        const latestFixture = group.fixtures.at(-1);
        const groupOpponentShortName = group.opponent_short_name ?? groupOpponent;
        const opponentDifficulty = upcomingFixture?.difficulty ?? latestFixture?.difficulty ?? null;
        const opponentIsHome = upcomingFixture?.is_home ?? latestFixture?.is_home ?? false;
        return <ChartCard
          ariaLabel={`Points against ${groupOpponent}`}
          className="player-profile__chart-card--full"
          heading={<OpponentChartHeading difficulty={opponentDifficulty} headingId={`opponent-${group.opponent_team_id}`} label={formatOpponentLabel(groupOpponentShortName, opponentIsHome)} title={fixtureDifficultyTitle(opponentDifficulty)} />}
          key={group.opponent_team_id}
        >
          {group.fixtures.length > 0 ? <DefensiveChart fixtures={group.fixtures} fdrDisplayMode={fdrDisplayMode} onFixtureClick={(fixture) => setChartDetail({ kind: 'opponent', fixture })} /> : <ChartEmpty message={`No cached defensive history is available for ${groupOpponent}.`} />}
        </ChartCard>;
      }) : <ChartCard title="Opponent form" className="player-profile__chart-card--full"><ChartEmpty message="No cached defensive history is available for the next opponent." /></ChartCard>}

      {notice ? <p className="player-profile__notice" role="status">{notice}</p> : null}
      {presentation === 'drawer' ? <div aria-hidden="true" className="player-profile__scroll-end-spacer" /> : null}
      </div>

      <div aria-label="Squad-management actions" className="player-profile__action-bar" role="toolbar">
        <ActionButton
          disabled={isLocked || selectedLineupPlayer === null || pendingAction !== null}
          icon={Repeat2}
          label="Sub"
          onClick={onStartSubstitution ?? openBenchActions}
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
          visual={<PlayerRoleBadge role="captain" />}
          label="Captain"
          onClick={() => changeCaptaincy('captain')}
        />
        <ActionButton
          active={captaincy === 'vice_captain'}
          disabled={isLocked || squadStatus !== 'starter' || captaincy === 'vice_captain' || pendingAction !== null}
          visual={<PlayerRoleBadge role="vice" />}
          label="Vice"
          onClick={() => changeCaptaincy('vice_captain')}
        />
      </div>

      {actionSheet === 'bench' ? (
        <ActionDialog labelledBy="player-profile-substitution-title" onClose={() => setActionSheet(null)} title="Choose substitution">
          <p>Choose an eligible player to swap with {player.display_name}. The formation will be validated before the change is applied.</p>
          <div className="player-profile__action-options">
            {substitutionOptions.length === 0 ? <ChartEmpty message="No legal replacements are available for this formation." /> : substitutionOptions.map((option) => (
              <button
                aria-pressed={selectedSubstitution?.target.id === option.target.id}
                className="player-profile__action-option"
                key={option.target.id}
                onClick={() => setSelectedSubstitution(option)}
                type="button"
              >
                <span className="player-profile__action-option-player">
                  <PlayerCard formPosition="hidden" layout="list" player={toTeamSelectionCardPlayer(option.target)} showOpponent={false} size="xs" />
                  <small>{option.target.position} · {option.target.slot === 'bench' ? 'Bench' : 'Reserves'}</small>
                </span>
                <span aria-hidden="true">{selectedSubstitution?.target.id === option.target.id ? 'Selected' : 'Select'}</span>
              </button>
            ))}
          </div>
          <div className="player-profile__dialog-actions">
            <Button onClick={() => setActionSheet(null)} type="button" variant="ghost">Cancel</Button>
            <Button disabled={!selectedSubstitution || pendingAction !== null} onClick={() => void confirmSubstitution()} type="button">Confirm sub</Button>
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
                <span className="player-profile__action-option-player">
                  <PlayerCard formPosition="hidden" layout="list" player={toPlayerCardPlayer(replacement)} size="xs" />
                  <small>{replacement.position} · {replacement.epl_team.short_name ?? replacement.epl_team.name}</small>
                </span>
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

      {chartDetail ? (
        <PlayerChartDetailDialog
          kind={chartDetail.kind}
          onClose={() => setChartDetail(null)}
          sections={chartDetail.kind === 'form' ? formDetailSections(chartDetail.fixture) : opponentDetailSections(chartDetail.fixture)}
          subtitle={chartDetail.kind === 'form' ? `${player.display_name} · ${formatOpponentLabel(chartDetail.fixture.opponentShortName, chartDetail.fixture.isHome)}` : `Points against ${formatOpponentLabel(chartDetail.fixture.opponent_short_name ?? null, chartDetail.fixture.is_home)}`}
          summary={chartDetail.kind === 'form' ? formDetailSummary(chartDetail.fixture) : opponentDetailSummary(chartDetail.fixture)}
          title={chartDetail.kind === 'form' ? `GW${chartDetail.fixture.gameweek} · ${formatOpponentLabel(chartDetail.fixture.opponentShortName, chartDetail.fixture.isHome)}` : `${formatOpponentLabel(chartDetail.fixture.opponent_short_name ?? null, chartDetail.fixture.is_home)} · GW${chartDetail.fixture.gameweek ?? '—'}`}
        />
      ) : null}
    </main>
  );
}

export function SubstitutionReviewDrawer({
  onCancel,
  onConfirm,
  pending = false,
  sourcePlayer,
  squadClient = defaultSquadClient,
  targetPlayer,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  sourceLabel?: string;
  sourcePlayer: SquadApiPlayer;
  squadClient?: SquadClient;
  targetLabel?: string;
  targetPlayer: SquadApiPlayer;
}) {
  const themePreset = useOptionalThemePreset();
  const fdrDisplayMode = themePreset?.fdrDisplayMode ?? 'font';
  const [histories, setHistories] = useState<{ source: SquadApiHistoryResponse | null; target: SquadApiHistoryResponse | null }>({ source: null, target: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartDetail, setChartDetail] = useState<ChartDetailSelection | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void Promise.allSettled([
      squadClient.getPlayerHistory(sourcePlayer.id),
      squadClient.getPlayerHistory(targetPlayer.id),
    ]).then(([sourceResult, targetResult]) => {
      if (!mounted) return;
      const sourceHistory = sourceResult.status === 'fulfilled' ? sourceResult.value : null;
      const targetHistory = targetResult.status === 'fulfilled' ? targetResult.value : null;
      setHistories({ source: sourceHistory, target: targetHistory });
      if (!sourceHistory || !targetHistory) {
        setError('One or both player histories are unavailable.');
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [sourcePlayer.id, squadClient, targetPlayer.id]);

  const sourceFixtures = (histories.source?.history ?? []).map((row) => mapHistoryFixture(row, sourcePlayer.position)).slice(-5);
  const targetFixtures = (histories.target?.history ?? []).map((row) => mapHistoryFixture(row, targetPlayer.position)).slice(-5);
  const reviewGroups = [
    createReviewPlayerGroup('source', sourcePlayer, histories.source, sourceFixtures),
    createReviewPlayerGroup('target', targetPlayer, histories.target, targetFixtures),
  ] satisfies ReviewPlayerGroup[];
  const formFixtures = reviewGroups.flatMap((group) => chartFixtureSlots(group.fixtures, REVIEW_FIXTURE_COUNT));
  const opponentFixtures = reviewGroups.flatMap((group) => chartFixtureSlots(group.opponent.fixtures, REVIEW_FIXTURE_COUNT));

  return (
    <main aria-labelledby="substitution-review-title" className="player-profile player-profile--drawer player-profile--substitution-review" data-presentation="drawer">
      <span aria-hidden="true" className="player-profile__sheet-handle" />
      <header className="player-profile__mobile-header">
        <button aria-label="Cancel substitution" className="player-profile__icon-button" onClick={onCancel} type="button"><X aria-hidden="true" size={20} /></button>
        <h1 id="substitution-review-title">Review substitution</h1>
        <span aria-hidden="true" />
      </header>

      <div className="player-profile__content">
        <section aria-label="Substitution players" className="player-profile__card player-profile__comparison-card">
          <ChartCard compact className="player-profile__substitution-shared-chart" title="Form & minutes">
            <ReviewChartGroupHeaders
              groups={reviewGroups.map((group) => ({
                ariaLabel: `Fixtures for ${group.player.display_name}`,
                content: <PlayerCard ariaLabel={`Player card for ${group.player.display_name}`} className="player-profile__player-card" formPosition="hidden" layout="token" player={toPlayerCardPlayer(group.player, group.nextFixtures)} size="xs" />,
                id: group.id,
                slotCount: REVIEW_FIXTURE_COUNT,
              }))}
              label="Substitution players"
            />
            {loading ? <ChartEmpty message="Loading the latest five fixtures…" /> : <CombinedFormMinutesChart fixtureCount={REVIEW_CHART_SLOT_COUNT} fixtures={formFixtures} fdrDisplayMode={fdrDisplayMode} groupBreakAfter={REVIEW_FIXTURE_COUNT} onFixtureClick={(fixture, index) => setChartDetail({ kind: 'form', fixture: fixture as ProfileFixture, playerName: reviewGroups[index < REVIEW_FIXTURE_COUNT ? 0 : 1]?.player.display_name })} windowLabel="latest five per player" />}
          </ChartCard>
          <ChartCard className="player-profile__substitution-shared-chart" title="Points against">
            <ReviewChartGroupHeaders
              groups={reviewGroups.map((group) => ({
                ariaLabel: `Opponent group for ${group.opponent.name}`,
                content: <OpponentFdrBadge difficulty={group.opponent.difficulty} label={group.opponent.label} title={fixtureDifficultyTitle(group.opponent.difficulty)} />,
                id: group.id,
                slotCount: REVIEW_FIXTURE_COUNT,
              }))}
              label="Upcoming opponents"
            />
            {loading ? <ChartEmpty message="Loading opponent history…" /> : <DefensiveChart fixtureCount={REVIEW_CHART_SLOT_COUNT} fixtures={opponentFixtures} fdrDisplayMode={fdrDisplayMode} groupBreakAfter={REVIEW_FIXTURE_COUNT} onFixtureClick={(fixture, index) => setChartDetail({ kind: 'opponent', fixture, playerName: reviewGroups[index < REVIEW_FIXTURE_COUNT ? 0 : 1]?.player.display_name })} />}
          </ChartCard>
          {!loading && error ? <p className="player-profile__inline-error" role="status">{error} Form and minutes may be incomplete.</p> : null}
        </section>
        <div aria-hidden="true" className="player-profile__scroll-end-spacer" />
      </div>

      <div aria-label="Substitution review actions" className="player-profile__review-actions" role="toolbar">
        <Button disabled={pending} onClick={onCancel} type="button" variant="ghost">Cancel</Button>
        <Button disabled={pending || loading} onClick={onConfirm} type="button">
          <Repeat2 aria-hidden="true" size={16} />
          {pending ? 'Applying…' : 'Confirm sub'}
        </Button>
      </div>

      {chartDetail ? (
        <PlayerChartDetailDialog
          kind={chartDetail.kind}
          onClose={() => setChartDetail(null)}
          sections={chartDetail.kind === 'form' ? formDetailSections(chartDetail.fixture) : opponentDetailSections(chartDetail.fixture)}
          subtitle={chartDetail.kind === 'form' ? `${chartDetail.playerName ?? 'Player'} · ${formatOpponentLabel(chartDetail.fixture.opponentShortName, chartDetail.fixture.isHome)}` : `${chartDetail.playerName ? `${chartDetail.playerName} · ` : ''}Points against ${formatOpponentLabel(chartDetail.fixture.opponent_short_name ?? null, chartDetail.fixture.is_home)}`}
          summary={chartDetail.kind === 'form' ? formDetailSummary(chartDetail.fixture) : opponentDetailSummary(chartDetail.fixture)}
          title={chartDetail.kind === 'form' ? `GW${chartDetail.fixture.gameweek} · ${formatOpponentLabel(chartDetail.fixture.opponentShortName, chartDetail.fixture.isHome)}` : `${formatOpponentLabel(chartDetail.fixture.opponent_short_name ?? null, chartDetail.fixture.is_home)} · GW${chartDetail.fixture.gameweek ?? '—'}`}
        />
      ) : null}
    </main>
  );
}

const REVIEW_FIXTURE_COUNT = 5;
const REVIEW_CHART_SLOT_COUNT = REVIEW_FIXTURE_COUNT * 2;

interface ReviewPlayerGroup {
  id: 'source' | 'target';
  fixtures: ProfileFixture[];
  nextFixtures: ProfileNextFixture[];
  opponent: ReviewOpponentGroup;
  player: SquadApiPlayer;
}

interface ReviewOpponentGroup {
  difficulty: number | null;
  fixtures: SquadApiOpponentDefensiveHistory[];
  label: string;
  name: string;
}

interface ReviewChartGroupHeader {
  ariaLabel: string;
  content: ReactNode;
  id: string;
  slotCount: number;
}

function createReviewPlayerGroup(id: ReviewPlayerGroup['id'], player: SquadApiPlayer, history: SquadApiHistoryResponse | null, fixtures: ProfileFixture[]): ReviewPlayerGroup {
  const nextFixtures = selectNextGameweekFixtures(
    player.next_fixtures?.length ? player.next_fixtures : player.next_fixture ? [player.next_fixture] : [],
  );
  const nextOpponent = nextFixtures[0] ?? null;
  const defensiveGroups = history?.opponent_defensive_histories ?? [];
  const matchingDefensiveGroup = nextOpponent
    ? defensiveGroups.find((group) => String(group.opponent_team_id) === String(nextOpponent.opponent_team_id))
    : defensiveGroups[0];
  const defensiveFixtures = matchingDefensiveGroup?.fixtures ?? (nextOpponent ? history?.opponent_defensive_history ?? [] : []);
  const latestFixture = defensiveFixtures.at(-1);
  const opponentName = nextOpponent?.opponent_name ?? matchingDefensiveGroup?.opponent_name ?? latestFixture?.opponent_name ?? 'Opponent';
  const opponentShortName = nextOpponent?.opponent_short_name ?? matchingDefensiveGroup?.opponent_short_name ?? latestFixture?.opponent_short_name ?? opponentName;
  const isHome = nextOpponent?.is_home ?? latestFixture?.is_home ?? false;
  const difficulty = nextOpponent?.difficulty ?? latestFixture?.difficulty ?? null;
  return {
    fixtures,
    id,
    nextFixtures,
    opponent: {
      difficulty,
      fixtures: defensiveFixtures.slice(-REVIEW_FIXTURE_COUNT),
      label: formatOpponentLabel(opponentShortName, isHome),
      name: opponentName,
    },
    player,
  };
}

function ReviewChartGroupHeaders({ groups, label }: { groups: ReviewChartGroupHeader[]; label: string }) {
  const slotCount = groups.reduce((total, group) => total + group.slotCount, 0);
  let gridColumnStart = 1;
  return <div aria-label={label} className="player-profile__chart-group-headers" role="group" style={{ '--chart-group-column-count': slotCount } as CSSProperties}>
    <span aria-hidden="true" className="player-profile__chart-group-axis" />
    <div className="player-profile__chart-group-columns">
      {groups.map((group, index) => {
        if (index > 0) gridColumnStart += 1;
        const style = { gridColumn: `${gridColumnStart} / span ${group.slotCount}` };
        gridColumnStart += group.slotCount;
        return <div aria-label={group.ariaLabel} className="player-profile__chart-group-header" key={group.id} style={style}>{group.content}</div>;
      })}
    </div>
  </div>;
}

function chartGroupColumnStyle(index: number, groupBreakAfter?: number): CSSProperties | undefined {
  if (groupBreakAfter === undefined) return undefined;
  return { gridColumn: String(index >= groupBreakAfter ? index + 2 : index + 1) };
}

function toTeamSelectionCardPlayer(player: TeamSelectionPlayer): PlayerCardPlayer {
  return {
    displayName: player.name,
    form: null,
    position: player.position,
    team: player.team,
  };
}

function toPlayerCardPlayer(player: SquadApiPlayer, selectedFixtures?: ProfileNextFixture[], captaincy: Captaincy = null): PlayerCardPlayer {
  const rawFixtures: Array<SquadApiNextFixture | SquadApiUpcomingFixture> = player.next_fixtures?.length
    ? player.next_fixtures
    : player.next_fixture
      ? [player.next_fixture]
      : [];
  const nextFixtures = selectedFixtures ?? selectNextGameweekFixtures(rawFixtures);
  return {
    displayName: player.display_name,
    fixtures: nextFixtures.map((fixture) => ({
      difficulty: fixture.difficulty,
      label: formatOpponentLabel(fixture.opponent_short_name ?? fixture.opponent_name ?? null, fixture.is_home),
      title: fixtureDifficultyTitle(fixture.difficulty),
    })),
    form: player.form,
    position: player.position,
    team: player.epl_team.short_name ?? player.epl_team.name,
    captain: captaincy === 'captain',
    viceCaptain: captaincy === 'vice_captain',
    availabilityChance: player.chance_of_playing_next_round,
  };
}

function ChartCard({ ariaLabel, children, className = '', compact = false, heading, idPrefix, title }: { ariaLabel?: string; children: ReactNode; className?: string; compact?: boolean; heading?: ReactNode; idPrefix?: string; title?: string }) {
  const headingId = idPrefix ?? title?.replace(/\s+/g, '-').toLowerCase() ?? 'player-profile-chart';
  return <section aria-label={ariaLabel} aria-labelledby={heading ? headingId : undefined} className={`player-profile__card player-profile__chart-card${compact ? ' player-profile__chart-card--compact' : ''} ${className}`.trim()}><div className="player-profile__card-heading">{heading ?? <h2 id={headingId}>{title}</h2>}</div>{children}</section>;
}

function DefensiveChart({ fixtureCount = PROFILE_CHART_COLUMN_COUNT, fixtures, fdrDisplayMode, groupBreakAfter, onFixtureClick }: { fixtureCount?: number; fixtures: ReadonlyArray<SquadApiOpponentDefensiveHistory | null>; fdrDisplayMode: 'font' | 'fill'; groupBreakAfter?: number; onFixtureClick?: (fixture: SquadApiOpponentDefensiveHistory, index: number) => void }) {
  const populatedFixtures = fixtures.filter((fixture): fixture is SquadApiOpponentDefensiveHistory => fixture !== null);
  const rawMaxValue = Math.max(80, ...populatedFixtures.map((fixture) => Math.max(fixture.total_points_conceded ?? 0, (fixture.attacking_asset_points ?? 0) + (fixture.defensive_asset_points ?? 0))));
  const maxValue = Math.ceil(rawMaxValue / 10) * 10;
  const slots = chartFixtureSlots(fixtures, fixtureCount);
  return <><div aria-label={`Attacking and defensive fantasy points conceded by the opponent, vertical scale 0 to ${maxValue} points`} className="player-profile__chart player-profile__chart--defensive" data-chart-kind="opponent-defence" data-fixture-count={slots.length} data-y-axis-max={maxValue} data-y-axis-min="0" data-y-axis-tick-step="10" role="group" style={{ '--chart-column-count': slots.length } as CSSProperties}><div className="player-profile__chart-layout"><PlayerChartYAxis max={maxValue} step={10} /><div className="player-profile__chart-plot"><PlayerChartGrid max={maxValue} step={10} /><PlayerChartZeroLine /><div className="player-profile__chart-columns">{slots.map((fixture, index) => <DefensiveColumn fixture={fixture} fdrDisplayMode={fdrDisplayMode} index={index} maxValue={maxValue} onClick={onFixtureClick} style={chartGroupColumnStyle(index, groupBreakAfter)} key={`${fixture?.fixture_id ?? 'empty'}-${index}`} />)}</div></div></div></div><div className="player-profile__legend"><span><i className="player-profile__legend-swatch player-profile__legend-swatch--attack" />Attacking assets</span><span><i className="player-profile__legend-swatch player-profile__legend-swatch--defence" />Defensive assets</span></div></>;
}

function DefensiveColumn({ fixture, fdrDisplayMode, index = 0, maxValue, onClick, style }: { fixture: SquadApiOpponentDefensiveHistory | null; fdrDisplayMode: 'font' | 'fill'; index?: number; maxValue: number; onClick?: (fixture: SquadApiOpponentDefensiveHistory, index: number) => void; style?: CSSProperties }) {
  const attack = fixture?.attacking_asset_points ?? 0;
  const defence = fixture?.defensive_asset_points ?? 0;
  const hasPoints = fixture !== null && fixture.total_points_conceded !== null && fixture.total_points_conceded !== undefined;
  const attackHeight = groupedAssetBarHeight(attack, maxValue, hasPoints);
  const defenceHeight = groupedAssetBarHeight(defence, maxValue, hasPoints);
  return <div className="player-profile__chart-column" style={style}><span className={`player-profile__chart-value${hasPoints ? '' : ' is-empty'}`}>{formatNullableNumber(fixture?.total_points_conceded)}</span>{fixture ? <button aria-label={`View ${formatOpponentLabel(fixture.opponent_short_name ?? null, fixture.is_home)} points-against details`} className="player-profile__bar-track player-profile__bar-track--grouped player-profile__grouped-bar-button" onClick={() => onClick?.(fixture, index)} type="button"><span className="player-profile__grouped-bar-wrap player-profile__grouped-bar-wrap--attack"><span aria-hidden="true" className="player-profile__grouped-bar-point-label player-profile__grouped-bar-point-label--attack">{attack}</span><span aria-label={`Attacking assets: ${attack} points`} className="player-profile__grouped-bar player-profile__grouped-bar--attack" style={{ '--bar-height': `${attackHeight}%` } as CSSProperties} /></span><span className="player-profile__grouped-stat-icons"><PlayerStatIcons className="player-profile__stat-icons--compact" position={null} stats={opponentStatSummary(fixture)} /></span><span className="player-profile__grouped-bar-wrap player-profile__grouped-bar-wrap--defence"><span aria-hidden="true" className="player-profile__grouped-bar-point-label player-profile__grouped-bar-point-label--defence">{defence}</span><span aria-label={`Defensive assets: ${defence} points`} className="player-profile__grouped-bar player-profile__grouped-bar--defence" style={{ '--bar-height': `${defenceHeight}%` } as CSSProperties} /></span></button> : <div aria-hidden="true" className="player-profile__bar-track player-profile__bar-track--grouped player-profile__grouped-bar-empty" /> }<span className="player-profile__opponent-label" style={fdrStyleFor(fixture?.difficulty ?? null, fdrDisplayMode)}>{fixture ? formatOpponentLabel(fixture.opponent_short_name ?? null, fixture.is_home) : ''}</span></div>;
}

function groupedAssetBarHeight(points: number, maxValue: number, hasPoints: boolean): number {
  if (!hasPoints) return 0;
  if (points <= 0) return 8;
  return Math.max(8, (points / maxValue) * 100);
}

function opponentStatSummary(fixture: SquadApiOpponentDefensiveHistory): PlayerStatSummary {
  return {
    goals: fixture.stat_icons?.goals ?? 0,
    assists: fixture.stat_icons?.assists ?? 0,
    cleanSheets: fixture.stat_icons?.clean_sheets ?? 0,
    saves: fixture.stat_icons?.saves ?? 0,
    yellowCards: fixture.stat_icons?.yellow_cards ?? 0,
    redCards: fixture.stat_icons?.red_cards ?? 0,
    ownGoals: fixture.stat_icons?.own_goals ?? 0,
    defensiveContributions: fixture.stat_icons?.defensive_contributions ?? 0,
    bonusPoints: fixture.stat_icons?.bonus_points ?? 0,
  };
}

const detailCategoryLabels: Record<string, string> = {
  assists: 'Assists',
  bonus_points: 'Bonus points',
  clean_sheets: 'Clean sheets',
  defensive_contributions: 'Defensive contributions',
  goals: 'Goals',
  own_goals: 'Own goals',
  red_cards: 'Red cards',
  saves: 'Saves',
  yellow_cards: 'Yellow cards',
};

const oppositionDetailCategoryOrder = [
  'goals',
  'assists',
  'clean_sheets',
  'defensive_contributions',
  'bonus_points',
  'yellow_cards',
  'red_cards',
  'own_goals',
  // Saves remain available after the explicitly requested order because they
  // are still a valid FPL scoring return for goalkeeper opposition assets.
  'saves',
] as const;

function formDetailSummary(fixture: ProfileFixture): PlayerChartDetailSummaryItem[] {
  return [
    { label: 'Fantasy points', value: formatNullableNumber(fixture.fantasyPoints) },
    { label: 'Minutes', value: formatNullableNumber(fixture.minutesPlayed) },
    { label: 'FDR', value: formatNullableNumber(fixture.fdr) },
  ];
}

function formDetailSections(fixture: ProfileFixture): PlayerChartDetailSection[] {
  const position = fixture.position?.toUpperCase() ?? '';
  const minutes = fixture.minutesPlayed ?? 0;
  const goalPoints = position === 'GKP' || position === 'DEF' ? 6 : position === 'MID' ? 5 : 4;
  const cleanSheetPoints = position === 'GKP' || position === 'DEF' ? 4 : position === 'MID' ? 1 : 0;
  const rows = [
    { label: 'Minutes', value: minutes, points: minutes >= 60 ? 2 : minutes > 0 ? 1 : 0 },
    { label: 'Goals', value: fixture.stats.goals, points: fixture.stats.goals * goalPoints },
    { label: 'Assists', value: fixture.stats.assists, points: fixture.stats.assists * 3 },
    { label: 'Clean sheets', value: fixture.stats.cleanSheets, points: fixture.stats.cleanSheets * cleanSheetPoints },
    { label: 'Saves', value: fixture.stats.saves, points: Math.floor(fixture.stats.saves / 3) },
    { label: 'Yellow card', value: fixture.stats.yellowCards, points: fixture.stats.yellowCards * -1 },
    { label: 'Red card', value: fixture.stats.redCards, points: fixture.stats.redCards * -3 },
    { label: 'Own goal', value: fixture.stats.ownGoals ?? 0, points: (fixture.stats.ownGoals ?? 0) * -2 },
    { label: 'Bonus points', value: fixture.stats.bonusPoints, points: fixture.stats.bonusPoints },
    {
      label: 'Defensive contributions',
      value: earnedDefensiveContributionPoints(fixture.stats.defensiveContributions, fixture.position)
        ? fixture.stats.defensiveContributions
        : 0,
      points: earnedDefensiveContributionPoints(fixture.stats.defensiveContributions, fixture.position) ? 2 : 0,
    },
  ]
    .filter((row) => row.value > 0)
    .map((row) => ({ label: row.label, value: String(row.value), points: formatSignedPoints(row.points) }));
  return [{ title: 'Scoring returns', rows }];
}

function formatSignedPoints(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function opponentDetailSummary(fixture: SquadApiOpponentDefensiveHistory): PlayerChartDetailSummaryItem[] {
  return [
    { label: 'Total points', value: formatNullableNumber(fixture.total_points_conceded) },
    { label: 'Attacking', value: formatNullableNumber(fixture.attacking_asset_points) },
    { label: 'Defensive', value: formatNullableNumber(fixture.defensive_asset_points) },
    { label: 'FDR', value: formatNullableNumber(fixture.difficulty) },
  ];
}

function opponentDetailSections(fixture: SquadApiOpponentDefensiveHistory): PlayerChartDetailSection[] {
  const details = fixture.stat_details ?? [];
  if (details.length > 0) {
    return oppositionDetailCategoryOrder
      .map((category) => ({
        title: detailCategoryLabels[category],
        rows: details
          .filter((detail) => detail.category === category)
          .sort((left, right) => right.points - left.points)
          .map((detail) => ({
            label: detail.player_name,
            points: formatSignedPoints(detail.points),
            value: detail.value !== null && detail.value !== undefined && detail.value > 0 ? `(${detail.value})` : undefined,
          })),
      }))
      .filter((section) => section.rows.length > 0);
  }

  const summary = opponentStatSummary(fixture);
  const fallbackStats: Array<[string, number]> = [
    ['goals', summary.goals],
    ['assists', summary.assists],
    ['clean_sheets', summary.cleanSheets],
    ['defensive_contributions', summary.defensiveContributions],
    ['bonus_points', summary.bonusPoints],
    ['yellow_cards', summary.yellowCards],
    ['red_cards', summary.redCards],
    ['own_goals', summary.ownGoals ?? 0],
    ['saves', summary.saves],
  ];
  const fallbackRows = fallbackStats
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ label: detailCategoryLabels[key] ?? key, value: String(value) }));
  return [{ title: 'Recorded returns', rows: fallbackRows }];
}

export { earnedDefensiveContributionPoints } from './components/player/PlayerStatIcons';

function PlayerAvailabilityNews({ chance, news }: { chance: number | null | undefined; news: string }) {
  return (
    <section aria-labelledby="player-availability-news-title" className="player-profile__card player-profile__availability-news">
      <div className="player-profile__card-heading">
        <h2 id="player-availability-news-title">FPL news</h2>
        {typeof chance === 'number' ? <span className="player-profile__muted-label">Chance {chance}%</span> : null}
      </div>
      <p>{news}</p>
    </section>
  );
}

function OpponentChartHeading({ difficulty, headingId, label, title }: { difficulty: number | null; headingId: string; label: string; title?: string }) {
  return (
    <h2 className="player-profile__opponent-chart-heading" id={headingId}>
      <span className="player-profile__muted-label">Points against</span>
      <OpponentFdrBadge difficulty={difficulty} label={label} title={title} />
    </h2>
  );
}

function ActionButton({ active = false, danger = false, disabled, icon: Icon, label, onClick, visual }: { active?: boolean; danger?: boolean; disabled: boolean; icon?: LucideIcon; label: string; onClick: () => void; visual?: ReactNode }) {
  return <button aria-pressed={active} className={`player-profile__action${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`} disabled={disabled} onClick={onClick} type="button">{visual ?? (Icon ? <Icon aria-hidden="true" size={17} /> : null)}<span>{label}</span></button>;
}

function PlayerRoleBadge({ role }: { role: 'captain' | 'vice' }) {
  return <i aria-hidden="true" className={`squad-page__captain player-profile__action-role-badge${role === 'vice' ? ' vice' : ''}`} />;
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

function selectNextGameweekFixtures(
  fixtures: Array<SquadApiUpcomingFixture | SquadApiNextFixture>,
): ProfileNextFixture[] {
  const normalized = fixtures.map((fixture) => {
    if ('opponent' in fixture) {
      return {
        fixture_id: fixture.fixture_id,
        gameweek: fixture.gameweek?.number ?? null,
        opponent_team_id: fixture.opponent.id,
        opponent_name: fixture.opponent.name,
        opponent_short_name: fixture.opponent.short_name ?? fixture.opponent.name,
        difficulty: fixture.difficulty ?? null,
        is_home: fixture.is_home,
        opponent_difficulty: null,
      } satisfies ProfileNextFixture;
    }
    return {
      fixture_id: fixture.fixture_id,
      gameweek: fixture.gameweek ?? null,
      opponent_team_id: fixture.opponent_team_id,
      opponent_name: fixture.opponent_name,
      opponent_short_name: fixture.opponent_short_name,
      difficulty: fixture.difficulty ?? null,
      is_home: fixture.is_home,
      opponent_difficulty: fixture.opponent_difficulty ?? null,
    } satisfies ProfileNextFixture;
  });
  const gameweeks = normalized
    .map((fixture) => fixture.gameweek)
    .filter((gameweek): gameweek is number => gameweek !== null);
  if (gameweeks.length === 0) return normalized.slice(0, 1);
  const nextGameweek = Math.min(...gameweeks);
  return normalized.filter((fixture) => fixture.gameweek === nextGameweek);
}

function mapHistoryFixture(row: SquadApiHistoryResponse['history'][number], position: string | null = null): ProfileFixture {
  return {
    fixtureId: String(row.fixture_id),
    gameweek: row.gameweek,
    position,
    opponentShortName: row.opponent_short_name ?? null,
    isHome: row.was_home,
    fdr: row.difficulty ?? null,
    fantasyPoints: row.minutes > 0 ? row.total_points : null,
    minutesPlayed: row.minutes > 0 ? row.minutes : null,
    stats: {
      goals: row.goals_scored,
      assists: row.assists,
      cleanSheets: row.clean_sheets,
      saves: row.saves,
      yellowCards: row.yellow_cards,
      redCards: row.red_cards,
      ownGoals: row.own_goals ?? 0,
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
