import { describe, it, expect } from "vitest";
import UPNG from "upng-js";
import type { Job } from "../../shared/types";
import { computePixelSize } from "../../shared/units";
import { renderMarginAndExport, thresholdToMonochromeRGBA, assertMonochromeRGBA } from "../png";

function makeJob(partial?: Partial<Job>): Job {
  const now = new Date().toISOString();
  return {
    id: "job-1",
    symbology: "qr",
    payload: "TEST",
    size: { unit: "in", width: 1, height: 1, dpi: 300 },
    margin: { value: 1 / 25.4 }, // ~1mm in inches
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("export/png", () => {
  it("thresholdToMonochromeRGBA produces strict 0/255 and alpha=255", () => {
    const rgba = new Uint8Array([
      10, 10, 10, 10,     // dark-ish, alpha wrong
      200, 200, 200, 0,   // light-ish, alpha wrong
    ]);
    const bw = thresholdToMonochromeRGBA(rgba, 128);
    assertMonochromeRGBA(bw);

    // first pixel should be black, alpha 255
    expect(bw[0]).toBe(0);
    expect(bw[1]).toBe(0);
    expect(bw[2]).toBe(0);
    expect(bw[3]).toBe(255);

    // second pixel should be white, alpha 255
    expect(bw[4]).toBe(255);
    expect(bw[5]).toBe(255);
    expect(bw[6]).toBe(255);
    expect(bw[7]).toBe(255);
  });

it("renderMarginAndExport returns a valid PNG with correct dimensions", async () => {
  const job = makeJob({
    size: { unit: "in", width: 1, height: 1, dpi: 300 },
    margin: { value: 1 / 25.4 }, // ~1mm in inches
  });

  const { pixelWidth, pixelHeight } = computePixelSize(job.size, job.size.dpi);

  // Your implementation uses computePixelSize on the margin value to get pixels.
  // Mirror that logic so the test matches the contract.
  const marginPx = computePixelSize(
    { unit: job.size.unit, width: job.margin.value, height: job.margin.value, dpi: job.size.dpi } as any,
    job.size.dpi
  ).pixelWidth;

  const innerW = pixelWidth - 2 * marginPx;
  const innerH = pixelHeight - 2 * marginPx;

  // Create a correctly sized "code" raster: white background with a small black block
  const code = new Uint8Array(innerW * innerH * 4);
  code.fill(255);

  // Put a black square in the center so we can assert black pixels exist
  const block = Math.max(4, Math.floor(Math.min(innerW, innerH) / 10));
  const startX = Math.floor(innerW / 2 - block / 2);
  const startY = Math.floor(innerH / 2 - block / 2);

  for (let y = 0; y < block; y++) {
    for (let x = 0; x < block; x++) {
      const px = (startY + y) * innerW + (startX + x);
      const i = px * 4;
      code[i + 0] = 0;
      code[i + 1] = 0;
      code[i + 2] = 0;
      code[i + 3] = 255;
    }
  }

  const pngBytes = await renderMarginAndExport(job, { width: innerW, height: innerH, data: code });

  // PNG signature
  expect(pngBytes[0]).toBe(0x89);
  expect(pngBytes[1]).toBe(0x50);
  expect(pngBytes[2]).toBe(0x4e);
  expect(pngBytes[3]).toBe(0x47);

  const decoded = UPNG.decode(
    pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength)
  );
  expect(decoded.width).toBe(pixelWidth);
  expect(decoded.height).toBe(pixelHeight);

  // Decode RGBA and assert strict monochrome
  const rgba = UPNG.toRGBA8(decoded)[0];
  const out = new Uint8Array(rgba);
  assertMonochromeRGBA(out);

  // Ensure we have at least some black pixels (not all white)
  let blackCount = 0;
  for (let p = 0; p < out.length; p += 4) {
    if (out[p] === 0 && out[p + 1] === 0 && out[p + 2] === 0) {
      blackCount++;
      if (blackCount > 10) break;
    }
  }
  expect(blackCount).toBeGreaterThan(10);
});

});
