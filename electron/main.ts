import { app, BrowserWindow, ipcMain, dialog, nativeImage, nativeTheme } from "electron";
import path from "node:path";
import UPNG from "upng-js";
import { LocalJsonStore } from "../persistence/store";
import type { Job, SaveAsResult, AppError, Preset, HistoryItem, ImageFormat } from "../shared/types";
import { suggestImageFilename } from "./filename";
import { writeFileAtomic } from "./fileSave";

const isDev = !app.isPackaged;
const JPEG_QUALITY = 95;

const SAVE_DIALOG_FILTERS: Record<ImageFormat, Electron.FileFilter[]> = {
  png: [{ name: "PNG Image", extensions: ["png"] }],
  jpg: [{ name: "JPEG Image", extensions: ["jpg", "jpeg"] }],
  bmp: [{ name: "Bitmap Image", extensions: ["bmp"] }],
};

const SAVE_DIALOG_TITLE: Record<ImageFormat, string> = {
  png: "Save PNG",
  jpg: "Save JPG",
  bmp: "Save BMP",
};

let mainWindow: BrowserWindow | null = null;

function resolveWindowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? "#0b1020" : "#f3f6fb";
}

function applySystemTheme(): void {
  nativeTheme.themeSource = "system";
  mainWindow?.setBackgroundColor(resolveWindowBackgroundColor());
}

function createWindow() {
  applySystemTheme();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 1080,
    backgroundColor: resolveWindowBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
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

function isImageFormat(value: unknown): value is ImageFormat {
  return value === "png" || value === "jpg" || value === "bmp";
}

function extensionForFormat(format: ImageFormat): ".png" | ".jpg" | ".bmp" {
  if (format === "jpg") return ".jpg";
  if (format === "bmp") return ".bmp";
  return ".png";
}

function normalizeTargetPath(filePath: string, format: ImageFormat): string {
  if (path.extname(filePath)) return filePath;
  return `${filePath}${extensionForFormat(format)}`;
}

function resolveExportDpi(job: Job): number {
  const dpi = job?.size?.dpi;
  if (Number.isInteger(dpi) && dpi > 0) {
    return dpi;
  }
  return 72;
}

function dpiToPixelsPerMeter(dpi: number): number {
  // 1 in = 0.0254 m
  return Math.round(dpi / 0.0254);
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeBmp24(width: number, height: number, rgba: Uint8Array, dpi: number): Uint8Array {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error(`Invalid BMP dimensions: ${width}x${height}`);
  }

  const expectedLen = width * height * 4;
  if (rgba.length !== expectedLen) {
    throw new Error(`Invalid BMP RGBA buffer length: got ${rgba.length}, expected ${expectedLen}`);
  }

  const rowStride = width * 3;
  const paddedRowStride = (rowStride + 3) & ~3;
  const pixelArraySize = paddedRowStride * height;
  const headerSize = 14 + 40;
  const fileSize = headerSize + pixelArraySize;
  const out = Buffer.alloc(fileSize);

  out.write("BM", 0, 2, "ascii");
  out.writeUInt32LE(fileSize, 2);
  out.writeUInt32LE(0, 6);
  out.writeUInt32LE(headerSize, 10);

  out.writeUInt32LE(40, 14); // BITMAPINFOHEADER size
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22); // positive => bottom-up rows
  out.writeUInt16LE(1, 26); // planes
  out.writeUInt16LE(24, 28); // bits per pixel (BGR24)
  out.writeUInt32LE(0, 30); // BI_RGB
  out.writeUInt32LE(pixelArraySize, 34);
  const pixelsPerMeter = dpiToPixelsPerMeter(dpi);
  out.writeInt32LE(pixelsPerMeter, 38); // horizontal resolution
  out.writeInt32LE(pixelsPerMeter, 42); // vertical resolution
  out.writeUInt32LE(0, 46);
  out.writeUInt32LE(0, 50);

  for (let y = 0; y < height; y++) {
    const srcRow = y * width * 4;
    const dstRow = headerSize + (height - 1 - y) * paddedRowStride;
    for (let x = 0; x < width; x++) {
      const src = srcRow + x * 4;
      const dst = dstRow + x * 3;
      out[dst + 0] = rgba[src + 2] ?? 0; // blue
      out[dst + 1] = rgba[src + 1] ?? 0; // green
      out[dst + 2] = rgba[src + 0] ?? 0; // red
    }
  }

  return out;
}

function convertPngToFormat(pngData: Uint8Array, format: ImageFormat, dpi: number): Uint8Array {
  if (format === "png") {
    return pngData;
  }

  if (format === "jpg") {
    const image = nativeImage.createFromBuffer(Buffer.from(pngData));
    if (image.isEmpty()) {
      throw new Error("Unable to decode PNG for JPG export");
    }
    return image.toJPEG(JPEG_QUALITY);
  }

  const decoded = UPNG.decode(asArrayBuffer(pngData));
  const frames = UPNG.toRGBA8(decoded);
  const rgba = frames[0];
  if (!rgba) {
    throw new Error("Unable to decode PNG RGBA frame for BMP export");
  }

  return encodeBmp24(decoded.width, decoded.height, new Uint8Array(rgba), dpi);
}

async function saveAsImage(
  evt: Electron.IpcMainInvokeEvent,
  job: Job,
  pngData: Uint8Array,
  format: ImageFormat
): Promise<SaveAsResult> {
  if (!(pngData instanceof Uint8Array)) {
    return {
      ok: false,
      reason: "error",
      error: { code: "INVALID_INPUT", message: "Invalid PNG buffer" },
    };
  }

  if (!isImageFormat(format)) {
    return {
      ok: false,
      reason: "error",
      error: { code: "INVALID_INPUT", message: `Invalid image format: ${String(format)}` },
    };
  }

  const win = BrowserWindow.fromWebContents(evt.sender);
  const defaultName = suggestImageFilename(job, format);

  const options: Electron.SaveDialogOptions = {
    title: SAVE_DIALOG_TITLE[format],
    defaultPath: path.join(app.getPath("downloads"), defaultName),
    filters: SAVE_DIALOG_FILTERS[format],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  };

  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);

  if (canceled || !filePath) {
    return { ok: false, reason: "canceled" };
  }

  const targetPath = normalizeTargetPath(filePath, format);

  try {
    const exportDpi = resolveExportDpi(job);
    const encoded = convertPngToFormat(pngData, format, exportDpi);
    await writeFileAtomic(targetPath, encoded);
    return { ok: true, path: targetPath };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      error: toAppError(e, { targetPath, format }),
    };
  }
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
  nativeTheme.on("updated", () => {
    if (nativeTheme.themeSource === "system") {
      mainWindow?.setBackgroundColor(resolveWindowBackgroundColor());
    }
  });

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
  "saveAsImage",
  async (evt, job: Job, pngData: Uint8Array, format: ImageFormat): Promise<SaveAsResult> =>
    saveAsImage(evt, job, pngData, format)
);

ipcMain.handle(
  "saveAsPng",
  async (evt, job: Job, pngData: Uint8Array): Promise<SaveAsResult> =>
    saveAsImage(evt, job, pngData, "png")
);

ipcMain.handle("savePng", async (_evt, targetPath: string, pngData: Uint8Array): Promise<void> => {
  if (!(pngData instanceof Uint8Array)) {
    throw new Error("Invalid PNG buffer");
  }
  await writeFileAtomic(targetPath, pngData);
});
