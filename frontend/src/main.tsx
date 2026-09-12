import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { registerLeagueFixtureDeskPolish } from './league-fixture-desk-polish';
import { registerPwaServiceWorker } from './pwa';
import type { SessionState } from './contracts';
import {
  staticPreviewDashboardClient,
  staticPreviewFdrClient,
  staticPreviewLeagueClient,
  staticPreviewPreferenceClient,
  staticPreviewSquadClient,
  staticPreviewTeamSelectionClient,
} from './static-preview-clients';
import './styles.css';
import './application-shell.css';
import './squad-management-responsive.css';
import './login-page.css';
import './squad-page-a11y.css';
import './manager-desk-fixture-layout.css';
import './result-colours.css';
import './league-fixture-desk-polish.css';
import './page-layout.css';

function getInitialPath() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = window.location.pathname;

  if (baseUrl && pathname.startsWith(baseUrl)) {
    return pathname.slice(baseUrl.length) || '/';
  }

  return pathname;
}

registerPwaServiceWorker();
registerLeagueFixtureDeskPolish();

const staticPreviewSession: SessionState = {
  isAuthenticated: true,
  user: {
    id: 'demo-manager',
    email: 'manager@example.com',
    displayName: 'CDL Manager',
    roles: ['manager'],
  },
  expiresAt: null,
};

const appProps = import.meta.env.VITE_STATIC_PREVIEW
  ? {
      dashboardClient: staticPreviewDashboardClient,
      fdrClient: staticPreviewFdrClient,
      leagueClient: staticPreviewLeagueClient,
      preferenceClient: staticPreviewPreferenceClient,
      session: staticPreviewSession,
      squadClient: staticPreviewSquadClient,
      teamSelectionClient: staticPreviewTeamSelectionClient,
    }
  : {};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App initialPath={getInitialPath()} {...appProps} />
  </React.StrictMode>,
);
