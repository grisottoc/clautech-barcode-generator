// /generator/__tests__/code128.test.ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { generateCode128Raster } from "../code128";
import type { Job } from "../../shared/types";
import { computePixelSize } from "../../shared/units";

function job(overrides: Partial<Job> = {}): Job {
  return {
    symbology: "code128",
    payload: "ABC-123-XYZ",
    size: { unit: "in", width: 3, height: 1, dpi: 300 },
    margin: { value: 0.1 },
    ...overrides,
  } as Job;
}

function isStrictMono(rgba: Uint8Array): boolean {
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i + 0];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];
    if (a !== 255) return false;
    if (r !== g || g !== b) return false;
    if (!(r === 0 || r === 255)) return false;
  }
  return true;
}

describe("generateCode128Raster", () => {
  it("throws if symbology mismatch", async () => {
    await expect(generateCode128Raster(job({ symbology: "qr" as any }))).rejects.toThrow();
  });

  it("returns correct RGBA length and strict monochrome", async () => {
    const r = await generateCode128Raster(job());
    expect(r.data.length).toBe(r.width * r.height * 4);
    expect(isStrictMono(r.data)).toBe(true);
  });

  it("is deterministic for the same job", async () => {
    const a = await generateCode128Raster(job());
    const b = await generateCode128Raster(job());
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
    expect(Buffer.from(a.data)).toEqual(Buffer.from(b.data));
  });

  it("returns full pixel-sized raster", async () => {
    const j = job({
      size: { unit: "in", width: 4, height: 1.25, dpi: 203 },
      margin: { value: 0.0 },
    });
    const { pixelWidth, pixelHeight } = computePixelSize(j.size, j.size.dpi);

    const r = await generateCode128Raster(j);
    expect(r.width).toBe(pixelWidth);
    expect(r.height).toBe(pixelHeight);
    expect(r.data.length).toBe(pixelWidth * pixelHeight * 4);
  });
});
