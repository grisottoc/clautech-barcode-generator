// /electron/filename.ts
// Deterministic filename suggestion helpers (no filesystem access).
// NOTE: This is a public-ish behavior surface; keep format stable once released.

import type { Job, Unit } from "../shared/types";

// Windows reserved device names (case-insensitive, with or without extension)
const WIN_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

export const MAX_BASE_LEN = 120;    // conservative base length (without extension)
export const MAX_PAYLOAD_SLUG = 60; // keep room for other parts

/**
 * Stable output format:
 *   <TYPE>_<payloadSlug>_<WxH><unit>_<dpi>dpi_m<margin><unit>.png
 *
 * Examples:
 *   QR_https_example_com_1x1in_600dpi_m0.04in.png
 *   DM_PART_12345_25.4x25.4mm_300dpi_m1mm.png
 *   C128_ABC-001_2x1in_203dpi_m0.06in.png
 */
export function suggestPngFilename(job: Job): string {
  const type = symbologyLabel(job.symbology); // "QR" | "DM" | "C128"
  const dpi = sanitizePositiveInt(job.size.dpi, 600);

  const sizePart = formatSizePart(job.size.width, job.size.height, job.size.unit);
  const marginPart = formatMarginPart(job.margin?.value ?? 0, job.size.unit);

  // payload is required in Job contract, but we keep this defensive anyway
  const payloadSlug = slugifyPayload(job.payload ?? "", MAX_PAYLOAD_SLUG) || "payload";

  let base = `${type}_${payloadSlug}_${sizePart}_${dpi}dpi_${marginPart}`;

  // Belt-and-suspenders sanitization for the full base (not just payload slug)
  base = sanitizeFilenameBase(base);

  // Final length clamp
  base = clampBaseLength(
    base,
    MAX_BASE_LEN,
    `${type}_${sizePart}_${dpi}dpi_${marginPart}`,
  );

  // Avoid reserved names even after sanitization/truncation (rare but possible)
  base = avoidWindowsReserved(base, type);

  return `${base}.png`;
}

function symbologyLabel(sym: Job["symbology"]): string {
  switch (sym) {
    case "qr":
      return "QR";
    case "datamatrix":
      return "DM";
    case "code128":
      return "C128";
    default:
      // Should be unreachable given Symbology union; keep defensive.
      return "CODE";
  }
}

function formatSizePart(w: number, h: number, unit: Unit): string {
  const wf = formatNumber(w);
  const hf = formatNumber(h);
  const unitLabel = unit === "in" ? "in" : "mm";
  return `${wf}x${hf}${unitLabel}`;
}

function formatMarginPart(marginValue: number, unit: Unit): string {
  // Margin is expressed in the SAME unit as Job.size.unit by contract.
  // Keep it explicit in the filename as: m<value><unit>
  const mv = formatNumber(marginValue);
  const unitLabel = unit === "in" ? "in" : "mm";
  return `m${mv}${unitLabel}`;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";

  // max 3 decimals, trim trailing zeros
  const s = n.toFixed(3).replace(/\.?0+$/g, "");
  return s.startsWith(".") ? `0${s}` : s;
}

function sanitizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.round(value);
  return n > 0 ? n : fallback;
}

/**
 * Slugify payload for use inside filenames.
 * - Removes illegal filename chars on Windows/macOS: <>:"/\|?* and control chars
 * - Normalizes unicode (NFKD)
 * - Keeps only [A-Za-z0-9._-], replacing other runs with "_"
 * - Collapses repeats, trims ends, clamps length
 * - Avoids Windows reserved device names
 */
export function slugifyPayload(payload: string, maxLen: number): string {
  if (!payload) return "";

  let s = payload.normalize("NFKD");

  // Convert whitespace runs to underscore early
  s = s.replace(/\s+/g, "_");

  // Strip illegal filename characters and control chars
  s = s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "");

  // Replace remaining non-safe characters with underscore.
  // Allow: letters, numbers, underscore, dash, dot.
  s = s.replace(/[^a-zA-Z0-9._-]+/g, "_");

  // Collapse multiple underscores/dots
  s = s.replace(/_+/g, "_").replace(/\.+/g, ".");

  // Trim underscores/dots/spaces from ends
  s = s.replace(/^[._\s]+|[._\s]+$/g, "");

  if (!s) return "";

  // Clamp length (try not to end with underscore/dot after clamping)
  if (s.length > maxLen) {
    s = s.slice(0, maxLen);
    s = s.replace(/[._\s]+$/g, "");
  }

  // Windows: no trailing dot/space
  s = s.replace(/[.\s]+$/g, "");

  // Avoid Windows reserved device names (exact match on the segment)
  if (WIN_RESERVED.has(s.toLowerCase())) {
    s = `${s}_`;
  }

  return s;
}

function sanitizeFilenameBase(base: string): string {
  // Ensure no illegal characters remain
  let s = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");

  // Windows disallows trailing dot/space
  s = s.replace(/[.\s]+$/g, "");

  // Collapse repeats
  s = s.replace(/_+/g, "_");

  // Avoid empty
  if (!s) s = "code";

  return s;
}

function clampBaseLength(base: string, maxLen: number, fallbackBase: string): string {
  if (base.length <= maxLen) return base;

  let s = base.slice(0, maxLen);

  // Avoid trailing dot/space/underscore after truncation
  s = s.replace(/[._\s]+$/g, "");

  // If truncation destroyed everything, fall back to a minimal deterministic name
  if (!s) s = sanitizeFilenameBase(fallbackBase);

  return s;
}

function avoidWindowsReserved(base: string, type: string): string {
  const lowered = base.toLowerCase();
  if (WIN_RESERVED.has(lowered)) return `${type}_${base}_`;
  return base;
}
