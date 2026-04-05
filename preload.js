const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Serial
  listPorts: () => ipcRenderer.invoke("serial:list"),
  connect: (portPath) => ipcRenderer.invoke("serial:connect", portPath),
  disconnect: () => ipcRenderer.invoke("serial:disconnect"),
  send: (data) => ipcRenderer.invoke("serial:send", data),
  onSerialData: (callback) => ipcRenderer.on("serial:data", (_event, data) => callback(data)),

  // Window
  toggleOnTop: () => ipcRenderer.invoke("window:toggleOnTop"),
  getOnTop: () => ipcRenderer.invoke("window:getOnTop"),
  setHeight: (h) => ipcRenderer.invoke("window:setHeight", h),
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),

  // Settings
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
});
