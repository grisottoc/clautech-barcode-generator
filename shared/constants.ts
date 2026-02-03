// /shared/constants.ts
// Shared defaults and constants used across the entire app.
// No UI logic, no Electron usage.

import type { JobDefaults, Symbology, Unit } from "./types";
import { mmToIn } from "./units";

/** Recommended default DPI for crisp label work. */
export const DEFAULT_DPI = 600 as const;

/** Common label printer DPIs + design-friendly high DPI. */
export const DPI_PRESETS = [203, 300, 600] as const;

/**
 * Reasonable DPI bounds for future validation.
 * - MIN_DPI: avoids nonsensical values (e.g. 1 dpi) that break export quality
 * - MAX_DPI: prevents runaway memory/CPU usage in render pipelines
 */
export const MIN_DPI = 72 as const;
export const MAX_DPI = 2400 as const;

/**
 * Default physical size:
 * MVP default is 1×1 inch for QR (per spec).
 */
export const DEFAULT_UNIT: Unit = "in";
export const DEFAULT_WIDTH_IN = 1 as const;
export const DEFAULT_HEIGHT_IN = 1 as const;

/**
 * Default quiet zone / margin recommendation.
 *
 * Conservative default: 1.0 mm (≈0.03937 in).
 * Rationale: Many print workflows benefit from a visible quiet zone;
 * 1mm is a practical minimum that remains meaningful at small label sizes.
 *
 * IMPORTANT CONTRACT:
 * - Job.margin.value is in the same unit as Job.size.unit.
 */
export const DEFAULT_MARGIN_MM = 1.0;
export const DEFAULT_MARGIN_IN = mmToIn(DEFAULT_MARGIN_MM);

/** Default symbology tab on first launch (MVP). */
export const DEFAULT_SYMBOLOGY: Symbology = "qr";

/**
 * Canonical default job defaults used for initializing UI state.
 * Payload is intentionally omitted in defaults.
 */
export const DEFAULT_JOB_DEFAULTS: JobDefaults = {
  symbology: DEFAULT_SYMBOLOGY,
  size: {
    unit: DEFAULT_UNIT,
    width: DEFAULT_WIDTH_IN,
    height: DEFAULT_HEIGHT_IN,
    dpi: DEFAULT_DPI,
  },
  margin: {
    value: DEFAULT_MARGIN_IN,
  },
};
