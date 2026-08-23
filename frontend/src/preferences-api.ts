import type { AttackDirection, UserPreferences } from './contracts';
import {
  defaultFdrCustomAnchors,
  defaultFdrDisplayMode,
  defaultFdrScaleReversed,
  resolveFdrCustomAnchors,
  resolveFdrScaleName,
  type FdrDisplayMode,
} from './fdr-colour-scales';
import { resolveThemePreset } from './theme-presets';
import { getStoredThemePreset, setThemePresetCookie } from './theme-cookie';
import {
  defaultThemeColour,
  getThemeColourForMode,
  resolveThemeBaseColour,
  resolveThemeColour,
} from './theme-colours';

interface ApiUserPreferences {
  theme_preset: string;
  attack_direction?: string;
  fdr_scale?: string;
  fdr_scale_reversed?: boolean;
  fdr_display_mode?: string;
  light_theme_colour?: string;
  dark_theme_colour?: string;
  fdr_custom_min?: string;
  fdr_custom_mid?: string;
  fdr_custom_max?: string;
}

export interface PreferenceClient {
  getPreferences(): Promise<UserPreferences>;
  updatePreferences(preferences: UserPreferences): Promise<UserPreferences>;
}

function fromApiPreferences(preferences: ApiUserPreferences): UserPreferences {
  return {
    themePreset: resolveThemePreset(preferences.theme_preset).name,
    attackDirection: resolveAttackDirection(preferences.attack_direction),
    fdrScale: resolveFdrScaleName(preferences.fdr_scale),
    fdrScaleReversed: preferences.fdr_scale_reversed ?? defaultFdrScaleReversed,
    fdrDisplayMode: resolveFdrDisplayMode(preferences.fdr_display_mode),
    lightThemeColour: resolveThemeBaseColour(preferences.light_theme_colour ?? preferences.dark_theme_colour),
    darkThemeColour: resolveThemeColour(preferences.light_theme_colour ?? preferences.dark_theme_colour, 'dark'),
    fdrCustomAnchors: resolveFdrCustomAnchors({
      min: preferences.fdr_custom_min,
      mid: preferences.fdr_custom_mid,
      max: preferences.fdr_custom_max,
    }),
  };
}

function toApiPreferences(preferences: UserPreferences): ApiUserPreferences {
  return {
    theme_preset: preferences.themePreset,
    attack_direction: preferences.attackDirection,
    fdr_scale: preferences.fdrScale,
    fdr_scale_reversed: preferences.fdrScaleReversed,
    fdr_display_mode: preferences.fdrDisplayMode ?? defaultFdrDisplayMode,
    light_theme_colour: resolveThemeBaseColour(preferences.lightThemeColour ?? defaultThemeColour),
    dark_theme_colour: getThemeColourForMode(preferences.lightThemeColour ?? defaultThemeColour, 'dark'),
    fdr_custom_min: preferences.fdrCustomAnchors?.min ?? defaultFdrCustomAnchors.min,
    fdr_custom_mid: preferences.fdrCustomAnchors?.mid ?? defaultFdrCustomAnchors.mid,
    fdr_custom_max: preferences.fdrCustomAnchors?.max ?? defaultFdrCustomAnchors.max,
  };
}

function resolveFdrDisplayMode(value: string | undefined): FdrDisplayMode {
  return value === 'fill' ? 'fill' : defaultFdrDisplayMode;
}

function resolveAttackDirection(value: string | undefined): AttackDirection {
  return value === 'down' ? 'down' : 'up';
}

export class HttpPreferenceClient implements PreferenceClient {
  constructor(private readonly baseUrl = '/api') {}

  async getPreferences(): Promise<UserPreferences> {
    const response = await fetch(`${this.baseUrl}/me/preferences`, {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Unable to load user preferences.');
    }

    return fromApiPreferences((await response.json()) as ApiUserPreferences);
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    const response = await fetch(`${this.baseUrl}/me/preferences`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(toApiPreferences(preferences)),
    });

    if (!response.ok) {
      throw new Error('Unable to save user preferences.');
    }

    return fromApiPreferences((await response.json()) as ApiUserPreferences);
  }
}

export class LocalStoragePreferenceClient implements PreferenceClient {
  private readonly storageKey = 'cdl-theme-preset';
  private readonly attackDirectionStorageKey = 'cdl-attack-direction';
  private readonly fdrScaleStorageKey = 'cdl-fdr-scale';
  private readonly fdrScaleReversedStorageKey = 'cdl-fdr-scale-reversed';
  private readonly fdrDisplayModeStorageKey = 'cdl-fdr-display-mode';
  private readonly lightThemeColourStorageKey = 'cdl-light-theme-colour';
  private readonly darkThemeColourStorageKey = 'cdl-dark-theme-colour';
  private readonly fdrCustomMinStorageKey = 'cdl-fdr-custom-min';
  private readonly fdrCustomMidStorageKey = 'cdl-fdr-custom-mid';
  private readonly fdrCustomMaxStorageKey = 'cdl-fdr-custom-max';

  async getPreferences(): Promise<UserPreferences> {
    const storedPreset = getStoredThemePreset();

    return {
      themePreset: resolveThemePreset(storedPreset).name,
      attackDirection: resolveAttackDirection(localStorage.getItem(this.attackDirectionStorageKey) ?? undefined),
      fdrScale: resolveFdrScaleName(localStorage.getItem(this.fdrScaleStorageKey)),
      fdrScaleReversed: localStorage.getItem(this.fdrScaleReversedStorageKey)
        ? localStorage.getItem(this.fdrScaleReversedStorageKey) === 'true'
        : defaultFdrScaleReversed,
      fdrDisplayMode: resolveFdrDisplayMode(localStorage.getItem(this.fdrDisplayModeStorageKey) ?? undefined),
      lightThemeColour: resolveThemeBaseColour(localStorage.getItem(this.lightThemeColourStorageKey) ?? defaultThemeColour),
      darkThemeColour: resolveThemeColour(localStorage.getItem(this.lightThemeColourStorageKey) ?? defaultThemeColour, 'dark'),
      fdrCustomAnchors: resolveFdrCustomAnchors({
        min: localStorage.getItem(this.fdrCustomMinStorageKey) ?? undefined,
        mid: localStorage.getItem(this.fdrCustomMidStorageKey) ?? undefined,
        max: localStorage.getItem(this.fdrCustomMaxStorageKey) ?? undefined,
      }),
    };
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    setThemePresetCookie(preferences.themePreset);
    localStorage.setItem(this.storageKey, preferences.themePreset);
    localStorage.setItem(this.attackDirectionStorageKey, preferences.attackDirection);
    localStorage.setItem(this.fdrScaleStorageKey, preferences.fdrScale);
    localStorage.setItem(this.fdrScaleReversedStorageKey, String(preferences.fdrScaleReversed));
    localStorage.setItem(this.fdrDisplayModeStorageKey, preferences.fdrDisplayMode ?? defaultFdrDisplayMode);
    const themeColour = resolveThemeBaseColour(preferences.lightThemeColour ?? defaultThemeColour);
    localStorage.setItem(this.lightThemeColourStorageKey, themeColour);
    localStorage.setItem(this.darkThemeColourStorageKey, getThemeColourForMode(themeColour, 'dark'));
    localStorage.setItem(this.fdrCustomMinStorageKey, preferences.fdrCustomAnchors?.min ?? defaultFdrCustomAnchors.min);
    localStorage.setItem(this.fdrCustomMidStorageKey, preferences.fdrCustomAnchors?.mid ?? defaultFdrCustomAnchors.mid);
    localStorage.setItem(this.fdrCustomMaxStorageKey, preferences.fdrCustomAnchors?.max ?? defaultFdrCustomAnchors.max);

    return preferences;
  }
}

export class FallbackPreferenceClient implements PreferenceClient {
  constructor(
    private readonly primary: PreferenceClient = new HttpPreferenceClient(),
    private readonly fallback: PreferenceClient = new LocalStoragePreferenceClient(),
  ) {}

  async getPreferences(): Promise<UserPreferences> {
    try {
      return await this.primary.getPreferences();
    } catch {
      return this.fallback.getPreferences();
    }
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    try {
      return await this.primary.updatePreferences(preferences);
    } catch {
      return this.fallback.updatePreferences(preferences);
    }
  }
}
