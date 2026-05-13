import { verifySession } from "../_lib/auth.js";
import { errorResponse, HttpError, jsonResponse, requireMethod } from "../_lib/http.js";
import { getStatus } from "../_lib/status-store.js";

export async function onRequest(context) {
  const { request, env } = context;

  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
