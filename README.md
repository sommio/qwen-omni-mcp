# qwen-omni-mcp

An [MCP](https://modelcontextprotocol.io) server that gives Claude Code and other AI agents **video and image understanding** via [Bailian (DashScope)](https://platform.qianwenai.com) using the multimodal **Qwen3.7-Plus** model.

Qwen3.7-Plus reads video natively — **no client-side frame extraction**. Pass a public media URL **or a local file path**; the model does the rest.

## Highlights

- **Native video understanding** — send a video URL or local file, get grounded analysis
- **Image understanding** — describe, Q&A, OCR
- **Local file support** — pass a local path; files are sent inline as base64 data URLs (25MB guardrail)
- **Convenience tools** — summarize, text extraction, frame comparison, Q&A
- **npx-launchable** — one line in your MCP client config

## Install

No global install needed. Run directly with npx:

```bash
npx -y qwen-omni-mcp
```

For local development:

```bash
git clone <this-repo>
cd qwen-omni-mcp
npm install            # also installs husky git hooks
cp .env.example .env   # fill in DASHSCOPE_API_KEY
npm run dev            # run from source via tsx
```

## Configuration

All config is via environment variables (loaded from `.env` by `dotenv`):

| Variable               | Required | Default                                             | Description                    |
| ---------------------- | -------- | --------------------------------------------------- | ------------------------------ |
| `DASHSCOPE_API_KEY`    | yes      | —                                                   | Bailian API key                |
| `QWEN_MODEL`           | no       | `qwen3.7-plus`                                      | Model id (multimodal)          |
| `DASHSCOPE_BASE_URL`   | no       | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible endpoint     |
| `QWEN_REQUEST_TIMEOUT` | no       | `300`                                               | Per-request timeout in seconds |

Get a key at <https://platform.qianwenai.com/home/api-keys>.

> The Anthropic-compatible `/apps/anthropic` endpoint does **not** support video input, so this server uses the OpenAI-compatible endpoint.

## Use with Claude Code

Add to your MCP client config:

```json
{
  "mcpServers": {
    "qwen-omni-mcp": {
      "command": "npx",
      "args": ["-y", "qwen-omni-mcp"],
      "env": {
        "DASHSCOPE_API_KEY": "your-key"
      }
    }
  }
}
```

For local development without publishing:

```json
{
  "mcpServers": {
    "qwen-omni-mcp": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "env": { "DASHSCOPE_API_KEY": "your-key" }
    }
  }
}
```

## Tools

| Tool                    | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `analyze_video`         | Analyze a video (URL or local file) with a custom prompt  |
| `analyze_image`         | Analyze an image (URL or local file) with a custom prompt |
| `summarize_video`       | Brief / standard / detailed summary                       |
| `extract_video_text`    | Extract on-screen text and transcribe speech              |
| `video_qa`              | Ask a specific question about a video                     |
| `compare_video_frames`  | Analyze changes and progression across a video            |
| `check_endpoint_status` | Show configured endpoint/model (key redacted)             |
| `list_capabilities`     | List server capabilities and supported formats            |

Each media tool accepts a public `http`/`https` URL **or a local file path**. Local files are read and sent inline as base64 data URLs, with a 25MB guardrail (verified up to a 14MB video / ~18MB body, HTTP 200). Files larger than 25MB must be hosted at a public URL instead. Local input is validated by extension + magic-byte signature before encoding, so non-media files are rejected.

## Development

```bash
npm run typecheck     # strict tsc
npm run lint          # eslint, --max-warnings 0
npm run format:check  # prettier
npm test              # unit + mocked e2e (no API cost)
npm run build         # emit dist/
LIVE=1 npm run test:live   # real API calls (costs tokens)
```

CI (`.github/workflows/ci.yml`) runs the same gates on Node 20/22. `secrets-scan.yml` runs gitleaks. `smoke-live.yml` (manual / weekly) runs one real image call.

See [AGENTS.md](AGENTS.md) for the full set of agent rules (never bypass hooks, never commit secrets, etc.).

## License

MIT
