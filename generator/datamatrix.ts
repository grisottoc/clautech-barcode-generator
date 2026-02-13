// /generator/datamatrix.ts
import type { Job } from "../shared/types";
import { computePixelSize } from "../shared/units";
import * as bwipjs from "bwip-js";
import UPNG from "upng-js";

export interface RasterInput {
  width: number;
  height: number;
  data: Uint8Array; // RGBA, len = width * height * 4
}

const THRESHOLD = 128;

function getDpi(job: Job): number {
  const anyJob = job as any;
  const dpi = (job.size as any)?.dpi ?? anyJob?.dpi ?? 0;
  if (!Number.isInteger(dpi) || dpi <= 0) {
    throw new Error("Invalid DPI");
  }
  return dpi;
}

function normalizedSize(job: Job) {
  return {
    ...job.size,
    dpi: getDpi(job),
  };
}

function hasDomCanvas(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * Render a symbol at a specific scale and return RGBA raster for the symbol itself.
 */
async function renderSymbolRGBA(payload: string, scale: number): Promise<{ w: number; h: number; rgba: Uint8Array }> {
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
    // @ts-expect-error compatibility across canvas implementations
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
  const y = (rgba[i + 0] + rgba[i + 1] + rgba[i + 2]) / 3;
  return y < THRESHOLD && rgba[i + 3] === 255;
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
    throw new Error("generateDatamatrixRaster: encoded symbol has no black modules");
  }

  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function extractModuleMatrix(payload: string): Promise<{ modules: number; bits: Uint8Array }> {
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
    throw new Error(
      `generateDatamatrixRaster: expected square module matrix, got ${b.width}x${b.height}`
    );
  }

  const modules = b.width;
  const matrix = new Uint8Array(modules * modules);

  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      matrix[y * modules + x] = bits[(b.top + y) * sym.w + (b.left + x)] ?? 0;
    }
  }

  return { modules, bits: matrix };
}

function fillWhiteOpaque(buf: Uint8Array) {
  for (let i = 0; i < buf.length; i += 4) {
    buf[i + 0] = 255;
    buf[i + 1] = 255;
    buf[i + 2] = 255;
    buf[i + 3] = 255;
  }
}

/**
 * Generate a tight Data Matrix raster from origin using integer module scaling.
 * No centering, no padding, no post-trim.
 */
export async function generateDatamatrixRaster(job: Job): Promise<RasterInput> {
  if (job.symbology !== "datamatrix") {
    throw new Error("generateDatamatrixRaster: job.symbology must be 'datamatrix'");
  }
  if (typeof job.payload !== "string" || job.payload.trim().length === 0) {
    throw new Error("generateDatamatrixRaster: payload must be a non-empty string");
  }

  const size = normalizedSize(job);
  const { pixelWidth, pixelHeight } = computePixelSize(size, size.dpi);
  const targetSquarePx = Math.min(pixelWidth, pixelHeight);
  if (targetSquarePx <= 0) {
    throw new Error("generateDatamatrixRaster: output area too small");
  }

  const { modules, bits } = await extractModuleMatrix(job.payload);
  if (!Number.isFinite(modules) || modules <= 0) {
    throw new Error("generateDatamatrixRaster: invalid module matrix size");
  }

  const modulePx = Math.floor(targetSquarePx / modules);
  if (modulePx < 1) {
    throw new Error("generateDatamatrixRaster: output area too small for payload");
  }

  const finalW = modules * modulePx;
  const finalH = modules * modulePx;
  const out = new Uint8Array(finalW * finalH * 4);
  fillWhiteOpaque(out);

  for (let my = 0; my < modules; my++) {
    for (let mx = 0; mx < modules; mx++) {
      if (bits[my * modules + mx] !== 1) continue;

      const x0 = mx * modulePx;
      const y0 = my * modulePx;

      for (let py = 0; py < modulePx; py++) {
        const y = y0 + py;
        const row = y * finalW;
        for (let px = 0; px < modulePx; px++) {
          const x = x0 + px;
          const i = (row + x) * 4;
          out[i + 0] = 0;
          out[i + 1] = 0;
          out[i + 2] = 0;
          out[i + 3] = 255;
        }
      }
    }
  }

  return { width: finalW, height: finalH, data: out };
}
