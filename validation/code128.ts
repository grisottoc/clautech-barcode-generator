// /validation/code128.ts
import type { Job } from "../shared/types";
import { computePixelSize, toPixels } from "../shared/units";
import JsBarcode from "jsbarcode";

const MIN_BAR_PX = 2;
const MAX_PAYLOAD_LEN = 256;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };

function ok(): Result<void> {
  return { ok: true, value: undefined };
}

function fail(code: string, message: string): Result<void> {
  return { ok: false, error: { code, message } };
}

// Match datamatrix.ts compatibility: some call sites may have dpi elsewhere.
function getDpi(job: Job): number {
  const anyJob = job as any;
  const dpi = (job.size as any)?.dpi ?? anyJob?.dpi ?? 0;
  return dpi;
}

function normalizedSize(job: Job) {
  return { ...job.size, dpi: getDpi(job) };
}

function hasDom(): boolean {
  return typeof document !== "undefined" && typeof document.createElementNS === "function";
}

function numAttr(el: Element, name: string, fallback = 0): number {
  const raw = el.getAttribute(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function isBlackFilledRect(rect: Element): boolean {
  const fill = (rect.getAttribute("fill") || "").toLowerCase().trim();
  if (fill === "#000" || fill === "#000000" || fill === "black" || fill === "rgb(0,0,0)") return true;

  const style = (rect.getAttribute("style") || "").toLowerCase();
  if (
    style.includes("fill:#000") ||
    style.includes("fill:#000000") ||
    style.includes("fill:black") ||
    style.includes("fill:rgb(0,0,0)")
  ) {
    return true;
  }

  return false;
}

function parsePxNumber(raw: string | null): number {
  if (!raw) return NaN;
  const n = Number(String(raw).replace("px", "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function svgBounds(svg: SVGSVGElement, rects: Element[]): { w: number; h: number } {
  const wAttr = parsePxNumber(svg.getAttribute("width"));
  const hAttr = parsePxNumber(svg.getAttribute("height"));

  if (Number.isFinite(wAttr) && wAttr > 0 && Number.isFinite(hAttr) && hAttr > 0) {
    return { w: wAttr, h: hAttr };
  }

  let maxRight = 0;
  let maxBottom = 0;
  for (const r of rects) {
    const x = numAttr(r, "x", 0);
    const y = numAttr(r, "y", 0);
    const w = numAttr(r, "width", 0);
    const h = numAttr(r, "height", 0);
    maxRight = Math.max(maxRight, x + w);
    maxBottom = Math.max(maxBottom, y + h);
  }
  return { w: Math.ceil(maxRight), h: Math.ceil(maxBottom) };
}

function isBackgroundRect(r: Element, svgW: number, svgH: number): boolean {
  const x = numAttr(r, "x", 0);
  const y = numAttr(r, "y", 0);
  const w = numAttr(r, "width", 0);
  const h = numAttr(r, "height", 0);

  const tol = 0.5;
  return (
    Math.abs(x - 0) <= tol &&
    Math.abs(y - 0) <= tol &&
    w >= svgW - tol &&
    h >= svgH - tol
  );
}

function probeBaseWidth(payload: string, barHeightPx = 100): number | null {
  if (!hasDom()) return null;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, payload, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 1,
    height: barHeightPx,
    background: "#ffffff",
    lineColor: "#000000",
  });

  const rectsAll = Array.from(svg.querySelectorAll("rect"));
  if (rectsAll.length === 0) return null;

  const { w: svgW, h: svgH } = svgBounds(svg, rectsAll);
  const bars = rectsAll.filter((r) => !isBackgroundRect(r, svgW, svgH));
  if (bars.length === 0) return null;

  let maxX = 0;
  for (const r of bars) {
    const x = numAttr(r, "x", 0);
    const w = numAttr(r, "width", 0);
    maxX = Math.max(maxX, x + w);
  }
  return Math.ceil(maxX);
}

/**
 * Conservative Code128 module estimate.
 * Each codeword ~ 11 modules, plus start/check/stop overhead.
 * We overestimate slightly to fail early rather than allow unscannable output.
 */
function estimateModules(payloadLen: number): number {
  const start = 11;
  const checksum = 11;
  const stop = 13;
  const termination = 2;
  const data = 11 * payloadLen; // conservative: 1 codeword per char
  return start + data + checksum + stop + termination;
}

export function validateCode128Job(job: Job): Result<void> {
  try {
    if (job.symbology !== "code128") {
      return fail("symbology", "Job symbology must be 'code128'.");
    }

    if (typeof job.payload !== "string" || job.payload.trim().length === 0) {
      return fail("payload", "Payload must be a non-empty string.");
    }

    const payload = job.payload.trim();

    if (payload.length > MAX_PAYLOAD_LEN) {
      return fail(
        "payload",
        `Payload too long (${payload.length} chars). Please shorten it (max ${MAX_PAYLOAD_LEN}).`
      );
    }

    const size = normalizedSize(job);
    const { width, height, dpi, unit } = size as any;

    if (!Number.isInteger(dpi) || dpi <= 0) {
      return fail("dpi", "DPI must be an integer greater than 0.");
    }
    if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) {
      return fail("size", "Width must be > 0.");
    }
    if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
      return fail("size", "Height must be > 0.");
    }
    if (unit !== "in" && unit !== "mm") {
      return fail("unit", "Unit must be 'in' or 'mm'.");
    }

    const marginVal = job.margin?.value ?? 0;
    if (typeof marginVal !== "number" || !Number.isFinite(marginVal) || marginVal < 0) {
      return fail("margin", "Margin must be a number >= 0.");
    }
    if (marginVal * 2 > width || marginVal * 2 > height) {
      return fail("margin", "Margin cannot exceed half of width or height.");
    }

    const { pixelWidth, pixelHeight } = computePixelSize(size, dpi);
    const marginPx = marginVal > 0 ? toPixels(marginVal, unit, dpi) : 0;

    const innerW = pixelWidth - 2 * marginPx;
    const innerH = pixelHeight - 2 * marginPx;

    if (innerW <= 0 || innerH <= 0) {
      return fail("inner", "Inner pixel size must be > 0 after margins.");
    }

    // Barcode needs some vertical resolution to be usable (inner height)
    if (innerH < 24) {
      return fail(
        "too_small",
        `Barcode height too small: ${innerH}px inner (suggest >= 24px). Increase height or DPI, or reduce margin.`
      );
    }

    // Prefer probing actual barcode base width at x-dimension=1 when DOM is available
    const probedBaseW = probeBaseWidth(payload);
    const baseW = probedBaseW ?? estimateModules(payload.length);

    const requiredInnerW = baseW * MIN_BAR_PX;

    if (innerW < requiredInnerW) {
      const suggestedTotalW = requiredInnerW + 2 * marginPx;
      const suggestedIn = suggestedTotalW / dpi;
      const suggestedPhysical = unit === "in" ? suggestedIn : suggestedIn * 25.4;

      return fail(
        "too_dense",
        `Barcode too dense for reliable scanning: need about ${requiredInnerW}px inner width ` +
          `(min ${MIN_BAR_PX}px per bar/module). ` +
          `At ${dpi} DPI, try width >= ${suggestedPhysical.toFixed(2)} ${unit} (including margin), ` +
          `or reduce payload length.`
      );
    }

    return ok();
  } catch (e) {
    return fail("encode", e instanceof Error ? e.message : String(e));
  }
}
