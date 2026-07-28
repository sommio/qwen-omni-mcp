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
import {
  SUMMARY_MAX_TOKENS,
  SUMMARY_PROMPTS,
  TEXT_EXTRACTION_PROMPT,
  qaPrompt,
  comparePrompt,
  DEFAULT_COMPARE_PROMPT,
} from "./prompts.js";

const MAX_TOKENS_DEFAULT_VIDEO = 1024;
const MAX_TOKENS_DEFAULT_IMAGE = 512;

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
    const result = await analyze(cfg, { kind, url, prompt, maxTokens });
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
        "Analyze a video via URL using Qwen3.7-Plus (multimodal). The model reads the video natively — no client-side frame extraction. URL must be publicly reachable (http/https).",
      inputSchema: {
        video_url: z.string().url().describe("Public URL of the video to analyze"),
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
        "Analyze an image via URL using Qwen3.7-Plus (multimodal). URL must be publicly reachable (http/https).",
      inputSchema: {
        image_url: z.string().url().describe("Public URL of the image to analyze"),
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
    "summarize_video",
    {
      description:
        "Generate a summary of a video. Styles: brief (1-2 sentences), standard (1-2 paragraphs), detailed (comprehensive timeline).",
      inputSchema: {
        video_url: z.string().url().describe("Public URL of the video to summarize"),
        style: z
          .enum(["brief", "standard", "detailed"])
          .default("standard")
          .describe("Summary style"),
      },
    },
    async (args) =>
      mediaCall(
        cfg,
        "video",
        args.video_url,
        SUMMARY_PROMPTS[args.style],
        SUMMARY_MAX_TOKENS[args.style],
      ),
  );

  server.registerTool(
    "extract_video_text",
    {
      description:
        "Extract and transcribe visible text or speech from a video (on-screen text, captions, speech, slide text).",
      inputSchema: {
        video_url: z.string().url().describe("Public URL of the video"),
      },
    },
    async (args) => mediaCall(cfg, "video", args.video_url, TEXT_EXTRACTION_PROMPT, 1024),
  );

  server.registerTool(
    "video_qa",
    {
      description: "Ask a specific question about a video's content.",
      inputSchema: {
        video_url: z.string().url().describe("Public URL of the video"),
        question: z.string().describe("Your specific question about the video"),
      },
    },
    async (args) => mediaCall(cfg, "video", args.video_url, qaPrompt(args.question), 512),
  );

  server.registerTool(
    "compare_video_frames",
    {
      description:
        "Analyze changes and progression across a video (before/after, movement, progression of events).",
      inputSchema: {
        video_url: z.string().url().describe("Public URL of the video"),
        comparison_prompt: z
          .string()
          .default(DEFAULT_COMPARE_PROMPT)
          .describe("What to compare across the video"),
      },
    },
    async (args) =>
      mediaCall(cfg, "video", args.video_url, comparePrompt(args.comparison_prompt), 1024),
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

  server.registerTool(
    "list_capabilities",
    {
      description: "List the capabilities of this MCP server.",
    },
    () =>
      ok(
        JSON.stringify(
          {
            model: cfg.model,
            backend: "Bailian (DashScope) OpenAI-compatible endpoint",
            capabilities: [
              "Video understanding (native, no frame extraction)",
              "Image understanding",
              "Video summarization",
              "Video Q&A",
              "Text extraction from video",
              "Scene change / progression analysis",
            ],
            supported_formats: {
              video: ["mp4", "webm", "mov", "avi", "mkv"],
              image: ["jpg", "jpeg", "png", "gif", "webp", "bmp"],
            },
            notes: [
              "Media must be reachable via public http/https URL",
              "Video frame sampling is handled by Bailian server-side (fixed 0.5s/frame on OpenAI-compatible mode)",
            ],
          },
          null,
          2,
        ),
      ),
  );

  return server;
}

export { loadConfig, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_TIMEOUT_SECONDS };
