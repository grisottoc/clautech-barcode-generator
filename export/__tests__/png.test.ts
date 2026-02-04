import { describe, it, expect } from "vitest";
import { PNG } from "pngjs";
import type { Job } from "../../shared/types";
import { computePixelSize } from "../../shared/units";
import {
  assertMonochromeRGBA,
  thresholdToMonochromeRGBA,
  renderMarginAndExport,
  type RasterInput,
} from "../png";

function decodePng(pngBytes: Uint8Array) {
  const decoded = PNG.sync.read(Buffer.from(pngBytes));
  return {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8Array(decoded.data),
  };
}

describe("export/png", () => {
  it("thresholdToMonochromeRGBA: gray -> strict black/white + alpha forced to 255", () => {
    const rgba = new Uint8Array([
      10, 10, 10, 0, // dark => black; alpha forced
      200, 200, 200, 12, // bright => white; alpha forced
      127, 127, 127, 254, // just below default 128 => black
      128, 128, 128, 1, // equal => white (>= threshold)
    ]);

    const out = thresholdToMonochromeRGBA(rgba); // threshold = 128

    expect(Array.from(out)).toEqual([
      0, 0, 0, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);
  });

  it("assertMonochromeRGBA: passes valid buffers and throws on grayscale/alpha!=255", () => {
    const ok = new Uint8Array([
      0, 0, 0, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
    ]);
    expect(() => assertMonochromeRGBA(ok)).not.toThrow();

    const badGray = new Uint8Array([127, 127, 127, 255]);
    expect(() => assertMonochromeRGBA(badGray)).toThrow(/Non-monochrome/);

    const badAlpha = new Uint8Array([0, 0, 0, 254]);
    expect(() => assertMonochromeRGBA(badAlpha)).toThrow(/Non-opaque alpha/);
  });

  it("renderMarginAndExport: outputs non-empty PNG, correct dimensions, white margin, and strict 0/255 pixels", async () => {
    // Canonical input for computePixelSize (dpi passed separately)
    const sizeInput = { unit: "in", width: 1, height: 1 } as const;
    const dpi = 100;

    const job: Job = {
      id: "job_test",
      symbology: "qr",
      payload: "TEST",
      size: { ...sizeInput, dpi },
      margin: { value: 0.1 }, // 0.1in => 10px (rounded)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const finalPx = computePixelSize(sizeInput, dpi);

    // Margin conversion must be deterministic and use the SAME dpi as the job
    const mPx = computePixelSize({
      unit: sizeInput.unit,
      width: job.margin.value,
      height: job.margin.value,
    }, dpi).pixelWidth;

    const innerW = finalPx.pixelWidth - 2 * mPx;
    const innerH = finalPx.pixelHeight - 2 * mPx;

    // Build a strict monochrome code raster (white with a black square).
    const codeData = new Uint8Array(innerW * innerH * 4);
    for (let i = 0; i < codeData.length; i += 4) {
      codeData[i] = 255;
      codeData[i + 1] = 255;
      codeData[i + 2] = 255;
      codeData[i + 3] = 255;
    }

    // Draw a black 10x10 block starting at (5,5) inside the code raster.
    const block = 10;
    for (let y = 5; y < 5 + block; y++) {
      for (let x = 5; x < 5 + block; x++) {
        const idx = (y * innerW + x) * 4;
        codeData[idx] = 0;
        codeData[idx + 1] = 0;
        codeData[idx + 2] = 0;
        codeData[idx + 3] = 255;
      }
    }

    const code: RasterInput = { width: innerW, height: innerH, data: codeData };

    const pngBytes = await renderMarginAndExport(job, code);

    expect(pngBytes.byteLength).toBeGreaterThan(0);

    const decoded = decodePng(pngBytes);
    expect(decoded.width).toBe(finalPx.pixelWidth);
    expect(decoded.height).toBe(finalPx.pixelHeight);

    // Margin area must be white: check a corner pixel (0,0)
    {
      const i = 0;
      expect(decoded.data[i]).toBe(255);
      expect(decoded.data[i + 1]).toBe(255);
      expect(decoded.data[i + 2]).toBe(255);
      expect(decoded.data[i + 3]).toBe(255);
    }

    // Code area: verify the pixel at (mPx+5, mPx+5) is black (from our block)
    {
      const x = mPx + 5;
      const y = mPx + 5;
      const i = (y * decoded.width + x) * 4;
      expect(decoded.data[i]).toBe(0);
      expect(decoded.data[i + 1]).toBe(0);
      expect(decoded.data[i + 2]).toBe(0);
      expect(decoded.data[i + 3]).toBe(255);
    }

    // Entire decoded image must be strict 0/255 and alpha 255.
    for (let i = 0; i < decoded.data.length; i += 4) {
      const r = decoded.data[i];
      const g = decoded.data[i + 1];
      const b = decoded.data[i + 2];
      const a = decoded.data[i + 3];
      expect([0, 255]).toContain(r);
      expect([0, 255]).toContain(g);
      expect([0, 255]).toContain(b);
      expect(a).toBe(255);
    }
  });
});
