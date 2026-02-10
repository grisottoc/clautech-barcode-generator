// /validation/datamatrix.ts
import type { Job } from "../shared/types";
import { computePixelSize, toPixels } from "../shared/units";
import * as bwipjs from "bwip-js";
import UPNG from "upng-js";

const MIN_MODULE_PX = 4;

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
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

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

export async function validateDatamatrixJob(job: Job): Promise<Result<void>> {
  try {
    if (job.symbology !== "datamatrix") {
      return fail("symbology", "Job symbology must be 'datamatrix'.");
    }

    if (typeof job.payload !== "string" || job.payload.trim().length === 0) {
      return fail("payload", "Payload must be a non-empty string.");
    }

    const size = normalizedSize(job);
    const { width, height, dpi, unit } = size;

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
    const marginPx = marginVal > 0 ? toPixels(marginVal, unit, dpi) : 0;

    const innerW = pixelWidth - 2 * marginPx;
    const innerH = pixelHeight - 2 * marginPx;
    if (innerW <= 0 || innerH <= 0) {
      return fail("inner", "Inner pixel size must be > 0 after margins.");
    }

    const squarePx = Math.min(innerW, innerH);
    if (squarePx <= 0) {
      return fail("inner", "Inner area too small.");
    }

    const { modulesW, modulesH } = await probeModules(job.payload);
    const modules = Math.max(modulesW, modulesH);
    if (!Number.isFinite(modules) || modules <= 0) {
      return fail("encode", "Unable to determine Data Matrix module dimensions.");
    }

    const modulePx = Math.floor(squarePx / modules);
    if (modulePx < MIN_MODULE_PX) {
      return fail(
        "too_small",
        `Output too small for reliable scanning: ${modulePx}px/module (min ${MIN_MODULE_PX}). Increase physical size or DPI, or reduce margin.`
      );
    }

    return ok();
  } catch (e) {
    return fail("encode", e instanceof Error ? e.message : String(e));
  }
}
