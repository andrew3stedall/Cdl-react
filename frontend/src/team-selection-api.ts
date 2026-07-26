import type { ApiErrorResponse, GameweekSummary, TeamSummary } from './contracts';

export type TeamSelectionSlot = 'starter' | 'bench' | 'reserve';
export type TeamSelectionChipStatus = 'available' | 'active' | 'used';

export interface TeamSelectionPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  slot: TeamSelectionSlot;
  slotOrder: number;
  captain: boolean;
  viceCaptain: boolean;
}

export interface TeamSelectionChip {
  id: string;
  name: string;
  status: TeamSelectionChipStatus;
}

export interface FixtureLockState {
  locked: boolean;
  fixtureId: string | null;
  fixtureType: string | null;
  lockScope: string | null;
  lockedAt: string | null;
  reason: string | null;
}

export interface TeamSelectionSnapshot {
  managerTeam: TeamSummary;
  gameweek: GameweekSummary;
  players: TeamSelectionPlayer[];
  chips: TeamSelectionChip[];
  fixtureLock: FixtureLockState;
}

export interface TeamSelectionClient {
  getTeamSelection(): Promise<TeamSelectionSnapshot>;
  saveLineup(players: TeamSelectionPlayer[]): Promise<TeamSelectionSnapshot>;
  updateChip(chipId: string, active: boolean): Promise<TeamSelectionSnapshot>;
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

interface ApiPlayer {
  id: string;
  display_name: string;
  position: string;
  epl_team: ApiTeam;
  slot: TeamSelectionSlot;
  slot_order: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

interface ApiChip {
  id: string;
  name: string;
  status: TeamSelectionChipStatus;
}

interface ApiFixtureLock {
  locked: boolean;
  fixture_id: string | null;
  fixture_type: string | null;
  lock_scope: string | null;
  locked_at: string | null;
  reason: string | null;
}

interface ApiTeamSelectionResponse {
  manager_team: ApiTeam;
  gameweek: ApiGameweek;
  lineup: ApiPlayer[];
  chips: ApiChip[];
  fixture_lock: ApiFixtureLock;
}

export class TeamSelectionApiError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorResponse['code'],
    readonly details: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class HttpTeamSelectionClient implements TeamSelectionClient {
  constructor(private readonly baseUrl = '/api') {}

  async getTeamSelection(): Promise<TeamSelectionSnapshot> {
    return mapResponse(await this.request<ApiTeamSelectionResponse>('/team-selection'));
  }

  async saveLineup(players: TeamSelectionPlayer[]): Promise<TeamSelectionSnapshot> {
    return mapResponse(
      await this.request<ApiTeamSelectionResponse>('/team-selection/lineup', {
        method: 'PUT',
        body: JSON.stringify({
          players: players.map((player) => ({
            player_id: player.id,
            slot: player.slot,
            slot_order: player.slotOrder,
            is_captain: player.captain,
            is_vice_captain: player.viceCaptain,
          })),
        }),
      }),
    );
  }

  async updateChip(chipId: string, active: boolean): Promise<TeamSelectionSnapshot> {
    return mapResponse(
      await this.request<ApiTeamSelectionResponse>(`/team-selection/chips/${chipId}`, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      }),
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
      credentials: 'include',
    });
    const payload = await response.json();

    if (!response.ok) {
      const error = payload as ApiErrorResponse;
      throw new TeamSelectionApiError(error.message, error.code, error.details ?? {});
    }

    return payload as T;
  }
}

function mapTeam(team: ApiTeam): TeamSummary {
  return { id: team.id, name: team.name, shortName: team.short_name ?? undefined };
}

function mapResponse(response: ApiTeamSelectionResponse): TeamSelectionSnapshot {
  return {
    managerTeam: mapTeam(response.manager_team),
    gameweek: response.gameweek,
    players: response.lineup.map((player) => ({
      id: player.id,
      name: player.display_name,
      position: player.position,
      team: player.epl_team.short_name ?? player.epl_team.name,
      slot: player.slot,
      slotOrder: player.slot_order,
      captain: player.is_captain,
      viceCaptain: player.is_vice_captain,
    })),
    chips: response.chips,
    fixtureLock: {
      locked: response.fixture_lock.locked,
      fixtureId: response.fixture_lock.fixture_id,
      fixtureType: response.fixture_lock.fixture_type,
      lockScope: response.fixture_lock.lock_scope,
      lockedAt: response.fixture_lock.locked_at,
      reason: response.fixture_lock.reason,
    },
  };
}
