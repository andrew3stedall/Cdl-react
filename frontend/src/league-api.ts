export interface LeagueTeam {
  id: string;
  name: string;
  shortName?: string;
}

export interface LeagueGameweek {
  id: string;
  name: string;
  number: number;
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
}

interface ApiTeam {
  id: string;
  name: string;
  short_name?: string | null;
}

interface ApiGameweek {
  id: string;
  name: string;
  number: number;
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

function mapTeam(team: ApiTeam): LeagueTeam {
  return {
    id: team.id,
    name: team.name,
    shortName: team.short_name ?? undefined,
  };
}

function mapGameweek(gameweek: ApiGameweek): LeagueGameweek {
  return {
    id: gameweek.id,
    name: gameweek.name,
    number: gameweek.number,
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
