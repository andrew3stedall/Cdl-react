import type { ThemePresetName } from './contracts';
import { resolveThemePreset } from './theme-presets';

export const THEME_PRESET_COOKIE = 'cdl-theme-preset';
const THEME_PRESET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split('; ')
    .find((value) => value.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

/**
 * Reads the device theme preference. The cookie is the canonical value; the
 * existing localStorage value is retained as a one-time migration fallback.
 */
export function getStoredThemePreset(): ThemePresetName | undefined {
  const cookieValue = readCookie(THEME_PRESET_COOKIE);
  if (cookieValue) return resolveThemePreset(cookieValue).name;

  if (typeof window === 'undefined') return undefined;

  const legacyValue = window.localStorage.getItem(THEME_PRESET_COOKIE);
  return legacyValue ? resolveThemePreset(legacyValue).name : undefined;
}

export function setThemePresetCookie(presetName: ThemePresetName): void {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = [
    `${THEME_PRESET_COOKIE}=${encodeURIComponent(presetName)}`,
    `Max-Age=${THEME_PRESET_COOKIE_MAX_AGE}`,
    'Path=/',
    'SameSite=Lax',
    secure.slice(2),
  ].filter(Boolean).join('; ');
}
