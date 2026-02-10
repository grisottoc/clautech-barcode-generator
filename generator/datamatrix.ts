// /generator/datamatrix.ts
import type { Job } from "../shared/types";
import { computePixelSize, toPixels } from "../shared/units";
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

function fillWhiteRGBA(buf: Uint8Array) {
  for (let i = 0; i < buf.length; i += 4) {
    buf[i + 0] = 255;
    buf[i + 1] = 255;
    buf[i + 2] = 255;
    buf[i + 3] = 255;
  }
}

function thresholdToMonochromeRGBA(src: Uint8Array, dst: Uint8Array) {
  const n = Math.min(src.length, dst.length);
  for (let i = 0; i < n; i += 4) {
    const r = src[i + 0];
    const g = src[i + 1];
    const b = src[i + 2];
    const y = (r + g + b) / 3;
    const v = y < THRESHOLD ? 0 : 255;

    dst[i + 0] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = 255;
  }
}

function hasDomCanvas(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * Probe module dimensions (scale=1 => width/height ~= module count).
 */
async function probeModules(payload: string): Promise<{ modulesW: number; modulesH: number }> {
  if (hasDomCanvas()) {
    const canvas = document.createElement("canvas");
    bwipjs.toCanvas(canvas, {
      bcid: "datamatrix",
      text: payload,
      scale: 1,
      padding: 0,
      includetext: false,
      backgroundcolor: "FFFFFF",
    });
    return { modulesW: canvas.width, modulesH: canvas.height };
  }

  const pngBuf = await bwipjs.toBuffer({
    bcid: "datamatrix",
    text: payload,
    scale: 1,
    padding: 0,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
  const decoded = UPNG.decode(asArrayBuffer(pngBuf));
  return { modulesW: decoded.width, modulesH: decoded.height };
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

/**
 * Generate a Data Matrix raster (no margin baked in).
 * Returns EXACTLY innerW x innerH, with a centered square symbol padded as needed.
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

  const marginVal = job.margin?.value ?? 0;
  if (typeof marginVal !== "number" || !Number.isFinite(marginVal) || marginVal < 0) {
    throw new Error("generateDatamatrixRaster: margin must be a finite number >= 0");
  }
  const marginPx = marginVal > 0 ? toPixels(marginVal, size.unit, size.dpi) : 0;

  const innerW = pixelWidth - 2 * marginPx;
  const innerH = pixelHeight - 2 * marginPx;

  if (innerW <= 0 || innerH <= 0) {
    throw new Error("generateDatamatrixRaster: inner size must be > 0 after margins");
  }

  const squarePx = Math.min(innerW, innerH);

  const { modulesW, modulesH } = await probeModules(job.payload);
  const modules = Math.max(modulesW, modulesH);
  if (!Number.isFinite(modules) || modules <= 0) {
    throw new Error("generateDatamatrixRaster: unable to determine module dimensions");
  }

  const scale = Math.max(1, Math.floor(squarePx / modules));
  const sym = await renderSymbolRGBA(job.payload, scale);

  const out = new Uint8Array(innerW * innerH * 4);
  fillWhiteRGBA(out);

  const monoSym = new Uint8Array(sym.w * sym.h * 4);
  thresholdToMonochromeRGBA(sym.rgba, monoSym);

  const squareX = Math.floor((innerW - squarePx) / 2);
  const squareY = Math.floor((innerH - squarePx) / 2);
  const symX = squareX + Math.floor((squarePx - sym.w) / 2);
  const symY = squareY + Math.floor((squarePx - sym.h) / 2);

  for (let y = 0; y < sym.h; y++) {
    const dy = symY + y;
    if (dy < 0 || dy >= innerH) continue;

    for (let x = 0; x < sym.w; x++) {
      const dx = symX + x;
      if (dx < 0 || dx >= innerW) continue;

      const si = (y * sym.w + x) * 4;
      const di = (dy * innerW + dx) * 4;

      out[di + 0] = monoSym[si + 0];
      out[di + 1] = monoSym[si + 1];
      out[di + 2] = monoSym[si + 2];
      out[di + 3] = 255;
    }
  }

  return { width: innerW, height: innerH, data: out };
}
