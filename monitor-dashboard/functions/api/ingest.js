import { safeEqual } from "../_lib/auth.js";
import { errorResponse, HttpError, jsonResponse, readJson, requireMethod } from "../_lib/http.js";
import { setStatus } from "../_lib/status-store.js";

function getBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : "";
}

function cleanString(value, maxLength = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanObject(payload, keys) {
  const result = {};

  for (const key of keys) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = payload[key];
      result[key] = typeof value === "number" ? cleanNumber(value) : cleanString(value);
    }
  }

  return result;
}

function normalizeStatus(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "Invalid status payload");
  }

  const containers = Array.isArray(payload.containers)
    ? payload.containers.slice(0, 50).map((container) => ({
        name: cleanString(container.name, 120),
        image: cleanString(container.image, 160),
        state: cleanString(container.state, 80),
        status: cleanString(container.status, 180),
        cpuPercent: cleanNumber(container.cpuPercent),
        memoryUsage: cleanString(container.memoryUsage, 80),
        memoryPercent: cleanNumber(container.memoryPercent),
        restarts: cleanNumber(container.restarts)
      }))
    : [];

  const logs = Array.isArray(payload.logs)
    ? payload.logs.slice(-30).map((line) => cleanString(line, 500)).filter(Boolean)
    : [];

  return {
    receivedAt: new Date().toISOString(),
    reportedAt: cleanString(payload.reportedAt, 80) || new Date().toISOString(),
    agentVersion: cleanString(payload.agentVersion, 40),
    host: cleanObject(payload.host, ["hostname", "platform", "kernel", "architecture"]),
    system: {
      uptimeSeconds: cleanNumber(payload.system?.uptimeSeconds),
      loadAverage: Array.isArray(payload.system?.loadAverage)
        ? payload.system.loadAverage.slice(0, 3).map(cleanNumber)
        : [],
      memory: {
        totalBytes: cleanNumber(payload.system?.memory?.totalBytes),
        usedBytes: cleanNumber(payload.system?.memory?.usedBytes),
        availableBytes: cleanNumber(payload.system?.memory?.availableBytes),
        usedPercent: cleanNumber(payload.system?.memory?.usedPercent)
      },
      disk: {
        path: cleanString(payload.system?.disk?.path, 200),
        totalBytes: cleanNumber(payload.system?.disk?.totalBytes),
        usedBytes: cleanNumber(payload.system?.disk?.usedBytes),
        freeBytes: cleanNumber(payload.system?.disk?.freeBytes),
        usedPercent: cleanNumber(payload.system?.disk?.usedPercent)
      }
    },
    docker: cleanObject(payload.docker, ["version", "composeVersion"]),
    bot: {
      name: cleanString(payload.bot?.name, 120),
      image: cleanString(payload.bot?.image, 160),
      state: cleanString(payload.bot?.state, 80),
      status: cleanString(payload.bot?.status, 180),
      health: cleanString(payload.bot?.health, 80),
      restartCount: cleanNumber(payload.bot?.restartCount),
      exitCode: cleanNumber(payload.bot?.exitCode),
      startedAt: cleanString(payload.bot?.startedAt, 80),
      finishedAt: cleanString(payload.bot?.finishedAt, 80),
      error: cleanString(payload.bot?.error, 240)
    },
    containers,
    logs
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    requireMethod(request, "POST");

    if (!safeEqual(getBearerToken(request), env.MONITOR_AGENT_TOKEN || "")) {
      throw new HttpError(401, "Unauthorized");
    }

    const status = normalizeStatus(await readJson(request));
    await setStatus(env, status);
    return jsonResponse({ ok: true, receivedAt: status.receivedAt }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
