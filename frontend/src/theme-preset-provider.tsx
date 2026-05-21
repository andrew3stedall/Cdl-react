import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ThemePreset, UserPreferences } from './contracts';
import { FallbackPreferenceClient, type PreferenceClient } from './preferences-api';
import { getThemePresetClassName, resolveThemePreset } from './theme-presets';

interface ThemePresetContextValue {
  preset: ThemePreset;
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
  const [saveStatus, setSaveStatus] = useState<ThemePresetContextValue['saveStatus']>('idle');
  const preset = resolveThemePreset(presetName);

  useEffect(() => {
    let isMounted = true;

    preferenceClient
      .getPreferences()
      .then((preferences) => {
        if (isMounted) {
          setPresetNameState(resolveThemePreset(preferences.themePreset).name);
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

    root.dataset.themePreset = preset.name;
    root.dataset.themeClass = getThemePresetClassName(preset);
    root.style.setProperty('--cdl-background', preset.tokens.colors.background);
    root.style.setProperty('--cdl-foreground', preset.tokens.colors.foreground);
    root.style.setProperty('--cdl-surface', preset.tokens.colors.surface);
    root.style.setProperty('--cdl-primary', preset.tokens.colors.primary);
    root.style.setProperty('--cdl-border', preset.tokens.colors.border);
    root.style.setProperty('--cdl-accent', preset.tokens.colors.accent);
    root.style.setProperty('--cdl-radius', preset.tokens.radius);
  }, [preset]);

  const savePresetPreference = (preferences: UserPreferences) => {
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
      preset,
      setPresetName: (nextPresetName) => {
        const nextPreset = resolveThemePreset(nextPresetName);

        setPresetNameState(nextPreset.name);
        savePresetPreference({ themePreset: nextPreset.name });
      },
      saveStatus,
    }),
    [preset, saveStatus],
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
