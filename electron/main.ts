import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { LocalJsonStore } from "../persistence/store";
import type { Job, SaveAsResult, AppError, Preset, HistoryItem } from "../shared/types";
import { suggestPngFilename } from "./filename";
import { writeFileAtomic } from "./fileSave";

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function toAppError(err: unknown, details?: Record<string, unknown>): AppError {
  const e = err as any;

  const message =
    typeof e?.message === "string"
      ? e.message
      : typeof err === "string"
        ? err
        : "Unknown filesystem error";

  const nodeCode = typeof e?.code === "string" ? e.code : undefined;

  return {
    code: "EXPORT_FAILED",
    message,
    details: {
      ...(nodeCode ? { nodeCode } : {}),
      ...(details ?? {}),
    },
  };
}

function getStore() {
  return new LocalJsonStore({ userDataDir: app.getPath("userData") });
}

export function registerPersistenceIpc() {
  const store = getStore();

  ipcMain.handle("persistence:getPresets", async () => {
    try {
      return await store.listPresets();
    } catch (e) {
      console.error("persistence:getPresets failed", e);
      return [] as Preset[];
    }
  });

  ipcMain.handle("persistence:savePreset", async (_evt, preset: Preset) => {
    try {
      return await store.upsertPreset(preset);
    } catch (e) {
      console.error("persistence:savePreset failed", e);
      return [] as Preset[];
    }
  });

  ipcMain.handle("persistence:deletePreset", async (_evt, id: string) => {
    try {
      return await store.deletePreset(id);
    } catch (e) {
      console.error("persistence:deletePreset failed", e);
      return [] as Preset[];
    }
  });

  ipcMain.handle("persistence:getHistory", async () => {
    try {
      return await store.listHistory();
    } catch (e) {
      console.error("persistence:getHistory failed", e);
      return [] as HistoryItem[];
    }
  });

  ipcMain.handle("persistence:addHistory", async (_evt, item: HistoryItem) => {
    try {
      return await store.addHistory(item);
    } catch (e) {
      console.error("persistence:addHistory failed", e);
      return [] as HistoryItem[];
    }
  });

  ipcMain.handle("persistence:clearHistory", async () => {
    try {
      return await store.clearHistory();
    } catch (e) {
      console.error("persistence:clearHistory failed", e);
      return [] as HistoryItem[];
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --------------------
// IPC
// --------------------
registerPersistenceIpc();

ipcMain.handle("ping", async () => "pong");

ipcMain.handle(
  "saveAsPng",
  async (evt, job: Job, pngData: Uint8Array): Promise<SaveAsResult> => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const defaultName = suggestPngFilename(job);

    const options: Electron.SaveDialogOptions = {
  title: "Save PNG",
  defaultPath: path.join(app.getPath("downloads"), defaultName),
  filters: [{ name: "PNG Image", extensions: ["png"] }],
  properties: ["createDirectory", "showOverwriteConfirmation"],
};


    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);


    if (canceled || !filePath) {
      return { ok: false, reason: "canceled" };
    }

    if (!(pngData instanceof Uint8Array)) {
      return {
        ok: false,
        reason: "error",
        error: { code: "INVALID_INPUT", message: "Invalid PNG buffer" },
      };
    }

    try {
      await writeFileAtomic(filePath, pngData);
      return { ok: true, path: filePath };
    } catch (e) {
      return {
        ok: false,
        reason: "error",
        error: toAppError(e, { targetPath: filePath }),
      };
    }
  }
);

ipcMain.handle("savePng", async (_evt, targetPath: string, pngData: Uint8Array): Promise<void> => {
  if (!(pngData instanceof Uint8Array)) {
    throw new Error("Invalid PNG buffer");
  }
  await writeFileAtomic(targetPath, pngData);
});
