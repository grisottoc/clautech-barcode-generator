// /electron/filename.ts
// Deterministic filename suggestion helpers (no filesystem access).
// Keep format stable once released.

import type { Job } from "../shared/types";

const WIN_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

const MAX_BASE_LEN = 120;
const MAX_PAYLOAD_SLUG = 60;

export function suggestPngFilename(job: Job): string {
  const payload = slugifyPayload(job.payload) || "code";

  let base = sanitizeBase(payload);

  if (base.length > MAX_BASE_LEN) {
    base = base.slice(0, MAX_BASE_LEN).replace(/[.\s]+$/g, "");
  }

  if (WIN_RESERVED.has(base.toLowerCase())) {
    base = `${base}_`;
  }

  return `${base}.png`;
}

/**
 * Exported because shared/__tests__/filename.test.ts locks slug rules.
 * Defaults maxLen to MAX_PAYLOAD_SLUG for convenience.
 */
export function slugifyPayload(s: string, maxLen: number = MAX_PAYLOAD_SLUG): string {
  let r = s
    .normalize("NFKD")
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");

  if (WIN_RESERVED.has(r.toLowerCase())) r += "_";
  return r.slice(0, maxLen);
}

function sanitizeBase(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/[.\s]+$/g, "");
}
