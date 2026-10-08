import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const developmentUrl = process.env.ELECTRON_START_URL ?? "http://127.0.0.1:5173";
const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function reportStartupError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("E-Register Dashboard failed to start:", error);
  dialog.showErrorBox("Unable to start E-Register Dashboard", message);
  app.quit();
}

function openExternalUrl(url: string): void {
  if (!["http:", "https:"].includes(new URL(url).protocol)) return;
  void shell.openExternal(url).catch((error: unknown) => {
    console.error("Unable to open external link:", error);
  });
}

function isAllowedNavigation(url: string, frontendPath: string): boolean {
  if (isDevelopment) {
    try {
      const target = new URL(url);
      const expected = new URL(developmentUrl);
      return target.origin === expected.origin;
    } catch {
      return false;
    }
  }

  try {
    const target = new URL(url);
    return target.protocol === "file:" && fileURLToPath(target) === frontendPath;
  } catch {
    return false;
  }
}

async function createMainWindow(): Promise<void> {
  const frontendPath = path.join(app.getAppPath(), "dist", "index.html");
  if (!isDevelopment && !existsSync(frontendPath)) {
    throw new Error(`The production frontend is missing: ${frontendPath}. Build the app before launching it.`);
  }

  const preloadPath = path.join(app.getAppPath(), "dist-electron", "preload.cjs");
  if (!existsSync(preloadPath)) {
    throw new Error(`The Electron preload script is missing: ${preloadPath}. Build the app before launching it.`);
  }

  const iconPath = path.join(app.getAppPath(), "assets", "icons", "icon.ico");
  const window = new BrowserWindow({
    title: "E-Register",
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#f8fafc",
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDevelopment,
    },
  });

  mainWindow = window;
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle("E-Register");
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isAllowedNavigation(url, frontendPath)) return;
    event.preventDefault();
    console.warn("Blocked navigation outside the application origin.");
    openExternalUrl(url);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    const message = `The application could not load its frontend (${errorDescription}). Check the installation and try again.`;
    console.error(`Frontend load failed (${errorCode}): ${errorDescription} - ${validatedUrl}`);
    dialog.showErrorBox("Unable to load E-Register Dashboard", message);
    if (isDevelopment) window.close();
    else app.quit();
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("The renderer process exited:", details);
    dialog.showErrorBox("Application error", "The application window stopped unexpectedly. Please reopen the app.");
  });

  if (isDevelopment) {
    await window.loadURL(developmentUrl);
  } else {
    await window.loadFile(frontendPath);
  }
}

if (hasSingleInstanceLock) {
  ipcMain.handle("app:get-version", () => app.getVersion());
  app.whenReady()
    .then(createMainWindow)
    .catch(reportStartupError);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow().catch(reportStartupError);
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
