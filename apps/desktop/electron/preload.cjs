const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("microsoftStore", {
  openPlan: (plan) => ipcRenderer.invoke("store:open-plan", plan),
  getCollectionsId: (serviceTicket, publisherUserId) =>
    ipcRenderer.invoke("store:get-collections-id", serviceTicket, publisherUserId),
});
