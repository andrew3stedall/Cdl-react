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

type AIProvider = 'chatgpt' | 'claude';
interface AISetupProgress { provider: AIProvider; step: 1 | 2 | 3 }
const AI_SETUP_STORAGE_KEY = 'cdl:ai-connection-setup';

function readAISetupProgress(): AISetupProgress | null {
  try {
    const saved = window.sessionStorage.getItem(AI_SETUP_STORAGE_KEY);
    if (!saved) return null;
    const value = JSON.parse(saved) as Partial<AISetupProgress>;
    if ((value.provider === 'chatgpt' || value.provider === 'claude')
      && (value.step === 1 || value.step === 2 || value.step === 3)) {
      return { provider: value.provider, step: value.step };
    }
  } catch {
    // Storage can be unavailable in private browsing; setup still works in memory.
  }
  return null;
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
  const [setup, setSetup] = useState<AISetupProgress | null>(() => readAISetupProgress());
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
  useEffect(() => {
    try {
      if (setup) window.sessionStorage.setItem(AI_SETUP_STORAGE_KEY, JSON.stringify(setup));
      else window.sessionStorage.removeItem(AI_SETUP_STORAGE_KEY);
    } catch {
      // Keep progress in memory when browser storage is unavailable.
    }
  }, [setup]);

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
        {!setup ? (
          <Card className="profile-settings-card ai-connection-setup">
            <div className="ai-connection-setup__heading"><Bot aria-hidden="true" size={20} /><strong>Choose your assistant</strong></div>
            <p>Connect from the assistant using CDL’s remote MCP server. Start with read access; you can review requested permissions before approving them.</p>
            <div className="ai-provider-choices">
              <Button className="ai-provider-choice" onClick={() => setSetup({ provider: 'chatgpt', step: 1 })} type="button" variant="secondary">ChatGPT</Button>
              <Button className="ai-provider-choice" onClick={() => setSetup({ provider: 'claude', step: 1 })} type="button" variant="secondary">Claude</Button>
            </div>
            <p className="ai-connection-setup__note">No automatic installation is available for every account. This guide shows the manual setup when needed.</p>
          </Card>
        ) : (
          <Card className="profile-settings-card ai-connection-setup" aria-label={`${setup.provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} connection setup`}>
            <div className="ai-onboarding-progress">
              <strong>{setup.provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} setup</strong>
              <span>Step {setup.step} of 3</span>
            </div>
            <progress aria-label="Connection setup progress" max={3} value={setup.step} />
            {setup.provider === 'chatgpt' && setup.step === 1 ? (
              <div className="ai-onboarding-instructions">
                <h3>Check ChatGPT access</h3>
                <p>Custom MCP apps are set up from ChatGPT on the web, not from the mobile app.</p>
                <ul>
                  <li>ChatGPT Pro supports read-only MCP connections.</li>
                  <li>Full MCP, including write actions, is currently for Business, Enterprise, and Edu workspaces.</li>
                  <li>ChatGPT Plus is not currently listed as supporting custom MCP apps.</li>
                </ul>
                <p>If your account does not show Apps or Developer mode, you cannot add this staging connector from that account yet.</p>
              </div>
            ) : null}
            {setup.provider === 'claude' && setup.step === 1 ? (
              <div className="ai-onboarding-instructions">
                <h3>Open Claude Connectors</h3>
                <p>Use Claude on the web or desktop. Custom remote MCP connectors are available on supported Claude plans; check the current <a href="https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities" rel="noreferrer" target="_blank">Claude connector guide</a> if the Custom option is missing.</p>
                <p>If you are on your phone, continue the setup from a desktop browser. You can copy the server URL in the next step.</p>
              </div>
            ) : null}
            {setup.step === 2 ? (
              <div className="ai-onboarding-instructions">
                <h3>Add CDL as a remote MCP server</h3>
                {setup.provider === 'chatgpt' ? (
                  <ol>
                    <li>In ChatGPT web, open <strong>Settings → Apps → Create</strong>. If prompted, enable Developer mode.</li>
                    <li>Name the app “Castle Draft League” and paste the CDL server URL below.</li>
                    <li>Choose OAuth, scan the tools, and begin with read-only actions where the account allows action controls.</li>
                  </ol>
                ) : (
                  <ol>
                    <li>In Claude, open <strong>Customize → Connectors → Add → Custom → Web</strong>.</li>
                    <li>Name the connector “Castle Draft League” and paste the CDL server URL below.</li>
                    <li>Continue with OAuth and review the connection details.</li>
                  </ol>
                )}
                <div className="ai-mcp-url">
                  <code aria-label="CDL MCP server URL">{mcpUrl}</code>
                  <Button aria-label="Copy MCP URL" onClick={() => void copyUrl()} type="button" variant="secondary">
                    {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                    {copied ? 'Copied' : 'Copy URL'}
                  </Button>
                </div>
                <p className="ai-connection-setup__note">The URL is staging-only. Do not paste a CDL password or signing secret into the assistant.</p>
              </div>
            ) : null}
            {setup.step === 3 ? (
              <div className="ai-onboarding-instructions">
                <h3>Sign in and verify the connection</h3>
                <ol>
                  <li>When the assistant opens CDL, sign in to your CDL account in the browser.</li>
                  <li>Review the OAuth consent screen. Grant only the permissions you want this connection to have.</li>
                  <li>Return here and refresh Connected assistants. Confirm the assistant appears with the expected permissions.</li>
                </ol>
                <p>Start with a read-only request, such as “Show my CDL team summary.” Consequential actions still require a separate 60-minute activation and approval.</p>
              </div>
            ) : null}
            <div className="ai-onboarding-actions">
              <Button onClick={() => setup.step === 1 ? setSetup(null) : setSetup({ ...setup, step: (setup.step - 1) as 1 | 2 | 3 })} type="button" variant="ghost">{setup.step === 1 ? 'Choose another assistant' : 'Back'}</Button>
              {setup.step < 3 ? <Button onClick={() => setSetup({ ...setup, step: (setup.step + 1) as 1 | 2 | 3 })} type="button">Continue</Button> : <Button onClick={() => { setSetup(null); void load(); }} type="button">Finish and check connection</Button>}
            </div>
          </Card>
        )}
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
