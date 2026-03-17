/**
 * LangSmith Tracing Utility for Edge Functions
 *
 * Lightweight REST-based tracing — no SDK needed (Deno-compatible).
 * Gated on LANGSMITH_API_KEY env var — no-op if missing.
 *
 * Usage:
 *   const startTime = Date.now();
 *   const message = await anthropic.messages.create({ ... });
 *   const endTime = Date.now();
 *
 *   traceClaudeCall({
 *     name: "generate_feedback",
 *     sessionId: body.session_id,
 *     input: { model: "claude-sonnet-4-20250514", messages: [...], max_tokens: 4096 },
 *     output: { content: message.content },
 *     startTime,
 *     endTime,
 *     tokens: { input: message.usage.input_tokens, output: message.usage.output_tokens },
 *     tags: ["edge-function", "feedback"],
 *   });
 */

const LANGSMITH_API_KEY = Deno.env.get("LANGSMITH_API_KEY");
const LANGSMITH_ENDPOINT =
  Deno.env.get("LANGSMITH_ENDPOINT") || "https://api.smith.langchain.com";
const LANGSMITH_PROJECT =
  Deno.env.get("LANGCHAIN_PROJECT") || "live-roleplay";

interface TraceParams {
  name: string;
  sessionId?: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startTime: number;
  endTime: number;
  tokens?: { input: number; output: number };
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Send a trace run to LangSmith REST API (fire-and-forget).
 * Non-blocking — errors are logged but never thrown.
 */
export function traceClaudeCall(params: TraceParams): void {
  if (!LANGSMITH_API_KEY) return;

  const runId = crypto.randomUUID();

  const body = {
    id: runId,
    name: params.name,
    run_type: "llm",
    inputs: params.input,
    outputs: params.output,
    start_time: new Date(params.startTime).toISOString(),
    end_time: new Date(params.endTime).toISOString(),
    extra: {
      metadata: {
        session_id: params.sessionId,
        component: params.name,
        ...params.metadata,
      },
      ...(params.tokens && {
        tokens: {
          total_tokens: params.tokens.input + params.tokens.output,
          prompt_tokens: params.tokens.input,
          completion_tokens: params.tokens.output,
        },
      }),
    },
    tags: params.tags || [],
    session_name: params.sessionId || undefined,
    project_name: LANGSMITH_PROJECT,
  };

  // Fire-and-forget — do not await
  fetch(`${LANGSMITH_ENDPOINT}/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": LANGSMITH_API_KEY,
    },
    body: JSON.stringify(body),
  }).catch((e) => {
    console.warn("LangSmith trace failed (non-blocking):", e);
  });
}
