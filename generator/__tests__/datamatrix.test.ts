// /generator/__tests__/datamatrix.test.ts
import { describe, expect, it } from "vitest";
import type { Job } from "../../shared/types";
import { computePixelSize, toPixels } from "../../shared/units";
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

describe("generateDatamatrixRaster", () => {
  it("returns buffer sized EXACTLY innerW×innerH", async () => {
    const job = mkJob("ABC123");
    const { pixelWidth, pixelHeight } = computePixelSize(job.size, job.size.dpi);
    const marginPx = toPixels(job.margin.value, job.size.unit, job.size.dpi);

    const innerW = pixelWidth - 2 * marginPx;
    const innerH = pixelHeight - 2 * marginPx;

    const r = await generateDatamatrixRaster(job);
    expect(r.width).toBe(innerW);
    expect(r.height).toBe(innerH);
    expect(r.data.length).toBe(innerW * innerH * 4);
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

  it("rectangular job still returns innerW×innerH (symbol padded/centered)", async () => {
    const job = mkJob("RECT");
    job.size = { unit: "in", width: 3, height: 1, dpi: 300 };
    const r = await generateDatamatrixRaster(job);

    const anyJob = job as any;
    const dpi = (job.size as any).dpi ?? anyJob.dpi;
    const size = { ...job.size, dpi };

    const { pixelWidth, pixelHeight } = computePixelSize(size, size.dpi);
    const marginPx = toPixels(job.margin.value, size.unit, size.dpi);

    expect(r.width).toBe(pixelWidth - 2 * marginPx);
    expect(r.height).toBe(pixelHeight - 2 * marginPx);
  });

  it("friendly failure when too small (module px constraint) via validation", async () => {
    const job = mkJob("SMALL");
    job.size = { unit: "in", width: 0.2, height: 0.2, dpi: 203 };
    job.margin.value = 0;

    const res = await validateDatamatrixJob(job);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("too_small");
  });
});
