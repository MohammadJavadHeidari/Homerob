import "server-only";

/**
 * Minimal OpenAI-compatible chat client. Gemini, DeepSeek and OpenAI all speak this
 * protocol, so switching providers is just `AI_PROVIDER` (+ its key) in the env.
 */

export type ProviderName = "mock" | "gemini" | "deepseek" | "openai";

interface ProviderConfig {
  baseUrl: string;
  keyEnv: string;
  /** Tried in order; later models are fallbacks for rate limits / overload. */
  models: string[];
}

const PROVIDERS: Record<Exclude<ProviderName, "mock">, ProviderConfig> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    // Free tier is flaky (503s / hangs), so several models are raced (see `chatJson`).
    models: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash"],
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    keyEnv: "DEEPSEEK_API_KEY",
    models: ["deepseek-flash"],
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
    models: ["gpt-5-mini"],
  },
};

export class AIError extends Error {
  constructor(
    message: string,
    /** Worth trying the next model (rate limit, overload, retired model, bad output). */
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** Which provider is active. Falls back to `mock` when the key is missing. */
export function activeProvider(): ProviderName {
  const name = (process.env.AI_PROVIDER ?? "mock").trim().toLowerCase();
  if (name === "mock" || !(name in PROVIDERS)) return "mock";
  const cfg = PROVIDERS[name as keyof typeof PROVIDERS];
  return process.env[cfg.keyEnv] ? (name as ProviderName) : "mock";
}

export interface ChatJsonOptions {
  system: string;
  user: string;
  temperature?: number;
  /** Start the next model in parallel if the current one hasn't answered after this long. */
  hedgeMs?: number;
  /** Give up on everything after this long. */
  deadlineMs?: number;
}

/**
 * Ask the active provider for a JSON object. Hedged: models start one after another every
 * `hedgeMs` (or immediately when one fails), and the first valid answer wins.
 */
export async function chatJson(opts: ChatJsonOptions): Promise<{ data: unknown; model: string }> {
  const provider = activeProvider();
  if (provider === "mock") throw new AIError("mock provider has no LLM");
  const cfg = PROVIDERS[provider];
  const key = process.env[cfg.keyEnv]!;
  const models = process.env.AI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? cfg.models;
  const hedgeMs = opts.hedgeMs ?? 1_500;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new AIError("deadline exceeded")), opts.deadlineMs ?? 5_000);

  try {
    return await new Promise((resolve, reject) => {
      const errors: string[] = [];
      let started = 0;
      let finished = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const startNext = () => {
        clearTimeout(timer);
        if (started >= models.length || controller.signal.aborted) return;
        const model = models[started++];
        callModel(cfg.baseUrl, key, model, opts, controller.signal).then(
          (data) => resolve({ data, model }),
          (err) => {
            errors.push(err instanceof Error ? err.message : String(err));
            finished++;
            if (err instanceof AIError && !err.retryable) return reject(err);
            if (finished === models.length) return reject(new AIError(errors.join(" | ")));
            startNext(); // failed fast → don't wait for the hedge timer
          },
        );
        timer = setTimeout(startNext, hedgeMs);
      };

      controller.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new AIError(`deadline exceeded (${errors.join(" | ") || "no response"})`));
      });
      startNext();
    });
  } finally {
    clearTimeout(deadline);
    controller.abort(); // cancel the losers
  }
}

async function callModel(
  baseUrl: string,
  key: string,
  model: string,
  opts: ChatJsonOptions,
  signal: AbortSignal,
): Promise<unknown> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text();
    // 429 / 5xx / 404 (model retired) → another model may work; other 4xx won't get better.
    const retryable = res.status === 429 || res.status >= 500 || res.status === 404;
    throw new AIError(`${model}: HTTP ${res.status} ${body.slice(0, 160)}`, retryable);
  }
  const json = await res.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new AIError(`${model}: empty response`, true);
  try {
    return JSON.parse(stripFences(content));
  } catch {
    throw new AIError(`${model}: invalid JSON`, true);
  }
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
