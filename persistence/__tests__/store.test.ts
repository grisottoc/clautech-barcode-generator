// /persistence/__tests__/store.test.ts
import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { LocalJsonStore } from "../store";

// NOTE: These types must already exist in /shared/types.ts
import type { Preset, HistoryItem, Job } from "../../shared/types";

async function mkTempDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "clautch-store-"));
}

async function readFileText(fp: string) {
  return await fs.readFile(fp, "utf8");
}

describe("persistence LocalJsonStore", () => {
  it("creates new store when missing", async () => {
    const dir = await mkTempDir();
    const store = new LocalJsonStore({ userDataDir: dir, filename: "store.json" });

    const presets = await store.listPresets();
    const history = await store.listHistory();

    expect(presets).toEqual([]);
    expect(history).toEqual([]);

    const fp = path.join(dir, "store.json");
    const txt = await readFileText(fp);
    expect(txt).toContain('"version"');
    expect(txt).toContain('"presets"');
    expect(txt).toContain('"history"');
  });

  it("upsert preset and persists", async () => {
    const dir = await mkTempDir();
    const store = new LocalJsonStore({ userDataDir: dir });

    const preset: Preset = {
      id: "p1",
      name: "Label 1x1 @600",
      // the rest of Preset shape is project-defined; store does not care
      // but it must be JSON-serializable.
      job: { symbology: "qr", payload: "HELLO", unit: "in", width: 1, height: 1, dpi: 600 } as unknown as Job,
    } as unknown as Preset;

    const after1 = await store.upsertPreset(preset);
    expect(after1[0] as any).toMatchObject({ id: "p1", name: "Label 1x1 @600" });

    // Update
    const updated: Preset = { ...(preset as any), name: "Updated" };
    const after2 = await store.upsertPreset(updated);
    expect((after2[0] as any).name).toBe("Updated");

    // Reload store from disk
    const store2 = new LocalJsonStore({ userDataDir: dir });
    const loaded = await store2.listPresets();
    expect((loaded[0] as any).name).toBe("Updated");
  });

  it("delete preset persists", async () => {
    const dir = await mkTempDir();
    const store = new LocalJsonStore({ userDataDir: dir });

    await store.upsertPreset({ id: "p1", name: "A", job: {} } as unknown as Preset);
    await store.upsertPreset({ id: "p2", name: "B", job: {} } as unknown as Preset);

    const afterDel = await store.deletePreset("p1");
    expect(afterDel.map((p: any) => p.id)).toEqual(["p2"]);

    const store2 = new LocalJsonStore({ userDataDir: dir });
    const loaded = await store2.listPresets();
    expect(loaded.map((p: any) => p.id)).toEqual(["p2"]);
  });

  it("append history, capped at 50, most recent first", async () => {
    const dir = await mkTempDir();
    const store = new LocalJsonStore({ userDataDir: dir });

    for (let i = 0; i < 60; i++) {
      const item: HistoryItem = {
        id: `h${i}`,
        createdAt: Date.now() + i,
        job: { symbology: "qr", payload: String(i) } as any,
      } as unknown as HistoryItem;

      await store.addHistory(item);
    }

    const hist = await store.listHistory();
    expect(hist.length).toBe(50);
    expect((hist[0] as any).id).toBe("h59");
    expect((hist[49] as any).id).toBe("h10");
  });

  it("corrupt JSON recovery renames corrupt file and recreates", async () => {
    const dir = await mkTempDir();
    const fp = path.join(dir, "store.json");

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fp, "{ this is not json", "utf8");

    const store = new LocalJsonStore({ userDataDir: dir, filename: "store.json" });
    const presets = await store.listPresets();
    expect(presets).toEqual([]);

    const entries = await fs.readdir(dir);
    const corrupt = entries.find((x) => x.startsWith("store.json.corrupt-") && x.endsWith(".json"));
    expect(corrupt).toBeTruthy();

    const txt = await readFileText(fp);
    expect(txt).toContain('"version"');
    expect(txt).toContain('"presets"');
    expect(txt).toContain('"history"');
  });
});
