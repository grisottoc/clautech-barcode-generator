// /generator/__tests__/datamatrix.test.ts
import { describe, expect, it } from "vitest";
import type { Job } from "../../shared/types";
import { computePixelSize } from "../../shared/units";
import { generateDatamatrixRaster } from "../datamatrix";
import { validateDatamatrixJob } from "../../validation/datamatrix";

function mkJob(payload = "HELLO WORLD"): Job {
  const ts = new Date().toISOString();
  return {
    id: "job-1",
    symbology: "datamatrix",
    payload,
    size: { unit: "in", width: 2, height: 1, dpi: 300 },
    margin: { value: 0.1 },
    createdAt: ts,
    updatedAt: ts,
  };
}

function isStrictMono(v: number) {
  return v === 0 || v === 255;
}

function isBlackPx(rgba: Uint8Array, i: number): boolean {
  return (
    rgba[i + 0] === 0 &&
    rgba[i + 1] === 0 &&
    rgba[i + 2] === 0 &&
    rgba[i + 3] === 255
  );
}

function blackBbox(r: { width: number; height: number; data: Uint8Array }) {
  let minX = r.width;
  let minY = r.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      const i = (y * r.width + x) * 4;
      if (!isBlackPx(r.data, i)) continue;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

describe("generateDatamatrixRaster", () => {
  it("returns a tight square raster that fits target square pixels", async () => {
    const job = mkJob("ABC123");
    const { pixelWidth, pixelHeight } = computePixelSize(job.size, job.size.dpi);
    const targetSquarePx = Math.min(pixelWidth, pixelHeight);

    const r = await generateDatamatrixRaster(job);
    expect(r.width).toBeGreaterThan(0);
    expect(r.width).toBe(r.height);
    expect(r.width).toBe(targetSquarePx);
    expect(r.data.length).toBe(r.width * r.height * 4);
  });

  it("is deterministic for same job", async () => {
    const job = mkJob("DETERMINISM");
    const a = await generateDatamatrixRaster(job);
    const b = await generateDatamatrixRaster(job);

    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
    expect(a.data.length).toBe(b.data.length);

    // Compare bytes
    expect(Buffer.from(a.data)).toEqual(Buffer.from(b.data));
  });

  it("is strict monochrome (0/255) with alpha=255", async () => {
    const job = mkJob("MONO");
    const r = await generateDatamatrixRaster(job);

    for (let i = 0; i < r.data.length; i += 4) {
      expect(isStrictMono(r.data[i + 0])).toBe(true);
      expect(isStrictMono(r.data[i + 1])).toBe(true);
      expect(isStrictMono(r.data[i + 2])).toBe(true);
      expect(r.data[i + 3]).toBe(255);
    }
  });

  it("has no extra frame: black content bbox touches all four edges", async () => {
    const fixtures = [
      mkJob("A"),
      mkJob("THIS IS A LONGER DATAMATRIX PAYLOAD 1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
    ];

    for (const job of fixtures) {
      const r = await generateDatamatrixRaster(job);
      const bbox = blackBbox(r);
      expect(bbox).not.toBeNull();
      expect(bbox?.minX).toBe(0);
      expect(bbox?.minY).toBe(0);
      expect(bbox?.maxX).toBe(r.width - 1);
      expect(bbox?.maxY).toBe(r.height - 1);
    }
  });

  it("friendly failure when too small (module px constraint) via validation", async () => {
    const job = mkJob("SMALL");
    job.size = { unit: "in", width: 0.03, height: 0.03, dpi: 203 };
    job.margin.value = 0;

    const res = await validateDatamatrixJob(job);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("too_small");
  });
});
