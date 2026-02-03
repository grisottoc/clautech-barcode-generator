// /shared/units.ts
// Canonical unit conversion + pixel math (pure, deterministic).
// No UI logic, no Electron usage.

import type { Unit } from "./types";

const MM_PER_INCH = 25.4;

function assertFiniteNumber(name: string, value: number): void {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number (received: ${String(value)})`);
  }
}

function assertPositiveNumber(name: string, value: number): void {
  assertFiniteNumber(name, value);
  if (value <= 0) {
    throw new RangeError(`${name} must be > 0 (received: ${value})`);
  }
}

function assertPositiveInt(name: string, value: number): void {
  assertPositiveNumber(name, value);
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer (received: ${value})`);
  }
}

/** Convert millimeters to inches. */
export function mmToIn(mm: number): number {
  assertFiniteNumber("mm", mm);
  return mm / MM_PER_INCH;
}

/** Convert inches to millimeters. */
export function inToMm(inches: number): number {
  assertFiniteNumber("inches", inches);
  return inches * MM_PER_INCH;
}

/**
 * Convert a physical value to pixels using DPI.
 *
 * Contract rule (deterministic):
 * - If unit = "in": px = round(inches * dpi)
 * - If unit = "mm": inches = mm / 25.4, then px = round(inches * dpi)
 *
 * dpi must be a positive integer
 * value must be > 0
 * rounding uses Math.round for stable output
 */
export function toPixels(value: number, unit: Unit, dpi: number): number {
  assertPositiveNumber("value", value);
  assertPositiveInt("dpi", dpi);

  let inches: number;
  if (unit === "in") {
    inches = value;
  } else if (unit === "mm") {
    inches = mmToIn(value);
  } else {
    // Exhaustiveness protection if Unit expands in the future.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new TypeError(`Unsupported unit: ${unit as never}`);
  }

  return Math.round(inches * dpi);
}

/**
 * Compute pixel dimensions from a physical size object + dpi.
 * Width/height must be > 0, dpi must be positive integer.
 */
export function computePixelSize(
  size: { unit: Unit; width: number; height: number },
  dpi: number
): { pixelWidth: number; pixelHeight: number } {
  assertPositiveNumber("width", size.width);
  assertPositiveNumber("height", size.height);
  assertPositiveInt("dpi", dpi);

  const pixelWidth = toPixels(size.width, size.unit, dpi);
  const pixelHeight = toPixels(size.height, size.unit, dpi);

  return { pixelWidth, pixelHeight };
}

/**
 * Optional helper: format a physical size for display without any UI dependency.
 * This is safe to use in renderer; it returns plain strings.
 */
export function formatSize(
  size: { unit: Unit; width: number; height: number },
  opts?: { precision?: number }
): string {
  const precision = opts?.precision ?? 3;

  assertPositiveNumber("width", size.width);
  assertPositiveNumber("height", size.height);

  const w = Number(size.width.toFixed(precision));
  const h = Number(size.height.toFixed(precision));
  return `${w} × ${h} ${size.unit}`;
}
