import type { Job, Unit } from "../shared/types";

const WIN_RESERVED = new Set([
  "con","prn","aux","nul",
  "com1","com2","com3","com4","com5","com6","com7","com8","com9",
  "lpt1","lpt2","lpt3","lpt4","lpt5","lpt6","lpt7","lpt8","lpt9",
]);

const MAX_BASE_LEN = 120;
const MAX_PAYLOAD_SLUG = 60;

export function suggestPngFilename(job: Job): string {
  const type = symLabel(job.symbology);
  const payload = slugify(job.payload) || "payload";
  const size = formatSize(job.size.width, job.size.height, job.size.unit);
  const dpi = Math.round(job.size.dpi);
  const margin = formatMargin(job.margin.value, job.size.unit);

  let base = `${type}_${payload}_${size}_${dpi}dpi_${margin}`;
  base = sanitizeBase(base);

  if (base.length > MAX_BASE_LEN) {
    base = base.slice(0, MAX_BASE_LEN).replace(/[.\s]+$/g, "");
  }

  if (WIN_RESERVED.has(base.toLowerCase())) {
    base = `${type}_${base}_`;
  }

  return `${base}.png`;
}

function symLabel(s: Job["symbology"]): string {
  return s === "qr" ? "QR" : s === "datamatrix" ? "DM" : "C128";
}

function formatSize(w: number, h: number, u: Unit): string {
  return `${fmt(w)}x${fmt(h)}${u}`;
}

function formatMargin(v: number, u: Unit): string {
  return `m${fmt(v)}${u}`;
}

function fmt(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/, "");
}

function slugify(s: string): string {
  let r = s.normalize("NFKD")
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");

  if (WIN_RESERVED.has(r.toLowerCase())) r += "_";
  return r.slice(0, MAX_PAYLOAD_SLUG);
}

function sanitizeBase(s: string): string {
  return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/[.\s]+$/g, "");
}
