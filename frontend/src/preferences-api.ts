import type { AttackDirection, UserPreferences } from './contracts';
import {
  defaultFdrCustomAnchors,
  defaultFdrDisplayMode,
  defaultFdrScaleReversed,
  resolveFdrCustomAnchors,
  resolveFdrScaleName,
  type FdrCustomPalette,
  type FdrCustomPaletteMode,
  type FdrDisplayMode,
} from './fdr-colour-scales';
import {
  defaultMetricColourScale,
  defaultMetricColourScaleReversed,
  defaultMetricCustomColours,
  defaultPositionColourMode,
  defaultPositionCustomColours,
  defaultPositionColourScale,
  resolveMetricPalette,
  resolvePositionColourMode,
  resolvePositionPalette,
  resolveMetricColourScale,
  resolvePositionColourScale,
  type MetricPalette,
  type PlayerColourPalette,
  type PlayerPosition,
} from './player-colour-scales';
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
  position_colour_scale?: string;
  position_colour_mode?: string;
  position_custom_gkp?: string;
  position_custom_def?: string;
  position_custom_mid?: string;
  position_custom_fwd?: string;
  metric_colour_scale?: string;
  metric_colour_scale_reversed?: boolean;
  metric_custom_1?: string;
  metric_custom_2?: string;
  metric_custom_3?: string;
  metric_custom_4?: string;
  metric_custom_5?: string;
  light_theme_colour?: string;
  dark_theme_colour?: string;
  fdr_custom_min?: string;
  fdr_custom_second?: string;
  fdr_custom_mid?: string;
  fdr_custom_fourth?: string;
  fdr_custom_max?: string;
}

interface ApiFdrCustomPalette {
  id: string;
  name: string;
  mode: FdrCustomPaletteMode;
  fdr_custom_min: string;
  fdr_custom_second: string;
  fdr_custom_mid: string;
  fdr_custom_fourth: string;
  fdr_custom_max: string;
}

interface ApiPlayerColourPalette {
  id: string;
  name: string;
  family: 'position' | 'metric';
  colours: string[];
}

export interface FdrCustomPaletteDraft {
  name: string;
  mode: FdrCustomPaletteMode;
  anchors: FdrCustomPalette['anchors'];
}

export interface PreferenceClient {
  getPreferences(): Promise<UserPreferences>;
  updatePreferences(preferences: UserPreferences): Promise<UserPreferences>;
  getFdrCustomPalettes?: () => Promise<FdrCustomPalette[]>;
  createFdrCustomPalette?: (palette: FdrCustomPaletteDraft) => Promise<FdrCustomPalette>;
  deleteFdrCustomPalette?: (paletteId: string) => Promise<void>;
  getPlayerColourPalettes?: () => Promise<PlayerColourPalette[]>;
  createPlayerColourPalette?: (palette: Omit<PlayerColourPalette, 'id'>) => Promise<PlayerColourPalette>;
  deletePlayerColourPalette?: (paletteId: string) => Promise<void>;
}

function fromApiFdrCustomPalette(palette: ApiFdrCustomPalette): FdrCustomPalette {
  return {
    id: palette.id,
    name: palette.name,
    mode: palette.mode === 'all' ? 'all' : 'anchors',
    anchors: resolveFdrCustomAnchors({
      min: palette.fdr_custom_min,
      second: palette.fdr_custom_second,
      mid: palette.fdr_custom_mid,
      fourth: palette.fdr_custom_fourth,
      max: palette.fdr_custom_max,
    }),
  };
}

function toApiFdrCustomPalette(palette: FdrCustomPaletteDraft): Omit<ApiFdrCustomPalette, 'id'> & { name: string } {
  return {
    name: palette.name,
    mode: palette.mode,
    fdr_custom_min: palette.anchors.min,
    fdr_custom_second: palette.anchors.second,
    fdr_custom_mid: palette.anchors.mid,
    fdr_custom_fourth: palette.anchors.fourth,
    fdr_custom_max: palette.anchors.max,
  };
}

function fromApiPreferences(preferences: ApiUserPreferences): UserPreferences {
  return {
    themePreset: resolveThemePreset(preferences.theme_preset).name,
    attackDirection: resolveAttackDirection(preferences.attack_direction),
    fdrScale: resolveFdrScaleName(preferences.fdr_scale),
    fdrScaleReversed: preferences.fdr_scale_reversed ?? defaultFdrScaleReversed,
    fdrDisplayMode: resolveFdrDisplayMode(preferences.fdr_display_mode),
    positionColourScale: resolvePositionColourScale(preferences.position_colour_scale),
    positionColourMode: resolvePositionColourMode(preferences.position_colour_mode),
    positionCustomColours: resolvePositionPalette({
      GKP: preferences.position_custom_gkp,
      DEF: preferences.position_custom_def,
      MID: preferences.position_custom_mid,
      FWD: preferences.position_custom_fwd,
    }),
    metricColourScale: resolveMetricColourScale(preferences.metric_colour_scale),
    metricColourScaleReversed: preferences.metric_colour_scale_reversed ?? defaultMetricColourScaleReversed,
    metricCustomColours: resolveMetricPalette([
      preferences.metric_custom_1 ?? defaultMetricCustomColours[0],
      preferences.metric_custom_2 ?? defaultMetricCustomColours[1],
      preferences.metric_custom_3 ?? defaultMetricCustomColours[2],
      preferences.metric_custom_4 ?? defaultMetricCustomColours[3],
      preferences.metric_custom_5 ?? defaultMetricCustomColours[4],
    ]),
    lightThemeColour: resolveThemeBaseColour(preferences.light_theme_colour ?? preferences.dark_theme_colour),
    darkThemeColour: resolveThemeColour(preferences.light_theme_colour ?? preferences.dark_theme_colour, 'dark'),
    fdrCustomAnchors: resolveFdrCustomAnchors({
      min: preferences.fdr_custom_min,
      second: preferences.fdr_custom_second,
      mid: preferences.fdr_custom_mid,
      fourth: preferences.fdr_custom_fourth,
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
    position_colour_scale: preferences.positionColourScale ?? defaultPositionColourScale,
    position_colour_mode: preferences.positionColourMode ?? defaultPositionColourMode,
    position_custom_gkp: preferences.positionCustomColours?.GKP ?? defaultPositionCustomColours.GKP,
    position_custom_def: preferences.positionCustomColours?.DEF ?? defaultPositionCustomColours.DEF,
    position_custom_mid: preferences.positionCustomColours?.MID ?? defaultPositionCustomColours.MID,
    position_custom_fwd: preferences.positionCustomColours?.FWD ?? defaultPositionCustomColours.FWD,
    metric_colour_scale: preferences.metricColourScale ?? defaultMetricColourScale,
    metric_colour_scale_reversed: preferences.metricColourScaleReversed ?? defaultMetricColourScaleReversed,
    metric_custom_1: preferences.metricCustomColours?.[0] ?? defaultMetricCustomColours[0],
    metric_custom_2: preferences.metricCustomColours?.[1] ?? defaultMetricCustomColours[1],
    metric_custom_3: preferences.metricCustomColours?.[2] ?? defaultMetricCustomColours[2],
    metric_custom_4: preferences.metricCustomColours?.[3] ?? defaultMetricCustomColours[3],
    metric_custom_5: preferences.metricCustomColours?.[4] ?? defaultMetricCustomColours[4],
    light_theme_colour: resolveThemeBaseColour(preferences.lightThemeColour ?? defaultThemeColour),
    dark_theme_colour: getThemeColourForMode(preferences.lightThemeColour ?? defaultThemeColour, 'dark'),
    fdr_custom_min: preferences.fdrCustomAnchors?.min ?? defaultFdrCustomAnchors.min,
    fdr_custom_second: preferences.fdrCustomAnchors?.second ?? defaultFdrCustomAnchors.second,
    fdr_custom_mid: preferences.fdrCustomAnchors?.mid ?? defaultFdrCustomAnchors.mid,
    fdr_custom_fourth: preferences.fdrCustomAnchors?.fourth ?? defaultFdrCustomAnchors.fourth,
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

  async getFdrCustomPalettes(): Promise<FdrCustomPalette[]> {
    const response = await fetch(`${this.baseUrl}/me/preferences/fdr-palettes`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Unable to load saved FDR palettes.');
    return ((await response.json()) as ApiFdrCustomPalette[]).map(fromApiFdrCustomPalette);
  }

  async createFdrCustomPalette(palette: FdrCustomPaletteDraft): Promise<FdrCustomPalette> {
    const response = await fetch(`${this.baseUrl}/me/preferences/fdr-palettes`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(toApiFdrCustomPalette(palette)),
    });
    if (!response.ok) throw new Error('Unable to save the FDR palette.');
    return fromApiFdrCustomPalette((await response.json()) as ApiFdrCustomPalette);
  }

  async deleteFdrCustomPalette(paletteId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/me/preferences/fdr-palettes/${encodeURIComponent(paletteId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Unable to delete the FDR palette.');
  }

  async getPlayerColourPalettes(): Promise<PlayerColourPalette[]> {
    const response = await fetch(`${this.baseUrl}/me/preferences/player-palettes`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Unable to load saved player colour palettes.');
    return (await response.json()) as ApiPlayerColourPalette[];
  }

  async createPlayerColourPalette(palette: Omit<PlayerColourPalette, 'id'>): Promise<PlayerColourPalette> {
    const response = await fetch(`${this.baseUrl}/me/preferences/player-palettes`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(palette),
    });
    if (!response.ok) throw new Error('Unable to save the player colour palette.');
    return (await response.json()) as ApiPlayerColourPalette;
  }

  async deletePlayerColourPalette(paletteId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/me/preferences/player-palettes/${encodeURIComponent(paletteId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Unable to delete the player colour palette.');
  }
}

export class LocalStoragePreferenceClient implements PreferenceClient {
  private readonly storageKey = 'cdl-theme-preset';
  private readonly attackDirectionStorageKey = 'cdl-attack-direction';
  private readonly fdrScaleStorageKey = 'cdl-fdr-scale';
  private readonly fdrScaleReversedStorageKey = 'cdl-fdr-scale-reversed';
  private readonly fdrDisplayModeStorageKey = 'cdl-fdr-display-mode';
  private readonly positionColourScaleStorageKey = 'cdl-position-colour-scale';
  private readonly positionColourModeStorageKey = 'cdl-position-colour-mode';
  private readonly positionCustomColoursStorageKey = 'cdl-position-custom-colours';
  private readonly metricColourScaleStorageKey = 'cdl-metric-colour-scale';
  private readonly metricColourScaleReversedStorageKey = 'cdl-metric-colour-scale-reversed';
  private readonly metricCustomColoursStorageKey = 'cdl-metric-custom-colours';
  private readonly lightThemeColourStorageKey = 'cdl-light-theme-colour';
  private readonly darkThemeColourStorageKey = 'cdl-dark-theme-colour';
  private readonly fdrCustomMinStorageKey = 'cdl-fdr-custom-min';
  private readonly fdrCustomSecondStorageKey = 'cdl-fdr-custom-second';
  private readonly fdrCustomMidStorageKey = 'cdl-fdr-custom-mid';
  private readonly fdrCustomFourthStorageKey = 'cdl-fdr-custom-fourth';
  private readonly fdrCustomMaxStorageKey = 'cdl-fdr-custom-max';
  private readonly fdrCustomPalettesStorageKey = 'cdl-fdr-custom-palettes';
  private readonly playerColourPalettesStorageKey = 'cdl-player-colour-palettes';

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
      positionColourScale: resolvePositionColourScale(localStorage.getItem(this.positionColourScaleStorageKey)),
      positionColourMode: resolvePositionColourMode(localStorage.getItem(this.positionColourModeStorageKey)),
      positionCustomColours: readStoredPositionColours(localStorage.getItem(this.positionCustomColoursStorageKey)),
      metricColourScale: resolveMetricColourScale(localStorage.getItem(this.metricColourScaleStorageKey)),
      metricColourScaleReversed: localStorage.getItem(this.metricColourScaleReversedStorageKey)
        ? localStorage.getItem(this.metricColourScaleReversedStorageKey) === 'true'
        : defaultMetricColourScaleReversed,
      metricCustomColours: readStoredMetricColours(localStorage.getItem(this.metricCustomColoursStorageKey)),
      lightThemeColour: resolveThemeBaseColour(localStorage.getItem(this.lightThemeColourStorageKey) ?? defaultThemeColour),
      darkThemeColour: resolveThemeColour(localStorage.getItem(this.lightThemeColourStorageKey) ?? defaultThemeColour, 'dark'),
      fdrCustomAnchors: resolveFdrCustomAnchors({
        min: localStorage.getItem(this.fdrCustomMinStorageKey) ?? undefined,
        second: localStorage.getItem(this.fdrCustomSecondStorageKey) ?? undefined,
        mid: localStorage.getItem(this.fdrCustomMidStorageKey) ?? undefined,
        fourth: localStorage.getItem(this.fdrCustomFourthStorageKey) ?? undefined,
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
    localStorage.setItem(this.positionColourScaleStorageKey, preferences.positionColourScale ?? defaultPositionColourScale);
    localStorage.setItem(this.positionColourModeStorageKey, preferences.positionColourMode ?? defaultPositionColourMode);
    localStorage.setItem(this.positionCustomColoursStorageKey, JSON.stringify(resolvePositionPalette(preferences.positionCustomColours)));
    localStorage.setItem(this.metricColourScaleStorageKey, preferences.metricColourScale ?? defaultMetricColourScale);
    localStorage.setItem(this.metricColourScaleReversedStorageKey, String(preferences.metricColourScaleReversed ?? defaultMetricColourScaleReversed));
    localStorage.setItem(this.metricCustomColoursStorageKey, JSON.stringify(resolveMetricPalette(preferences.metricCustomColours)));
    const themeColour = resolveThemeBaseColour(preferences.lightThemeColour ?? defaultThemeColour);
    localStorage.setItem(this.lightThemeColourStorageKey, themeColour);
    localStorage.setItem(this.darkThemeColourStorageKey, getThemeColourForMode(themeColour, 'dark'));
    localStorage.setItem(this.fdrCustomMinStorageKey, preferences.fdrCustomAnchors?.min ?? defaultFdrCustomAnchors.min);
    localStorage.setItem(this.fdrCustomSecondStorageKey, preferences.fdrCustomAnchors?.second ?? defaultFdrCustomAnchors.second);
    localStorage.setItem(this.fdrCustomMidStorageKey, preferences.fdrCustomAnchors?.mid ?? defaultFdrCustomAnchors.mid);
    localStorage.setItem(this.fdrCustomFourthStorageKey, preferences.fdrCustomAnchors?.fourth ?? defaultFdrCustomAnchors.fourth);
    localStorage.setItem(this.fdrCustomMaxStorageKey, preferences.fdrCustomAnchors?.max ?? defaultFdrCustomAnchors.max);

    return preferences;
  }

  async getFdrCustomPalettes(): Promise<FdrCustomPalette[]> {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.fdrCustomPalettesStorageKey) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const candidate = value as Partial<FdrCustomPalette>;
        if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return [];
        if (candidate.mode !== 'anchors' && candidate.mode !== 'all') return [];
        return [{
          id: candidate.id,
          name: candidate.name,
          mode: candidate.mode,
          anchors: resolveFdrCustomAnchors(candidate.anchors),
        }];
      });
    } catch {
      return [];
    }
  }

  async createFdrCustomPalette(palette: FdrCustomPaletteDraft): Promise<FdrCustomPalette> {
    const saved: FdrCustomPalette = {
      id: `local-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
      name: palette.name.trim(),
      mode: palette.mode,
      anchors: resolveFdrCustomAnchors(palette.anchors),
    };
    const palettes = await this.getFdrCustomPalettes();
    localStorage.setItem(this.fdrCustomPalettesStorageKey, JSON.stringify([...palettes, saved]));
    return saved;
  }

  async deleteFdrCustomPalette(paletteId: string): Promise<void> {
    const palettes = await this.getFdrCustomPalettes();
    localStorage.setItem(
      this.fdrCustomPalettesStorageKey,
      JSON.stringify(palettes.filter((palette) => palette.id !== paletteId)),
    );
  }

  async getPlayerColourPalettes(): Promise<PlayerColourPalette[]> {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.playerColourPalettesStorageKey) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        const candidate = value as Partial<PlayerColourPalette>;
        if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return [];
        if ((candidate.family !== 'position' && candidate.family !== 'metric') || !Array.isArray(candidate.colours)) return [];
        const expected = candidate.family === 'position' ? 4 : 5;
        if (candidate.colours.length !== expected) return [];
        return [{ id: candidate.id, name: candidate.name, family: candidate.family, colours: candidate.colours }];
      });
    } catch {
      return [];
    }
  }

  async createPlayerColourPalette(palette: Omit<PlayerColourPalette, 'id'>): Promise<PlayerColourPalette> {
    const saved: PlayerColourPalette = {
      id: `local-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
      name: palette.name.trim(),
      family: palette.family,
      colours: palette.colours.map((colour) => colour.toUpperCase()),
    };
    const palettes = await this.getPlayerColourPalettes();
    localStorage.setItem(this.playerColourPalettesStorageKey, JSON.stringify([...palettes, saved]));
    return saved;
  }

  async deletePlayerColourPalette(paletteId: string): Promise<void> {
    const palettes = await this.getPlayerColourPalettes();
    localStorage.setItem(
      this.playerColourPalettesStorageKey,
      JSON.stringify(palettes.filter((palette) => palette.id !== paletteId)),
    );
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

  async getFdrCustomPalettes(): Promise<FdrCustomPalette[]> {
    try {
      if (this.primary.getFdrCustomPalettes) return await this.primary.getFdrCustomPalettes();
    } catch {
      // Fall through to the local palette store when the API is unavailable.
    }
    return this.fallback.getFdrCustomPalettes?.() ?? [];
  }

  async createFdrCustomPalette(palette: FdrCustomPaletteDraft): Promise<FdrCustomPalette> {
    try {
      if (this.primary.createFdrCustomPalette) return await this.primary.createFdrCustomPalette(palette);
    } catch {
      // Fall through to the local palette store when the API is unavailable.
    }
    if (!this.fallback.createFdrCustomPalette) throw new Error('No FDR palette store is available.');
    return this.fallback.createFdrCustomPalette(palette);
  }

  async deleteFdrCustomPalette(paletteId: string): Promise<void> {
    try {
      if (this.primary.deleteFdrCustomPalette) {
        await this.primary.deleteFdrCustomPalette(paletteId);
        return;
      }
    } catch {
      // Fall through to the local palette store when the API is unavailable.
    }
    if (this.fallback.deleteFdrCustomPalette) await this.fallback.deleteFdrCustomPalette(paletteId);
  }

  async getPlayerColourPalettes(): Promise<PlayerColourPalette[]> {
    try {
      if (this.primary.getPlayerColourPalettes) return await this.primary.getPlayerColourPalettes();
    } catch {
      // Fall through to the local palette store when the API is unavailable.
    }
    return this.fallback.getPlayerColourPalettes?.() ?? [];
  }

  async createPlayerColourPalette(palette: Omit<PlayerColourPalette, 'id'>): Promise<PlayerColourPalette> {
    try {
      if (this.primary.createPlayerColourPalette) return await this.primary.createPlayerColourPalette(palette);
    } catch {
      // Fall through to the local palette store when the API is unavailable.
    }
    if (!this.fallback.createPlayerColourPalette) throw new Error('No player colour palette store is available.');
    return this.fallback.createPlayerColourPalette(palette);
  }

  async deletePlayerColourPalette(paletteId: string): Promise<void> {
    try {
      if (this.primary.deletePlayerColourPalette) {
        await this.primary.deletePlayerColourPalette(paletteId);
        return;
      }
    } catch {
      // Fall through to the local palette store when the API is unavailable.
    }
    if (this.fallback.deletePlayerColourPalette) await this.fallback.deletePlayerColourPalette(paletteId);
  }
}

function readStoredPositionColours(value: string | null): UserPreferences['positionCustomColours'] {
  try {
    return resolvePositionPalette(JSON.parse(value ?? 'null') as Partial<Record<PlayerPosition, string>>);
  } catch {
    return resolvePositionPalette(undefined);
  }
}

function readStoredMetricColours(value: string | null): MetricPalette {
  try {
    return resolveMetricPalette(JSON.parse(value ?? 'null') as string[]);
  } catch {
    return resolveMetricPalette(undefined);
  }
}
