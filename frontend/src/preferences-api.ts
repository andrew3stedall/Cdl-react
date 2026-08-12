import type { AttackDirection, UserPreferences } from './contracts';
import {
  defaultFdrScaleReversed,
  resolveFdrScaleName,
} from './fdr-colour-scales';
import { resolveThemePreset } from './theme-presets';

interface ApiUserPreferences {
  theme_preset: string;
  attack_direction?: string;
  fdr_scale?: string;
  fdr_scale_reversed?: boolean;
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
  };
}

function toApiPreferences(preferences: UserPreferences): ApiUserPreferences {
  return {
    theme_preset: preferences.themePreset,
    attack_direction: preferences.attackDirection,
    fdr_scale: preferences.fdrScale,
    fdr_scale_reversed: preferences.fdrScaleReversed,
  };
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

  async getPreferences(): Promise<UserPreferences> {
    const storedPreset = localStorage.getItem(this.storageKey);

    return {
      themePreset: resolveThemePreset(storedPreset).name,
      attackDirection: resolveAttackDirection(localStorage.getItem(this.attackDirectionStorageKey) ?? undefined),
      fdrScale: resolveFdrScaleName(localStorage.getItem(this.fdrScaleStorageKey)),
      fdrScaleReversed: localStorage.getItem(this.fdrScaleReversedStorageKey)
        ? localStorage.getItem(this.fdrScaleReversedStorageKey) === 'true'
        : defaultFdrScaleReversed,
    };
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    localStorage.setItem(this.storageKey, preferences.themePreset);
    localStorage.setItem(this.attackDirectionStorageKey, preferences.attackDirection);
    localStorage.setItem(this.fdrScaleStorageKey, preferences.fdrScale);
    localStorage.setItem(this.fdrScaleReversedStorageKey, String(preferences.fdrScaleReversed));

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
