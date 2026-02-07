// /generator/__tests__/qr.test.ts
import { describe, it, expect } from "vitest";
import { generateQrRaster } from "../qr";
import type { Job } from "../../shared/types";
import { computePixelSize, toPixels } from "../../shared/units";

function makeJob(partial?: Partial<Job>): Job {
  const now = new Date().toISOString();
  return {
    id: "job-1",
    symbology: "qr",
    payload: "HELLO",
    size: { unit: "in", width: 1, height: 1, dpi: 600 },
    margin: { value: 1 }, // 1mm? NO: contract says same unit as size.unit, so this is 1 inch here
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function expectStrictMonochromeRGBA(buf: Uint8Array) {
  expect(buf.length % 4).toBe(0);

  // sample up to 5000 pixels evenly across the buffer
  const pixelCount = buf.length / 4;
  const samples = Math.min(5000, pixelCount);
  const step = Math.max(1, Math.floor(pixelCount / samples));

  for (let p = 0; p < pixelCount; p += step) {
    const i = p * 4;
    const r = buf[i + 0];
    const g = buf[i + 1];
    const b = buf[i + 2];
    const a = buf[i + 3];

    expect(a).toBe(255);
    expect(r === 0 || r === 255).toBe(true);
    expect(g === 0 || g === 255).toBe(true);
    expect(b === 0 || b === 255).toBe(true);
  }
}


describe("generateQrRaster", () => {
  it("produces RGBA buffer with correct length and strict monochrome", async () => {
    // Use a sane margin in inches to avoid crushing the code area.
    const job = makeJob({
      margin: { value: 0.04 }, // ~1mm in inches
      payload: "https://example.com",
    });

    const raster = await generateQrRaster(job);
    expect(raster.width).toBeGreaterThan(0);
    expect(raster.height).toBe(raster.width);
    expect(raster.data.length).toBe(raster.width * raster.height * 4);
    expectStrictMonochromeRGBA(raster.data);
  });

  it("is deterministic for same job", async () => {
    const job = makeJob({
      margin: { value: 0.04 },
      payload: "DET_TEST",
    });

    const a = await generateQrRaster(job);
    const b = await generateQrRaster(job);

    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
    expect(a.data.length).toBe(b.data.length);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  it("returns inner-area-sized raster for rectangular jobs", async () => {
    const job = makeJob({
      margin: { value: 0.04 }, // ~1mm in inches
      size: { unit: "in", width: 2, height: 1, dpi: 300 },
      payload: "SIZE_TEST",
    });

    const { pixelWidth, pixelHeight } = computePixelSize(job.size, job.size.dpi);
    const marginPx = Math.round(toPixels(job.margin.value, job.size.unit, job.size.dpi));
    const innerW = pixelWidth - 2 * marginPx;
    const innerH = pixelHeight - 2 * marginPx;

    const raster = await generateQrRaster(job);
    expect(raster.width).toBe(innerW);
    expect(raster.height).toBe(innerH);
    expect(raster.data.length).toBe(innerW * innerH * 4);
    expectStrictMonochromeRGBA(raster.data);
  });

  it("throws a friendly error when modules would be too small", async () => {
    // Intentionally tiny code area: 0.2in square at 203 DPI with modest margin.
    // This should force scale < MIN_MODULE_PX for typical payload density.
    const job = makeJob({
      size: { unit: "in", width: 0.2, height: 0.2, dpi: 203 },
      margin: { value: 0.01 }, // small margin
      payload: "TOO_SMALL_PAYLOAD_DENSITY_TEST_1234567890",
    });

    await expect(generateQrRaster(job)).rejects.toThrow(/QR too small/i);
    await expect(generateQrRaster(job)).rejects.toThrow(/px\/module/i);
  });

  it("throws if symbology is not qr", async () => {
    const job = makeJob({ symbology: "code128" as any });
    await expect(generateQrRaster(job)).rejects.toThrow(/symbology must be 'qr'/i);
  });
});
