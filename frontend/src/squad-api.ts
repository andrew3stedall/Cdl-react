import type { ApiErrorResponse } from './contracts';

export interface SquadApiTeam {
  id: string;
  name: string;
  short_name?: string | null;
}

export interface SquadApiNextFixture {
  fixture_id: string;
  gameweek?: { id: string; name: string; number: number; deadline_at?: string | null } | null;
  opponent: SquadApiTeam;
  difficulty?: number | null;
  is_home: boolean;
  kickoff_at?: string | null;
}

export interface SquadApiPlayer {
  id: string;
  display_name: string;
  position: string;
  epl_team: SquadApiTeam;
  draft_team?: SquadApiTeam | null;
  status: 'owned' | 'available' | 'interested' | 'trade_target';
  points: number;
  form?: number | null;
  value: number;
  selected_by_percent?: number | null;
  expected_goals?: number | null;
  expected_assists?: number | null;
  availability_status?: string | null;
  availability_news?: string | null;
  chance_of_playing_next_round?: number | null;
  next_fixture?: SquadApiNextFixture | null;
  next_fixtures?: SquadApiNextFixture[] | null;
}

export interface SquadApiSummary {
  manager_team: SquadApiTeam;
  gameweek: { id: string; name: string; number: number; deadline_at?: string | null };
  players: SquadApiPlayer[];
}

export interface SquadApiScoutingResponse {
  players: SquadApiPlayer[];
}

export interface SquadApiTrade {
  id: string;
  status: string;
}

export interface SquadApiHistoryRow {
  gameweek: number;
  fixture_id: number;
  opponent_team_id: number;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
  own_goals?: number;
  bonus: number;
  bps: number;
  expected_goals: number;
  expected_assists: number;
  value: number;
  was_home: boolean;
  kickoff_time?: string | null;
  opponent_name?: string | null;
  opponent_short_name?: string | null;
  difficulty?: number | null;
  defensive_contributions?: number;
}

export interface SquadApiUpcomingFixture {
  fixture_id: number;
  gameweek?: number | null;
  opponent_team_id: number;
  difficulty: number;
  is_home: boolean;
  kickoff_time?: string | null;
  opponent_name?: string | null;
  opponent_short_name?: string | null;
  opponent_difficulty?: number | null;
}

export interface SquadApiOpponentDefensiveHistory {
  fixture_id: number;
  gameweek?: number | null;
  opponent_name?: string | null;
  opponent_short_name?: string | null;
  is_home: boolean;
  difficulty?: number | null;
  total_points_conceded?: number | null;
  attacking_asset_points?: number | null;
  defensive_asset_points?: number | null;
  stat_icons?: SquadApiOpponentStatIcons;
  stat_details?: SquadApiOpponentStatDetail[];
}

export interface SquadApiOpponentStatDetail {
  category: string;
  player_name: string;
  player_position?: string | null;
  value?: number | null;
  points: number;
}

export interface SquadApiOpponentStatIcons {
  goals: number;
  assists: number;
  clean_sheets: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
  own_goals?: number;
  defensive_contributions: number;
  bonus_points: number;
}

export interface SquadApiOpponentDefensiveHistoryGroup {
  opponent_team_id: number;
  opponent_name?: string | null;
  opponent_short_name?: string | null;
  fixtures: SquadApiOpponentDefensiveHistory[];
}

export interface SquadApiHistoryResponse {
  player_id: string;
  fetched_at: string;
  response_sha256: string;
  history: SquadApiHistoryRow[];
  fixtures: SquadApiUpcomingFixture[];
  opponent_defensive_history?: SquadApiOpponentDefensiveHistory[];
  opponent_defensive_histories?: SquadApiOpponentDefensiveHistoryGroup[];
}

export interface SquadApiNotification {
  id: string;
  title: string;
  message: string;
  action_href: string;
  kind: string;
}

export interface SquadApiNotificationsResponse {
  notifications: SquadApiNotification[];
  proposed_trade_count: number;
}

export interface SquadApiWorkspaceResponse {
  summary: SquadApiSummary;
  notifications: SquadApiNotificationsResponse;
}

export interface SquadWorkspace {
  summary: SquadApiSummary;
  notifications: SquadApiNotificationsResponse;
}

export interface SquadApiChangesResponse {
  available_to_add: SquadApiPlayer[];
}

export interface SquadClient {
  getWorkspace(): Promise<SquadWorkspace>;
  getSummary(): Promise<SquadApiSummary>;
  getScoutingPlayers(): Promise<SquadApiScoutingResponse>;
  getTrades(): Promise<{ trades: SquadApiTrade[] }>;
  getChanges(): Promise<SquadApiChangesResponse>;
  getNotifications(): Promise<SquadApiNotificationsResponse>;
  getPlayer(playerId: string): Promise<SquadApiPlayer>;
  getPlayerHistory(playerId: string): Promise<SquadApiHistoryResponse>;
  createTrade(
    offeredToTeamId: string,
    offeredPlayerIds: string[],
    requestedPlayerIds: string[],
  ): Promise<SquadApiTrade>;
  applyChanges(addPlayerIds: string[], removePlayerIds: string[]): Promise<SquadApiSummary>;
}

export type PlayerProfileSquadClient = Pick<SquadClient, 'getPlayerHistory'> &
  Partial<Pick<SquadClient, 'getPlayer' | 'getChanges' | 'applyChanges'>>;

export class SquadApiError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorResponse['code'] | 'request_failed',
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export class HttpSquadClient implements SquadClient {
  constructor(private readonly baseUrl = '/api') {}

  async getWorkspace(): Promise<SquadWorkspace> {
    const response = await this.request<SquadApiWorkspaceResponse>('/squad/workspace');
    return {
      summary: response.summary,
      notifications: response.notifications,
    };
  }

  getSummary(): Promise<SquadApiSummary> {
    return this.request<SquadApiSummary>('/squad/summary');
  }

  getScoutingPlayers(): Promise<SquadApiScoutingResponse> {
    return this.request<SquadApiScoutingResponse>('/scouting/players');
  }

  getTrades(): Promise<{ trades: SquadApiTrade[] }> {
    return this.request<{ trades: SquadApiTrade[] }>('/trades');
  }

  getChanges(): Promise<SquadApiChangesResponse> {
    return this.request<SquadApiChangesResponse>('/squad/changes');
  }

  getNotifications(): Promise<SquadApiNotificationsResponse> {
    return this.request<SquadApiNotificationsResponse>('/squad/notifications');
  }

  getPlayer(playerId: string): Promise<SquadApiPlayer> {
    return this.request<SquadApiPlayer>(`/scouting/players/${encodeURIComponent(playerId)}`);
  }

  getPlayerHistory(playerId: string): Promise<SquadApiHistoryResponse> {
    return this.request<unknown>(`/fpl/players/${encodeURIComponent(playerId)}/history`).then((payload) => {
      if (!payload || typeof payload !== 'object' || !Array.isArray((payload as SquadApiHistoryResponse).history) || !Array.isArray((payload as SquadApiHistoryResponse).fixtures)) {
        throw new SquadApiError('FPL history response is incomplete.', 'request_failed');
      }
      return payload as SquadApiHistoryResponse;
    });
  }

  createTrade(
    offeredToTeamId: string,
    offeredPlayerIds: string[],
    requestedPlayerIds: string[],
  ): Promise<SquadApiTrade> {
    return this.request<SquadApiTrade>('/trades', {
      method: 'POST',
      body: JSON.stringify({
        offered_to_team_id: offeredToTeamId,
        offered_player_ids: offeredPlayerIds,
        requested_player_ids: requestedPlayerIds,
      }),
    });
  }

  applyChanges(addPlayerIds: string[], removePlayerIds: string[]): Promise<SquadApiSummary> {
    return this.request<SquadApiSummary>('/squad/changes', {
      method: 'POST',
      body: JSON.stringify({
        add_player_ids: addPlayerIds,
        remove_player_ids: removePlayerIds,
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
      });
    } catch (error) {
      throw new SquadApiError(error instanceof Error ? error.message : 'Network request failed.', 'request_failed');
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload as Partial<ApiErrorResponse>;
      throw new SquadApiError(
        error.message ?? `Squad API request failed with ${response.status}.`,
        error.code ?? 'request_failed',
        error.details ?? {},
      );
    }
    return payload as T;
  }
}
