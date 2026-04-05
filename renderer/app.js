const input = document.getElementById("cw-input");
const logOutput = document.getElementById("log-output");
const btnMode = document.getElementById("btn-mode");
const btnClear = document.getElementById("btn-clear");
const btnSettings = document.getElementById("btn-settings");
const settingsPanel = document.getElementById("settings-panel");
const portSelect = document.getElementById("port-select");
const btnRefresh = document.getElementById("btn-refresh-ports");
const btnConnect = document.getElementById("btn-connect");
const btnOnTop = document.getElementById("btn-ontop");
const btnMinimize = document.getElementById("btn-minimize");
const btnClose = document.getElementById("btn-close");
const statusText = document.getElementById("status-text");

let realtimeMode = true;
let isConnected = false;

// Keep input focused, but not when settings panel is open
input.addEventListener("blur", () => {
  if (!settingsPanel.classList.contains("hidden")) return;
  setTimeout(() => input.focus(), 50);
});

// Mode toggle
btnMode.addEventListener("click", () => {
  realtimeMode = !realtimeMode;
  btnMode.textContent = realtimeMode ? "REALTIME" : "SENTENCE";
  btnMode.classList.toggle("sentence", !realtimeMode);
  window.api.saveSettings({ realtimeMode });
  input.focus();
});

// Realtime mode: send each character as typed
input.addEventListener("input", async (e) => {
  if (!realtimeMode || !isConnected) return;
  const data = e.data;
  if (data) {
    try {
      await window.api.send(data);
    } catch (err) {
      setStatus("Send error: " + err, false);
    }
  }
});

// Sentence mode: send on Enter
input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (!isConnected) return;
    const text = input.value;
    if (text.length === 0) return;

    if (!realtimeMode) {
      try {
        await window.api.send(text + "\r\n");
      } catch (err) {
        setStatus("Send error: " + err, false);
      }
    }
    input.value = "";
  }
});

// In realtime mode, Enter clears the input
input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && realtimeMode) {
    e.preventDefault();
    input.value = "";
  }
});

// Clear log
btnClear.addEventListener("click", () => {
  logOutput.textContent = "";
  input.focus();
});

// Append to log
function appendLog(text) {
  logOutput.textContent += text;
  logOutput.scrollLeft = logOutput.scrollWidth;
}

const BASE_HEIGHT = 135;
const SETTINGS_HEIGHT = 200;

// Settings toggle
btnSettings.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  const open = !settingsPanel.classList.contains("hidden");
  window.api.setHeight(open ? SETTINGS_HEIGHT : BASE_HEIGHT);
  if (!open) {
    input.focus();
  }
});

// Refresh ports
async function refreshPorts() {
  const ports = await window.api.listPorts();
  portSelect.innerHTML = '<option value="">-- Select Port --</option>';
  for (const p of ports) {
    const opt = document.createElement("option");
    opt.value = p.path;
    opt.textContent = p.path + (p.manufacturer ? ` (${p.manufacturer})` : "");
    portSelect.appendChild(opt);
  }
}

btnRefresh.addEventListener("click", refreshPorts);

// Connect/Disconnect
btnConnect.addEventListener("click", async () => {
  if (isConnected) {
    await window.api.disconnect();
    isConnected = false;
    btnConnect.textContent = "Connect";
    btnConnect.classList.remove("connected");
    setStatus("Disconnected", false);
    input.focus();
    return;
  }

  const port = portSelect.value;
  if (!port) return;

  try {
    await window.api.connect(port);
    isConnected = true;
    btnConnect.textContent = "Disconnect";
    btnConnect.classList.add("connected");
    setStatus("Connected to " + port, true);
    window.api.saveSettings({ lastPort: port });
    input.focus();
  } catch (err) {
    setStatus("Connection failed: " + err, false);
  }
});

// Always on top
btnOnTop.addEventListener("click", async () => {
  const state = await window.api.toggleOnTop();
  btnOnTop.textContent = state ? "ON" : "OFF";
  btnOnTop.classList.toggle("active", state);
  input.focus();
});

// Window controls
btnMinimize.addEventListener("click", () => window.api.minimize());
btnClose.addEventListener("click", () => window.api.close());

// Status
function setStatus(text, connected) {
  statusText.textContent = text;
  statusText.classList.toggle("connected", connected);
}

// Listen for incoming serial data
window.api.onSerialData((data) => {
  appendLog(data);
});

// Init
async function init() {
  const settings = await window.api.loadSettings();

  // Restore always on top
  const onTop = await window.api.getOnTop();
  btnOnTop.textContent = onTop ? "ON" : "OFF";
  btnOnTop.classList.toggle("active", onTop);

  // Restore mode
  if (settings.realtimeMode === false) {
    realtimeMode = false;
    btnMode.textContent = "SENTENCE";
    btnMode.classList.add("sentence");
  }

  // Restore port and auto-connect
  await refreshPorts();
  if (settings.lastPort) {
    portSelect.value = settings.lastPort;
    // Auto-connect if port is available
    if (portSelect.value === settings.lastPort) {
      try {
        await window.api.connect(settings.lastPort);
        isConnected = true;
        btnConnect.textContent = "Disconnect";
        btnConnect.classList.add("connected");
        setStatus("Connected to " + settings.lastPort, true);
      } catch (_) {
        setStatus("Auto-connect failed", false);
      }
    }
  }

  input.focus();
}

init();
