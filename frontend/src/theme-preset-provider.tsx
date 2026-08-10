import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { AttackDirection, ThemePreset, UserPreferences } from './contracts';
import { FallbackPreferenceClient, type PreferenceClient } from './preferences-api';
import { getThemeMode, getThemePresetClassName, resolveThemePreset } from './theme-presets';

interface ThemePresetContextValue {
  attackDirection: AttackDirection;
  preset: ThemePreset;
  setAttackDirection: (direction: AttackDirection) => void;
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
    resolveThemePreset(initialPresetName).name,
  );
  const [attackDirection, setAttackDirectionState] = useState<AttackDirection>('up');
  const [saveStatus, setSaveStatus] = useState<ThemePresetContextValue['saveStatus']>('idle');
  const preset = resolveThemePreset(presetName);

  useEffect(() => {
    let isMounted = true;

    preferenceClient
      .getPreferences()
      .then((preferences) => {
        if (isMounted) {
          setPresetNameState(resolveThemePreset(preferences.themePreset).name);
          setAttackDirectionState(preferences.attackDirection === 'down' ? 'down' : 'up');
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
  }, [preset]);

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
      preset,
      setAttackDirection: (nextAttackDirection) => {
        setAttackDirectionState(nextAttackDirection);
        savePreference({ themePreset: preset.name, attackDirection: nextAttackDirection });
      },
      setPresetName: (nextPresetName) => {
        const nextPreset = resolveThemePreset(nextPresetName);

        setPresetNameState(nextPreset.name);
        savePreference({ themePreset: nextPreset.name, attackDirection });
      },
      saveStatus,
    }),
    [attackDirection, preset, saveStatus],
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
