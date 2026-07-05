import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import {
  staticPreviewDashboardClient,
  staticPreviewFdrClient,
  staticPreviewLeagueClient,
  staticPreviewPreferenceClient,
} from './static-preview-clients';
import './styles.css';

function getInitialPath() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = window.location.pathname;

  if (baseUrl && pathname.startsWith(baseUrl)) {
    return pathname.slice(baseUrl.length) || '/';
  }

  return pathname;
}

const appProps = import.meta.env.VITE_STATIC_PREVIEW
  ? {
      dashboardClient: staticPreviewDashboardClient,
      fdrClient: staticPreviewFdrClient,
      leagueClient: staticPreviewLeagueClient,
      preferenceClient: staticPreviewPreferenceClient,
    }
  : {};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App initialPath={getInitialPath()} {...appProps} />
  </React.StrictMode>,
);
