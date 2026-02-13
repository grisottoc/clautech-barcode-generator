import type { Job } from "../shared/types";
// import { PNG } from "pngjs";
import UPNG from "upng-js";


/**
 * Local-only raster input (RGBA).
 */
export interface RasterInput {
  width: number; // pixels
  height: number; // pixels
  data: Uint8Array; // RGBA, length = width * height * 4
}

/**
 * Throws if any RGB channel is not exactly 0 or 255.
 * Throws if alpha is not exactly 255.
 */
export function assertMonochromeRGBA(rgba: Uint8Array): void {
  if (rgba.length % 4 !== 0) {
    throw new Error(`Invalid RGBA buffer length: ${rgba.length} (not divisible by 4)`);
  }

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    const a = rgba[i + 3] ?? 0;

    const is01 = (v: number) => v === 0 || v === 255;

    if (!is01(r) || !is01(g) || !is01(b)) {
      throw new Error(`Non-monochrome RGB detected at byte ${i}: (${r},${g},${b})`);
    }
    if (a !== 255) {
      throw new Error(`Non-opaque alpha detected at byte ${i + 3}: ${a}`);
    }
  }
}

/**
 * Converts RGBA to strict black/white.
 * Default threshold = 128
 * Alpha is forced to 255.
 *
 * Rule: compute luma-ish value using average of RGB.
 * - avg < threshold => black (0)
 * - avg >= threshold => white (255)
 */
export function thresholdToMonochromeRGBA(rgba: Uint8Array, threshold = 128): Uint8Array {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) {
    throw new Error(`Invalid threshold: ${threshold}`);
  }
  if (rgba.length % 4 !== 0) {
    throw new Error(`Invalid RGBA buffer length: ${rgba.length} (not divisible by 4)`);
  }

  const out = new Uint8Array(rgba.length);

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1]?? 0;
    const b = rgba[i + 2] ?? 0;
    const avg = (r + g + b) / 3;

    const v = avg < threshold ? 0 : 255;

    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }

  return out;
}

/**
 * Encodes RGBA -> PNG.
 * Enforces strict monochrome prior to encode.
 */
export async function exportPngFromRgba(input: RasterInput): Promise<Uint8Array> {
  const mono = thresholdToMonochromeRGBA(input.data, 128);
  assertMonochromeRGBA(mono);

  // UPNG expects an ArrayBuffer containing RGBA pixels
  const ab = mono.buffer.slice(mono.byteOffset, mono.byteOffset + mono.byteLength);

  // 0 = lossless; returns ArrayBuffer of PNG bytes
  const pngArrayBuffer = UPNG.encode([ab], input.width, input.height, 0);

  return new Uint8Array(pngArrayBuffer);
}


export async function renderMarginAndExport(job: Job, code: RasterInput): Promise<Uint8Array> {
  // Export should be EXACTLY the code raster dimensions.
  // Job.size and Job.margin must NOT affect output dimensions in this mode.

  const expectedLen = code.width * code.height * 4;
  if (code.data.length !== expectedLen) {
    throw new Error(`Invalid code RGBA length: got ${code.data.length}, expected ${expectedLen}`);
  }

  // Enforce strict monochrome on code.
  const codeBW = thresholdToMonochromeRGBA(code.data);
  assertMonochromeRGBA(codeBW);

  return exportPngFromRgba({ width: code.width, height: code.height, data: codeBW });
}
