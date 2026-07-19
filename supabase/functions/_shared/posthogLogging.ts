/**
 * Shared server-side PostHog capture for AI OpenAI calls.
 * Used by: supabase/functions/ai-agents, workspace-synthesize, workspace-ai-chat
 *
 * Replicates the event shape already used in ai-agents so all three functions
 * emit comparable, queryable `ai_openai_call` / `ai_openai_call_failed` events.
 *
 * Properties contain ONLY metadata (IDs, token counts, cost, model, timing).
 * No workspace content, chat text, or decision text is ever included — safe to
 * query and share internally without touching customer data governance.
 *
 * Fail-safe: any error inside this helper is swallowed (logged to console at
 * worst) and never breaks or delays the user-facing response.
 */

const POSTHOG_KEY = Deno.env.get("POSTHOG_KEY");
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") || "https://eu.i.posthog.com";

// Current gpt-5.5 pricing (USD per 1M tokens).
// Update if OpenAI pricing changes.
const PRICE_INPUT_PER_M = 1.25;
const PRICE_OUTPUT_PER_M = 10;

function usdCost(promptTokens: number | null, completionTokens: number | null): number {
  const p = promptTokens ?? 0;
  const c = completionTokens ?? 0;
  return (p / 1_000_000) * PRICE_INPUT_PER_M + (c / 1_000_000) * PRICE_OUTPUT_PER_M;
}

function phCaptureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  if (!POSTHOG_KEY) return;
  try {
    const body = JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId,
      properties: { ...(properties ?? {}), source: "edge_function" },
      timestamp: new Date().toISOString(),
    });
    const promise = fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {});
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil) {
      (EdgeRuntime as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(promise);
    }
  } catch {
    /* no-op */
  }
}

export interface AiCallLogInput {
  /** Distinct id for PostHog (user id, or "workspace_<id>" when no user). */
  distinctId: string;
  /** Workspace UUID. */
  workspaceId: string;
  /** Function name, e.g. "workspace-synthesize". */
  functionName: string;
  /** Granular call site, e.g. "main_synthesis", "agent_3", "title". */
  callSite: string;
  /** Model name, e.g. "gpt-5.5". */
  model: string;
  /** OpenAI response usage object (prompt_tokens / completion_tokens / total_tokens). */
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  /** max_completion_tokens requested. */
  maxCompletionTokens?: number;
  /** Whether JSON mode was requested. */
  jsonMode?: boolean;
  /** Latency of the call in ms. */
  latencyMs: number;
  /** Status: "succeeded" | "errored" | "timeout" | "token_cap". */
  status: "succeeded" | "errored" | "timeout" | "token_cap";
  /** HTTP status code (when available). */
  httpStatus?: number;
}

/** Log a successful or failed OpenAI call with the standard event shape. */
export function logAiOpenAICall(input: AiCallLogInput) {
  const promptTokens = input.usage?.prompt_tokens ?? null;
  const completionTokens = input.usage?.completion_tokens ?? null;
  const totalTokens = input.usage?.total_tokens ?? null;
  const event = input.status === "succeeded" ? "ai_openai_call" : "ai_openai_call_failed";
  phCaptureServer(event, input.distinctId, {
    function: input.functionName,
    call_site: input.callSite,
    workspace_id: input.workspaceId,
    model: input.model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    max_completion_tokens: input.maxCompletionTokens ?? null,
    json_mode: input.jsonMode ?? false,
    latency_ms: input.latencyMs,
    status: input.status,
    http_status: input.httpStatus ?? null,
    cost_usd: usdCost(promptTokens, completionTokens),
  });
}
