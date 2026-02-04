import type { Job } from "../shared/types";
import { computePixelSize } from "../shared/units";
import { PNG } from "pngjs";

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
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];

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
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
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
  if (!Number.isInteger(input.width) || input.width <= 0) {
    throw new Error(`Invalid width: ${input.width}`);
  }
  if (!Number.isInteger(input.height) || input.height <= 0) {
    throw new Error(`Invalid height: ${input.height}`);
  }

  const expectedLen = input.width * input.height * 4;
  if (input.data.length !== expectedLen) {
    throw new Error(`Invalid RGBA length: got ${input.data.length}, expected ${expectedLen}`);
  }

  // Force strict BW + opaque, then assert.
  const bw = thresholdToMonochromeRGBA(input.data);
  assertMonochromeRGBA(bw);

  const png = new PNG({ width: input.width, height: input.height });
  // png.data is a Buffer in Node; Uint8Array-compatible assignment works.
  png.data = Buffer.from(bw);

  const encoded = PNG.sync.write(png);
  return new Uint8Array(encoded);
}

/**
 * Computes final pixel size using computePixelSize(job.size)
 * Converts physical margin -> pixels deterministically using computePixelSize (locked rounding behavior)
 * Creates white background
 * Centers code bitmap at (marginPx, marginPx)
 * Throws if code + margin cannot fit OR if code does not match expected inner area
 * Returns PNG Uint8Array
 */
export async function renderMarginAndExport(job: Job, code: RasterInput): Promise<Uint8Array> {
  const { unit, width, height, dpi } = job.size;

  const finalPx = computePixelSize({ unit, width, height }, dpi);
  const finalW = finalPx.pixelWidth;
  const finalH = finalPx.pixelHeight;

  // Margin (physical) -> pixels using computePixelSize to inherit locked rounding.
  const mVal = job.margin.value;
  const mPx = computePixelSize({ unit, width: mVal, height: mVal }, dpi).pixelWidth;

  if (mPx < 0) throw new Error(`Invalid margin pixels: ${mPx}`);

  const innerW = finalW - 2 * mPx;
  const innerH = finalH - 2 * mPx;

  if (innerW <= 0 || innerH <= 0) {
    throw new Error(`Margin too large: inner area ${innerW}x${innerH} px`);
  }

  if (code.width !== innerW || code.height !== innerH) {
    throw new Error(
      `Code raster size mismatch. Expected ${innerW}x${innerH} px, got ${code.width}x${code.height} px`
    );
  }

  const expectedLen = code.width * code.height * 4;
  if (code.data.length !== expectedLen) {
    throw new Error(`Invalid code RGBA length: got ${code.data.length}, expected ${expectedLen}`);
  }

  // Enforce strict monochrome on code.
  const codeBW = thresholdToMonochromeRGBA(code.data);
  assertMonochromeRGBA(codeBW);

  // Final RGBA buffer: white background, opaque.
  const out = new Uint8Array(finalW * finalH * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = 255;
  }

  // Copy code into final buffer at offset (mPx, mPx)
  for (let y = 0; y < innerH; y++) {
    const srcRowStart = y * innerW * 4;
    const dstRowStart = ((y + mPx) * finalW + mPx) * 4;
    out.set(codeBW.subarray(srcRowStart, srcRowStart + innerW * 4), dstRowStart);
  }

  return exportPngFromRgba({ width: finalW, height: finalH, data: out });
}
