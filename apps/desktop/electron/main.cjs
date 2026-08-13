const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const storeProducts = {
  monthly: "9NCL4LXGNBPF",
  annual: "9NCRCSC8WBX7",
};

ipcMain.handle("store:open-plan", async (_event, plan) => {
  const productId = storeProducts[plan];
  if (!productId || process.platform !== "win32") return false;
  await shell.openExternal(`ms-windows-store://pdp/?ProductId=${productId}`);
  return true;
});

function storeBridgePath() {
  return app.isPackaged
    ? path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "electron",
        "store-bridge",
        "AIChatbot.StoreBridge.exe",
      )
    : path.join(__dirname, "store-bridge", "AIChatbot.StoreBridge.exe");
}

function createCollectionsId(serviceTicket, publisherUserId) {
  return new Promise((resolve, reject) => {
    const child = spawn(storeBridgePath(), [], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Microsoft Store verification timed out."));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && stdout.trim()) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || "Microsoft Store verification failed."));
    });
    child.stdin.end(JSON.stringify({ serviceTicket, publisherUserId }));
  });
}

ipcMain.handle("store:get-collections-id", async (_event, serviceTicket, publisherUserId) => {
  if (
    process.platform !== "win32" ||
    typeof serviceTicket !== "string" ||
    serviceTicket.length < 100 ||
    serviceTicket.length > 20_000 ||
    typeof publisherUserId !== "string" ||
    publisherUserId.length > 200
  ) {
    throw new Error("Microsoft Store verification is unavailable.");
  }
  return createCollectionsId(serviceTicket, publisherUserId);
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: "#0b0d12",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  if (developmentUrl) {
    window.loadURL(developmentUrl);
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
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
