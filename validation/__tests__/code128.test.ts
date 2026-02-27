// /validation/__tests__/code128.test.ts
import { describe, expect, it } from "vitest";
import type { Job } from "../../shared/types";
import { validateCode128Job } from "../code128";

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    symbology: "code128",
    payload: "1234567890",
    size: { unit: "mm", width: 30, height: 6, dpi: 1200 },
    margin: { value: 1 },
    ...overrides,
  } as Job;
}

describe("validateCode128Job", () => {
  it("rejects empty payload", () => {
    const r = validateCode128Job(baseJob({ payload: "   " }));
    expect(r.ok).toBe(false);
  });

  it("rejects invalid dpi", () => {
    const r = validateCode128Job(baseJob({ size: { unit: "mm", width: 30, height: 6, dpi: 0 } as any }));
    expect(r.ok).toBe(false);
  });

  it("rejects invalid margin", () => {
    const r = validateCode128Job(baseJob({ margin: { value: 4 } })); // > half height (6 mm)
    expect(r.ok).toBe(false);
  });

  it("rejects width outside 20-50 mm", () => {
    const r = validateCode128Job(baseJob({ size: { unit: "mm", width: 12, height: 6, dpi: 1200 } as any }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain("width");
    }
  });

  it("rejects height outside 3-10 mm", () => {
    const r = validateCode128Job(baseJob({ size: { unit: "mm", width: 30, height: 12, dpi: 1200 } as any }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toContain("height");
    }
  });

  it("rejects too-small inner area with friendly error", () => {
    const r = validateCode128Job(
      baseJob({
        payload: "ABC-123-XYZ",
        size: { unit: "in", width: 1, height: 0.3, dpi: 203 },
        margin: { value: 0 },
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message.toLowerCase()).toContain("too dense");
    }
  });

  it("accepts a valid job", () => {
    const r = validateCode128Job(baseJob());
    expect(r.ok).toBe(true);
  });
});
