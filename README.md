# qwen-omni-mcp

An [MCP](https://modelcontextprotocol.io) server that gives Claude Code and other AI agents **video and image understanding** via [Bailian (DashScope)](https://platform.qianwenai.com) using the multimodal **Qwen3.7-Plus** model.

Qwen3.7-Plus reads video natively — **no client-side frame extraction**. You pass a public media URL; the model does the rest.

## Highlights

- **Native video understanding** — send a video URL, get grounded analysis
- **Image understanding** — describe, Q&A, OCR
- **Convenience tools** — summarize, text extraction, frame comparison, Q&A
- **npx-launchable** — one line in your MCP client config
- **Hardened** — secret-leak pre-commit guard + gitleaks, strict TypeScript, full CI

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

| Tool                    | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `analyze_video`         | Analyze a video URL with a custom prompt       |
| `analyze_image`         | Analyze an image URL with a custom prompt      |
| `summarize_video`       | Brief / standard / detailed summary            |
| `extract_video_text`    | Extract on-screen text and transcribe speech   |
| `video_qa`              | Ask a specific question about a video          |
| `compare_video_frames`  | Analyze changes and progression across a video |
| `check_endpoint_status` | Show configured endpoint/model (key redacted)  |
| `list_capabilities`     | List server capabilities and supported formats |

Media must be reachable via a public `http`/`https` URL. Large local videos should be hosted at a public URL (base64 data URLs over ~10MB will be rejected).

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
