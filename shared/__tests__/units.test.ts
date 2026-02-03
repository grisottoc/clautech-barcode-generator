// /shared/__tests__/units.test.ts
import { describe, expect, it } from "vitest";
import { computePixelSize, inToMm, mmToIn, toPixels } from "../units";

describe("shared/units conversions", () => {
  it("mmToIn and inToMm round-trip known values", () => {
    // 25.4 mm = 1 inch
    expect(mmToIn(25.4)).toBeCloseTo(1, 10);
    expect(inToMm(1)).toBeCloseTo(25.4, 10);

    // 50.8 mm = 2 inches
    expect(mmToIn(50.8)).toBeCloseTo(2, 10);
    expect(inToMm(2)).toBeCloseTo(50.8, 10);
  });
});

describe("shared/units pixel math", () => {
  it("1 in at 600 dpi -> 600 px", () => {
    expect(toPixels(1, "in", 600)).toBe(600);
    expect(computePixelSize({ unit: "in", width: 1, height: 1 }, 600)).toEqual({
      pixelWidth: 600,
      pixelHeight: 600,
    });
  });

  it("25.4 mm at 300 dpi -> 300 px", () => {
    expect(toPixels(25.4, "mm", 300)).toBe(300);
    expect(computePixelSize({ unit: "mm", width: 25.4, height: 25.4 }, 300)).toEqual({
      pixelWidth: 300,
      pixelHeight: 300,
    });
  });

  it("2 in × 1 in at 203 dpi -> 406 × 203 px", () => {
    expect(computePixelSize({ unit: "in", width: 2, height: 1 }, 203)).toEqual({
      pixelWidth: 406,
      pixelHeight: 203,
    });
  });

  it("throws on invalid inputs", () => {
    expect(() => toPixels(1, "in", 0)).toThrow();
    expect(() => toPixels(0, "in", 300)).toThrow();
    expect(() => computePixelSize({ unit: "mm", width: NaN, height: 10 }, 300)).toThrow();
    expect(() => computePixelSize({ unit: "mm", width: 10, height: 10 }, 300.5)).toThrow();
  });
});
