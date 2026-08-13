import { type FormEvent, useCallback, useEffect, useState } from 'react';

import {
  canAccessProtectedRoute,
  defaultSessionClient,
  getUnauthenticatedSession,
  type SessionClient,
} from './auth';
import { AppShell } from './AppShell';
import { AnalyticsDashboardPage } from './AnalyticsDashboardPage';
import type { RuleSection, SessionState } from './contracts';
import type { DashboardClient } from './dashboard-api';
import { FixtureDifficultyPage } from './FixtureDifficultyPage';
import type { FdrClient } from './fdr-api';
import { GlobalNavigation } from './GlobalNavigation';
import { LeaguePage } from './LeaguePage';
import type { LeagueClient } from './league-api';
import { LoginPage } from './LoginPage';
import { MarketPage } from './MarketPage';
import { ManagerDeskPage } from './ManagerDeskPage';
import { ModernisationCheckpointPage } from './ModernisationCheckpointPage';
import { isSquadRoute } from './navigation';
import type { PreferenceClient } from './preferences-api';
import { ProfilePage } from './ProfilePage';
import { RulesPage } from './RulesPage';
import { SquadWorkspacePage } from './SquadWorkspacePage';
import type { SquadClient } from './squad-api';
import type { TeamSelectionClient } from './team-selection-api';
import { ThemePresetProvider, useThemePreset } from './theme-preset-provider';

const rulesVersion = {
  version: '2026.05',
  effectiveDate: '2026-05-22',
  status: 'active',
  source: 'docs/features/active/rules-knowledge-base.md',
};

const featuredRules: RuleSection[] = [
  {
    id: 'squad-size',
    title: 'Squad Size',
    category: 'squads',
    summary: 'Squads must remain within approved roster limits.',
    body: ['Validation errors should link to this stable rule identifier.'],
    tags: ['squad', 'validation'],
    anchors: ['squad-size'],
    relatedRuleIds: ['transfer-deadline'],
    version: rulesVersion,
  },
  {
    id: 'trade-window',
    title: 'Trade Window',
    category: 'trades',
    summary: 'Trades are only valid during configured trade windows.',
    body: ['Trade proposals can only be accepted while the trade window is open.'],
    tags: ['trades', 'commissioner'],
    anchors: ['trade-window'],
    relatedRuleIds: ['commissioner-decisions'],
    version: rulesVersion,
  },
  {
    id: 'lineup-validation',
    title: 'Lineup Validation',
    category: 'squads',
    summary: 'Lineups must satisfy starter, bench, reserve, and captaincy rules.',
    body: ['Team selection validation links to this stable rule identifier.'],
    tags: ['team-selection', 'validation'],
    anchors: ['lineup-validation'],
    relatedRuleIds: ['chip-usage', 'captaincy'],
    version: rulesVersion,
  },
  {
    id: 'chip-usage',
    title: 'Chip Usage',
    category: 'squads',
    summary: 'Only one unused chip can be active at a time.',
    body: ['Used chips cannot be reactivated.'],
    tags: ['chips', 'team-selection'],
    anchors: ['chip-usage'],
    relatedRuleIds: ['lineup-validation'],
    version: rulesVersion,
  },
];

interface AppProps {
  dashboardClient?: DashboardClient;
  fdrClient?: FdrClient;
  initialPath?: string;
  leagueClient?: LeagueClient;
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
  preferenceClient,
  session,
  sessionClient = defaultSessionClient,
  squadClient,
  teamSelectionClient,
}: AppProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [activeSession, setActiveSession] = useState<SessionState | null>(session ?? null);
  const [sessionCheckError, setSessionCheckError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

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

  const setBrowserPath = (href: string, replace = false) => {
    try {
      if (replace) {
        window.history.replaceState({}, '', href);
      } else {
        window.history.pushState({}, '', href);
      }
    } catch {
      // Browser history can be unavailable in isolated DOM tests.
    }
    setCurrentPath(href);
  };

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

      setSessionCheckError(null);
      setLoginPassword('');
      setBrowserPath('/', true);
      setActiveSession(result.data.session);
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
        const result = await sessionClient.loginWithGoogleCredential(credential);
        if (!result.ok) {
          setLoginError(result.error.message);
          return;
        }
        setSessionCheckError(null);
        setBrowserPath('/', true);
        setActiveSession(result.data.session);
      } catch {
        setLoginError('Google sign-in is temporarily unavailable. Try again.');
      } finally {
        setLoginPending(false);
      }
    },
    [sessionClient],
  );

  const handleSignOut = async () => {
    setActiveSession(null);
    setSessionCheckError(null);
    setBrowserPath('/login', true);
    if (session !== undefined) {
      setActiveSession(getUnauthenticatedSession());
      return;
    }
    try {
      const response = await sessionClient.logout();
      setActiveSession(response.session);
    } catch {
      setActiveSession(getUnauthenticatedSession());
    }
  };

  const handleNavigate = (href: string) => {
    setBrowserPath(href);
  };

  const handleRefresh = () => {
    void refreshActiveSession();
  };

  if (activeSession === null) {
    return (
      <main className="session-boundary" aria-label="Protected route session state">
        <h1>Castle Draft League</h1>
        {sessionCheckError ? (
          <div className="login-required" role="alert">
            <p>{sessionCheckError}</p>
            <button onClick={() => void refreshActiveSession()} type="button">
              Retry session check
            </button>
          </div>
        ) : (
          <div className="login-required" role="status">
            Checking your session…
          </div>
        )}
      </main>
    );
  }

  if (!canAccessProtectedRoute(activeSession)) {
    return (
      <LoginPage
        email={loginEmail}
        error={loginError}
        googleClientId={googleClientId}
        onEmailChange={setLoginEmail}
        onGoogleCredential={handleGoogleCredential}
        onPasswordChange={setLoginPassword}
        onRetry={() => void refreshActiveSession()}
        onSubmit={(event) => void handleLogin(event)}
        password={loginPassword}
        pending={loginPending}
        showRetry={session === undefined}
      />
    );
  }

  return (
    <ThemePresetProvider preferenceClient={preferenceClient}>
      <>
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
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            onSignOut={() => void handleSignOut()}
            squadClient={squadClient}
            teamSelectionClient={teamSelectionClient}
          />
        </AppShell>
        <GlobalNavigation currentPath={currentPath} onNavigate={handleNavigate} />
      </>
    </ThemePresetProvider>
  );
}

interface AppRouteContentProps {
  activeSession: SessionState;
  currentPath: string;
  dashboardClient?: DashboardClient;
  fdrClient?: FdrClient;
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
  onRefresh: () => void;
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
  onNavigate,
  onRefresh,
  onSignOut,
  squadClient,
  teamSelectionClient,
}: AppRouteContentProps) {
  const { attackDirection, preset } = useThemePreset();
  let routeContent = (
    <ManagerDeskPage
      leagueClient={leagueClient}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      session={activeSession}
      squadClient={squadClient}
      teamSelectionClient={teamSelectionClient}
    />
  );

  if (currentPath.startsWith('/account') || currentPath.startsWith('/profile')) {
    routeContent = <ProfilePage onRefresh={onRefresh} onSignOut={onSignOut} session={activeSession} />;
  }

  if (currentPath.startsWith('/rules')) {
    routeContent = <RulesPage categories={['squads', 'trades']} sections={featuredRules} preset={preset} />;
  }

  if (currentPath.startsWith('/league')) {
    routeContent = <LeaguePage attackDirection={attackDirection} currentPath={currentPath} leagueClient={leagueClient} onNavigate={onNavigate} squadClient={squadClient} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-1')) {
    routeContent = <ModernisationCheckpointPage />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-2')) {
    routeContent = <ModernisationCheckpointPage checkpoint={2} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-3')) {
    routeContent = <ModernisationCheckpointPage checkpoint={3} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-4')) {
    routeContent = <ModernisationCheckpointPage checkpoint={4} />;
  }

  if (currentPath.startsWith('/modernisation/checkpoint-5')) {
    routeContent = <ModernisationCheckpointPage checkpoint={5} />;
  }

  if (currentPath.startsWith('/dashboard/analytics') || currentPath.startsWith('/analytics')) {
    routeContent = <AnalyticsDashboardPage dashboardClient={dashboardClient} />;
  }

  if (currentPath === '/dashboard' || currentPath === '/') {
    routeContent = (
      <ManagerDeskPage
        leagueClient={leagueClient}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        session={activeSession}
        squadClient={squadClient}
        teamSelectionClient={teamSelectionClient}
      />
    );
  }

  if (currentPath.startsWith('/fdr')) {
    routeContent = <FixtureDifficultyPage fdrClient={fdrClient} />;
  }

  if (currentPath.startsWith('/scouting')) {
    routeContent = <MarketPage currentPath={currentPath} onNavigate={onNavigate} preset={preset} />;
  }

  if (isSquadRoute(currentPath)) {
    routeContent = <SquadWorkspacePage attackDirection={attackDirection} preset={preset} teamSelectionClient={teamSelectionClient} />;
  }

  return routeContent;
}
