// /generator/qr.ts

import type { Job } from "../shared/types";
import { computePixelSize, inToMm } from "../shared/units";
import QRCode from "qrcode";

export interface RasterInput {
  width: number;
  height: number;
  data: Uint8Array; // RGBA, len = width * height * 4
}

/**
 * Minimum pixel size per QR module.
 * Prevents "technically valid but practically unscannable" QR output.
 */
const MIN_MODULE_PX = 4;

/**
 * Generate a QR code raster for the full output area.
 * The returned raster is exactly pixelWidth x pixelHeight; when area is rectangular,
 * the square QR is centered on a white background.
 */
export async function generateQrRaster(job: Job): Promise<RasterInput> {
  if (job.symbology !== "qr") {
    throw new Error("generateQrRaster: job.symbology must be 'qr'");
  }
  if (typeof job.payload !== "string") {
    throw new Error("generateQrRaster: payload must be a string");
  }

  const { pixelWidth, pixelHeight } = computePixelSize(job.size, job.size.dpi);
  const codePx = Math.min(pixelWidth, pixelHeight);

  // Build module matrix (deterministic for same payload/options)
  const qr = QRCode.create(job.payload, {
    errorCorrectionLevel: "M",
  });

  const n = qr.modules.size;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("generateQrRaster: invalid module matrix size");
  }

  const scale = Math.floor(codePx / n);

  // Guard: prevent too-small modules (scan reliability).
  if (scale < MIN_MODULE_PX) {
    const minCodePx = n * MIN_MODULE_PX;
    const minIn = minCodePx / job.size.dpi;
    const minMm = inToMm(minIn);

    const unitLabel = job.size.unit === "in" ? "in" : "mm";
    const minInStr = `${trim3(minIn)}in`;
    const minMmStr = `${trim3(minMm)}mm`;

    const suggestion =
      unitLabel === "in"
        ? `${minInStr} (~${minMmStr})`
        : `${minMmStr} (~${minInStr})`;

    throw new Error(
      `generateQrRaster: QR too small for payload at current size. ` +
        `Need at least ${minCodePx}px code area (>= ${MIN_MODULE_PX}px/module), ` +
        `which is about ${suggestion} at ${job.size.dpi} DPI.`
    );
  }

  const qrPx = scale * n;
  const offset = Math.floor((codePx - qrPx) / 2);

  const qrData = new Uint8Array(codePx * codePx * 4);

  // Fill background white (RGBA 255)
  qrData.fill(255);

  // Render black modules (RGBA 0,0,0,255), no antialias
  const modules = qr.modules.data; // Uint8Array/Array-like of 0/1, length n*n

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const idx = r * n + c;
      const isDark = modules[idx] === 1 || (modules as any)[idx] === true;

      if (!isDark) continue;

      const x0 = offset + c * scale;
      const y0 = offset + r * scale;

      for (let y = 0; y < scale; y++) {
        const yy = y0 + y;
        const rowBase = (yy * codePx + x0) * 4;

        for (let x = 0; x < scale; x++) {
          const p = rowBase + x * 4;
          qrData[p + 0] = 0;
          qrData[p + 1] = 0;
          qrData[p + 2] = 0;
          qrData[p + 3] = 255;
        }
      }
    }
  }

  const qrSquare: RasterInput = { width: codePx, height: codePx, data: qrData };
  const outW = pixelWidth;
  const outH = pixelHeight;
  const out = new Uint8Array(outW * outH * 4);

  for (let i = 0; i < out.length; i += 4) {
    out[i + 0] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = 255;
  }

  const offX = Math.floor((outW - qrSquare.width) / 2);
  const offY = Math.floor((outH - qrSquare.height) / 2);

  for (let y = 0; y < qrSquare.height; y++) {
    const srcRow = y * qrSquare.width * 4;
    const dstRow = (y + offY) * outW * 4 + offX * 4;
    out.set(qrSquare.data.subarray(srcRow, srcRow + qrSquare.width * 4), dstRow);
  }

  return { width: outW, height: outH, data: out };
}

function trim3(n: number): string {
  return n.toFixed(3).replace(/\.?0+$/g, "");
}
