import type { AppConfig } from "./config.js";

export type MediaKind = "video" | "image";

export interface AnalyzeParams {
  kind: MediaKind;
  url: string;
  prompt: string;
  maxTokens: number;
}

export interface AnalyzeResult {
  answer: string;
  model: string;
}

export type BailianErrorStatus = number | "timeout" | "network" | "parse" | "empty";

export class BailianError extends Error {
  constructor(
    message: string,
    public readonly status: BailianErrorStatus,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "BailianError";
  }
}

interface ChatChoice {
  message?: { content?: string };
}

interface ChatResponse {
  choices?: ChatChoice[];
  model?: string;
  error?: { message?: string; code?: string };
}

export function contentBlock(kind: MediaKind, url: string): Record<string, unknown> {
  if (kind === "video") {
    return { type: "video_url", video_url: { url } };
  }
  return { type: "image_url", image_url: { url } };
}

export function buildPayload(cfg: AppConfig, params: AnalyzeParams): Record<string, unknown> {
  return {
    model: cfg.model,
    max_tokens: params.maxTokens,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: params.prompt }, contentBlock(params.kind, params.url)],
      },
    ],
  };
}

function chatCompletionsUrl(cfg: AppConfig): string {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  return `${base}/chat/completions`;
}

export async function analyze(cfg: AppConfig, params: AnalyzeParams): Promise<AnalyzeResult> {
  const url = chatCompletionsUrl(cfg);
  const body = JSON.stringify(buildPayload(cfg, params));
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, cfg.timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new BailianError("Request timed out", "timeout");
    }
    throw new BailianError("Network error contacting Bailian", "network", err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => undefined);
    }
    throw new BailianError(`Bailian HTTP ${String(res.status)}`, res.status, detail);
  }

  let data: ChatResponse;
  try {
    const json: unknown = await res.json();
    data = json as ChatResponse;
  } catch (err) {
    throw new BailianError("Invalid JSON in Bailian response", "parse", err);
  }

  if (data.error) {
    throw new BailianError(data.error.message ?? "Bailian returned an error", "empty", data.error);
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new BailianError("Bailian response had no text content", "empty", data);
  }

  return { answer: content, model: data.model ?? cfg.model };
}
