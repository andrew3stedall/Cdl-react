import type { ApiErrorResponse, SessionState } from './contracts';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  session: SessionState;
}

export interface LogoutResponse {
  session: SessionState;
}

export interface SessionClient {
  getSession(): Promise<SessionState>;
  logout(): Promise<LogoutResponse>;
}

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorResponse };

interface ApiSessionUser {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
}

interface ApiSessionState {
  is_authenticated: boolean;
  user: ApiSessionUser | null;
  expires_at: string | null;
}

interface ApiLoginResponse {
  session: ApiSessionState;
}

interface ApiLogoutResponse {
  session: ApiSessionState;
}

const unauthenticatedSession: SessionState = {
  isAuthenticated: false,
  user: null,
  expiresAt: null,
};

export function getUnauthenticatedSession(): SessionState {
  return unauthenticatedSession;
}

export function canAccessProtectedRoute(session: SessionState): boolean {
  if (!session.isAuthenticated || session.user === null) return false;
  if (session.expiresAt === null) return true;
  return new Date(session.expiresAt).getTime() > Date.now();
}

export function getProtectedRouteRedirect(session: SessionState, loginPath = '/login'): string | null {
  return canAccessProtectedRoute(session) ? null : loginPath;
}

export async function login(request: LoginRequest): Promise<AuthResult<LoginResponse>> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    credentials: 'include',
  });

  const payload = await response.json();
  if (!response.ok) {
    return { ok: false, error: payload as ApiErrorResponse };
  }

  const loginResponse = payload as ApiLoginResponse;
  return { ok: true, data: { session: mapSession(loginResponse.session) } };
}

export async function getSession(): Promise<SessionState> {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
  });

  if (!response.ok) {
    return getUnauthenticatedSession();
  }

  return mapSession((await response.json()) as ApiSessionState);
}

export async function logout(): Promise<LogoutResponse> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  const payload = (await response.json()) as ApiLogoutResponse;
  return { session: mapSession(payload.session) };
}

export const defaultSessionClient: SessionClient = {
  getSession,
  logout,
};

function mapSession(session: ApiSessionState): SessionState {
  return {
    isAuthenticated: session.is_authenticated,
    user: session.user
      ? {
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.display_name,
          roles: session.user.roles,
        }
      : null,
    expiresAt: session.expires_at,
  };
}
