import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/bailian.js";
import { loadConfig } from "../src/config.js";
import { resolveMedia } from "../src/media.js";

const LIVE = process.env.LIVE === "1" && !!process.env.DASHSCOPE_API_KEY;
const LOCAL_ASSET_DIR =
  process.env.QWEN_LIVE_ASSET_DIR ??
  "/home/sommio/Downloads/2026-07-08-01-test10_V1_fix1/cat_dialogue_10/cat_dialogue_000001";
const BUNDLED_SAMPLE = join(import.meta.dirname, "fixtures", "sample.png");

function skipIfMissing(asset: string): boolean {
  if (existsSync(asset)) return false;
  console.warn(`[live] local asset missing: ${asset}, skipping.`);
  return true;
}

describe.skipIf(!LIVE)("live: Bailian image understanding", () => {
  it("analyzes a bundled image through resolveMedia (self-contained smoke test)", async () => {
    const cfg = loadConfig();
    const url = await resolveMedia(BUNDLED_SAMPLE, "image");
    expect(url).toMatch(/^data:image\/png;base64,/);
    const r = await analyze(cfg, {
      kind: "image",
      url,
      prompt: "Describe this image in one sentence.",
      maxTokens: 128,
    });
    expect(r.answer.length).toBeGreaterThan(0);
  }, 60_000);

  it("analyzes a local image through resolveMedia (local-only; skipped if asset missing)", async () => {
    const asset = join(LOCAL_ASSET_DIR, "图1.jpg");
    if (skipIfMissing(asset)) return;
    const cfg = loadConfig();
    const url = await resolveMedia(asset, "image");
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
    const r = await analyze(cfg, {
      kind: "image",
      url,
      prompt: "What kind of cat is shown? Answer in one short sentence.",
      maxTokens: 128,
    });
    expect(r.answer.length).toBeGreaterThan(0);
  }, 60_000);
});

describe.skipIf(!LIVE)("live: Bailian video understanding", () => {
  it("analyzes a local 14MB video through resolveMedia (local-only; skipped if asset missing)", async () => {
    const asset = join(LOCAL_ASSET_DIR, "video.mp4");
    if (skipIfMissing(asset)) return;
    const cfg = loadConfig();
    // resolveMedia enforces the 25MB guardrail and validates the MP4 magic
    // bytes before base64-encoding — this exercises the full local-file path.
    const url = await resolveMedia(asset, "video");
    expect(url).toMatch(/^data:video\/mp4;base64,/);
    const r = await analyze(cfg, {
      kind: "video",
      url,
      prompt: "Describe what happens in this video. What animals appear?",
      maxTokens: 256,
    });
    expect(r.answer.length).toBeGreaterThan(0);
  }, 180_000);
});
