// /validation/datamatrix.ts
import type { Job } from "../shared/types";
import { computePixelSize } from "../shared/units";
import bwipjs from "bwip-js";
import UPNG from "upng-js";

const THRESHOLD = 128;
const MIN_MODULE_PX = 1;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };

function ok(): Result<void> {
  return { ok: true, value: undefined };
}

function fail(code: string, message: string): Result<void> {
  return { ok: false, error: { code, message } };
}

function getDpi(job: Job): number {
  const anyJob = job as any;
  const dpi = (job.size as any)?.dpi ?? anyJob?.dpi ?? 0;
  return dpi;
}

function normalizedSize(job: Job) {
  return { ...job.size, dpi: getDpi(job) };
}

function hasDomCanvas(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function renderSymbolRGBA(
  payload: string,
  scale: number
): Promise<{ w: number; h: number; rgba: Uint8Array }> {
  if (hasDomCanvas()) {
    const canvas = document.createElement("canvas");
    bwipjs.toCanvas(canvas, {
      bcid: "datamatrix",
      text: payload,
      scale,
      padding: 0,
      includetext: false,
      backgroundcolor: "FFFFFF",
    });

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("datamatrix: unable to acquire 2D context");
    ctx.imageSmoothingEnabled = false;

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { w: canvas.width, h: canvas.height, rgba: new Uint8Array(img.data.buffer.slice(0)) };
  }

  const pngBuf = await bwipjs.toBuffer({
    bcid: "datamatrix",
    text: payload,
    scale,
    padding: 0,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
  const decoded = UPNG.decode(asArrayBuffer(pngBuf));
  const frames = UPNG.toRGBA8(decoded);
  const rgba = frames[0];
  if (!rgba) {
    throw new Error("datamatrix: unable to decode PNG RGBA frame");
  }
  return { w: decoded.width, h: decoded.height, rgba: new Uint8Array(rgba) };
}

function isBlackAt(rgba: Uint8Array, i: number): boolean {
  const y = ((rgba[i + 0] ?? 0) + (rgba[i + 1] ?? 0) + (rgba[i + 2] ?? 0)) / 3;
  return y < THRESHOLD && (rgba[i + 3] ?? 0) === 255;
}

function rowHasBlack(bits: Uint8Array, stride: number, y: number, left: number, right: number): boolean {
  const base = y * stride;
  for (let x = left; x <= right; x++) {
    if (bits[base + x] === 1) return true;
  }
  return false;
}

function colHasBlack(bits: Uint8Array, stride: number, x: number, top: number, bottom: number): boolean {
  for (let y = top; y <= bottom; y++) {
    if (bits[y * stride + x] === 1) return true;
  }
  return false;
}

function extractTightBounds(bits: Uint8Array, w: number, h: number) {
  let left = 0;
  let right = w - 1;
  let top = 0;
  let bottom = h - 1;

  while (top <= bottom && !rowHasBlack(bits, w, top, left, right)) top++;
  while (bottom >= top && !rowHasBlack(bits, w, bottom, left, right)) bottom--;
  while (left <= right && !colHasBlack(bits, w, left, top, bottom)) left++;
  while (right >= left && !colHasBlack(bits, w, right, top, bottom)) right--;

  if (left > right || top > bottom) {
    throw new Error("Unable to determine Data Matrix module dimensions.");
  }

  return { width: right - left + 1, height: bottom - top + 1 };
}

async function probeModules(payload: string): Promise<number> {
  const sym = await renderSymbolRGBA(payload, 1);
  const bits = new Uint8Array(sym.w * sym.h);

  for (let y = 0; y < sym.h; y++) {
    for (let x = 0; x < sym.w; x++) {
      const i = (y * sym.w + x) * 4;
      bits[y * sym.w + x] = isBlackAt(sym.rgba, i) ? 1 : 0;
    }
  }

  const b = extractTightBounds(bits, sym.w, sym.h);
  if (b.width !== b.height) {
    throw new Error(`Expected square Data Matrix modules, got ${b.width}x${b.height}.`);
  }
  return b.width;
}

export async function validateDatamatrixJob(job: Job): Promise<Result<void>> {
  try {
    if (job.symbology !== "datamatrix") {
      return fail("symbology", "Job symbology must be 'datamatrix'.");
    }

    if (typeof job.payload !== "string" || job.payload.trim().length === 0) {
      return fail("payload", "Payload must be a non-empty string.");
    }

    const size = normalizedSize(job);
    const { width, height, dpi } = size;

    if (!Number.isInteger(dpi) || dpi <= 0) {
      return fail("dpi", "DPI must be an integer greater than 0.");
    }
    if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) {
      return fail("size", "Width must be > 0.");
    }
    if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
      return fail("size", "Height must be > 0.");
    }

    const marginVal = job.margin?.value ?? 0;
    if (typeof marginVal !== "number" || !Number.isFinite(marginVal) || marginVal < 0) {
      return fail("margin", "Margin must be a number >= 0.");
    }
    if (marginVal * 2 > width || marginVal * 2 > height) {
      return fail("margin", "Margin cannot exceed half of width or height.");
    }

    const { pixelWidth, pixelHeight } = computePixelSize(size, dpi);
    const squarePx = Math.min(pixelWidth, pixelHeight);
    if (squarePx <= 0) {
      return fail("size", "Output area too small.");
    }

    const modules = await probeModules(job.payload);
    if (!Number.isFinite(modules) || modules <= 0) {
      return fail("encode", "Unable to determine Data Matrix module dimensions.");
    }

    // Generator rule: modulePx = floor(targetSquarePx / modules), must be >= 1.
    const modulePx = Math.floor(squarePx / modules);
    if (modulePx < MIN_MODULE_PX) {
      return fail(
        "too_small",
        `Output too small for reliable scanning: ${modulePx}px/module (min ${MIN_MODULE_PX}). Increase physical size or DPI.`
      );
    }

    return ok();
  } catch (e) {
    return fail("encode", e instanceof Error ? e.message : String(e));
  }
}
