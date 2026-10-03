import { type FormEvent, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  canAccessProtectedRoute,
  defaultSessionClient,
  getAppleAuthConfig,
  getPasskeyAuthConfig,
  getUnauthenticatedSession,
  type SessionClient,
} from './auth';
import { AppShell } from './AppShell';
import { GlobalNotificationsProvider } from './components/ui/global-notifications';
import type { SessionState } from './contracts';
import type { DashboardClient } from './dashboard-api';
import type { FdrClient } from './fdr-api';
import { GlobalNavigation } from './GlobalNavigation';
import { LeaguePage } from './LeaguePage';
import { LeagueInvitePage } from './LeagueInvitePage';
import type { LeagueClient } from './league-api';
import { LoginPage } from './LoginPage';
import { MarketPage } from './MarketPage';
import { ManagerDeskPage } from './ManagerDeskPage';
import type { ManagerDeskClient } from './manager-desk-api';
import { ModernisationCheckpointPage } from './ModernisationCheckpointPage';
import { getPageRouteKey, isSquadRoute, isSupportedRoute } from './navigation';
import { activateDataRoute } from './data-freshness';
import { PlayerProfilePage } from './PlayerProfilePage';
import { LocalStoragePreferenceClient, type PreferenceClient } from './preferences-api';
import { ProfilePage } from './ProfilePage';
import { ResultColourProfilePage } from './ResultColourProfilePage';
import { loginWithPasskey } from './passkeys';
import { RulesWorkspacePage } from './RulesWorkspacePage';
import { SessionSplash } from './SessionSplash';
import { SquadWorkspacePage } from './SquadWorkspacePage';
import { HttpSquadClient, type SquadClient } from './squad-api';
import type { TeamSelectionClient } from './team-selection-api';
import { ThemePresetProvider, useThemePreset } from './theme-preset-provider';
import { getStoredThemePreset } from './theme-cookie';

const loginPreferenceClient = new LocalStoragePreferenceClient();
const defaultAppSquadClient = new HttpSquadClient();
const LOGIN_RETURN_KEY = 'cdl.loginReturnPath';

function storedLoginReturnPath(): string | null {
  try {
    const value = window.sessionStorage.getItem(LOGIN_RETURN_KEY);
    return value?.startsWith('/join/') ? value : null;
  } catch {
    return null;
  }
}
const AnalyticsDashboardPage = lazy(() => import('./AnalyticsDashboardPage').then((module) => ({ default: module.AnalyticsDashboardPage })));
const FixtureDifficultyPage = lazy(() => import('./FixtureDifficultyPage').then((module) => ({ default: module.FixtureDifficultyPage })));

interface AppProps {
  dashboardClient?: DashboardClient;
  fdrClient?: FdrClient;
  initialPath?: string;
  leagueClient?: LeagueClient;
  managerDeskClient?: ManagerDeskClient;
  preferenceClient?: PreferenceClient;
  session?: SessionState;
  sessionClient?: SessionClient;
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

export function App({
  dashboardClient,
  fdrClient,
  initialPath = window.location.pathname,
  leagueClient,
  managerDeskClient,
  preferenceClient,
  session,
  sessionClient = defaultSessionClient,
  squadClient,
  teamSelectionClient,
}: AppProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [loginReturnPath, setLoginReturnPath] = useState<string | null>(() => initialPath.startsWith('/join/') ? initialPath : storedLoginReturnPath());
  const [activeSession, setActiveSession] = useState<SessionState | null>(session ?? null);
  const [sessionCheckError, setSessionCheckError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [appleEnabled, setAppleEnabled] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const appSquadClient = squadClient ?? defaultAppSquadClient;

  useEffect(() => {
    let cancelled = false;

    if (session !== undefined) {
      setSessionCheckError(null);
      setActiveSession(session);
      return () => {
        cancelled = true;
      };
    }

    setSessionCheckError(null);
    setActiveSession(null);
    void sessionClient.getSession()
      .then((resolvedSession) => {
        if (!cancelled) {
          setSessionCheckError(null);
          setActiveSession(resolvedSession);
          if (!canAccessProtectedRoute(resolvedSession)) {
            const invitePath = initialPath.startsWith('/join/') ? initialPath : storedLoginReturnPath();
            if (invitePath) {
              setLoginReturnPath(invitePath);
              try { window.sessionStorage.setItem(LOGIN_RETURN_KEY, invitePath); } catch { /* storage is optional */ }
            }
            try {
              window.history.replaceState({}, '', '/login');
            } catch {
              // Browser history can be unavailable in isolated DOM tests.
            }
            setCurrentPath('/login');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionCheckError(
            'Your session could not be verified because the server is temporarily unavailable.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionClient]);

  useEffect(() => {
    let cancelled = false;
    if (session !== undefined) return () => undefined;

    void Promise.all([getAppleAuthConfig(), getPasskeyAuthConfig()])
      .then(([appleConfig, passkeyConfig]) => {
        if (!cancelled) {
          setAppleEnabled(appleConfig.enabled);
          setPasskeyEnabled(passkeyConfig.enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppleEnabled(false);
          setPasskeyEnabled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    if (session !== undefined) return () => undefined;

    void sessionClient.getGoogleAuthConfig()
      .then((config) => {
        if (!cancelled && config.enabled) setGoogleClientId(config.clientId);
      })
      .catch(() => {
        if (!cancelled) setGoogleClientId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionClient]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const setBrowserPath = useCallback((href: string, replace = false) => {
    try {
      if (replace) {
        window.history.replaceState({}, '', href);
      } else {
        window.history.pushState({}, '', href);
      }
    } catch {
      // Browser history can be unavailable in isolated DOM tests.
    }
    const normalizedPath = new URL(href, window.location.origin).pathname;
    setCurrentPath(normalizedPath);
  }, []);

  const completeLogin = useCallback((resolvedSession: SessionState) => {
    setSessionCheckError(null);
    setActiveSession(resolvedSession);
    const destination = loginReturnPath ?? '/';
    setLoginReturnPath(null);
    try { window.sessionStorage.removeItem(LOGIN_RETURN_KEY); } catch { /* storage is optional */ }
    setBrowserPath(destination, true);
  }, [loginReturnPath, setBrowserPath]);

  const refreshActiveSession = async () => {
    if (session !== undefined) return;
    setSessionCheckError(null);
    setActiveSession(null);
    try {
      const resolvedSession = await sessionClient.getSession();
      setActiveSession(resolvedSession);
      if (!canAccessProtectedRoute(resolvedSession)) {
        setBrowserPath('/login', true);
      }
    } catch {
      setSessionCheckError(
        'Your session could not be verified because the server is temporarily unavailable.',
      );
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setLoginPending(true);

    try {
      const result = await sessionClient.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (!result.ok) {
        setLoginError(result.error.message);
        return;
      }

      setLoginPassword('');
      completeLogin(result.data.session);
    } catch {
      setLoginError('Sign in is temporarily unavailable. Try again.');
    } finally {
      setLoginPending(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoginError(null);
      setLoginPending(true);
      try {
        const result = await sessionClient.loginWithGoogleCredential(
          credential,
          inviteTokenFromPath(loginReturnPath) ?? undefined,
        );
        if (!result.ok) {
          setLoginError(result.error.message);
          return;
        }
        completeLogin(result.data.session);
      } catch {
        setLoginError('Google sign-in is temporarily unavailable. Try again.');
      } finally {
        setLoginPending(false);
      }
    },
    [completeLogin, sessionClient],
  );

  const handlePasskeyLogin = useCallback(async () => {
    setLoginError(null);
    setLoginPending(true);
    try {
      const result = await loginWithPasskey();
      if (!result.ok) {
        setLoginError(result.error.message);
        return;
      }
      completeLogin(result.data.session);
    } finally {
      setLoginPending(false);
    }
  }, [completeLogin]);

  const handleAppleSignIn = useCallback(() => {
    window.location.assign('/api/auth/apple/start');
  }, []);

  const handleSignOut = async () => {
    setLogoutError(null);
    setLogoutPending(true);
    if (session !== undefined) {
      setActiveSession(getUnauthenticatedSession());
      setBrowserPath('/login', true);
      setLogoutPending(false);
      return;
    }
    try {
      const response = await sessionClient.logout();
      setActiveSession(response.session);
      setSessionCheckError(null);
      setBrowserPath('/login', true);
    } catch {
      setLogoutError('Sign out could not be confirmed. You are still signed in; retry to finish signing out.');
    } finally {
      setLogoutPending(false);
    }
  };

  const handleNavigate = (href: string) => {
    setBrowserPath(href);
  };

  if (activeSession === null) {
    return (
      <ThemePresetProvider
        initialPresetName={getStoredThemePreset()}
        preferenceClient={loginPreferenceClient}
      >
        <SessionSplash
          error={sessionCheckError}
          onRetry={() => void refreshActiveSession()}
        />
      </ThemePresetProvider>
    );
  }

  if (!canAccessProtectedRoute(activeSession)) {
    return (
      <ThemePresetProvider
        initialPresetName={getStoredThemePreset()}
        preferenceClient={loginPreferenceClient}
      >
        <LoginPage
          appleEnabled={appleEnabled}
          email={loginEmail}
          error={loginError}
          googleClientId={googleClientId}
          inviteMode={Boolean(loginReturnPath)}
          onEmailChange={setLoginEmail}
          onGoogleCredential={handleGoogleCredential}
          onAppleSignIn={handleAppleSignIn}
          onPasskeyLogin={handlePasskeyLogin}
          onPasswordChange={setLoginPassword}
          onRetry={() => void refreshActiveSession()}
          onSubmit={(event) => void handleLogin(event)}
          password={loginPassword}
          pending={loginPending}
          passkeyEnabled={passkeyEnabled}
          showRetry={session === undefined}
        />
      </ThemePresetProvider>
    );
  }

  return (
    <ThemePresetProvider preferenceClient={preferenceClient}>
      <GlobalNotificationsProvider squadClient={appSquadClient}>
        <>
          {logoutError ? <div className="auth-logout-error" role="alert"><span>{logoutError}</span><button disabled={logoutPending} onClick={() => void handleSignOut()} type="button">{logoutPending ? 'Retrying…' : 'Retry sign out'}</button></div> : null}
          <AppShell
            currentPath={currentPath}
            onNavigate={handleNavigate}
            onSignOut={() => void handleSignOut()}
            session={activeSession}
          >
            <AppRouteContent
              activeSession={activeSession}
              currentPath={currentPath}
              dashboardClient={dashboardClient}
              fdrClient={fdrClient}
              leagueClient={leagueClient}
              managerDeskClient={managerDeskClient}
              onNavigate={handleNavigate}
              onSignOut={() => void handleSignOut()}
              squadClient={squadClient}
              teamSelectionClient={teamSelectionClient}
            />
          </AppShell>
          <GlobalNavigation currentPath={currentPath} onNavigate={handleNavigate} />
        </>
      </GlobalNotificationsProvider>
    </ThemePresetProvider>
  );
}

function inviteTokenFromPath(path: string | null): string | null {
  if (!path?.startsWith('/join/')) return null;
  const token = path.replace(/^\/join\//, '').split('/')[0];
  return token ? decodeURIComponent(token) : null;
}

interface AppRouteContentProps {
  activeSession: SessionState;
  currentPath: string;
  dashboardClient?: DashboardClient;
  fdrClient?: FdrClient;
  leagueClient?: LeagueClient;
  managerDeskClient?: ManagerDeskClient;
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

function AppRouteContent({
  activeSession,
  currentPath,
  dashboardClient,
  fdrClient,
  leagueClient,
  managerDeskClient,
  onNavigate,
  onSignOut,
  squadClient,
  teamSelectionClient,
}: AppRouteContentProps) {
  const { attackDirection, preset } = useThemePreset();
  const activeRouteKey = getPageRouteKey(currentPath);
  const [routePaths, setRoutePaths] = useState<Record<string, string>>(() => ({
    [activeRouteKey]: currentPath,
  }));
  const previousRouteKey = useRef(activeRouteKey);
  const scrollPositions = useRef(new Map<string, number>());

  useEffect(() => activateDataRoute(activeRouteKey), [activeRouteKey]);

  // Browser history restoration runs before async page data exists. On a
  // fresh app mount that can restore a stale offset into the loading state,
  // then move the page again when the Desk content expands. SPA navigation
  // owns scroll restoration below, so disable the browser's competing policy
  // and start every app load at the top.
  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    try {
      window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
    } catch {
      // Isolated DOM environments may not implement scrollTo.
    }

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  // Keep the last path for each page identity. This lets nested page paths
  // (for example League fixtures/table) share one mounted page instance.
  useEffect(() => {
    setRoutePaths((current) => {
      if (current[activeRouteKey] === currentPath) return current;
      return { ...current, [activeRouteKey]: currentPath };
    });
  }, [activeRouteKey, currentPath]);

  // Remember each page's scroll position while it is active and restore it
  // before the browser paints when the user returns to that page.
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current.set(activeRouteKey, window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeRouteKey]);

  useLayoutEffect(() => {
    const previousKey = previousRouteKey.current;
    if (previousKey === activeRouteKey) return;

    scrollPositions.current.set(previousKey, window.scrollY);
    previousRouteKey.current = activeRouteKey;
    const targetScrollTop = scrollPositions.current.get(activeRouteKey) ?? 0;
    try {
      window.scrollTo({ behavior: 'auto', left: 0, top: targetScrollTop });
    } catch {
      // Isolated DOM environments may not implement scrollTo.
    }
  }, [activeRouteKey]);

  const renderRouteContent = (path: string) => {
    let routeContent = (
      <ManagerDeskPage
        deskClient={managerDeskClient}
        leagueClient={leagueClient}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        session={activeSession}
        squadClient={squadClient}
        teamSelectionClient={teamSelectionClient}
      />
    );

    if (path.startsWith('/account') || path.startsWith('/profile')) {
      routeContent = <ProfilePage currentPath={path} onNavigate={onNavigate} session={activeSession} />;
    }

    if (path === '/account/result-colours' || path === '/profile/result-colours') {
      routeContent = <ResultColourProfilePage onNavigate={onNavigate} />;
    }

    if (path.startsWith('/rules')) {
      routeContent = <RulesWorkspacePage anchor={window.location.hash} onNavigate={onNavigate} preset={preset} />;
    }

    if (path.startsWith('/league')) {
      routeContent = <LeaguePage attackDirection={attackDirection} currentPath={path} leagueClient={leagueClient} onNavigate={onNavigate} session={activeSession} squadClient={squadClient} teamSelectionClient={teamSelectionClient} />;
    }

    if (path.startsWith('/join/')) {
      routeContent = <LeagueInvitePage currentPath={path} leagueClient={leagueClient} onNavigate={onNavigate} session={activeSession} />;
    }

    const checkpointMatch = path.match(/^\/modernisation\/checkpoint-([1-5])$/);
    if (checkpointMatch) {
      routeContent = activeSession.engineeringPreviewsEnabled === true
        ? <ModernisationCheckpointPage checkpoint={Number(checkpointMatch[1]) as 1 | 2 | 3 | 4 | 5} onNavigate={onNavigate} />
        : <main aria-labelledby="preview-unavailable-title" className="feature-screen"><h1 id="preview-unavailable-title">Preview unavailable</h1><p>This engineering preview is not enabled for this environment.</p></main>;
    }

    if (path.startsWith('/dashboard/analytics') || path.startsWith('/analytics')) {
      routeContent = <Suspense fallback={<LazyRouteLoading label="Loading Analytics" />}><AnalyticsDashboardPage dashboardClient={dashboardClient} onNavigate={onNavigate} /></Suspense>;
    }

    if (path === '/dashboard' || path === '/team' || path === '/') {
      routeContent = (
        <ManagerDeskPage
          deskClient={managerDeskClient}
          leagueClient={leagueClient}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          session={activeSession}
          squadClient={squadClient}
          teamSelectionClient={teamSelectionClient}
        />
      );
    }

    if (path.startsWith('/fdr')) {
      routeContent = <Suspense fallback={<LazyRouteLoading label="Loading FDR" />}><FixtureDifficultyPage fdrClient={fdrClient} onNavigate={onNavigate} /></Suspense>;
    }

    if (path.startsWith('/scouting')) {
      routeContent = <MarketPage currentPath={path} onNavigate={onNavigate} preset={preset} />;
    }

    const playerProfileMatch = path.match(/^\/players\/([^/]+)$/);
    if (playerProfileMatch) {
      routeContent = (
        <PlayerProfilePage
          onNavigate={onNavigate}
          playerId={decodeURIComponent(playerProfileMatch[1])}
          squadClient={squadClient}
          teamSelectionClient={teamSelectionClient}
        />
      );
    }

    if (isSquadRoute(path)) {
      routeContent = <SquadWorkspacePage attackDirection={attackDirection} onNavigate={onNavigate} preset={preset} squadClient={squadClient} teamSelectionClient={teamSelectionClient} />;
    }

    if (!isSupportedRoute(path)) {
      routeContent = <main aria-labelledby="route-not-found-title" className="feature-screen"><h1 id="route-not-found-title">Page not found</h1><p>This address is not a supported destination.</p><a href="/dashboard" onClick={(event) => { event.preventDefault(); onNavigate('/dashboard'); }}>Go to Desk</a></main>;
    }

    return routeContent;
  };

  const pathsToRender = { ...routePaths, [activeRouteKey]: currentPath };
  return (
    <div className="app-route-cache">
      {Object.entries(pathsToRender).map(([routeKey, path]) => {
        const isActive = routeKey === activeRouteKey;
        return (
          <div
            aria-hidden={isActive ? undefined : true}
            className="app-route-cache__entry"
            data-route-key={routeKey}
            hidden={!isActive}
            key={routeKey}
          >
            {renderRouteContent(path)}
          </div>
        );
      })}
    </div>
  );
}

function LazyRouteLoading({ label }: { label: string }) {
  return <main aria-label={label} className="feature-screen" role="status"><p>{label}…</p></main>;
}
