// /generator/code128.ts
import type { Job } from "../shared/types";
import { computePixelSize, toPixels } from "../shared/units";
import JsBarcode from "jsbarcode";

export interface RasterInput {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

const BLACK = 0;
const WHITE = 255;
const MIN_BAR_PX = 2;

function getDpi(job: Job): number {
  const anyJob = job as any;
  return (job.size as any)?.dpi ?? anyJob?.dpi ?? 0;
}
function normalizedSize(job: Job) {
  return { ...job.size, dpi: getDpi(job) };
}

function hasDom(): boolean {
  return typeof document !== "undefined" && typeof document.createElementNS === "function";
}

function fillWhite(w: number, h: number): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i + 0] = WHITE;
    data[i + 1] = WHITE;
    data[i + 2] = WHITE;
    data[i + 3] = 255;
  }
  return data;
}

function setPixel(data: Uint8Array, w: number, x: number, y: number, v: number) {
  const idx = (y * w + x) * 4;
  data[idx + 0] = v;
  data[idx + 1] = v;
  data[idx + 2] = v;
  data[idx + 3] = 255;
}

function parsePxNumber(raw: string | null): number {
  if (!raw) return NaN;
  const n = Number(String(raw).replace("px", "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function numAttr(el: Element, name: string, fallback = 0): number {
  const raw = el.getAttribute(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Determine overall SVG bounds (W/H) either from attributes or rect extents. */
function svgBounds(svg: SVGSVGElement, rects: Element[]): { w: number; h: number } {
  const wAttr = parsePxNumber(svg.getAttribute("width"));
  const hAttr = parsePxNumber(svg.getAttribute("height"));

  if (Number.isFinite(wAttr) && wAttr > 0 && Number.isFinite(hAttr) && hAttr > 0) {
    return { w: wAttr, h: hAttr };
  }

  // Fallback: compute extents from rects
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

/** Background rect is usually x≈0,y≈0,width≈svgW,height≈svgH */
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

function baseWidthFromRects(rects: Element[]): number {
  let maxRight = 0;
  for (const r of rects) {
    const x = numAttr(r, "x", 0);
    const w = numAttr(r, "width", 0);
    maxRight = Math.max(maxRight, x + w);
  }
  return Math.ceil(maxRight);
}

/**
 * Generate a Code128 raster sized EXACTLY innerW × innerH (margin excluded).
 * Crisp bars via integer scaling. Strict monochrome.
 */
export async function generateCode128Raster(job: Job): Promise<RasterInput> {
  if (job.symbology !== "code128") {
    throw new Error("generateCode128Raster: job.symbology must be 'code128'");
  }
  if (typeof job.payload !== "string") {
    throw new Error("generateCode128Raster: payload must be a string");
  }
  const payload = job.payload.trim();
  if (!payload) {
    throw new Error("generateCode128Raster: payload cannot be empty");
  }
  if (!hasDom()) {
    throw new Error("generateCode128Raster requires DOM (renderer/jsdom).");
  }

  const dpi = getDpi(job);
  const size = normalizedSize(job);

  const { pixelWidth, pixelHeight } = computePixelSize(size, dpi);
  const marginVal = job.margin?.value ?? 0;
  const marginPx = marginVal > 0 ? toPixels(marginVal, size.unit, dpi) : 0;

  const innerW = pixelWidth - 2 * marginPx;
  const innerH = pixelHeight - 2 * marginPx;

  if (innerW <= 0 || innerH <= 0) {
    throw new Error("generateCode128Raster: inner size is invalid after margin");
  }

  // SVG at x-dimension=1
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, payload, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 1,
    height: innerH,
    background: "#ffffff",
    lineColor: "#000000",
  });

  const allRects = Array.from(svg.querySelectorAll("rect"));
  if (allRects.length === 0) {
    throw new Error("generateCode128Raster: JsBarcode produced no rects (unexpected SVG).");
  }

  const { w: svgW, h: svgH } = svgBounds(svg, allRects);
  const barRects = allRects.filter((r) => !isBackgroundRect(r, svgW, svgH));

  if (barRects.length === 0) {
    throw new Error("generateCode128Raster: JsBarcode produced only a background rect (no bars).");
  }

  const baseW = baseWidthFromRects(barRects);
  if (!Number.isFinite(baseW) || baseW <= 0) {
    throw new Error("generateCode128Raster: could not determine base width from bar rects.");
  }

  const maxScale = Math.floor(innerW / baseW);
  const scale = Math.max(1, maxScale);

  if (scale < MIN_BAR_PX) {
    throw new Error(
      `generateCode128Raster: barcode too dense for inner width ${innerW}px (need min bar width ${MIN_BAR_PX}px).`
    );
  }

  const drawW = baseW * scale;
  const offsetX = Math.floor((innerW - drawW) / 2);

  const data = fillWhite(innerW, innerH);

  for (const r of barRects) {
    const x0 = offsetX + numAttr(r, "x", 0) * scale;
    const y0 = numAttr(r, "y", 0);
    const w = numAttr(r, "width", 0) * scale;
    const h = numAttr(r, "height", 0);

    const x1 = Math.max(0, x0);
    const y1 = Math.max(0, y0);
    const x2 = Math.min(innerW, x0 + w);
    const y2 = Math.min(innerH, y0 + h);

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        setPixel(data, innerW, x, y, BLACK);
      }
    }
  }

  // Strict mono guarantee
  for (let i = 0; i < data.length; i += 4) {
    const mono = data[i] < 128 ? BLACK : WHITE;
    data[i + 0] = mono;
    data[i + 1] = mono;
    data[i + 2] = mono;
    data[i + 3] = 255;
  }

  return { width: innerW, height: innerH, data };
}
