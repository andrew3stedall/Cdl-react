import { type FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, RefreshCw } from 'lucide-react';

import { GoogleSignInButton } from './GoogleSignInButton';

interface LoginPageProps {
  email: string;
  error: string | null;
  googleClientId: string | null;
  password: string;
  pending: boolean;
  showRetry: boolean;
  onEmailChange(value: string): void;
  onGoogleCredential(credential: string): void | Promise<void>;
  onPasswordChange(value: string): void;
  onRetry(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
}

function CastleLeagueMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 72">
      <path d="M8 13 32 3l24 10v21c0 16-9.8 27.4-24 35C17.8 61.4 8 50 8 34V13Z" />
      <path d="M19 24h7v-7h5v7h7v-7h5v7h3v20H18V24h1Z" />
      <path d="M25 44V33h14v11" />
    </svg>
  );
}

export function LoginPage({
  email,
  error,
  googleClientId,
  password,
  pending,
  showRetry,
  onEmailChange,
  onGoogleCredential,
  onPasswordChange,
  onRetry,
  onSubmit,
}: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="login-screen" aria-labelledby="login-title">
      <div aria-hidden="true" className="login-ambient login-ambient-top" />
      <div aria-hidden="true" className="login-ambient login-ambient-bottom" />

      <section className="login-panel">
        <header className="login-brand">
          <span className="login-brand-mark">
            <CastleLeagueMark />
          </span>
          <div>
            <p className="login-brand-name">
              <span>Castle</span>
              <strong> Draft League</strong>
            </p>
            <p className="login-brand-tagline">Build your squad. Shape your legacy.</p>
          </div>
        </header>

        <div className="login-rule" />

        <div className="login-intro">
          <p className="login-kicker">Manager access</p>
          <h1 id="login-title">Welcome back</h1>
          <p className="login-access-copy">
            Sign in to access the Castle Draft League manager workspace.
          </p>
        </div>

        <form className="login-form login-form-redesigned" onSubmit={onSubmit}>
          <div className="login-field login-field-redesigned">
            <label htmlFor="login-email">Email address</label>
            <span className="login-input-shell">
              <Mail aria-hidden="true" size={20} />
              <input
                aria-label="Email address"
                autoComplete="email"
                id="login-email"
                inputMode="email"
                name="email"
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="manager@example.com"
                required
                type="email"
                value={email}
              />
            </span>
          </div>

          <div className="login-field login-field-redesigned">
            <label htmlFor="login-password">Password</label>
            <span className="login-input-shell">
              <LockKeyhole aria-hidden="true" size={20} />
              <input
                aria-label="Password"
                autoComplete="current-password"
                id="login-password"
                name="password"
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Enter your password"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="login-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
              </button>
            </span>
          </div>

          {error ? (
            <p className="login-error login-error-redesigned" role="status">
              {error}
            </p>
          ) : null}

          <button className="login-submit" disabled={pending} type="submit">
            <span>{pending ? 'Signing in…' : 'Sign in'}</span>
            <ArrowRight aria-hidden="true" size={22} />
          </button>

          {showRetry ? (
            <button
              className="login-retry"
              disabled={pending}
              onClick={onRetry}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={17} />
              Retry session check
            </button>
          ) : null}
        </form>

        {googleClientId ? (
          <section className="google-login login-google-redesigned" aria-label="Google sign-in">
            <div className="login-divider-row">
              <span />
              <p>or continue with</p>
              <span />
            </div>
            <GoogleSignInButton
              clientId={googleClientId}
              onCredential={onGoogleCredential}
            />
          </section>
        ) : null}

        <p className="login-footnote">
          Access is limited to invited Castle Draft League managers.
        </p>
      </section>
    </main>
  );
}
