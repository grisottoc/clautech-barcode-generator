// /validation/__tests__/code128.test.ts
import { describe, expect, it } from "vitest";
import type { Job } from "../../shared/types";
import { validateCode128Job } from "../code128";

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    symbology: "code128",
    payload: "1234567890",
    size: { unit: "in", width: 3, height: 1, dpi: 300 },
    margin: { value: 0.1 },
    ...overrides,
  } as Job;
}

describe("validateCode128Job", () => {
  it("rejects empty payload", () => {
    const r = validateCode128Job(baseJob({ payload: "   " }));
    expect(r.ok).toBe(false);
  });

  it("rejects invalid dpi", () => {
    const r = validateCode128Job(baseJob({ size: { unit: "in", width: 3, height: 1, dpi: 0 } as any }));
    expect(r.ok).toBe(false);
  });

  it("rejects invalid margin", () => {
    const r = validateCode128Job(baseJob({ margin: { value: 2 } })); // > half height (1 in)
    expect(r.ok).toBe(false);
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
