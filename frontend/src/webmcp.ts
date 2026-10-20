import { invalidateData } from './data-freshness';

type JsonSchema = Record<string, unknown>;

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    consequentialHint?: boolean;
    untrustedContentHint?: boolean;
  };
}

interface ModelContext {
  registerTool(
    tool: WebMcpTool & {
      execute: (
        args: Record<string, unknown>,
        context?: { signal?: AbortSignal },
      ) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ): Promise<void>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

/** Registers the same registry-backed tools as the remote MCP endpoint when WebMCP is available. */
export function registerCdlWebMcp(): () => void {
  const modelContext = document.modelContext;
  if (!modelContext || window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    return () => undefined;
  }

  const controllers: AbortController[] = [];
  let cancelled = false;

  void fetch('/webmcp/tools', { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(async (response) => {
        if (!response.ok) return null;
      return (await response.json()) as { tools: WebMcpTool[] };
    })
    .then(async (catalogue) => {
      if (cancelled || !catalogue) return;
      for (const tool of catalogue.tools) {
        const controller = new AbortController();
        controllers.push(controller);
        await modelContext.registerTool(
          {
            ...tool,
            execute: async (arguments_, context) => {
              const signal = context?.signal
                ? AbortSignal.any([controller.signal, context.signal])
                : controller.signal;
              const response = await fetch(`/webmcp/tools/${encodeURIComponent(tool.name)}`, {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify(arguments_),
                signal,
              });
              const result = await response.json();
              if (!response.ok || result.isError) {
                throw new Error(result.detail ?? result.content?.[0]?.text ?? 'The CDL tool failed.');
              }
              if (!tool.annotations?.readOnlyHint) invalidateData(['global']);
              return result.structuredContent ?? result;
            },
          },
          { signal: controller.signal },
        );
      }
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    for (const controller of controllers) controller.abort();
  };
}
