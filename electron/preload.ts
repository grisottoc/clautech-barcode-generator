import { contextBridge, ipcRenderer } from "electron";
import type { Job, SaveAsResult, Preset, HistoryItem, ImageFormat } from "../shared/types";

export type Api = {
  ping: () => Promise<string>;
  saveAsImage: (job: Job, pngData: Uint8Array, format: ImageFormat) => Promise<SaveAsResult>;
  saveAsPng: (job: Job, pngData: Uint8Array) => Promise<SaveAsResult>;
  savePng: (path: string, pngData: Uint8Array) => Promise<void>;
  getPresets: () => Promise<Preset[]>;
  savePreset: (preset: Preset) => Promise<Preset[]>;
  deletePreset: (id: string) => Promise<Preset[]>;
  getHistory: () => Promise<HistoryItem[]>;
  addHistory: (item: HistoryItem) => Promise<HistoryItem[]>;
  clearHistory: () => Promise<HistoryItem[]>;
};

const api: Api = {
  ping: () => ipcRenderer.invoke("ping"),

  saveAsImage: (job, pngData, format) =>
    ipcRenderer.invoke("saveAsImage", job, pngData, format),

  saveAsPng: (job, pngData) =>
    ipcRenderer.invoke("saveAsPng", job, pngData),

  savePng: (path, pngData) =>
    ipcRenderer.invoke("savePng", path, pngData),

  getPresets: () => ipcRenderer.invoke("persistence:getPresets"),
  savePreset: (preset) => ipcRenderer.invoke("persistence:savePreset", preset),
  deletePreset: (id) => ipcRenderer.invoke("persistence:deletePreset", id),

  getHistory: () => ipcRenderer.invoke("persistence:getHistory"),
  addHistory: (item) => ipcRenderer.invoke("persistence:addHistory", item),
  clearHistory: () => ipcRenderer.invoke("persistence:clearHistory"),
};

contextBridge.exposeInMainWorld("api", api);
