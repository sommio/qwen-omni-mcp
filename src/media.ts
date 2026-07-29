import { readFile, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import { extname } from "node:path";
import type { MediaKind } from "./bailian.js";

const REMOTE_URL_RE = /^https?:\/\//i;

/** A publicly reachable http/https URL (DashScope fetches it server-side). */
export function isRemoteUrl(value: string): boolean {
  return REMOTE_URL_RE.test(value);
}

/** Any non-empty string that is not a remote URL — treated as a local file path. */
export function isLocalPath(value: string): boolean {
  return value.length > 0 && !isRemoteUrl(value);
}

const IMAGE_MIME: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

const VIDEO_MIME: Readonly<Record<string, string>> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};

/**
 * MIME type for a known media extension, or `undefined` for unknown / missing
 * extensions. Returning `undefined` (rather than a defaulted media MIME) lets
 * `toDataUrl` reject non-media files like `.env`, `id_rsa`, or `/etc/passwd`
 * before they are read.
 */
export function mimeFromExt(path: string, kind: MediaKind): string | undefined {
  const ext = extname(path).toLowerCase();
  const table = kind === "video" ? VIDEO_MIME : IMAGE_MIME;
  return table[ext];
}

/**
 * Inline base64 size guardrail. Verified safe up to a 14MB file / ~18MB base64
 * body against the Bailian (DashScope) OpenAI-compatible endpoint; 25MB leaves
 * headroom. Larger local files must be hosted at a public URL instead.
 */
export const MAX_LOCAL_FILE_BYTES = 25 * 1024 * 1024;

function overLimitMessage(size: number, path: string): string {
  return `Local file is ${String(size)} bytes which exceeds the ${String(MAX_LOCAL_FILE_BYTES)} byte limit; host it at a public URL instead: ${path}`;
}

function fourcc(buffer: Buffer, offset: number): string {
  return buffer.toString("ascii", offset, offset + 4);
}

/**
 * Whether a buffer starts with a known media signature for the given kind.
 * Guards against renamed non-media files (e.g. a text secret renamed to
 * `secret.png`) being base64-encoded and shipped to DashScope. Also defeats
 * symlink-to-secret attacks: a symlinked sensitive file's content is not media,
 * so it is rejected here — no separate `lstat` guard is needed (which would
 * otherwise reject legitimate symlinked media files).
 */
function matchesMediaSignature(buffer: Buffer, kind: MediaKind): boolean {
  if (kind === "image") {
    return (
      (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) || // JPEG
      (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) || // PNG
      fourcc(buffer, 0) === "GIF8" || // GIF87a / GIF89a
      (fourcc(buffer, 0) === "RIFF" && fourcc(buffer, 8) === "WEBP") || // WebP
      (buffer[0] === 0x42 && buffer[1] === 0x4d) // BMP
    );
  }
  return (
    fourcc(buffer, 4) === "ftyp" || // MP4 / MOV
    fourcc(buffer, 4) === "moov" ||
    fourcc(buffer, 4) === "mdat" ||
    (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) || // WebM / MKV (EBML)
    (fourcc(buffer, 0) === "RIFF" && fourcc(buffer, 8) === "AVI ") // AVI
  );
}

/** Read a local file and encode it as a `data:` URL for inline transport. */
export async function toDataUrl(path: string, kind: MediaKind): Promise<string> {
  let info: Stats;
  try {
    info = await stat(path);
  } catch (err) {
    throw new Error(`Cannot read local file: ${path}`, { cause: err });
  }
  if (!info.isFile()) {
    throw new Error(`Local path is not a file: ${path}`);
  }
  if (info.size === 0) {
    throw new Error(`Local file is empty: ${path}`);
  }
  if (info.size > MAX_LOCAL_FILE_BYTES) {
    throw new Error(overLimitMessage(info.size, path));
  }
  const mime = mimeFromExt(path, kind);
  if (mime === undefined) {
    throw new Error(`Local file has an unsupported extension for ${kind} input: ${path}`);
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch (err) {
    throw new Error(`Cannot read local file: ${path}`, { cause: err });
  }
  // Authoritative check on the bytes actually read: closes the stat-then-read
  // race where a file grows past the limit between the stat and the read.
  if (buffer.length > MAX_LOCAL_FILE_BYTES) {
    throw new Error(overLimitMessage(buffer.length, path));
  }
  if (!matchesMediaSignature(buffer, kind)) {
    throw new Error(`Local file does not appear to be a valid ${kind} file: ${path}`);
  }
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/**
 * Resolve a media input to a value the Bailian endpoint accepts in a content
 * block `url` field: remote URLs pass through unchanged; local paths become
 * base64 data URLs (with extension + magic-byte validation).
 */
export async function resolveMedia(raw: string, kind: MediaKind): Promise<string> {
  if (isRemoteUrl(raw)) {
    return raw;
  }
  return toDataUrl(raw, kind);
}
