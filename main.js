const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { SerialPort } = require("serialport");

let mainWindow;
let activePort = null;
let alwaysOnTop = false;

// Settings persistence
const settingsPath = path.join(app.getPath("userData"), "settings.json");

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch (_) {}
  return {};
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function createWindow() {
  const settings = loadSettings();
  alwaysOnTop = settings.alwaysOnTop || false;

  mainWindow = new BrowserWindow({
    width: 600,
    height: 135,
    minWidth: 400,
    minHeight: 135,
    alwaysOnTop: alwaysOnTop,
    frame: false,
    transparent: false,
    backgroundColor: "#1a2a3a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (activePort && activePort.isOpen) {
    activePort.close();
  }
  app.quit();
});

// List available serial ports
ipcMain.handle("serial:list", async () => {
  const ports = await SerialPort.list();
  return ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer || "",
    vendorId: p.vendorId || "",
    productId: p.productId || "",
  }));
});

// Connect to a serial port
ipcMain.handle("serial:connect", async (_event, portPath) => {
  if (activePort && activePort.isOpen) {
    activePort.close();
  }
  return new Promise((resolve, reject) => {
    activePort = new SerialPort(
      { path: portPath, baudRate: 115200 },
      (err) => {
        if (err) {
          activePort = null;
          reject(err.message);
        } else {
          // Forward incoming serial data to renderer
          activePort.on("data", (buf) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("serial:data", buf.toString());
            }
          });
          resolve(true);
        }
      }
    );
  });
});

// Disconnect
ipcMain.handle("serial:disconnect", async () => {
  if (activePort && activePort.isOpen) {
    return new Promise((resolve) => {
      activePort.close(() => {
        activePort = null;
        resolve(true);
      });
    });
  }
  activePort = null;
  return true;
});

// Send data to serial port
ipcMain.handle("serial:send", async (_event, data) => {
  if (!activePort || !activePort.isOpen) {
    throw new Error("Not connected");
  }
  return new Promise((resolve, reject) => {
    activePort.write(data, (err) => {
      if (err) reject(err.message);
      else resolve(true);
    });
  });
});

// Toggle always on top
ipcMain.handle("window:toggleOnTop", async () => {
  alwaysOnTop = !alwaysOnTop;
  mainWindow.setAlwaysOnTop(alwaysOnTop);
  const settings = loadSettings();
  settings.alwaysOnTop = alwaysOnTop;
  saveSettings(settings);
  return alwaysOnTop;
});

// Get always on top state
ipcMain.handle("window:getOnTop", async () => {
  return alwaysOnTop;
});

// Settings save/load
ipcMain.handle("settings:load", async () => {
  return loadSettings();
});

ipcMain.handle("settings:save", async (_event, settings) => {
  const current = loadSettings();
  saveSettings({ ...current, ...settings });
});

// Resize window (for settings panel toggle)
ipcMain.handle("window:setHeight", async (_event, height) => {
  const [width] = mainWindow.getSize();
  mainWindow.setSize(width, height, true);
});

// Window controls
ipcMain.on("window:minimize", () => mainWindow.minimize());
ipcMain.on("window:close", () => mainWindow.close());
