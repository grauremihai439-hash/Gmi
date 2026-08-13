const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("microsoftStore", {
  openPlan: (plan) => ipcRenderer.invoke("store:open-plan", plan),
});
