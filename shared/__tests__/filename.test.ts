// /shared/__tests__/filename.test.ts
import { describe, it, expect } from "vitest";

import type { Job } from "../types";
import { suggestPngFilename, slugifyPayload } from "../../electron/filename";

function makeJob(overrides: Partial<Job> = {}): Job {
  const now = new Date("2026-02-03T00:00:00.000Z").toISOString();
  return {
    id: "job-1",
    symbology: "qr",
    payload: "https://example.com",
    size: { unit: "in", width: 1, height: 1, dpi: 600 },
    margin: { value: 0.04 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("slugifyPayload (filename behavior contract)", () => {
  it("returns empty for empty input", () => {
    expect(slugifyPayload("", 60)).toBe("");
  });

  it("strips illegal filename characters (Windows/macOS) and control chars", () => {
    const s = slugifyPayload(`a<>:"/\\|?*\x01b`, 60);
    expect(s).toBe("ab");
  });

  it("normalizes whitespace to underscores and trims", () => {
    const s = slugifyPayload("  hello   world  ", 60);
    expect(s).toBe("hello_world");
  });

  it("avoids Windows reserved device names", () => {
    const s = slugifyPayload("CON", 60);
    expect(s.toLowerCase()).toBe("con_");
  });

  it("clamps length", () => {
    const s = slugifyPayload("a".repeat(200), 60);
    expect(s.length).toBeLessThanOrEqual(60);
  });
});

describe("suggestPngFilename (stable naming)", () => {
  it("formats deterministic name including size, dpi, and margin", () => {
    const job = makeJob({
      symbology: "qr",
      payload: "https://example.com",
      size: { unit: "in", width: 1, height: 1, dpi: 600 },
      margin: { value: 0.04 },
    });

    expect(suggestPngFilename(job)).toBe("QR_httpsexample.com_1x1in_600dpi_m0.04in.png");

  });

  it("uses fallback 'payload' if slug becomes empty", () => {
    const job = makeJob({ payload: `<>:"/\\|?*` });
    expect(suggestPngFilename(job)).toContain("_payload_");
  });

  it("does not output a reserved Windows device name as the entire base", () => {
    const job = makeJob({ payload: "CON" }); // slug becomes con_
    const name = suggestPngFilename(job);
    expect(name.endsWith(".png")).toBe(true);
    expect(name.toLowerCase()).not.toBe("con.png");
  });

  it("clamps long names to reduce path-length risk", () => {
    const job = makeJob({ payload: "a".repeat(500) });
    const name = suggestPngFilename(job);
    expect(name.length).toBeLessThanOrEqual(120 + ".png".length);
  });

  it("formats decimals with max 3 places and trims zeros", () => {
    const job = makeJob({
      symbology: "datamatrix",
      payload: "PART 12345",
      size: { unit: "mm", width: 25.4, height: 25.4, dpi: 300 },
      margin: { value: 1.0 },
    });

    expect(suggestPngFilename(job)).toBe("DM_PART_12345_25.4x25.4mm_300dpi_m1mm.png");
  });
});
