const COOKIE_NAME = "tutor_monitor_session";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

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

export function safeEqual(value, expected) {
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

export async function makeSessionCookie(request, env) {
  const payload = encodeJson({
    sub: "viewer",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  });
  const token = `${payload}.${await sign(payload, env)}`;
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";

  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Strict; Path=/${secure}`;
}

export function makeClearSessionCookie(request) {
  const secure = shouldUseSecureCookie(request) ? "; Secure" : "";
  return `${COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/${secure}`;
}

export async function verifySession(request, env) {
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
