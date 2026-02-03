import { contextBridge, ipcRenderer } from "electron";

export type Api = {
  ping: () => Promise<string>;
};

const api: Api = {
  ping: () => ipcRenderer.invoke("api:ping")
};

contextBridge.exposeInMainWorld("api", api);
