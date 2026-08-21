import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { getStoredThemePreset, setThemePresetCookie, THEME_PRESET_COOKIE } from './theme-cookie';

describe('device theme preference cookie', () => {
  beforeEach(() => {
    document.cookie = `${THEME_PRESET_COOKIE}=; Max-Age=0; Path=/`;
    window.localStorage.clear();
  });

  afterEach(() => {
    document.cookie = `${THEME_PRESET_COOKIE}=; Max-Age=0; Path=/`;
    window.localStorage.clear();
  });

  test('persists and reads the selected theme from a device cookie', () => {
    setThemePresetCookie('teal-dark');

    expect(document.cookie).toContain(`${THEME_PRESET_COOKIE}=teal-dark`);
    expect(getStoredThemePreset()).toBe('teal-dark');
  });

  test('uses the existing localStorage value when migrating a device', () => {
    window.localStorage.setItem(THEME_PRESET_COOKIE, 'teal-dark');

    expect(getStoredThemePreset()).toBe('teal-dark');
  });

  test('prefers the cookie over the legacy localStorage value', () => {
    window.localStorage.setItem(THEME_PRESET_COOKIE, 'teal-light');
    setThemePresetCookie('teal-dark');

    expect(getStoredThemePreset()).toBe('teal-dark');
  });
});
