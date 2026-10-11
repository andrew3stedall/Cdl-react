import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerCdlWebMcp } from './webmcp';

describe('registerCdlWebMcp', () => {
  afterEach(() => {
    delete document.modelContext;
    vi.restoreAllMocks();
  });

  it('registers the shared catalogue and calls the authenticated browser endpoint', async () => {
    const registered: Array<{
      name: string;
      execute: (args: Record<string, unknown>) => Promise<unknown>;
    }> = [];
    document.modelContext = {
      registerTool: vi.fn(async (tool) => {
        registered.push(tool);
      }),
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tools: [{ name: 'get_my_squad', description: 'Read squad', inputSchema: { type: 'object' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ structuredContent: { data: { players: [] }, page: {} } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const cleanup = registerCdlWebMcp();
    await vi.waitFor(() => expect(registered).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/webmcp/tools',
      expect.objectContaining({ credentials: 'include' }),
    );
    const result = await registered[0].execute({});
    expect(result).toEqual({ data: { players: [] }, page: {} });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/webmcp/tools/get_my_squad',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    cleanup();
  });

  it('does not fetch or register tools when the browser has no WebMCP implementation', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const cleanup = registerCdlWebMcp();
    expect(fetchMock).not.toHaveBeenCalled();
    cleanup();
  });
});
