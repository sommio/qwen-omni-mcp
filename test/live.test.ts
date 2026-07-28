import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/bailian.js";
import { loadConfig } from "../src/config.js";

const LIVE = process.env.LIVE === "1" && !!process.env.DASHSCOPE_API_KEY;
const LOCAL_ASSET_DIR = "/home/sommio/Downloads/test10-v3/cat_dialogue_10/cat_dialogue_000001";
const BUNDLED_SAMPLE = join(import.meta.dirname, "fixtures", "sample.png");

describe.skipIf(!LIVE)("live: Bailian image understanding", () => {
  it("analyzes a bundled image via base64 data URL (CI-safe)", async () => {
    const cfg = loadConfig();
    const buf = readFileSync(BUNDLED_SAMPLE);
    const url = `data:image/png;base64,${buf.toString("base64")}`;
    const r = await analyze(cfg, {
      kind: "image",
      url,
      prompt: "Describe this image in one sentence.",
      maxTokens: 128,
    });
    expect(r.answer.length).toBeGreaterThan(0);
  }, 60_000);

  it("analyzes a local cat image (local-only; skipped if asset missing)", async () => {
    const asset = join(LOCAL_ASSET_DIR, "图1.png");
    if (!existsSync(asset)) {
      console.warn(`[live] local asset missing: ${asset}, skipping.`);
      return;
    }
    const cfg = loadConfig();
    const buf = readFileSync(asset);
    const url = `data:image/png;base64,${buf.toString("base64")}`;
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
  it("analyzes a local video (local-only; skipped if missing or >10MB — host a public URL instead)", async () => {
    const asset = join(LOCAL_ASSET_DIR, "video.mp4");
    if (!existsSync(asset)) {
      console.warn(`[live] local video missing: ${asset}, skipping.`);
      return;
    }
    const cfg = loadConfig();
    const buf = readFileSync(asset);
    if (buf.length > 10_000_000) {
      // 14MB video -> ~19MB base64 body, exceeds typical request limits.
      // For large local videos, host at a public URL and pass that instead.
      console.warn(
        `[live] video is ${String(buf.length)} bytes; too large for base64 data URL, skipping.`,
      );
      return;
    }
    const url = `data:video/mp4;base64,${buf.toString("base64")}`;
    const r = await analyze(cfg, {
      kind: "video",
      url,
      prompt: "Describe what happens in this video. What animals appear?",
      maxTokens: 256,
    });
    expect(r.answer.length).toBeGreaterThan(0);
  }, 120_000);
});
