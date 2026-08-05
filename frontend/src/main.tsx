import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import type { SessionState } from './contracts';
import {
  staticPreviewDashboardClient,
  staticPreviewFdrClient,
  staticPreviewLeagueClient,
  staticPreviewPreferenceClient,
  staticPreviewTeamSelectionClient,
} from './static-preview-clients';
import './styles.css';
import './application-shell.css';
import './squad-management-responsive.css';
import './login-page.css';

function getInitialPath() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = window.location.pathname;

  if (baseUrl && pathname.startsWith(baseUrl)) {
    return pathname.slice(baseUrl.length) || '/';
  }

  return pathname;
}

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
      teamSelectionClient: staticPreviewTeamSelectionClient,
    }
  : {};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App initialPath={getInitialPath()} {...appProps} />
  </React.StrictMode>,
);
