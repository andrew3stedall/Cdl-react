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

export interface GoogleAuthConfig {
  enabled: boolean;
  clientId: string | null;
}

export interface SessionClient {
  getSession(): Promise<SessionState>;
  getGoogleAuthConfig(): Promise<GoogleAuthConfig>;
  login(request: LoginRequest): Promise<AuthResult<LoginResponse>>;
  loginWithGoogleCredential(credential: string): Promise<AuthResult<LoginResponse>>;
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

interface ApiGoogleAuthConfig {
  enabled: boolean;
  client_id: string | null;
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

  if (!response.ok) {
    return {
      ok: false,
      error: await readApiError(response, 'Sign in is temporarily unavailable. Try again.'),
    };
  }

  const loginResponse = (await response.json()) as ApiLoginResponse;
  return { ok: true, data: { session: mapSession(loginResponse.session) } };
}

export async function getSession(): Promise<SessionState> {
  const response = await fetch('/api/auth/session', {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await readApiError(
      response,
      'Session verification is temporarily unavailable. Retry.',
    );
    throw new Error(error.message);
  }

  return mapSession((await response.json()) as ApiSessionState);
}

export async function getGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  const response = await fetch('/api/auth/google/config', {
    credentials: 'include',
  });
  if (!response.ok) return { enabled: false, clientId: null };

  const config = (await response.json()) as ApiGoogleAuthConfig;
  return { enabled: config.enabled, clientId: config.client_id };
}

export async function loginWithGoogleCredential(
  credential: string,
): Promise<AuthResult<LoginResponse>> {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CDL-Google-Sign-In': '1',
    },
    body: JSON.stringify({ credential }),
    credentials: 'include',
  });

  if (!response.ok) {
    return {
      ok: false,
      error: await readApiError(
        response,
        'Google sign-in is temporarily unavailable. Try again.',
      ),
    };
  }

  const loginResponse = (await response.json()) as ApiLoginResponse;
  return { ok: true, data: { session: mapSession(loginResponse.session) } };
}

export async function logout(): Promise<LogoutResponse> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await readApiError(response, 'Sign out is temporarily unavailable. Try again.');
    throw new Error(error.message);
  }
  const payload = (await response.json()) as ApiLogoutResponse;
  return { session: mapSession(payload.session) };
}

export const defaultSessionClient: SessionClient = {
  getGoogleAuthConfig,
  getSession,
  login,
  loginWithGoogleCredential,
  logout,
};

async function readApiError(response: Response, fallbackMessage: string): Promise<ApiErrorResponse> {
  try {
    const payload = (await response.json()) as Partial<ApiErrorResponse>;
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return {
        code: payload.code ?? 'server_error',
        message: payload.message,
        details: payload.details ?? {},
      };
    }
  } catch {
    // Some infrastructure failures return HTML/plain-text instead of the API error contract.
  }
  return {
    code: 'server_error',
    message: fallbackMessage,
    details: {},
  };
}

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