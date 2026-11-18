import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, test, vi } from 'vitest';

import { AI_TEST_PROMPT, AIConnectionsPage } from './AIConnectionsPage';
import type { AIConnectionDiagnostics, AIConnectionStatus, AIConnectionsClient, AIExecutionGrant } from './ai-connections-api';
import type { SessionState } from './contracts';

const session: SessionState = {
  isAuthenticated: true,
  user: { id: 'manager-1', email: 'manager@example.com', displayName: 'Manager', roles: ['manager'] },
  expiresAt: null,
};

const MCP_URL = 'https://staging.cdl.example/mcp';

function status(overrides: Partial<AIConnectionStatus> = {}): AIConnectionStatus {
  return {
    id: 'connection-1', client_id: 'chatgpt', client_name: 'ChatGPT', scopes: ['cdl:read', 'cdl:write'],
    created_at: '2026-10-10T12:00:00Z', last_used_at: '2026-10-11T12:00:00Z', revoked_at: null,
    access_expires_at: '2026-11-10T12:00:00Z', state: 'verified', first_verified_read_at: '2026-10-11T12:00:00Z',
    last_verified_read_at: '2026-10-11T12:00:00Z', last_failure: null,
    ...overrides,
  };
}

function diagnostics(connections: AIConnectionStatus[] = [status()], endpoint: Partial<AIConnectionDiagnostics['endpoint']> = {}): AIConnectionDiagnostics {
  return {
    checked_at: '2026-10-11T12:30:00Z',
    endpoint: { url: MCP_URL, oauth_enabled: true, remote_enabled: true, browser_enabled: true, execution_enabled: true, ...endpoint },
    team_assigned: true,
    connections,
  };
}

function cardFor(container: HTMLElement, name: string): Element | undefined {
  return Array.from(container.querySelectorAll('.ai-connection-card'))
    .find((card) => card.querySelector('h3')?.textContent === name);
}

function buttonIn(scope: ParentNode | undefined, label: string): HTMLButtonElement | undefined {
  return Array.from(scope?.querySelectorAll('button') ?? []).find((button) => button.textContent?.trim() === label);
}

function clientMock(): AIConnectionsClient {
  let activeGrant: AIExecutionGrant | null = null;
  return {
    listConnections: vi.fn().mockResolvedValue([]),
    getDiagnostics: vi.fn().mockResolvedValue(diagnostics()),
    checkConnection: vi.fn().mockResolvedValue(status()),
    revokeConnection: vi.fn().mockResolvedValue(undefined),
    getGrant: vi.fn().mockImplementation(async () => ({ active: Boolean(activeGrant), grant: activeGrant })),
    activateGrant: vi.fn().mockImplementation(async (connectionId: string) => {
      activeGrant = { id: 'grant-1', connection_id: connectionId, activated_at: '2026-10-11T12:00:00Z', expires_at: '2026-10-11T13:00:00Z' };
      return activeGrant;
    }),
    revokeGrant: vi.fn().mockImplementation(async () => { activeGrant = null; }),
    listActivity: vi.fn().mockResolvedValue([{
      id: 'event-1', connection_id: 'connection-1', tool_name: 'squad.get_summary', risk: 'read', outcome: 'success',
      details: {}, created_at: '2026-10-11T12:00:00Z',
    }]),
  };
}

async function render(client: AIConnectionsClient): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AIConnectionsPage client={client} onNavigate={vi.fn()} session={session} />);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
  return { container, root };
}

describe('AIConnectionsPage', () => {
  test('shows the remote endpoint, connection scopes, execution controls and recent activity', async () => {
    const client = clientMock();
    const { container, root } = await render(client);

    expect(container.textContent).toContain('Choose your assistant');
    expect(container.textContent).toContain('ChatGPT');

    const chatgptChoice = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'ChatGPT');
    await act(async () => chatgptChoice?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const continueButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Continue');
    await act(async () => continueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain(MCP_URL);
    expect(container.textContent).not.toContain(`${window.location.origin}/mcp`);
    expect(container.textContent).toContain('Add CDL as a remote MCP server');
    expect(container.textContent).toContain('cdl:read, cdl:write');
    expect(container.textContent).toContain('Browser WebMCP');
    expect(container.textContent).toContain('squad.get summary');
    expect(client.getGrant).toHaveBeenCalledWith('connection-1');

    await act(async () => root.unmount());
    container.remove();
  });

  test('manually activates a 60-minute grant and confirms assistant revocation', async () => {
    const client = clientMock();
    const { container, root } = await render(client);
    const assistantCard = Array.from(container.querySelectorAll('.ai-connection-card'))
      .find((card) => card.querySelector('h3')?.textContent === 'ChatGPT');
    const activate = Array.from(assistantCard?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('Activate 60-minute window'));
    expect(activate).toBeDefined();

    await act(async () => {
      activate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(client.activateGrant).toHaveBeenCalledWith('connection-1');
    expect(container.textContent).toContain('Execution window active for 60 minutes.');
    expect(container.textContent).toContain('Active');

    const revoke = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Revoke');
    await act(async () => revoke?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Revoke this assistant’s CDL access?');
    const confirm = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Confirm revoke');
    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(client.revokeConnection).toHaveBeenCalledWith('connection-1');
    expect(container.textContent).toContain('Assistant connection revoked.');

    await act(async () => root.unmount());
    container.remove();
  });

  test('guides ChatGPT setup with plan limits and resumes saved progress', async () => {
    window.sessionStorage.removeItem('cdl:ai-connection-setup');
    const client = clientMock();
    const first = await render(client);
    const chatgpt = Array.from(first.container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'ChatGPT');
    expect(chatgpt).toBeDefined();

    await act(async () => chatgpt?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(first.container.textContent).toContain('Custom MCP apps are set up from ChatGPT on the web');
    expect(first.container.textContent).toContain('ChatGPT Pro supports read-only MCP connections.');
    expect(first.container.textContent).toContain('ChatGPT Plus is not currently listed');
    const readOnly = first.container.querySelector<HTMLInputElement>('input[name="ai-onboarding-access"][value="read-only"]');
    expect(readOnly?.checked).toBe(true);
    const readWrite = first.container.querySelector<HTMLInputElement>('input[name="ai-onboarding-access"][value="read-write"]');
    await act(async () => {
      readWrite?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(window.sessionStorage.getItem('cdl:ai-connection-setup')).toContain('"access":"read-write"');
    expect(window.sessionStorage.getItem('cdl:ai-connection-setup')).toContain('"provider":"chatgpt"');

    await act(async () => first.root.unmount());
    first.container.remove();

    const resumed = await render(client);
    expect(resumed.container.textContent).toContain('ChatGPT setup');
    expect(resumed.container.textContent).toContain('Step 1 of 3');
    expect(resumed.container.querySelector<HTMLInputElement>('input[name="ai-onboarding-access"][value="read-write"]')?.checked).toBe(true);
    await act(async () => resumed.root.unmount());
    resumed.container.remove();
    window.sessionStorage.removeItem('cdl:ai-connection-setup');
  });

  test('separates authorization from verified remote reads and keeps WebMCP out of verification', async () => {
    const client = clientMock();
    vi.mocked(client.getDiagnostics).mockResolvedValue(diagnostics([
      status(),
      status({ id: 'connection-2', client_name: 'Claude', state: 'authorized', first_verified_read_at: null, last_verified_read_at: null }),
      status({ id: 'connection-3', client_name: 'Other assistant', state: 'check_failed', last_failure: { category: 'permission', observed_at: '2026-10-11T13:00:00Z' } }),
    ]));
    const { container, root } = await render(client);

    const verified = cardFor(container, 'ChatGPT');
    expect(verified?.textContent).toContain('Verified');
    expect(buttonIn(verified, 'Copy test prompt')).toBeUndefined();

    const pending = cardFor(container, 'Claude');
    expect(pending?.textContent).toContain('Pending check');
    expect(pending?.textContent).toContain('Not observed');
    expect(pending?.textContent).toContain(AI_TEST_PROMPT);
    expect(buttonIn(pending, 'Copy test prompt')).toBeDefined();

    const failed = cardFor(container, 'Other assistant');
    expect(failed?.textContent).toContain('Check failed');
    expect(failed?.textContent).toContain('Permission denied');
    expect(buttonIn(failed, 'Reconnect')).toBeDefined();

    const browser = cardFor(container, 'Browser WebMCP');
    expect(browser?.textContent).toContain('Browser only');
    expect(browser?.textContent).not.toContain('Verified');
    expect(buttonIn(browser, 'Check')).toBeUndefined();
    expect(container.querySelector('[aria-label="Connection diagnostics"]')?.textContent).toContain('Assigned');

    await act(async () => root.unmount());
    container.remove();
  });

  test('runs a manual check without polling and updates only that connection', async () => {
    const client = clientMock();
    vi.mocked(client.getDiagnostics).mockResolvedValue(diagnostics([
      status({ state: 'authorized', first_verified_read_at: null, last_verified_read_at: null }),
    ]));
    vi.mocked(client.checkConnection).mockResolvedValue(status({ last_verified_read_at: '2026-10-11T14:00:00Z' }));
    const { container, root } = await render(client);
    expect(cardFor(container, 'ChatGPT')?.textContent).toContain('Pending check');
    expect(client.getDiagnostics).toHaveBeenCalledTimes(1);

    await act(async () => {
      buttonIn(cardFor(container, 'ChatGPT'), 'Check')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(client.checkConnection).toHaveBeenCalledWith('connection-1');
    expect(cardFor(container, 'ChatGPT')?.textContent).toContain('Verified');
    expect(container.textContent).toContain('ChatGPT: Verified.');
    expect(client.getDiagnostics).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();
  });

  test('offers reconnect without broadening access for revoked connections', async () => {
    window.sessionStorage.removeItem('cdl:ai-connection-setup');
    const client = clientMock();
    vi.mocked(client.getDiagnostics).mockResolvedValue(diagnostics([
      status({ client_name: 'Claude', scopes: ['cdl:read'], state: 'revoked', revoked_at: '2026-10-12T09:00:00Z', access_expires_at: null }),
    ]));
    const { container, root } = await render(client);
    const revoked = cardFor(container, 'Claude');
    expect(revoked?.textContent).toContain('Revoked');
    expect(buttonIn(revoked, 'Revoke')).toBeUndefined();
    expect(Array.from(revoked?.querySelectorAll('button') ?? []).some((button) => button.textContent?.includes('Activate'))).toBe(false);
    expect(client.getGrant).not.toHaveBeenCalledWith('connection-1');

    await act(async () => buttonIn(revoked, 'Reconnect')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Claude setup');
    expect(container.textContent).toContain('Step 2 of 3');
    expect(container.querySelector<HTMLInputElement>('input[name="ai-onboarding-access"][value="read-only"]')?.checked).toBe(true);

    await act(async () => root.unmount());
    container.remove();
    window.sessionStorage.removeItem('cdl:ai-connection-setup');
  });

  test('does not show a derived MCP URL when remote MCP is off', async () => {
    window.sessionStorage.setItem('cdl:ai-connection-setup', JSON.stringify({ provider: 'chatgpt', step: 2, access: 'read-only' }));
    const client = clientMock();
    vi.mocked(client.getDiagnostics).mockResolvedValue(diagnostics([], { remote_enabled: false, browser_enabled: false, execution_enabled: false }));
    const { container, root } = await render(client);

    expect(container.textContent).toContain('Remote MCP unavailable.');
    expect(container.querySelector('[aria-label="CDL MCP server URL"]')).toBeNull();
    expect(container.textContent).toContain('No assistants are connected.');
    expect(client.listActivity).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
    window.sessionStorage.removeItem('cdl:ai-connection-setup');
  });

  test('reports unavailable connection APIs accessibly', async () => {
    const client = clientMock();
    vi.mocked(client.getDiagnostics).mockRejectedValue(new Error('AI connections are disabled.'));
    const { container, root } = await render(client);

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('AI connections are disabled.');
    await act(async () => root.unmount());
    container.remove();
  });
});
