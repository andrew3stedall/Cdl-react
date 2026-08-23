import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { AttackDirection, ThemePreset, UserPreferences } from './contracts';
import {
  defaultFdrScaleName,
  defaultFdrDisplayMode,
  defaultFdrScaleReversed,
  getFdrFillForeground,
  getFdrFillPalette,
  getFdrPalette,
  resolveFdrScaleName,
  type FdrDisplayMode,
  type FdrScaleName,
} from './fdr-colour-scales';
import { FallbackPreferenceClient, type PreferenceClient } from './preferences-api';
import { getThemeMode, getThemePresetClassName, resolveThemePreset } from './theme-presets';
import { getStoredThemePreset, setThemePresetCookie } from './theme-cookie';
import {
  applyThemeColours,
  defaultDarkThemeColour,
  defaultLightThemeColour,
  resolveThemeColour,
  type ThemeColourMode,
} from './theme-colours';

interface ThemePresetContextValue {
  attackDirection: AttackDirection;
  fdrDisplayMode: FdrDisplayMode;
  fdrScale: FdrScaleName;
  fdrScaleReversed: boolean;
  lightThemeColour: string;
  darkThemeColour: string;
  preset: ThemePreset;
  setAttackDirection: (direction: AttackDirection) => void;
  setFdrDisplayMode: (mode: FdrDisplayMode) => void;
  setFdrScale: (scale: FdrScaleName) => void;
  setFdrScaleReversed: (reversed: boolean) => void;
  setThemeColour: (mode: ThemeColourMode, colour: string) => void;
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
  const [lightThemeColour, setLightThemeColourState] = useState(defaultLightThemeColour);
  const [darkThemeColour, setDarkThemeColourState] = useState(defaultDarkThemeColour);
  const [saveStatus, setSaveStatus] = useState<ThemePresetContextValue['saveStatus']>('idle');
  const preset = useMemo(
    () => applyThemeColours(resolveThemePreset(presetName), lightThemeColour, darkThemeColour),
    [darkThemeColour, lightThemeColour, presetName],
  );

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
          setLightThemeColourState(resolveThemeColour(preferences.lightThemeColour, 'light'));
          setDarkThemeColourState(resolveThemeColour(preferences.darkThemeColour, 'dark'));
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
    const root = document.documentElement;
    const colors = preset.tokens.colors;
    const themeMode = getThemeMode(preset);
    const fdrPalette = getFdrPalette(fdrScale, themeMode, fdrScaleReversed);
    const fdrFillPalette = getFdrFillPalette(fdrScale, themeMode, fdrScaleReversed);
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
    root.dataset.fdrScale = fdrScale;
    root.dataset.fdrScaleReversed = String(fdrScaleReversed);
    root.dataset.fdrDisplayMode = fdrDisplayMode;
  }, [fdrDisplayMode, fdrScale, fdrScaleReversed, preset]);

  const savePreference = (preferences: UserPreferences) => {
    setSaveStatus('saving');

    preferenceClient
      .updatePreferences(preferences)
      .then(() => {
        setSaveStatus('saved');
      })
      .catch(() => {
        setSaveStatus('error');
      });
  };

  const value = useMemo<ThemePresetContextValue>(
    () => ({
      attackDirection,
      fdrDisplayMode,
      fdrScale,
      fdrScaleReversed,
      lightThemeColour,
      darkThemeColour,
      preset,
      setAttackDirection: (nextAttackDirection) => {
        setAttackDirectionState(nextAttackDirection);
        savePreference({
          themePreset: preset.name,
          attackDirection: nextAttackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          lightThemeColour,
          darkThemeColour,
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
          lightThemeColour,
          darkThemeColour,
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
          lightThemeColour,
          darkThemeColour,
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
          lightThemeColour,
          darkThemeColour,
        });
      },
      setThemeColour: (mode, nextColour) => {
        const resolvedColour = resolveThemeColour(nextColour, mode);
        if (mode === 'light') {
          setLightThemeColourState(resolvedColour);
        } else {
          setDarkThemeColourState(resolvedColour);
        }
        savePreference({
          themePreset: preset.name,
          attackDirection,
          fdrScale,
          fdrScaleReversed,
          fdrDisplayMode,
          lightThemeColour: mode === 'light' ? resolvedColour : lightThemeColour,
          darkThemeColour: mode === 'dark' ? resolvedColour : darkThemeColour,
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
          lightThemeColour,
          darkThemeColour,
        });
      },
      saveStatus,
    }),
    [attackDirection, darkThemeColour, fdrDisplayMode, fdrScale, fdrScaleReversed, lightThemeColour, preset, saveStatus],
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
