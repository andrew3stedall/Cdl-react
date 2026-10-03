export interface PrivateScoutingRecord {
  player_id: string;
  watchlisted: boolean;
  note: string;
  updated_at: string | null;
}

export interface CdlOwnershipPeriod {
  id: string;
  season_id: string;
  season_name: string;
  team_id: string;
  team_name: string;
  started_at: string;
  ended_at: string | null;
}

export interface PlayerProfileDataClient {
  getScoutingRecord(playerId: string): Promise<PrivateScoutingRecord>;
  saveScoutingRecord(playerId: string, values: Pick<PrivateScoutingRecord, 'watchlisted' | 'note'>): Promise<PrivateScoutingRecord>;
  getWatchlist(): Promise<PrivateScoutingRecord[]>;
  getOwnershipHistory(playerId: string): Promise<{ player_id: string; periods: CdlOwnershipPeriod[] }>;
}

export class HttpPlayerProfileDataClient implements PlayerProfileDataClient {
  constructor(private readonly baseUrl = '/api') {}

  getScoutingRecord(playerId: string): Promise<PrivateScoutingRecord> {
    return this.request<PrivateScoutingRecord>(`/me/scouting/${encodeURIComponent(playerId)}`);
  }

  saveScoutingRecord(playerId: string, values: Pick<PrivateScoutingRecord, 'watchlisted' | 'note'>): Promise<PrivateScoutingRecord> {
    return this.request<PrivateScoutingRecord>(`/me/scouting/${encodeURIComponent(playerId)}`, {
      method: 'PUT',
      body: JSON.stringify(values),
    });
  }

  getWatchlist(): Promise<PrivateScoutingRecord[]> {
    return this.request<PrivateScoutingRecord[]>('/me/watchlist');
  }

  getOwnershipHistory(playerId: string): Promise<{ player_id: string; periods: CdlOwnershipPeriod[] }> {
    return this.request<{ player_id: string; periods: CdlOwnershipPeriod[] }>(`/players/${encodeURIComponent(playerId)}/cdl-history`);
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
      throw new Error(error instanceof Error ? error.message : 'Network request failed.', { cause: error });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Player scouting request failed with ${response.status}.`;
      throw new Error(message);
    }
    return payload as T;
  }
}
