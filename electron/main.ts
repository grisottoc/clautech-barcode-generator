import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: "#ffffff",
    webPreferences: {
      // electron-vite dev build is emitting preload as .mjs in your setup
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const isDev = !app.isPackaged;

  // In dev, load Vite dev server. Some setups don't populate env vars on Windows,
  // so we fall back to the default Vite port.
  const devUrl =
    process.env.VITE_DEV_SERVER_URL ??
    process.env.ELECTRON_RENDERER_URL ??
    "http://localhost:5173/";

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
const OPEN_DEVTOOLS = false;

  if (isDev && OPEN_DEVTOOLS) {
  mainWindow.webContents.openDevTools({ mode: "detach" });
}

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc(): void {
  ipcMain.handle("api:ping", async () => "pong");
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // macOS convention
  if (process.platform !== "darwin") app.quit();
});
