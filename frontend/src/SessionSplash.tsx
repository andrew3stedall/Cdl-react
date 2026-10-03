import { LoaderCircle, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';

import { defaultThemeColour, resolveThemeAccentColours, resolveThemeColourVariants } from './theme-colours';
import { getStoredThemePreset } from './theme-cookie';
import { getThemeMode, resolveThemePreset } from './theme-presets';
import './session-splash.css';

interface SessionSplashProps {
  error?: string | null;
  onRetry: () => void;
}

export function SessionSplash({ error, onRetry }: SessionSplashProps) {
  const savedAccent = getPersistedSplashAccent();
  const splashStyle = {
    '--session-splash-background': savedAccent,
  } as CSSProperties;

  return (
    <main aria-label="Castle Draft League loading" className="session-splash" style={splashStyle}>
      <div className="session-splash__halo session-splash__halo--outer" aria-hidden="true" />
      <div className="session-splash__halo session-splash__halo--inner" aria-hidden="true" />

      <section className="session-splash__content">
        <div aria-hidden="true" className="session-splash__mark">CDL</div>
        <span className="sr-only">Castle Draft League</span>

        {error ? (
          <div className="session-splash__error" role="alert">
            <p>We couldn’t load your league just yet.</p>
            <span>{error}</span>
            <button className="session-splash__retry" onClick={onRetry} type="button">
              <RotateCcw aria-hidden="true" size={16} />
              Try again
            </button>
          </div>
        ) : (
          <div aria-live="polite" className="session-splash__loading" role="status">
            <div aria-hidden="true" className="session-splash__progress">
              <span />
            </div>
            <span>Loading</span>
            <LoaderCircle aria-hidden="true" className="session-splash__spinner" size={17} />
          </div>
        )}
      </section>
    </main>
  );
}

function getPersistedSplashAccent(): string {
  if (typeof window === 'undefined') return defaultThemeColour;
  try {
    const stored = window.localStorage.getItem('cdl-theme-colour-variants');
    if (!stored) return defaultThemeColour;
    const variants = resolveThemeColourVariants(JSON.parse(stored) as Parameters<typeof resolveThemeColourVariants>[0]);
    const mode = getThemeMode(resolveThemePreset(getStoredThemePreset()));
    return resolveThemeAccentColours(variants[mode]).primary;
  } catch {
    return defaultThemeColour;
  }
}
