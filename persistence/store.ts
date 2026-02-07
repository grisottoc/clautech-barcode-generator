// /persistence/store.ts
import path from "node:path";
import fs from "node:fs/promises";
import type { Preset, HistoryItem } from "../shared/types";
import { coerceStoreFile, defaultStore, STORE_VERSION, type StoreFile } from "./schema";

export type StoreOptions = {
  userDataDir: string;
  filename?: string; // default: "store.json"
};

function storePath(opts: StoreOptions): string {
  return path.join(opts.userDataDir, opts.filename ?? "store.json");
}

function corruptPath(opts: StoreOptions, ts: string): string {
  const base = opts.filename ?? "store.json";
  return path.join(opts.userDataDir, `${base}.corrupt-${ts}.json`);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

// Atomic write: write temp then rename
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = JSON.stringify(data, null, 2);

  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, filePath);
}

async function safeReadJson(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    // parse error or other read error -> bubble up
    throw err;
  }
}

async function renameCorrupt(opts: StoreOptions): Promise<void> {
  const fp = storePath(opts);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const cp = corruptPath(opts, ts);

  try {
    await fs.rename(fp, cp);
  } catch {
    // If rename fails, do nothing; we'll still recreate a clean store.
  }
}

export class LocalJsonStore {
  private opts: StoreOptions;

  constructor(opts: StoreOptions) {
    this.opts = opts;
  }

  private async readOrCreate(): Promise<StoreFile> {
    const fp = storePath(this.opts);

    try {
      const parsed = await safeReadJson(fp);
      if (parsed === null) {
        const fresh = defaultStore();
        await atomicWriteJson(fp, fresh);
        return fresh;
      }
      const coerced = coerceStoreFile(parsed);

      // If version missing/old, keep data and set current version (no migrations yet)
      if (coerced.version !== STORE_VERSION) {
        const upgraded: StoreFile = { ...coerced, version: STORE_VERSION };
        await atomicWriteJson(fp, upgraded);
        return upgraded;
      }

      // Defensive: ensure arrays
      return {
        version: STORE_VERSION,
        presets: Array.isArray(coerced.presets) ? coerced.presets : [],
        history: Array.isArray(coerced.history) ? coerced.history : [],
      };
    } catch {
      // Corrupt JSON or read failure: rename and recreate clean
      await renameCorrupt(this.opts);
      const fresh = defaultStore();
      await atomicWriteJson(fp, fresh);
      return fresh;
    }
  }

  private async write(next: StoreFile): Promise<void> {
    const fp = storePath(this.opts);
    await atomicWriteJson(fp, { ...next, version: STORE_VERSION });
  }

  async listPresets(): Promise<Preset[]> {
    const s = await this.readOrCreate();
    return s.presets;
  }

  async upsertPreset(preset: Preset): Promise<Preset[]> {
    const s = await this.readOrCreate();

    const id = (preset as any)?.id;
    if (typeof id !== "string" || id.trim() === "") {
      // If caller passes invalid preset, do nothing (never crash)
      return s.presets;
    }

    const idx = s.presets.findIndex((p: any) => p?.id === id);
    const nextPresets = [...s.presets];

    if (idx >= 0) nextPresets[idx] = preset;
    else nextPresets.unshift(preset); // newest first

    const next: StoreFile = { ...s, presets: nextPresets };
    await this.write(next);
    return next.presets;
  }

  async deletePreset(id: string): Promise<Preset[]> {
    const s = await this.readOrCreate();
    const nextPresets = s.presets.filter((p: any) => p?.id !== id);
    const next: StoreFile = { ...s, presets: nextPresets };
    await this.write(next);
    return next.presets;
  }

  async listHistory(): Promise<HistoryItem[]> {
    const s = await this.readOrCreate();
    return s.history;
  }

  async addHistory(item: HistoryItem): Promise<HistoryItem[]> {
    const s = await this.readOrCreate();
    // Newest first; cap at 50
    const nextHistory = [item, ...s.history].slice(0, 50);
    const next: StoreFile = { ...s, history: nextHistory };
    await this.write(next);
    return next.history;
  }

  async clearHistory(): Promise<HistoryItem[]> {
    const s = await this.readOrCreate();
    const next: StoreFile = { ...s, history: [] };
    await this.write(next);
    return next.history;
  }
}
