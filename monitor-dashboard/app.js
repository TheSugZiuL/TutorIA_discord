const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const passwordInput = document.querySelector("#password");
const refreshButton = document.querySelector("#refresh-button");
const logoutButton = document.querySelector("#logout-button");
const statusPill = document.querySelector("#status-pill");

const fields = {
  botState: document.querySelector("#bot-state"),
  botDetail: document.querySelector("#bot-detail"),
  memoryValue: document.querySelector("#memory-value"),
  memoryDetail: document.querySelector("#memory-detail"),
  diskValue: document.querySelector("#disk-value"),
  diskDetail: document.querySelector("#disk-detail"),
  uptimeValue: document.querySelector("#uptime-value"),
  hostDetail: document.querySelector("#host-detail"),
  containersCount: document.querySelector("#containers-count"),
  containersBody: document.querySelector("#containers-body"),
  logsCount: document.querySelector("#logs-count"),
  logsOutput: document.querySelector("#logs-output")
};

let refreshTimer = null;

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || "Falha na requisicao");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function showLogin() {
  dashboardView.hidden = true;
  loginView.hidden = false;
  passwordInput.focus();

  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
}

function formatBytes(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = number;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : "-";
}

function formatDuration(seconds) {
  const total = Number(seconds);

  if (!Number.isFinite(total)) {
    return "-";
  }

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function setPill(label, state) {
  statusPill.textContent = label;
  statusPill.className = `status-pill ${state}`;
}

function setCellText(cell, value) {
  cell.textContent = value || "-";
}

function renderContainers(containers = []) {
  fields.containersCount.textContent = String(containers.length);
  fields.containersBody.replaceChildren();

  if (containers.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Sem dados";
    row.append(cell);
    fields.containersBody.append(row);
    return;
  }

  for (const container of containers) {
    const row = document.createElement("tr");

    const name = document.createElement("td");
    const nameText = document.createElement("div");
    const statusText = document.createElement("div");
    nameText.className = "container-name";
    statusText.className = "muted";
    setCellText(nameText, container.name);
    setCellText(statusText, container.status);
    name.append(nameText, statusText);

    const state = document.createElement("td");
    setCellText(state, container.state);

    const cpu = document.createElement("td");
    setCellText(cpu, formatPercent(container.cpuPercent));

    const memory = document.createElement("td");
    setCellText(memory, container.memoryUsage || formatPercent(container.memoryPercent));

    const image = document.createElement("td");
    setCellText(image, container.image);

    row.append(name, state, cpu, memory, image);
    fields.containersBody.append(row);
  }
}

function renderStatus(payload) {
  const status = payload.status;

  if (!status) {
    setPill("Sem dados", "warn");
    fields.botState.textContent = "-";
    fields.botDetail.textContent = "-";
    fields.memoryValue.textContent = "-";
    fields.memoryDetail.textContent = "-";
    fields.diskValue.textContent = "-";
    fields.diskDetail.textContent = "-";
    fields.uptimeValue.textContent = "-";
    fields.hostDetail.textContent = "-";
    renderContainers([]);
    fields.logsCount.textContent = "0";
    fields.logsOutput.textContent = "Sem dados";
    return;
  }

  const botRunning = status.bot?.state === "running";
  const pillState = payload.stale ? "warn" : botRunning ? "ok" : "bad";
  const pillLabel = payload.stale ? "Desatualizado" : botRunning ? "Online" : "Atencao";
  const memory = status.system?.memory || {};
  const disk = status.system?.disk || {};
  const host = status.host || {};
  const logs = status.logs || [];

  setPill(pillLabel, pillState);
  fields.botState.textContent = status.bot?.state || "-";
  fields.botDetail.textContent = `${status.bot?.name || "bot"} | ${status.bot?.status || "-"}`;
  fields.memoryValue.textContent = formatPercent(memory.usedPercent);
  fields.memoryDetail.textContent = `${formatBytes(memory.usedBytes)} de ${formatBytes(memory.totalBytes)}`;
  fields.diskValue.textContent = formatPercent(disk.usedPercent);
  fields.diskDetail.textContent = `${formatBytes(disk.usedBytes)} de ${formatBytes(disk.totalBytes)}`;
  fields.uptimeValue.textContent = formatDuration(status.system?.uptimeSeconds);
  fields.hostDetail.textContent = `${host.hostname || "-"} | ${host.platform || "-"} | ${payload.ageSeconds ?? "-"}s`;
  renderContainers(status.containers || []);
  fields.logsCount.textContent = String(logs.length);
  fields.logsOutput.textContent = logs.length > 0 ? logs.join("\n") : "Sem dados";
}

async function refreshStatus() {
  refreshButton.disabled = true;

  try {
    renderStatus(await request("/api/status"));
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      return;
    }

    setPill("Erro", "bad");
  } finally {
    refreshButton.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  try {
    await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ password: passwordInput.value })
    });
    loginForm.reset();
    showDashboard();
    await refreshStatus();
    refreshTimer = window.setInterval(refreshStatus, 15000);
  } catch {
    loginError.textContent = "Senha invalida";
  }
});

refreshButton.addEventListener("click", refreshStatus);

logoutButton.addEventListener("click", async () => {
  await request("/api/logout", { method: "POST" }).catch(() => null);
  showLogin();
});

const session = await request("/api/me").catch(() => ({ authenticated: false }));

if (session.authenticated) {
  showDashboard();
  await refreshStatus();
  refreshTimer = window.setInterval(refreshStatus, 15000);
} else {
  showLogin();
}
