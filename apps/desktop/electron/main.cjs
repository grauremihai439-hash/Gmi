const { app, BrowserWindow, ipcMain, shell } = require("electron");
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
