import QRCode from "qrcode";
import type { AppError, Job, Result } from "../shared/types";
import { computePixelSize } from "../shared/units";

const MIN_MODULE_PX = 4;

function invalid(message: string, details?: Record<string, unknown>): Result<void> {
  const error: AppError = {
    code: "INVALID_INPUT",
    message,
    details,
  };
  return { ok: false, error };
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * Mirror the pixel rounding rule used across size->px conversions:
 * - Convert physical inches/mm to pixels via dpi and round to integer pixels.
 * This is intentionally deterministic and matches the shared units tests behavior.
 */
function physicalToPixels(value: number, unit: "in" | "mm", dpi: number): number {
  const inches = unit === "mm" ? value / 25.4 : value;
  return Math.round(inches * dpi);
}

function getQrModuleCount(payload: string): number {
  // Must match generator’s QR lib and options (ECC "M")
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  // qrcode exposes modules.size
  const n = (qr as any)?.modules?.size;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function validateQrJob(job: Job): Result<void> {
  // A) Symbology + payload
  if (job.symbology !== "qr") {
    return invalid("Job symbology must be 'qr'.", {
      symbology: job.symbology,
      expected: "qr",
    });
  }

  const payload = typeof job.payload === "string" ? job.payload : String(job.payload ?? "");
  if (payload.trim().length === 0) {
    return invalid("Payload cannot be empty.", { payloadLength: payload.length });
  }

  // B) Size + DPI sanity
  const { width, height, dpi, unit } = job.size;

  if (!isFinitePositive(width) || !isFinitePositive(height) || !isFinitePositive(dpi)) {
    return invalid("Width, height, and DPI must be finite numbers greater than 0.", {
      width,
      height,
      dpi,
      unit,
    });
  }

  if (!Number.isInteger(dpi)) {
    return invalid("DPI must be an integer.", { dpi });
  }

  // C) Margin sanity
  const margin = job.margin?.value;

  if (!isFiniteNonNegative(margin)) {
    return invalid("Margin must be a finite number greater than or equal to 0.", { margin });
  }

  if (margin > width / 2 || margin > height / 2) {
    return invalid("Margin is too large for the selected physical size.", {
      margin,
      width,
      height,
      unit,
      maxMarginWidth: width / 2,
      maxMarginHeight: height / 2,
    });
  }

  // D) Derived pixel math constraints (mirror generator)
  const { pixelWidth, pixelHeight } = computePixelSize(job.size, dpi);
  const marginPx = physicalToPixels(margin, unit as "in" | "mm", dpi);

  const innerW = pixelWidth - 2 * marginPx;
  const innerH = pixelHeight - 2 * marginPx;

  if (innerW <= 0 || innerH <= 0) {
    return invalid("Margin is too large at the chosen DPI (no inner area remains).", {
      pixelWidth,
      pixelHeight,
      marginPx,
      innerW,
      innerH,
      dpi,
      unit,
    });
  }

  const codePx = Math.min(innerW, innerH);

  // E) QR density / module constraints (mirror generator)
  const n = getQrModuleCount(payload);
  if (!Number.isFinite(n) || n <= 0) {
    return invalid("Unable to determine QR module density for this payload.", {
      n,
      errorCorrectionLevel: "M",
    });
  }

  const scale = Math.floor(codePx / n);

  if (scale < MIN_MODULE_PX) {
    const minCodePx = n * MIN_MODULE_PX;

    // Suggest a minimum physical size at current DPI:
    // codePx = min(innerW, innerH) ~= min(pixelW, pixelH) - 2*marginPx
    // so min(pixelW,pixelH) should be >= minCodePx + 2*marginPx
    const minOuterPx = minCodePx + 2 * marginPx;
    const minOuterIn = minOuterPx / dpi;
    const minOuterMm = minOuterIn * 25.4;

    return invalid(
      `QR is too dense for the selected size/margin/DPI. Increase size, reduce margin, reduce payload length, or increase DPI.`,
      {
        pixelWidth,
        pixelHeight,
        marginPx,
        innerW,
        innerH,
        codePx,
        moduleCount: n,
        scale,
        minModulePx: MIN_MODULE_PX,
        minCodePx,
        suggestedMinOuterPx: minOuterPx,
        suggestedMinOuterIn: Number(minOuterIn.toFixed(4)),
        suggestedMinOuterMm: Number(minOuterMm.toFixed(2)),
        dpi,
        unit,
      }
    );
  }

  return { ok: true, value: undefined };
}
