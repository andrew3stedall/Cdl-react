import type { ThemePreset, UserPreferences } from './contracts';

interface ApiUserPreferences {
  theme_preset: ThemePreset['name'];
}

export interface PreferenceClient {
  getPreferences(): Promise<UserPreferences>;
  updatePreferences(preferences: UserPreferences): Promise<UserPreferences>;
}

function fromApiPreferences(preferences: ApiUserPreferences): UserPreferences {
  return {
    themePreset: preferences.theme_preset,
  };
}

function toApiPreferences(preferences: UserPreferences): ApiUserPreferences {
  return {
    theme_preset: preferences.themePreset,
  };
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

  async getPreferences(): Promise<UserPreferences> {
    const storedPreset = localStorage.getItem(this.storageKey);

    return {
      themePreset: storedPreset === 'dark' || storedPreset === 'compact' ? storedPreset : 'classic',
    };
  }

  async updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
    localStorage.setItem(this.storageKey, preferences.themePreset);

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
