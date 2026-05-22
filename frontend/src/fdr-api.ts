export type FixtureDifficultyView = 'attack' | 'defence';
export type FixtureDifficultyBand = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';

export interface FdrTeam {
  id: string;
  name: string;
  shortName?: string;
}

export interface FdrGameweek {
  id: string;
  name: string;
  number: number;
}

export interface FdrScaleStep {
  rating: number;
  band: FixtureDifficultyBand;
  label: string;
  foregroundToken: string;
  backgroundToken: string;
  contrastRatio: number;
}

export interface FdrFixtureCell {
  id: string;
  opponent: FdrTeam;
  gameweek: FdrGameweek;
  venue: string;
  rating: number;
  band: FixtureDifficultyBand;
  abbreviation: string;
}

export interface FdrRow {
  team: FdrTeam;
  fixtures: FdrFixtureCell[];
  averageRating: number;
}

export interface FdrFilters {
  season: string;
  teamId: string | null;
  gameweekStart: number;
  gameweekEnd: number;
}

export interface FdrViewResponse {
  view: FixtureDifficultyView;
  filters: FdrFilters;
  scales: FdrScaleStep[];
  rows: FdrRow[];
  availableTeams: FdrTeam[];
  availableGameweeks: FdrGameweek[];
}

export interface FdrCombinedResponse {
  attack: FdrViewResponse;
  defence: FdrViewResponse;
  scales: FdrScaleStep[];
}

export interface FdrClient {
  getFdr(filters: FdrFilters): Promise<FdrCombinedResponse>;
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

interface ApiScaleStep {
  rating: number;
  band: FixtureDifficultyBand;
  label: string;
  foreground_token: string;
  background_token: string;
  contrast_ratio: number;
}

interface ApiFixtureCell {
  id: string;
  opponent: ApiTeam;
  gameweek: ApiGameweek;
  venue: string;
  rating: number;
  band: FixtureDifficultyBand;
  abbreviation: string;
}

interface ApiRow {
  team: ApiTeam;
  fixtures: ApiFixtureCell[];
  average_rating: number;
}

interface ApiFilters {
  season: string;
  team_id: string | null;
  gameweek_start: number;
  gameweek_end: number;
}

interface ApiViewResponse {
  view: FixtureDifficultyView;
  filters: ApiFilters;
  scales: ApiScaleStep[];
  rows: ApiRow[];
  available_teams: ApiTeam[];
  available_gameweeks: ApiGameweek[];
}

interface ApiCombinedResponse {
  attack: ApiViewResponse;
  defence: ApiViewResponse;
  scales: ApiScaleStep[];
}

export class HttpFdrClient implements FdrClient {
  constructor(private readonly baseUrl = '/api') {}

  async getFdr(filters: FdrFilters): Promise<FdrCombinedResponse> {
    const params = new URLSearchParams({
      season: filters.season,
      gameweek_start: String(filters.gameweekStart),
      gameweek_end: String(filters.gameweekEnd),
    });
    if (filters.teamId) {
      params.set('team_id', filters.teamId);
    }

    const response = await fetch(`${this.baseUrl}/fdr?${params.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Unable to load fixture difficulty ratings.');
    }

    return mapCombinedResponse((await response.json()) as ApiCombinedResponse);
  }
}

function mapTeam(team: ApiTeam): FdrTeam {
  return {
    id: team.id,
    name: team.name,
    shortName: team.short_name ?? undefined,
  };
}

function mapScale(scale: ApiScaleStep): FdrScaleStep {
  return {
    rating: scale.rating,
    band: scale.band,
    label: scale.label,
    foregroundToken: scale.foreground_token,
    backgroundToken: scale.background_token,
    contrastRatio: scale.contrast_ratio,
  };
}

function mapFilters(filters: ApiFilters): FdrFilters {
  return {
    season: filters.season,
    teamId: filters.team_id,
    gameweekStart: filters.gameweek_start,
    gameweekEnd: filters.gameweek_end,
  };
}

function mapFixture(fixture: ApiFixtureCell): FdrFixtureCell {
  return {
    id: fixture.id,
    opponent: mapTeam(fixture.opponent),
    gameweek: fixture.gameweek,
    venue: fixture.venue,
    rating: fixture.rating,
    band: fixture.band,
    abbreviation: fixture.abbreviation,
  };
}

function mapViewResponse(response: ApiViewResponse): FdrViewResponse {
  return {
    view: response.view,
    filters: mapFilters(response.filters),
    scales: response.scales.map(mapScale),
    rows: response.rows.map((row) => ({
      team: mapTeam(row.team),
      fixtures: row.fixtures.map(mapFixture),
      averageRating: row.average_rating,
    })),
    availableTeams: response.available_teams.map(mapTeam),
    availableGameweeks: response.available_gameweeks,
  };
}

function mapCombinedResponse(response: ApiCombinedResponse): FdrCombinedResponse {
  return {
    attack: mapViewResponse(response.attack),
    defence: mapViewResponse(response.defence),
    scales: response.scales.map(mapScale),
  };
}
