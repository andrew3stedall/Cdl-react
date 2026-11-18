import { fetchWithQuery as fetch } from './query-cache';
export interface AIConnection {
  id: string;
  client_id: string;
  client_name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
}

export interface AIExecutionGrant {
  id: string;
  connection_id: string;
  activated_at: string;
  expires_at: string;
}

export interface AIGrantStatus {
  active: boolean;
  grant: AIExecutionGrant | null;
}

export interface AIActivityEvent {
  id: string;
  connection_id: string;
  tool_name: string;
  risk: string;
  outcome: string;
  details: unknown;
  created_at: string;
}

export type AIConnectionState = 'authorized' | 'verified' | 'check_failed' | 'expired' | 'revoked';
export type AIConnectionFailureCategory = 'permission' | 'request' | 'service' | 'other';

export interface AIConnectionStatus extends AIConnection {
  revoked_at: string | null;
  access_expires_at: string | null;
  state: AIConnectionState;
  first_verified_read_at: string | null;
  last_verified_read_at: string | null;
  last_failure: { category: AIConnectionFailureCategory; observed_at: string } | null;
}

export interface AIConnectionDiagnostics {
  checked_at: string;
  endpoint: {
    url: string;
    oauth_enabled: boolean;
    remote_enabled: boolean;
    browser_enabled: boolean;
    execution_enabled: boolean;
  };
  team_assigned: boolean | null;
  connections: AIConnectionStatus[];
}

export interface AIConnectionsClient {
  listConnections(): Promise<AIConnection[]>;
  getDiagnostics(): Promise<AIConnectionDiagnostics>;
  checkConnection(connectionId: string): Promise<AIConnectionStatus>;
  revokeConnection(connectionId: string): Promise<void>;
  getGrant(connectionId: string): Promise<AIGrantStatus>;
  activateGrant(connectionId: string): Promise<AIExecutionGrant>;
  revokeGrant(connectionId: string): Promise<void>;
  listActivity(): Promise<AIActivityEvent[]>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestPath = path.startsWith('/oauth/') ? path : `/api${path}`;
  const response = await fetch(requestPath, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const httpAIConnectionsClient: AIConnectionsClient = {
  listConnections: () => request<AIConnection[]>('/oauth/connections'),
  // Verification state must reflect the latest server audit evidence; never serve it from the cache.
  getDiagnostics: () => request<AIConnectionDiagnostics>('/ai/connections', { cache: 'no-store' }),
  checkConnection: (id) => request<AIConnectionStatus>(`/ai/connections/${encodeURIComponent(id)}/check`, { method: 'POST' }),
  revokeConnection: (id) => request<void>(`/oauth/connections/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getGrant: (id) => request<AIGrantStatus>(`/ai/execution-grants/${encodeURIComponent(id)}`),
  activateGrant: (id) => request<AIExecutionGrant>('/ai/execution-grants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection_id: id }),
  }),
  revokeGrant: (id) => request<void>(`/ai/execution-grants/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listActivity: () => request<AIActivityEvent[]>('/ai/activity?limit=50'),
};
