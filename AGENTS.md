# AGENTS.md — Rules for AI agents working on this repo

Hard rules. Follow exactly. These exist to keep agents from shipping broken or leaky code.

## Secrets (highest priority)

- **Never commit secrets, API keys, tokens, or `.env` files.** Keys live only in `.env` (gitignored) or environment variables.
- **Never hardcode a key in source, tests, configs, or docs.** Read it from `DASHSCOPE_API_KEY` via `src/config.ts`.
- **Never paste a real key into a fixture.** Tests use dummy values (`sk-test`, `sk-secret-key-…`). The pre-commit `check-secrets.mjs` blocks `sk-ws-…` (real Bailian keys); don't try to evade it.
- If you accidentally stage a secret: unstage it, rotate the key immediately, and tell the maintainer.

## Git hooks — never bypass

- **Never use `git commit --no-verify` or `git push --no-verify`.** Hooks run secret scan, lint, format, type-check, and tests for a reason.
- If a hook fails, fix the cause. Do not work around it.
- After first clone: run `npm install` (the `prepare` script installs husky hooks). Verify with `git config core.hooksPath` → `.husky`.

## Quality gates — all must pass before push

Run these locally before considering work done:

```bash
npm run typecheck   # tsc --noEmit, strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
npm run lint        # eslint, typescript-eslint strictTypeChecked, --max-warnings 0
npm run format:check
npm test            # vitest, unit + mocked e2e (live tests auto-skip without LIVE=1)
npm run build       # tsc -p tsconfig.build.json -> dist/
```

CI runs the same on Node 20 and 22. Local green ≠ CI green if you skip a step.

## Code standards

- **TypeScript strict.** No `any` in `src/` (allowed sparingly in `test/` for fixture typing). No `@ts-ignore`. No non-null assertions in `src/`.
- Prefer narrow types and `unknown` over `any` when parsing external JSON (see `src/bailian.ts`).
- The DashScope payload builder (`buildPayload`) is intentionally injectable — if the `video_url`/`image_url` content block shape changes, change it in one place.
- Do not add a new runtime, language, or heavy dependency without explicit maintainer approval.
- Match existing style; let `prettier` and `eslint --fix` handle formatting.

## Tool surface

The server exposes 8 MCP tools (see `src/server.ts`): `analyze_video`, `analyze_image`, `summarize_video`, `extract_video_text`, `video_qa`, `compare_video_frames`, `check_endpoint_status`, `list_capabilities`. Do not silently change a tool's name or argument schema — that breaks MCP clients. Add new tools rather than renaming.

`check_endpoint_status` must redact the API key (`redactKey`). There is a test asserting no key leaks — keep it passing.

## Backend

- Endpoint: Bailian (DashScope) OpenAI-compatible mode, `${DASHSCOPE_BASE_URL}/chat/completions` (default `https://dashscope.aliyuncs.com/compatible-mode/v1`).
- Model: `qwen3.7-plus` (multimodal, native video — **no client-side frame extraction**).
- The Anthropic-compatible `/apps/anthropic` endpoint does NOT support video input. Do not switch to it for multimodal tools.
- Video frame sampling is server-side (fixed 0.5s/frame on OpenAI-compatible mode). Do not add frame extraction logic.

## Testing

- Unit + mocked e2e use **msw** to mock `fetch` — no real API calls, no cost. Keep it that way.
- Live tests (`test/live.test.ts`) run only with `LIVE=1` and a real `DASHSCOPE_API_KEY`. They hit the real API and cost tokens. Run locally to verify behavior; never make them part of the default `npm test`.
- Every new tool or branch of logic gets a test. Coverage threshold is 85%.

## Filesystem

- Delete files with `trash`, never `rm` (per global policy).
- `ref/` is vendored reference material — read-only, do not modify, do not import from.

## Fragile assumptions (verify before relying on)

1. The OpenAI-compatible endpoint accepts a `video_url` content block for `qwen3.7-plus`. If a live call rejects it, the fallback is the native DashScope `video` content type or switching to `qwen-vl-max-latest`. Change `contentBlock()` in `src/bailian.ts`.
2. The exact model id string `qwen3.7-plus`. Verify against the Bailian model list if a call returns a model-not-found error.
3. Local files up to the 25MB guardrail in `src/media.ts` can be sent as base64 data URLs — verified live (14MB video / ~18MB body, HTTP 200 on `qwen3.7-plus` OpenAI-compatible mode). Larger files must be hosted at a public URL. Local input is validated by extension + magic-byte signature before encoding (see `toDataUrl`).
