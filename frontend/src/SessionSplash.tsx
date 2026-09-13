import { LoaderCircle, RotateCcw } from 'lucide-react';

import './session-splash.css';

interface SessionSplashProps {
  error?: string | null;
  onRetry: () => void;
}

export function SessionSplash({ error, onRetry }: SessionSplashProps) {
  return (
    <main aria-label="Castle Draft League loading" className="session-splash">
      <div className="session-splash__halo session-splash__halo--outer" aria-hidden="true" />
      <div className="session-splash__halo session-splash__halo--inner" aria-hidden="true" />

      <section className="session-splash__content">
        <div aria-hidden="true" className="session-splash__mark">CDL</div>
        <div className="session-splash__copy">
          <p className="session-splash__kicker">Castle Draft League</p>
          <h1>Own your league.</h1>
          <p className="session-splash__tagline">Your league. Your strategy. All season long.</p>
        </div>

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
            <span>Preparing your workspace</span>
            <LoaderCircle aria-hidden="true" className="session-splash__spinner" size={17} />
          </div>
        )}
      </section>
    </main>
  );
}
