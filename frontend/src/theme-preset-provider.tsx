import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { AttackDirection, ThemePreset, UserPreferences } from './contracts';
import {
  defaultFdrScaleName,
  defaultFdrDisplayMode,
  defaultFdrScaleReversed,
  defaultFdrCustomAnchors,
  getFdrFillForeground,
  getFdrFillPalette,
  getFdrPalette,
  resolveFdrCustomAnchors,
  resolveFdrScaleName,
  type FdrCustomAnchors,
  type FdrCustomPalette,
  type FdrDisplayMode,
  type FdrScaleName,
} from './fdr-colour-scales';
import { FallbackPreferenceClient, type FdrCustomPaletteDraft, type PreferenceClient } from './preferences-api';
import {
  defaultMetricColourScale,
  defaultMetricColourScaleReversed,
  defaultPositionColourScale,
  getMetricPalette,
  getPositionColourScale,
  resolveMetricColourScale,
  resolvePositionColourScale,
  type MetricColourScaleName,
  type PositionColourScaleName,
} from './player-colour-scales';
import { getThemeMode, getThemePresetClassName, resolveThemePreset } from './theme-presets';
import { getStoredThemePreset, setThemePresetCookie } from './theme-cookie';
import {
  applyThemeColours,
  defaultThemeColour,
  getThemeColourForMode,
  resolveThemeBaseColour,
} from './theme-colours';

interface ThemePresetContextValue {
  attackDirection: AttackDirection;
  fdrDisplayMode: FdrDisplayMode;
  fdrScale: FdrScaleName;
  fdrScaleReversed: boolean;
  customFdrAnchors: FdrCustomAnchors;
  customFdrPalettes: FdrCustomPalette[];
  positionColourScale: PositionColourScaleName;
  metricColourScale: MetricColourScaleName;
  metricColourScaleReversed: boolean;
  themeColour: string;
  preset: ThemePreset;
  setAttackDirection: (direction: AttackDirection) => void;
  setFdrDisplayMode: (mode: FdrDisplayMode) => void;
  setFdrScale: (scale: FdrScaleName) => void;
  setFdrScaleReversed: (reversed: boolean) => void;
  setCustomFdrAnchors: (anchors: FdrCustomAnchors) => void;
  useCustomFdrPalette: (palette: FdrCustomPalette) => void;
  saveCustomFdrPalette: (palette: FdrCustomPaletteDraft) => Promise<FdrCustomPalette>;
  deleteCustomFdrPalette: (paletteId: string) => Promise<void>;
  setPositionColourScale: (scale: PositionColourScaleName) => void;
  setMetricColourScale: (scale: MetricColourScaleName) => void;
  setMetricColourScaleReversed: (reversed: boolean) => void;
  setThemeColour: (colour: string) => void;
  setPresetName: (presetName: ThemePreset['name']) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null);
const defaultPreferenceClient = new FallbackPreferenceClient();

interface ThemePresetProviderProps {
  children: ReactNode;
  initialPresetName?: ThemePreset['name'];
  preferenceClient?: PreferenceClient;
}

export function ThemePresetProvider({
  children,
  initialPresetName,
  preferenceClient = defaultPreferenceClient,
}: ThemePresetProviderProps) {
  const [presetName, setPresetNameState] = useState<ThemePreset['name']>(
    resolveThemePreset(initialPresetName ?? getStoredThemePreset()).name,
  );
  const [attackDirection, setAttackDirectionState] = useState<AttackDirection>('up');
  const [fdrScale, setFdrScaleState] = useState<FdrScaleName>(defaultFdrScaleName);
  const [fdrScaleReversed, setFdrScaleReversedState] = useState(defaultFdrScaleReversed);
  const [fdrDisplayMode, setFdrDisplayModeState] = useState<FdrDisplayMode>(defaultFdrDisplayMode);
  const [customFdrAnchors, setCustomFdrAnchorsState] = useState(defaultFdrCustomAnchors);
  const [customFdrPalettes, setCustomFdrPalettes] = useState<FdrCustomPalette[]>([]);
  const [positionColourScale, setPositionColourScaleState] = useState<PositionColourScaleName>(defaultPositionColourScale);
  const [metricColourScale, setMetricColourScaleState] = useState<MetricColourScaleName>(defaultMetricColourScale);
  const [metricColourScaleReversed, setMetricColourScaleReversedState] = useState(defaultMetricColourScaleReversed);
  const [themeColour, setThemeColourState] = useState(defaultThemeColour);
  const [themeClockTick, setThemeClockTick] = useState(() => Date.now());
  const [saveStatus, setSaveStatus] = useState<ThemePresetContextValue['saveStatus']>('idle');
  const latestPreferencesRef = useRef<UserPreferences | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const preset = useMemo(
    () => applyThemeColours(resolveThemePreset(presetName), themeColour),
    [presetName, themeClockTick, themeColour],
  );

  useEffect(() => {
    if (presetName !== 'adaptive') return undefined;

    const interval = window.setInterval(() => setThemeClockTick(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [presetName]);

  useEffect(() => {
    let isMounted = true;

    preferenceClient
      .getPreferences()
      .then((preferences) => {
        if (isMounted) {
          const nextPresetName = resolveThemePreset(preferences.themePreset).name;
          setPresetNameState(nextPresetName);
          setThemePresetCookie(nextPresetName);
          setAttackDirectionState(preferences.attackDirection === 'down' ? 'down' : 'up');
          setFdrScaleState(resolveFdrScaleName(preferences.fdrScale));
          setFdrScaleReversedState(preferences.fdrScaleReversed ?? defaultFdrScaleReversed);
          setFdrDisplayModeState(preferences.fdrDisplayMode ?? defaultFdrDisplayMode);
          setPositionColourScaleState(resolvePositionColourScale(preferences.positionColourScale));
          setMetricColourScaleState(resolveMetricColourScale(preferences.metricColourScale));
          setMetricColourScaleReversedState(preferences.metricColourScaleReversed ?? defaultMetricColourScaleReversed);
          setThemeColourState(resolveThemeBaseColour(preferences.lightThemeColour ?? preferences.darkThemeColour));
          setCustomFdrAnchorsState(resolveFdrCustomAnchors(preferences.fdrCustomAnchors));
          latestPreferencesRef.current = preferences;
        }
      })
      .catch(() => {
        if (isMounted) {
          setSaveStatus('error');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [preferenceClient]);

  useEffect(() => {
    let isMounted = true;
    if (!preferenceClient.getFdrCustomPalettes) return undefined;

    preferenceClient.getFdrCustomPalettes()
      .then((palettes) => {
        if (isMounted) setCustomFdrPalettes(palettes);
      })
      .catch(() => {
        if (isMounted) setCustomFdrPalettes([]);
      });

    return () => {
      isMounted = false;
    };
  }, [preferenceClient]);

  useEffect(() => {
    const root = document.documentElement;
    const colors = preset.tokens.colors;
    const themeMode = getThemeMode(preset);
    const fdrPalette = getFdrPalette(fdrScale, themeMode, fdrScaleReversed, customFdrAnchors);
    const fdrFillPalette = getFdrFillPalette(fdrScale, themeMode, fdrScaleReversed, customFdrAnchors);
    const positionPalette = getPositionColourScale(positionColourScale);
    const metricPalette = getMetricPalette(metricColourScale, themeMode, metricColourScaleReversed);
    const tokenValues: Record<string, string> = {
      background: colors.background,
      foreground: colors.foreground,
      card: colors.card,
      'card-foreground': colors.cardForeground,
      surface: colors.surface,
      'surface-foreground': colors.surfaceForeground,
      popover: colors.popover,
      'popover-foreground': colors.popoverForeground,
      primary: colors.primary,
      'primary-foreground': colors.primaryForeground,
      secondary: colors.secondary,
      'secondary-foreground': colors.secondaryForeground,
      muted: colors.muted,
      'muted-foreground': colors.mutedForeground,
      accent: colors.accent,
      'accent-foreground': colors.accentForeground,
      border: colors.border,
      input: colors.input,
      ring: colors.ring,
      destructive: colors.destructive,
      'destructive-foreground': colors.destructiveForeground,
    };

    root.dataset.themePreset = preset.name;
    root.dataset.themeMode = getThemeMode(preset);
    root.dataset.themeClass = getThemePresetClassName(preset);
    root.style.colorScheme = getThemeMode(preset);
    Object.entries(tokenValues).forEach(([token, value]) => {
      root.style.setProperty(`--${token}`, value);
      root.style.setProperty(`--cdl-${token}`, value);
    });
    root.style.setProperty('--cdl-radius', preset.tokens.radius);
    root.style.setProperty('--radius', preset.tokens.radius);
    fdrPalette.forEach((color, index) => {
      root.style.setProperty(`--cdl-fdr-${index + 1}`, color);
      root.style.setProperty(`--cdl-fdr-fill-${index + 1}`, fdrFillPalette[index]);
      root.style.setProperty(`--cdl-fdr-fill-foreground-${index + 1}`, getFdrFillForeground(fdrFillPalette[index]));
    });
    root.style.setProperty('--cdl-position-gkp', positionPalette.positions.GKP);
    root.style.setProperty('--cdl-position-def', positionPalette.positions.DEF);
    root.style.setProperty('--cdl-position-mid', positionPalette.positions.MID);
    root.style.setProperty('--cdl-position-fwd', positionPalette.positions.FWD);
    metricPalette.forEach((color, index) => root.style.setProperty(`--cdl-metric-${index + 1}`, color));
    root.dataset.fdrScale = fdrScale;
    root.dataset.fdrScaleReversed = String(fdrScaleReversed);
    root.dataset.fdrDisplayMode = fdrDisplayMode;
    root.dataset.positionColourScale = positionColourScale;
    root.dataset.metricColourScale = metricColourScale;
    root.dataset.metricColourScaleReversed = String(metricColourScaleReversed);
  }, [customFdrAnchors, fdrDisplayMode, fdrScale, fdrScaleReversed, metricColourScale, metricColourScaleReversed, positionColourScale, preset]);

  const savePreference = (preferences: UserPreferences) => {
    latestPreferencesRef.current = preferences;
    setSaveStatus('saving');

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const nextPreferences = latestPreferencesRef.current;
        if (nextPreferences) await preferenceClient.updatePreferences(nextPreferences);
      })
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('error'));
  };

  const value = useMemo<ThemePresetContextValue>(
    () => {
      const savePreferencePatch = (patch: Partial<UserPreferences>) => {
        const basePreferences = latestPreferencesRef.current ?? {
          themePreset: preset.name,
          attackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: customFdrAnchors,
        };
        savePreference({ ...basePreferences, ...patch });
      };

      return ({
      attackDirection,
      fdrDisplayMode,
      fdrScale,
      fdrScaleReversed,
      customFdrAnchors,
      customFdrPalettes,
      positionColourScale,
      metricColourScale,
      metricColourScaleReversed,
      themeColour,
      preset,
      setAttackDirection: (nextAttackDirection) => {
        setAttackDirectionState(nextAttackDirection);
        savePreference({
          themePreset: preset.name,
          attackDirection: nextAttackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: customFdrAnchors,
        });
      },
      setFdrDisplayMode: (nextFdrDisplayMode) => {
        setFdrDisplayModeState(nextFdrDisplayMode);
        savePreference({
          themePreset: preset.name,
          attackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode: nextFdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: customFdrAnchors,
        });
      },
      setFdrScale: (nextFdrScale) => {
        setFdrScaleState(nextFdrScale);
        savePreference({
          themePreset: preset.name,
          attackDirection,
          fdrScale: nextFdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: customFdrAnchors,
        });
      },
      setFdrScaleReversed: (nextFdrScaleReversed) => {
        setFdrScaleReversedState(nextFdrScaleReversed);
        savePreference({
          themePreset: preset.name,
          attackDirection,
          fdrScale,
          fdrScaleReversed: nextFdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: customFdrAnchors,
        });
      },
      setCustomFdrAnchors: (nextAnchors) => {
        const resolvedAnchors = resolveFdrCustomAnchors(nextAnchors);
        setCustomFdrAnchorsState(resolvedAnchors);
        savePreference({
          themePreset: preset.name,
          attackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: resolvedAnchors,
        });
      },
      useCustomFdrPalette: (palette) => {
        const nextScale: FdrScaleName = palette.mode === 'all' ? 'CustomAll' : 'CustomHex';
        setCustomFdrAnchorsState(palette.anchors);
        setFdrScaleState(nextScale);
        savePreference({
          themePreset: preset.name,
          attackDirection,
          fdrScale: nextScale,
          fdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: palette.anchors,
        });
      },
      saveCustomFdrPalette: async (palette) => {
        if (!preferenceClient.createFdrCustomPalette) {
          throw new Error('No FDR palette store is available.');
        }
        const saved = await preferenceClient.createFdrCustomPalette(palette);
        setCustomFdrPalettes((current) => [...current, saved]);
        return saved;
      },
      deleteCustomFdrPalette: async (paletteId) => {
        if (!preferenceClient.deleteFdrCustomPalette) {
          throw new Error('No FDR palette store is available.');
        }
        await preferenceClient.deleteFdrCustomPalette(paletteId);
        setCustomFdrPalettes((current) => current.filter((palette) => palette.id !== paletteId));
      },
      setPositionColourScale: (nextPositionColourScale) => {
        setPositionColourScaleState(nextPositionColourScale);
        savePreferencePatch({ positionColourScale: nextPositionColourScale });
      },
      setMetricColourScale: (nextMetricColourScale) => {
        setMetricColourScaleState(nextMetricColourScale);
        savePreferencePatch({ metricColourScale: nextMetricColourScale });
      },
      setMetricColourScaleReversed: (nextMetricColourScaleReversed) => {
        setMetricColourScaleReversedState(nextMetricColourScaleReversed);
        savePreferencePatch({ metricColourScaleReversed: nextMetricColourScaleReversed });
      },
      setThemeColour: (nextColour) => {
        const resolvedColour = resolveThemeBaseColour(nextColour);
        setThemeColourState(resolvedColour);
        savePreference({
          themePreset: preset.name,
          attackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: resolvedColour,
          darkThemeColour: getThemeColourForMode(resolvedColour, 'dark'),
          fdrCustomAnchors: customFdrAnchors,
        });
      },
      setPresetName: (nextPresetName) => {
        const nextPreset = resolveThemePreset(nextPresetName);

        setPresetNameState(nextPreset.name);
        setThemePresetCookie(nextPreset.name);
        savePreference({
          themePreset: nextPreset.name,
          attackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          positionColourScale,
          metricColourScale,
          metricColourScaleReversed,
          lightThemeColour: themeColour,
          darkThemeColour: getThemeColourForMode(themeColour, 'dark'),
          fdrCustomAnchors: customFdrAnchors,
        });
      },
      saveStatus,
      });
    },
    [attackDirection, customFdrAnchors, customFdrPalettes, fdrDisplayMode, fdrScale, fdrScaleReversed, metricColourScale, metricColourScaleReversed, positionColourScale, preferenceClient, preset, saveStatus, themeColour],
  );

  return <ThemePresetContext.Provider value={value}>{children}</ThemePresetContext.Provider>;
}

export function useThemePreset(): ThemePresetContextValue {
  const context = useContext(ThemePresetContext);

  if (!context) {
    throw new Error('useThemePreset must be used inside ThemePresetProvider.');
  }

  return context;
}

export function useOptionalThemePreset(): ThemePresetContextValue | null {
  return useContext(ThemePresetContext);
}
