const COOKIE_NAME = "tutor_monitor_session";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const STATUS_KEY = "latest-status";

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()"
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(key, value);
  }

  return secured;
}

function jsonResponse(payload, status = 200, headers = {}) {
  return withSecurityHeaders(
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json; charset=utf-8",
        ...headers
      }
    })
  );
}

function errorResponse(error) {
  const status = error instanceof HttpError ? error.statusCode : 500;
  const message = status === 500 ? "Internal server error" : error.message;
  return jsonResponse({ error: message }, status);
}

async function readJson(request, maxBytes = 64 * 1024) {
  const body = await request.text();

  if (body.length > maxBytes) {
    throw new HttpError(413, "Request body is too large");
  }

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function requireMethod(request, method) {
  if (request.method !== method) {
    throw new HttpError(405, "Method not allowed");
  }
}

function safeEqual(value, expected) {
  const left = String(value || "");
  const right = String(expected || "");

  if (right.length === 0 || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function getSessionSecret(env) {
  const secret = env.MONITOR_SESSION_SECRET || "";

  if (secret.length < 32) {
    throw new Error("MONITOR_SESSION_SECRET must have at least 32 characters");
  }

  return secret;
}

function base64url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeJson(value) {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(fromBase64url(value)));
}

async function sign(value, env) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64url(new Uint8Array(signature));
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};

  for (const part of header.split(";")) {
    const trimmed = part.trim();

    if (!trimmed) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    const name = separator >= 0 ? trimmed.slice(0, separator) : trimmed;
    const value = separator >= 0 ? trimmed.slice(separator + 1) : "";
    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

function shouldUseSecureCookie(request) {
  const hostname = new URL(request.url).hostname;
  return hostname !== "localhost" && hostname !== "127.0.0.1";
}

async function makeSessionCookie(request, env) {
  const payload = encodeJson({
    sub: "viewer",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  });
  const token = `${payload}.${await sign(payload, env)}`;
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";

  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Strict; Path=/${secure}`;
}

function makeClearSessionCookie(request) {
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";
  return `${COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/${secure}`;
}

async function verifySession(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];

  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeEqual(signature, await sign(payload, env))) {
    return false;
  }

  try {
    const session = decodeJson(payload);
    return session.sub === "viewer" && Number(session.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function getStore(env) {
  if (!env.MONITOR_STATUS_KV) {
    throw new Error("MONITOR_STATUS_KV KV binding is required");
  }

  return env.MONITOR_STATUS_KV;
}

async function setStatus(env, status) {
  const ttl = Number(env.MONITOR_STATUS_TTL_SECONDS || 24 * 60 * 60);
  await getStore(env).put(STATUS_KEY, JSON.stringify(status), {
    expirationTtl: Number.isFinite(ttl) ? ttl : 24 * 60 * 60
  });
}

async function getStatus(env) {
  const value = await getStore(env).get(STATUS_KEY);
  return value ? JSON.parse(value) : null;
}

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

async function handleIngest(request, env) {
  requireMethod(request, "POST");

  if (!safeEqual(getBearerToken(request), env.MONITOR_AGENT_TOKEN || "")) {
    throw new HttpError(401, "Unauthorized");
  }

  const status = normalizeStatus(await readJson(request));
  await setStatus(env, status);
  return jsonResponse({ ok: true, receivedAt: status.receivedAt }, 202);
}

async function handleLogin(request, env) {
  requireMethod(request, "POST");

  const { password } = await readJson(request, 8 * 1024);

  if (!safeEqual(password, env.MONITOR_DASHBOARD_PASSWORD || "")) {
    throw new HttpError(401, "Unauthorized");
  }

  return jsonResponse(
    { ok: true },
    200,
    {
      "Set-Cookie": await makeSessionCookie(request, env)
    }
  );
}

function handleLogout(request) {
  requireMethod(request, "POST");

  return jsonResponse(
    { ok: true },
    200,
    {
      "Set-Cookie": makeClearSessionCookie(request)
    }
  );
}

async function handleMe(request, env) {
  requireMethod(request, "GET");
  return jsonResponse({ authenticated: await verifySession(request, env) });
}

async function handleStatus(request, env) {
  requireMethod(request, "GET");

  if (!(await verifySession(request, env))) {
    throw new HttpError(401, "Unauthorized");
  }

  const status = await getStatus(env);
  const receivedAt = status ? Date.parse(status.receivedAt) : null;
  const ageSeconds = receivedAt ? Math.max(0, Math.round((Date.now() - receivedAt) / 1000)) : null;

  return jsonResponse({
    status,
    ageSeconds,
    stale: ageSeconds === null || ageSeconds > 180
  });
}

async function handleApi(request, env) {
  const { pathname } = new URL(request.url);

  try {
    if (pathname === "/api/ingest") {
      return await handleIngest(request, env);
    }

    if (pathname === "/api/login") {
      return await handleLogin(request, env);
    }

    if (pathname === "/api/logout") {
      return handleLogout(request);
    }

    if (pathname === "/api/me") {
      return await handleMe(request, env);
    }

    if (pathname === "/api/status") {
      return await handleStatus(request, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
