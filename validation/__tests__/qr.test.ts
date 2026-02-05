import { describe, expect, it } from "vitest";
import type { Job } from "../../shared/types";
import { validateQrJob } from "../qr";

function makeJob(overrides: Partial<Job> = {}): Job {
  const now = new Date("2026-02-04T12:00:00.000Z").toISOString();

  const base: Job = {
    id: "job_test_001",
    symbology: "qr",
    payload: "https://example.com",
    size: { unit: "in", width: 1, height: 1, dpi: 600 },
    margin: { value: 0.05 },
    createdAt: now,
    updatedAt: now,
  };

  // Shallow merge + nested merges for size/margin
  return {
    ...base,
    ...overrides,
    size: { ...base.size, ...(overrides as any).size },
    margin: { ...base.margin, ...(overrides as any).margin },
  };
}

describe("validateQrJob", () => {
  it("valid job returns ok:true", () => {
    const job = makeJob();
    const res = validateQrJob(job);
    expect(res.ok).toBe(true);
  });

  it("wrong symbology -> ok:false INVALID_INPUT", () => {
    const job = makeJob({ symbology: "code128" as any });
    const res = validateQrJob(job);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INVALID_INPUT");
  });

  it("empty payload -> INVALID_INPUT", () => {
    const job = makeJob({ payload: "   " });
    const res = validateQrJob(job);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INVALID_INPUT");
  });

  it("margin too large -> INVALID_INPUT", () => {
    // margin exceeds half of width/height (physical)
    const job = makeJob({
      size: { unit: "in", width: 1, height: 1, dpi: 600 } as any,
      margin: { value: 0.6 } as any,
    });
    const res = validateQrJob(job);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("INVALID_INPUT");
  });

  it("too-small job triggers min-module rule -> INVALID_INPUT", () => {
    // Make code area tiny and payload dense enough to force scale < 4.
    // Example: 0.2in @300dpi => ~60px outer, margin 0.02in => ~6px each side, inner ~48px.
    const job = makeJob({
      payload: "THIS IS A LONGER PAYLOAD TO INCREASE MODULE COUNT 1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      size: { unit: "in", width: 0.2, height: 0.2, dpi: 300 } as any,
      margin: { value: 0.02 } as any,
    });

    const res = validateQrJob(job);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("INVALID_INPUT");
      // ensure diagnostics exist (density rule)
      expect(res.error.details).toBeTruthy();
    }
  });

  it("determinism: same job returns same ok/error code", () => {
    const job = makeJob({
      payload: "Determinism payload",
      size: { unit: "in", width: 0.25, height: 0.25, dpi: 300 } as any,
      margin: { value: 0.02 } as any,
    });

    const a = validateQrJob(job);
    const b = validateQrJob(job);

    expect(a.ok).toBe(b.ok);
    if (!a.ok && !b.ok) {
      expect(a.error.code).toBe(b.error.code);
      expect(a.error.message).toBe(b.error.message);
    }
  });
});
