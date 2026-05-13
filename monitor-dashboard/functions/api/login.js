import { makeSessionCookie, safeEqual } from "../_lib/auth.js";
import { errorResponse, HttpError, jsonResponse, readJson, requireMethod } from "../_lib/http.js";

export async function onRequest(context) {
  const { request, env } = context;

  try {
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
  } catch (error) {
    return errorResponse(error);
  }
}
