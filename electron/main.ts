import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import type { Job, SaveAsResult, AppError } from "../shared/types";
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
ipcMain.handle("ping", async () => "pong");

ipcMain.handle(
  "saveAsPng",
  async (evt, job: Job, pngData: Uint8Array): Promise<SaveAsResult> => {
    const win = BrowserWindow.fromWebContents(evt.sender);
    const defaultName = suggestPngFilename(job);

    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: "Save PNG",
      defaultPath: path.join(app.getPath("downloads"), defaultName),
      filters: [{ name: "PNG Image", extensions: ["png"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });

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
