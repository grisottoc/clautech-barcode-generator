// /validation/__tests__/datamatrix.test.ts
import { describe, expect, it } from "vitest";
import type { Job } from "../../shared/types";
import { validateDatamatrixJob } from "../datamatrix";

function baseJob(payload = "HELLO"): Job {
  const ts = new Date().toISOString();
  return {
    id: "job-1",
    symbology: "datamatrix",
    payload,
    size: { unit: "in", width: 1, height: 1, dpi: 300 },
    margin: { value: 0.1 },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe("validateDatamatrixJob", () => {
  it("accepts a valid job", async () => {
    const res = await validateDatamatrixJob(baseJob("HELLO WORLD"));
    expect(res.ok).toBe(true);
  });

  it("rejects empty payload", async () => {
    const res = await validateDatamatrixJob(baseJob("   "));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("payload");
  });

  it("rejects negative margin", async () => {
    const j = baseJob("ABC");
    j.margin.value = -1;
    const res = await validateDatamatrixJob(j);
    expect(res.ok).toBe(false);
  });

  it("rejects too-small module size (friendly)", async () => {
    // Tiny label at low DPI to force modulePx < 1
    const j = baseJob("HELLO WORLD");
    j.size = { unit: "in", width: 0.03, height: 0.03, dpi: 203 };
    j.margin.value = 0;
    const res = await validateDatamatrixJob(j);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("too_small");
  });
});
