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
  form: number;
  slot: 'starter' | 'bench' | 'reserve';
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}

export interface FixturePlayerFixture {
  fixtureId: string;
  gameweek: number | null;
  opponent: LeagueTeam;
  difficulty?: number;
  isHome: boolean;
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
}

export interface LeagueClient {
  getLeagueSnapshot(): Promise<LeagueSnapshot>;
  getFixtureDetail?(fixtureId: string): Promise<FixtureDetailResponse>;
  getFixtureSquads?(fixtureId: string): Promise<FixtureSquad[]>;
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

export class HttpLeagueClient implements LeagueClient {
  constructor(private readonly baseUrl = '/api') {}

  async getLeagueSnapshot(): Promise<LeagueSnapshot> {
    const [currentFixtures, nextFixtures, allFixtures, table, knockout, headToHead] =
      await Promise.all([
        this.get<ApiFixturesResponse>('/league/fixtures/current'),
        this.get<ApiFixturesResponse>('/league/fixtures/next'),
        this.get<ApiFixturesResponse>('/league/fixtures'),
        this.get<ApiTableResponse>('/league/table'),
        this.get<ApiKnockoutResponse>('/league/knockout'),
        this.get<ApiHeadToHeadResponse>('/league/head-to-head'),
      ]);

    return {
      currentFixtures: mapFixturesResponse(currentFixtures),
      nextFixtures: mapFixturesResponse(nextFixtures),
      allFixtures: mapFixturesResponse(allFixtures),
      table: mapTableResponse(table),
      knockout: mapKnockoutResponse(knockout),
      headToHead: mapHeadToHeadResponse(headToHead),
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
      throw new Error(`Unable to load league data from ${path}.`);
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
  form: number;
  slot: 'starter' | 'bench' | 'reserve';
  is_captain?: boolean;
  is_vice_captain?: boolean;
}

interface ApiFixturePlayerFixture {
  fixture_id: string;
  gameweek?: number | null;
  opponent: ApiTeam;
  difficulty?: number | null;
  is_home: boolean;
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
      gameweek: fixture.gameweek ?? null,
      opponent: mapTeam(fixture.opponent),
      difficulty: fixture.difficulty ?? undefined,
      isHome: fixture.is_home,
    })),
    points: player.points,
    form: player.form,
    slot: player.slot,
    isCaptain: player.is_captain === true,
    isViceCaptain: player.is_vice_captain === true,
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
