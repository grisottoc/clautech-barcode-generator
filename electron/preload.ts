import { contextBridge, ipcRenderer } from "electron";
import type { Job, SaveAsResult } from "../shared/types";

export type Api = {
  ping: () => Promise<string>;
  saveAsPng: (job: Job, pngData: Uint8Array) => Promise<SaveAsResult>;
  savePng: (path: string, pngData: Uint8Array) => Promise<void>;
};

const api: Api = {
  ping: () => ipcRenderer.invoke("ping"),

  saveAsPng: (job, pngData) =>
    ipcRenderer.invoke("saveAsPng", job, pngData),

  savePng: (path, pngData) =>
    ipcRenderer.invoke("savePng", path, pngData),
};

contextBridge.exposeInMainWorld("api", api);
