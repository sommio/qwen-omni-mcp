import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  type AppConfig,
  loadConfig,
  redactKey,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_SECONDS,
} from "./config.js";
import { analyze, BailianError, type MediaKind } from "./bailian.js";
import { isRemoteUrl, isLocalPath, resolveMedia } from "./media.js";

const MAX_TOKENS_DEFAULT_VIDEO = 1024;
const MAX_TOKENS_DEFAULT_IMAGE = 512;

/**
 * Accepts either a public http/https URL or a local file path. Remote URLs are
 * fetched by DashScope; local paths are read and sent inline as base64 data
 * URLs (see `resolveMedia`). Relaxes the previous `z.string().url()` so callers
 * can pass local files without a separate field — the field name and string
 * type are unchanged, so existing MCP clients keep working.
 */
const mediaInput = (description: string) =>
  z
    .string()
    .refine((v) => isRemoteUrl(v) || isLocalPath(v), "Must be a public URL or a local file path")
    .describe(description);

function ok(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: false };
}

function fail(err: unknown): CallToolResult {
  let message: string;
  if (err instanceof BailianError) {
    const detail = err.detail === undefined ? "" : ` | ${JSON.stringify(err.detail)}`;
    message = `${err.message}${detail}`;
  } else if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err);
  }
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

async function mediaCall(
  cfg: AppConfig,
  kind: MediaKind,
  url: string,
  prompt: string,
  maxTokens: number,
): Promise<CallToolResult> {
  try {
    const resolved = await resolveMedia(url, kind);
    const result = await analyze(cfg, { kind, url: resolved, prompt, maxTokens });
    return ok(result.answer);
  } catch (err) {
    return fail(err);
  }
}

export function createServer(cfg: AppConfig = loadConfig()): McpServer {
  const server = new McpServer({
    name: "qwen-omni-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "analyze_video",
    {
      description:
        "Analyze a video using Qwen3.7-Plus (multimodal). The model reads the video natively — no client-side frame extraction. Pass a public URL (http/https) or a local file path; local files are sent inline as a base64 data URL (25MB guardrail).",
      inputSchema: {
        video_url: mediaInput("Public URL or local file path of the video to analyze"),
        question: z
          .string()
          .default("Describe what happens in this video in detail.")
          .describe("Question or prompt about the video"),
        max_tokens: z
          .number()
          .int()
          .positive()
          .default(MAX_TOKENS_DEFAULT_VIDEO)
          .describe("Maximum tokens in the response"),
      },
    },
    async (args) => mediaCall(cfg, "video", args.video_url, args.question, args.max_tokens),
  );

  server.registerTool(
    "analyze_image",
    {
      description:
        "Analyze an image using Qwen3.7-Plus (multimodal). Pass a public URL (http/https) or a local file path; local files are sent inline as a base64 data URL (25MB guardrail).",
      inputSchema: {
        image_url: mediaInput("Public URL or local file path of the image to analyze"),
        question: z
          .string()
          .default("Describe this image in detail.")
          .describe("Question or prompt about the image"),
        max_tokens: z
          .number()
          .int()
          .positive()
          .default(MAX_TOKENS_DEFAULT_IMAGE)
          .describe("Maximum tokens in the response"),
      },
    },
    async (args) => mediaCall(cfg, "image", args.image_url, args.question, args.max_tokens),
  );

  server.registerTool(
    "check_endpoint_status",
    {
      description:
        "Check the configured Bailian endpoint, model, and timeout. The API key is redacted in the output.",
    },
    () =>
      ok(
        JSON.stringify(
          {
            status: "configured",
            base_url: cfg.baseUrl,
            model: cfg.model,
            api_key: redactKey(cfg.apiKey),
            timeout_seconds: cfg.timeoutMs / 1000,
          },
          null,
          2,
        ),
      ),
  );

  return server;
}

export { loadConfig, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_TIMEOUT_SECONDS };
