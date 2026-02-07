// /persistence/schema.ts
import type { Preset, HistoryItem } from "../shared/types";

export const STORE_VERSION = 1 as const;

export type StoreFile = {
  version: number;
  presets: Preset[];
  history: HistoryItem[];
};

export function defaultStore(): StoreFile {
  return { version: STORE_VERSION, presets: [], history: [] };
}

// Very lightweight schema guard (no new deps)
export function isStoreFile(x: unknown): x is StoreFile {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;

  if (typeof obj.version !== "number") return false;
  if (!Array.isArray(obj.presets)) return false;
  if (!Array.isArray(obj.history)) return false;

  // We intentionally do not deep-validate Preset/HistoryItem to avoid coupling.
  // Goal: never crash; treat invalid shapes as empty arrays if needed in store.ts.
  return true;
}

export function coerceStoreFile(x: unknown): StoreFile {
  if (!isStoreFile(x)) return defaultStore();

  const obj = x as StoreFile;

  return {
    version: typeof obj.version === "number" ? obj.version : STORE_VERSION,
    presets: Array.isArray(obj.presets) ? (obj.presets as Preset[]) : [],
    history: Array.isArray(obj.history) ? (obj.history as HistoryItem[]) : [],
  };
}
