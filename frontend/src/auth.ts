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

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiErrorResponse };

const unauthenticatedSession: SessionState = {
  isAuthenticated: false,
  user: null,
  expiresAt: null,
};

export function getUnauthenticatedSession(): SessionState {
  return unauthenticatedSession;
}

export function canAccessProtectedRoute(session: SessionState): boolean {
  return session.isAuthenticated && session.user !== null;
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

  return { ok: true, data: payload as LoginResponse };
}

export async function getSession(): Promise<SessionState> {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
  });

  if (!response.ok) {
    return getUnauthenticatedSession();
  }

  return (await response.json()) as SessionState;
}

export async function logout(): Promise<LogoutResponse> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  return (await response.json()) as LogoutResponse;
}
