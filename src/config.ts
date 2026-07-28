import "dotenv/config";

export interface AppConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

export const DEFAULT_MODEL = "qwen3.7-plus";
export const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const DEFAULT_TIMEOUT_SECONDS = 300;

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  return {
    apiKey: required("DASHSCOPE_API_KEY"),
    model: process.env.QWEN_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: process.env.DASHSCOPE_BASE_URL?.trim() || DEFAULT_BASE_URL,
    timeoutMs: positiveInt("QWEN_REQUEST_TIMEOUT", DEFAULT_TIMEOUT_SECONDS) * 1000,
  };
}

export function redactKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
