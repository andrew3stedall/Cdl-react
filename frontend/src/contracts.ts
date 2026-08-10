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

export interface ThemePresetTokens {
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    surface: string;
    surfaceForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accentForeground: string;
    border: string;
    input: string;
    ring: string;
    destructive: string;
    destructiveForeground: string;
    accent: string;
  };
  density: 'comfortable' | 'compact';
  radius: string;
  typographyScale: 'standard' | 'condensed';
  chartPaletteHooks: string[];
}

export type ThemePresetName =
  | 'teal-light'
  | 'teal-dark'
  | 'teal-light-compact'
  | 'teal-dark-compact';

export interface ThemePreset {
  name: ThemePresetName;
  label: string;
  description: string;
  isDefault: boolean;
  tokens: ThemePresetTokens;
}

export type AttackDirection = 'up' | 'down';

export interface UserPreferences {
  // Kept as a single persisted value so existing staging databases and the
  // current preferences API remain compatible while still exposing complete
  // appearance choices to users.
  themePreset: ThemePresetName;
  attackDirection: AttackDirection;
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
  deadlineAt?: string | null;
}

export interface FixtureSummary {
  id: string;
  gameweek: GameweekSummary;
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  status: string;
}

export type RuleCategory =
  | 'draft'
  | 'squads'
  | 'transfers'
  | 'trades'
  | 'matchday'
  | 'chips'
  | 'league'
  | 'playoffs'
  | 'commissioner';

export interface RuleVersion {
  version: string;
  effectiveDate: string;
  status: string;
  source: string;
}

export interface RuleSection {
  id: string;
  title: string;
  category: RuleCategory;
  summary: string;
  body: string[];
  tags: string[];
  anchors: string[];
  relatedRuleIds: string[];
  version: RuleVersion;
}

export interface RulesIndexResponse {
  version: RuleVersion;
  categories: RuleCategory[];
  sections: RuleSection[];
}
