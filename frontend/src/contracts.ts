export interface ApiErrorResponse {
  code: 'validation_error' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'server_error';
  message: string;
  details: Record<string, unknown>;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

export interface SessionState {
  isAuthenticated: boolean;
  user: SessionUser | null;
  expiresAt: string | null;
}

export interface ThemePreset {
  name: string;
  label: string;
  isDefault: boolean;
  tokens: Record<string, unknown>;
}

export interface TeamSummary {
  id: string;
  name: string;
  shortName?: string;
}

export interface GameweekSummary {
  id: string;
  name: string;
  number: number;
}

export interface FixtureSummary {
  id: string;
  gameweek: GameweekSummary;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  status: string;
}
