import type { SquadApiFormGameweek } from './squad-api';

export interface LeagueTeam {
  id: string;
  name: string;
  shortName?: string;
  managerName?: string;
}

export interface LeagueGameweek {
  id: string;
  name: string;
  number: number;
  deadlineAt?: string | null;
}

export interface LeagueFixtureScore {
  homeScore: number | null;
  awayScore: number | null;
  bonusPoints: Record<string, number>;
  chipsPlayed: Record<string, string[]>;
  outcome: 'home_win' | 'away_win' | 'draw' | 'pending';
}

export interface LeagueFixture {
  id: string;
  gameweek: LeagueGameweek;
  homeTeam: LeagueTeam;
  awayTeam: LeagueTeam;
  status: 'pending' | 'started' | 'complete';
  kickoffLabel: string;
  roundLabel: string;
  isCurrent: boolean;
  isNext: boolean;
  detailAvailable: boolean;
  score: LeagueFixtureScore;
}

export interface FixtureEvent {
  label: string;
  team: LeagueTeam;
  points: number;
  ruleReference: string | null;
}

export interface FixtureDetailResponse {
  fixture: LeagueFixture;
  events: FixtureEvent[];
  notes: string[];
}

export interface FixtureSquadPlayer {
  id: string;
  displayName: string;
  position: string;
  club?: LeagueTeam;
  nextOpponent?: LeagueTeam;
  nextFixtureIsHome?: boolean;
  nextFixtureDifficulty?: number;
  fixtureFixtures?: FixturePlayerFixture[];
  points: number;
  pointsMultiplier?: number;
  minutes?: number | null;
  hasStartedFixture?: boolean | null;
  allFixturesFinished?: boolean | null;
  form: number;
  formHistory?: SquadApiFormGameweek[];
  slot: 'starter' | 'bench' | 'reserve';
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isSubstitutedIn?: boolean;
  isSubstitutedOut?: boolean;
}

export interface FixturePlayerFixture {
  fixtureId: string;
  gameweek: number | null;
  opponent: LeagueTeam;
  difficulty?: number;
  isHome: boolean;
  kickoffAt?: string | null;
}

export interface FixtureSquad {
  team: LeagueTeam;
  isUserTeam: boolean;
  players: FixtureSquadPlayer[];
  starters: FixtureSquadPlayer[];
  bench: FixtureSquadPlayer[];
  reserves: FixtureSquadPlayer[];
}

export interface LeagueFixturesResponse {
  gameweek: LeagueGameweek | null;
  fixtures: LeagueFixture[];
}

export interface LeagueTableRow {
  position: number;
  team: LeagueTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifference: number;
  leaguePoints: number;
}

export interface LeagueTableResponse {
  rows: LeagueTableRow[];
  source: string;
}

export interface KnockoutMatch {
  id: string;
  roundLabel: string;
  fixture: LeagueFixture;
  winner: LeagueTeam | null;
}

export interface KnockoutResponse {
  rounds: string[];
  matches: KnockoutMatch[];
  status?: 'not_ready' | 'in_progress' | 'complete' | 'partially_configured';
  brackets?: KnockoutBracket[];
  unconfiguredBrackets?: string[];
}

export interface KnockoutBracket {
  id: string;
  label: string;
  status: string;
  ties: {
    id: string;
    roundLabel: string;
    teams: LeagueTeam[];
    legs: { id: string; fixture: LeagueFixture; legNumber: number }[];
    aggregate: Record<string, number>;
    scoringLineupGoals: Record<string, number>;
    winner: LeagueTeam | null;
    tiebreakStatus: 'pending' | 'decided' | 'unresolved';
  }[];
}

export interface HeadToHeadRecord {
  team: LeagueTeam;
  opponent: LeagueTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface HeadToHeadResponse {
  records: HeadToHeadRecord[];
}

export interface LeagueSnapshot {
  currentFixtures: LeagueFixturesResponse;
  nextFixtures: LeagueFixturesResponse;
  allFixtures: LeagueFixturesResponse;
  table: LeagueTableResponse;
  knockout: KnockoutResponse;
  headToHead: HeadToHeadResponse;
  failedReads?: string[];
}

export type LeagueSnapshotView = 'fixtures' | 'table' | 'knockout' | 'head-to-head' | 'all';

export interface LeagueManagement {
  leagueName: string;
  availableTeamCount: number;
  teams: LeagueManagementTeam[];
}

export interface LeagueManagementTeam {
  teamId: string;
  teamName: string;
  managerName: string | null;
  managerEmail: string | null;
  isAssigned: boolean;
}

export interface LeagueInvite {
  leagueName: string;
  teamId: string;
  teamName: string;
  token: string;
  availableTeamCount: number;
}

export interface LeagueInvitePreview {
  leagueName: string;
  teamId: string;
  teamName: string;
  availableTeamCount: number;
}

export interface LeagueJoinResult {
  leagueName: string;
  teamId: string;
  teamName: string;
  alreadyMember: boolean;
}

export interface LeagueClient {
  getLeagueSnapshot(view?: LeagueSnapshotView): Promise<LeagueSnapshot>;
  getKnockout?(): Promise<KnockoutResponse>;
  getHeadToHead?(): Promise<HeadToHeadResponse>;
  getLeagueManagement?(): Promise<LeagueManagement>;
  createLeagueInvite?(teamId: string): Promise<LeagueInvite>;
  previewLeagueInvite?(token: string): Promise<LeagueInvitePreview>;
  acceptLeagueInvite?(token: string): Promise<LeagueJoinResult>;
  getFixtureDetail?(fixtureId: string): Promise<FixtureDetailResponse>;
  getFixtureSquads?(fixtureId: string): Promise<FixtureSquad[]>;
}

export class LeagueApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'LeagueApiError';
  }
}

interface ApiTeam {
  id: string;
  name: string;
  short_name?: string | null;
  manager_name?: string | null;
}

interface ApiGameweek {
  id: string;
  name: string;
  number: number;
  deadline_at?: string | null;
}

interface ApiFixtureScore {
  home_score: number | null;
  away_score: number | null;
  bonus_points: Record<string, number>;
  chips_played: Record<string, string[]>;
  outcome: LeagueFixtureScore['outcome'];
}

interface ApiFixture {
  id: string;
  gameweek: ApiGameweek;
  home_team: ApiTeam;
  away_team: ApiTeam;
  status: LeagueFixture['status'];
  kickoff_label: string;
  round_label: string;
  is_current: boolean;
  is_next: boolean;
  detail_available: boolean;
  score: ApiFixtureScore;
}

interface ApiFixtureEvent {
  label: string;
  team: ApiTeam;
  points: number;
  rule_reference?: string | null;
}

interface ApiFixtureDetailResponse {
  fixture: ApiFixture;
  events: ApiFixtureEvent[];
  notes: string[];
}

interface ApiFixturesResponse {
  gameweek: ApiGameweek | null;
  fixtures: ApiFixture[];
}

interface ApiTableRow {
  position: number;
  team: ApiTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points_for: number;
  points_against: number;
  points_difference: number;
  league_points: number;
}

interface ApiTableResponse {
  rows: ApiTableRow[];
  source: string;
}

interface ApiKnockoutMatch {
  id: string;
  round_label: string;
  fixture: ApiFixture;
  winner: ApiTeam | null;
}

interface ApiKnockoutResponse {
  rounds: string[];
  matches: ApiKnockoutMatch[];
  status?: KnockoutResponse['status'];
  unconfigured_brackets?: string[];
  brackets?: {
    id: string;
    label: string;
    status: string;
    ties: {
      id: string;
      round_label: string;
      teams: ApiTeam[];
      legs: { id: string; fixture: ApiFixture; leg_number: number }[];
      aggregate: Record<string, number>;
      scoring_lineup_goals: Record<string, number>;
      winner: ApiTeam | null;
      tiebreak_status: 'pending' | 'decided' | 'unresolved';
    }[];
  }[];
}

interface ApiHeadToHeadRecord {
  team: ApiTeam;
  opponent: ApiTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points_for: number;
  points_against: number;
}

interface ApiHeadToHeadResponse {
  records: ApiHeadToHeadRecord[];
}

interface ApiLeagueManagementResponse {
  league_name: string;
  available_team_count: number;
  teams: ApiLeagueManagementTeam[];
}

interface ApiLeagueManagementTeam {
  team_id: string;
  team_name: string;
  manager_name?: string | null;
  manager_email?: string | null;
  is_assigned: boolean;
}

interface ApiLeagueInviteResponse {
  league_name: string;
  team_id: string;
  team_name: string;
  token: string;
  available_team_count: number;
}

interface ApiLeagueInvitePreviewResponse {
  league_name: string;
  team_id: string;
  team_name: string;
  available_team_count: number;
}

interface ApiLeagueJoinResponse {
  league_name: string;
  team_id: string;
  team_name: string;
  already_member?: boolean;
}

export class HttpLeagueClient implements LeagueClient {
  constructor(private readonly baseUrl = '/api') {}

  async getLeagueSnapshot(view: LeagueSnapshotView = 'all'): Promise<LeagueSnapshot> {
    const emptyFixtures: LeagueFixturesResponse = { gameweek: null, fixtures: [] };
    const emptyTable: LeagueTableResponse = { rows: [], source: 'unavailable' };
    const fixtureReads = view === 'fixtures' || view === 'all'
      ? await Promise.allSettled([
          this.get<ApiFixturesResponse>('/league/fixtures/current'),
          this.get<ApiFixturesResponse>('/league/fixtures/next'),
          this.get<ApiFixturesResponse>('/league/fixtures'),
        ])
      : [];
    const tableRead = view === 'table' || view === 'all'
      ? await Promise.allSettled([this.get<ApiTableResponse>('/league/table')])
      : [];
    const knockoutRead = view === 'knockout' || view === 'all'
      ? await Promise.allSettled([this.getKnockout()])
      : [];
    const headToHeadRead = view === 'head-to-head' || view === 'all'
      ? await Promise.allSettled([this.getHeadToHead()])
      : [];
    const failedReads: string[] = [];
    const fixtureValue = (index: number, label: string): LeagueFixturesResponse => {
      const result = fixtureReads[index];
      if (!result) return emptyFixtures;
      if (result.status === 'rejected') {
        failedReads.push(label);
        return emptyFixtures;
      }
      return mapFixturesResponse(result.value);
    };
    let table = emptyTable;
    if (view === 'table' || view === 'all') {
      const result = tableRead[0];
      if (result?.status === 'fulfilled') table = mapTableResponse(result.value);
      else failedReads.push('table');
    }
    let knockout: KnockoutResponse = { rounds: [], matches: [] };
    if (view === 'knockout' || view === 'all') {
      const result = knockoutRead[0];
      if (result?.status === 'fulfilled') knockout = result.value;
      else failedReads.push('knockout');
    }
    let headToHead: HeadToHeadResponse = { records: [] };
    if (view === 'head-to-head' || view === 'all') {
      const result = headToHeadRead[0];
      if (result?.status === 'fulfilled') headToHead = result.value;
      else failedReads.push('head-to-head');
    }
    return {
      currentFixtures: fixtureValue(0, 'current fixtures'),
      nextFixtures: fixtureValue(1, 'upcoming fixtures'),
      allFixtures: fixtureValue(2, 'fixture history'),
      table,
      knockout,
      headToHead,
      failedReads,
    };
  }

  async getKnockout(): Promise<KnockoutResponse> {
    return mapKnockoutResponse(await this.get<ApiKnockoutResponse>('/league/knockout'));
  }

  async getHeadToHead(): Promise<HeadToHeadResponse> {
    return mapHeadToHeadResponse(await this.get<ApiHeadToHeadResponse>('/league/head-to-head'));
  }

  async getLeagueManagement(): Promise<LeagueManagement> {
    const response = await this.get<ApiLeagueManagementResponse>('/league/management');
    return {
      leagueName: response.league_name,
      availableTeamCount: response.available_team_count,
      teams: response.teams.map((team) => ({
        teamId: team.team_id,
        teamName: team.team_name,
        managerName: team.manager_name ?? null,
        managerEmail: team.manager_email ?? null,
        isAssigned: team.is_assigned,
      })),
    };
  }

  async createLeagueInvite(teamId: string): Promise<LeagueInvite> {
    const response = await this.post<ApiLeagueInviteResponse>('/league/management/invites', { team_id: teamId });
    return {
      leagueName: response.league_name,
      teamId: response.team_id,
      teamName: response.team_name,
      token: response.token,
      availableTeamCount: response.available_team_count,
    };
  }

  async previewLeagueInvite(token: string): Promise<LeagueInvitePreview> {
    const response = await this.get<ApiLeagueInvitePreviewResponse>(
      `/league/invites/${encodeURIComponent(token)}`,
    );
    return {
      leagueName: response.league_name,
      teamId: response.team_id,
      teamName: response.team_name,
      availableTeamCount: response.available_team_count,
    };
  }

  async acceptLeagueInvite(token: string): Promise<LeagueJoinResult> {
    const response = await this.post<ApiLeagueJoinResponse>(
      `/league/invites/${encodeURIComponent(token)}/accept`,
    );
    return {
      leagueName: response.league_name,
      teamId: response.team_id,
      teamName: response.team_name,
      alreadyMember: response.already_member === true,
    };
  }

  async getFixtureDetail(fixtureId: string): Promise<FixtureDetailResponse> {
    const response = await this.get<ApiFixtureDetailResponse>(
      `/league/fixtures/${encodeURIComponent(fixtureId)}`,
    );

    return {
      fixture: mapFixture(response.fixture),
      events: response.events.map((event) => ({
        label: event.label,
        team: mapTeam(event.team),
        points: event.points,
        ruleReference: event.rule_reference ?? null,
      })),
      notes: response.notes,
    };
  }

  async getFixtureSquads(fixtureId: string): Promise<FixtureSquad[]> {
    const response = await this.get<ApiFixtureSquad[]>(`/league/fixtures/${encodeURIComponent(fixtureId)}/squads`);
    return response.map((squad) => ({
      team: mapTeam(squad.team),
      isUserTeam: squad.is_user_team === true,
      players: (squad.players ?? squad.starters.concat(squad.bench, squad.reserves ?? [])).map(mapFixtureSquadPlayer),
      starters: squad.starters.map(mapFixtureSquadPlayer),
      bench: squad.bench.map(mapFixtureSquadPlayer),
      reserves: (squad.reserves ?? []).map(mapFixtureSquadPlayer),
    }));
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new LeagueApiError(response.status, `Unable to load league data from ${path}.`);
    }

    return (await response.json()) as T;
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new LeagueApiError(response.status, `Unable to update league data at ${path}.`);
    }

    return (await response.json()) as T;
  }
}

interface ApiFixtureSquadPlayer {
  id: string;
  display_name: string;
  position: string;
  club?: ApiTeam | null;
  next_opponent?: ApiTeam | null;
  next_fixture_is_home?: boolean | null;
  next_fixture_difficulty?: number | null;
  fixture_fixtures?: ApiFixturePlayerFixture[];
  points: number;
  points_multiplier?: number;
  minutes?: number | null;
  has_started_fixture?: boolean | null;
  all_fixtures_finished?: boolean | null;
  form: number;
  form_history?: SquadApiFormGameweek[];
  slot: 'starter' | 'bench' | 'reserve';
  is_captain?: boolean;
  is_vice_captain?: boolean;
  is_substituted_in?: boolean;
  is_substituted_out?: boolean;
}

interface ApiFixturePlayerFixture {
  fixture_id: string;
  gameweek?: ApiGameweek | number | null;
  opponent: ApiTeam;
  difficulty?: number | null;
  is_home: boolean;
  kickoff_at?: string | null;
}

interface ApiFixtureSquad {
  team: ApiTeam;
  is_user_team?: boolean;
  players?: ApiFixtureSquadPlayer[];
  starters: ApiFixtureSquadPlayer[];
  bench: ApiFixtureSquadPlayer[];
  reserves?: ApiFixtureSquadPlayer[];
}

function mapFixtureSquadPlayer(player: ApiFixtureSquadPlayer): FixtureSquadPlayer {
  return {
    id: player.id,
    displayName: player.display_name,
    position: player.position,
    club: player.club ? mapTeam(player.club) : undefined,
    nextOpponent: player.next_opponent ? mapTeam(player.next_opponent) : undefined,
    nextFixtureIsHome: player.next_fixture_is_home ?? undefined,
    nextFixtureDifficulty: player.next_fixture_difficulty ?? undefined,
    fixtureFixtures: (player.fixture_fixtures ?? []).map((fixture) => ({
      fixtureId: fixture.fixture_id,
      gameweek: typeof fixture.gameweek === 'number' ? fixture.gameweek : fixture.gameweek?.number ?? null,
      opponent: mapTeam(fixture.opponent),
      difficulty: fixture.difficulty ?? undefined,
      isHome: fixture.is_home,
      kickoffAt: fixture.kickoff_at ?? null,
    })),
    points: player.points,
    pointsMultiplier: player.points_multiplier ?? 1,
    minutes: player.minutes ?? null,
    hasStartedFixture: player.has_started_fixture ?? null,
    allFixturesFinished: player.all_fixtures_finished ?? null,
    form: player.form,
    formHistory: player.form_history ?? [],
    slot: player.slot,
    isCaptain: player.is_captain === true,
    isViceCaptain: player.is_vice_captain === true,
    isSubstitutedIn: player.is_substituted_in === true,
    isSubstitutedOut: player.is_substituted_out === true,
  };
}

function mapTeam(team: ApiTeam): LeagueTeam {
  return {
    id: team.id,
    name: team.name,
    shortName: team.short_name ?? undefined,
    managerName: team.manager_name ?? undefined,
  };
}

function mapGameweek(gameweek: ApiGameweek): LeagueGameweek {
  return {
    id: gameweek.id,
    name: gameweek.name,
    number: gameweek.number,
    deadlineAt: gameweek.deadline_at ?? null,
  };
}

function mapFixture(fixture: ApiFixture): LeagueFixture {
  return {
    id: fixture.id,
    gameweek: mapGameweek(fixture.gameweek),
    homeTeam: mapTeam(fixture.home_team),
    awayTeam: mapTeam(fixture.away_team),
    status: fixture.status,
    kickoffLabel: fixture.kickoff_label,
    roundLabel: fixture.round_label,
    isCurrent: fixture.is_current,
    isNext: fixture.is_next,
    detailAvailable: fixture.detail_available,
    score: {
      homeScore: fixture.score.home_score,
      awayScore: fixture.score.away_score,
      bonusPoints: fixture.score.bonus_points,
      chipsPlayed: fixture.score.chips_played,
      outcome: fixture.score.outcome,
    },
  };
}

function mapFixturesResponse(response: ApiFixturesResponse): LeagueFixturesResponse {
  return {
    gameweek: response.gameweek ? mapGameweek(response.gameweek) : null,
    fixtures: response.fixtures.map(mapFixture),
  };
}

function mapTableResponse(response: ApiTableResponse): LeagueTableResponse {
  return {
    source: response.source,
    rows: response.rows.map((row) => ({
      position: row.position,
      team: mapTeam(row.team),
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      pointsFor: row.points_for,
      pointsAgainst: row.points_against,
      pointsDifference: row.points_difference,
      leaguePoints: row.league_points,
    })),
  };
}

function mapKnockoutResponse(response: ApiKnockoutResponse): KnockoutResponse {
  return {
    status: response.status,
    unconfiguredBrackets: response.unconfigured_brackets ?? [],
    brackets: response.brackets?.map((bracket) => ({
      id: bracket.id,
      label: bracket.label,
      status: bracket.status,
      ties: bracket.ties.map((tie) => ({
        id: tie.id,
        roundLabel: tie.round_label,
        teams: tie.teams.map(mapTeam),
        legs: tie.legs.map((leg) => ({ id: leg.id, fixture: mapFixture(leg.fixture), legNumber: leg.leg_number })),
        aggregate: tie.aggregate,
        scoringLineupGoals: tie.scoring_lineup_goals,
        winner: tie.winner ? mapTeam(tie.winner) : null,
        tiebreakStatus: tie.tiebreak_status,
      })),
    })),
    rounds: response.rounds,
    matches: response.matches.map((match) => ({
      id: match.id,
      roundLabel: match.round_label,
      fixture: mapFixture(match.fixture),
      winner: match.winner ? mapTeam(match.winner) : null,
    })),
  };
}

function mapHeadToHeadResponse(response: ApiHeadToHeadResponse): HeadToHeadResponse {
  return {
    records: response.records.map((record) => ({
      team: mapTeam(record.team),
      opponent: mapTeam(record.opponent),
      played: record.played,
      wins: record.wins,
      draws: record.draws,
      losses: record.losses,
      pointsFor: record.points_for,
      pointsAgainst: record.points_against,
    })),
  };
}
