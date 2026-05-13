const STATUS_KEY = "latest-status";

function getStore(env) {
  if (!env.MONITOR_STATUS_KV) {
    throw new Error("MONITOR_STATUS_KV KV binding is required");
  }

  return env.MONITOR_STATUS_KV;
}

export async function setStatus(env, status) {
  const ttl = Number(env.MONITOR_STATUS_TTL_SECONDS || 24 * 60 * 60);
  await getStore(env).put(STATUS_KEY, JSON.stringify(status), {
    expirationTtl: Number.isFinite(ttl) ? ttl : 24 * 60 * 60
  });
}

export async function getStatus(env) {
  const status = await getStore(env).get(STATUS_KEY, "json");
  return status || null;
}
