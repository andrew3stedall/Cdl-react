import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, test, vi } from 'vitest';

import { AIConnectionsPage } from './AIConnectionsPage';
import type { AIConnectionsClient, AIExecutionGrant } from './ai-connections-api';
import type { SessionState } from './contracts';

const session: SessionState = {
  isAuthenticated: true,
  user: { id: 'manager-1', email: 'manager@example.com', displayName: 'Manager', roles: ['manager'] },
  expiresAt: null,
};

function clientMock(): AIConnectionsClient {
  let activeGrant: AIExecutionGrant | null = null;
  return {
    listConnections: vi.fn().mockResolvedValue([{
      id: 'connection-1', client_id: 'chatgpt', client_name: 'ChatGPT', scopes: ['cdl:read', 'cdl:write'],
      created_at: '2026-10-10T12:00:00Z', last_used_at: '2026-10-11T12:00:00Z',
    }]),
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

    expect(container.textContent).toContain('Remote MCP');
    expect(container.textContent).toContain(`${window.location.origin}/mcp`);
    expect(container.textContent).toContain('ChatGPT');
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

  test('reports unavailable connection APIs accessibly', async () => {
    const client = clientMock();
    vi.mocked(client.listConnections).mockRejectedValue(new Error('AI connections are disabled.'));
    const { container, root } = await render(client);

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('AI connections are disabled.');
    await act(async () => root.unmount());
    container.remove();
  });
});
