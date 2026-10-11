import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Check, Copy, ExternalLink, Shield, Timer, Unplug } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { GlobalPageHeader } from './components/ui/global-notifications';
import type { SessionState } from './contracts';
import {
  httpAIConnectionsClient,
  type AIActivityEvent,
  type AIConnection,
  type AIConnectionsClient,
  type AIGrantStatus,
} from './ai-connections-api';
import './profile-page.css';

interface AIConnectionsPageProps {
  onNavigate: (href: string) => void;
  session: SessionState;
  client?: AIConnectionsClient;
}

interface ConnectionView {
  connection: AIConnection;
  grant: AIGrantStatus | null;
}

const BROWSER_CLIENT_NAME = 'Browser WebMCP';

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function displayOutcome(outcome: string): string {
  return outcome.replaceAll('_', ' ');
}

export function AIConnectionsPage({ onNavigate, session, client = httpAIConnectionsClient }: AIConnectionsPageProps) {
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [activity, setActivity] = useState<AIActivityEvent[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const browserConnectionId = session.user?.id ? `browser:${session.user.id}` : null;
  const mcpUrl = useMemo(() => `${window.location.origin}/mcp`, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActivityError(null);
    try {
      const rows = await client.listConnections();
      const events = await client.listActivity().catch((cause: unknown) => {
        setActivityError(cause instanceof Error ? cause.message : 'Activity is currently unavailable.');
        return [];
      });
      const withBrowser = browserConnectionId
        ? [{ id: browserConnectionId, client_id: 'browser', client_name: BROWSER_CLIENT_NAME, scopes: ['cdl:read', 'cdl:write'], created_at: new Date().toISOString(), last_used_at: null }, ...rows]
        : rows;
      const views = await Promise.all(withBrowser.map(async (connection) => {
        try {
          return { connection, grant: await client.getGrant(connection.id) };
        } catch {
          return { connection, grant: null };
        }
      }));
      setConnections(views);
      setActivity(events);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load AI connections.');
    } finally {
      setLoading(false);
    }
  }, [browserConnectionId, client]);

  useEffect(() => { void load(); }, [load]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the MCP URL. Select and copy it manually.');
    }
  };

  const activate = async (id: string) => {
    setPending(id);
    setMessage(null);
    try {
      await client.activateGrant(id);
      setMessage('Execution window active for 60 minutes.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not activate execution window.');
    } finally {
      setPending(null);
    }
  };

  const revokeGrant = async (id: string) => {
    setPending(id);
    try {
      await client.revokeGrant(id);
      setMessage('Execution window ended.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not end execution window.');
    } finally {
      setPending(null);
    }
  };

  const revokeConnection = async (id: string) => {
    setPending(id);
    try {
      await client.revokeConnection(id);
      setConfirmRevoke(null);
      setMessage('Assistant connection revoked.');
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not revoke assistant connection.');
    } finally {
      setPending(null);
    }
  };

  return (
    <main aria-labelledby="ai-connections-title" className="feature-screen profile-page profile-page--subpage ai-connections-page">
      <GlobalPageHeader className="profile-page__header profile-page__header--subpage" onNavigate={onNavigate}>
        <button className="profile-subpage-back" onClick={() => onNavigate('/profile')} type="button">Profile</button>
        <p className="eyebrow">Profile</p>
        <h1 id="ai-connections-title">AI connections</h1>
      </GlobalPageHeader>

      <section aria-labelledby="mcp-setup-title" className="profile-settings-group">
        <h2 id="mcp-setup-title">Connect an assistant</h2>
        <Card className="profile-settings-card ai-connection-setup">
          <div className="ai-connection-setup__heading"><Bot aria-hidden="true" size={20} /><strong>Remote MCP</strong></div>
          <p>Use this URL in a compatible ChatGPT or Claude MCP connector. Sign in to CDL and review the requested read or write permissions during setup.</p>
          <div className="ai-mcp-url">
            <code aria-label="CDL MCP server URL">{mcpUrl}</code>
            <Button aria-label="Copy MCP URL" onClick={() => void copyUrl()} type="button" variant="secondary">
              {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
              {copied ? 'Copied' : 'Copy URL'}
            </Button>
          </div>
          <p className="ai-connection-setup__note">The connection starts from the assistant. CDL does not receive or store your assistant account credentials.</p>
        </Card>
      </section>

      <section aria-labelledby="connected-assistants-title" className="profile-settings-group">
        <div className="ai-section-heading">
          <h2 id="connected-assistants-title">Connected assistants</h2>
          <Button disabled={loading} onClick={() => void load()} type="button" variant="ghost">Refresh</Button>
        </div>
        {loading ? <p aria-live="polite" className="ai-page-status">Loading connections…</p> : null}
        {error ? <p aria-live="assertive" className="ai-page-status ai-page-status--error" role="alert">{error}</p> : null}
        {!loading && !error && connections.length === 0 ? <Card className="ai-empty-state">No assistants are connected.</Card> : null}
        <div className="ai-connection-list">
          {connections.map(({ connection, grant }) => {
            const isBrowser = connection.id === browserConnectionId;
            const isActive = Boolean(grant?.active && grant.grant);
            const canRevokeConnection = !isBrowser;
            return (
              <Card className="ai-connection-card" key={connection.id}>
                <div className="ai-connection-card__top">
                  <span aria-hidden="true" className="ai-connection-card__icon">{isBrowser ? <Shield size={19} /> : <Bot size={19} />}</span>
                  <div className="ai-connection-card__identity">
                    <h3>{connection.client_name}</h3>
                    <p>{isBrowser ? 'This browser session' : `Connected ${formatDate(connection.created_at)}`}</p>
                  </div>
                  {isActive ? <span className="ai-status-pill ai-status-pill--active">Active</span> : null}
                </div>
                <dl className="ai-connection-details">
                  <div><dt>Permissions</dt><dd>{connection.scopes.length ? connection.scopes.join(', ') : 'None'}</dd></div>
                  {!isBrowser ? <div><dt>Last used</dt><dd>{formatDate(connection.last_used_at)}</dd></div> : null}
                  {isActive && grant?.grant ? <div><dt>Window ends</dt><dd>{formatDate(grant.grant.expires_at)}</dd></div> : null}
                </dl>
                {confirmRevoke === connection.id ? (
                  <div aria-label={`Confirm revoke ${connection.client_name}`} className="ai-connection-confirm" role="group">
                    <span>Revoke this assistant’s CDL access?</span>
                    <Button disabled={pending === connection.id} onClick={() => void revokeConnection(connection.id)} type="button">Confirm revoke</Button>
                    <Button disabled={pending === connection.id} onClick={() => setConfirmRevoke(null)} type="button" variant="secondary">Cancel</Button>
                  </div>
                ) : (
                  <div className="ai-connection-card__actions">
                    {isActive ? (
                      <Button disabled={pending === connection.id} onClick={() => void revokeGrant(connection.id)} type="button" variant="secondary"><Timer aria-hidden="true" size={16} />End window</Button>
                    ) : (
                      <Button disabled={pending === connection.id || !grant} onClick={() => void activate(connection.id)} type="button" variant="secondary"><Timer aria-hidden="true" size={16} />{pending === connection.id ? 'Activating…' : 'Activate 60-minute window'}</Button>
                    )}
                    {canRevokeConnection ? <Button disabled={pending === connection.id} onClick={() => setConfirmRevoke(connection.id)} type="button" variant="ghost"><Unplug aria-hidden="true" size={16} />Revoke</Button> : null}
                  </div>
                )}
                {!grant ? <small className="ai-grant-note">Execution controls are currently unavailable.</small> : null}
              </Card>
            );
          })}
        </div>
        {message ? <p aria-live="polite" className="ai-page-status" role="status">{message}</p> : null}
        <Card className="ai-approval-note">
          <ExternalLink aria-hidden="true" size={18} />
          <p>Consequential actions require an active execution window and a separate approval for the exact action. Open the CDL approval link returned by your assistant to review or reject it.</p>
        </Card>
      </section>

      <section aria-labelledby="ai-activity-title" className="profile-settings-group">
        <div className="ai-section-heading"><h2 id="ai-activity-title">Recent AI activity</h2><Activity aria-hidden="true" size={17} /></div>
        {!loading && !error && activity.length === 0 ? <Card className="ai-empty-state">No AI activity yet.</Card> : null}
        <div className="ai-activity-list">
          {activityError ? <p aria-live="polite" className="ai-page-status">Activity history is currently unavailable.</p> : null}
          {activity.map((event) => (
            <Card className="ai-activity-card" key={event.id}>
              <div><strong>{event.tool_name.replaceAll('_', ' ')}</strong><span className={`ai-status-pill ai-status-pill--${event.outcome === 'success' ? 'active' : 'muted'}`}>{displayOutcome(event.outcome)}</span></div>
              <p>{event.risk} · {event.connection_id.startsWith('browser:') ? BROWSER_CLIENT_NAME : connections.find((row) => row.connection.id === event.connection_id)?.connection.client_name ?? 'Assistant'}</p>
              <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
