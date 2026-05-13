import { makeClearSessionCookie } from "../_lib/auth.js";
import { errorResponse, jsonResponse, requireMethod } from "../_lib/http.js";

export async function onRequest(context) {
  const { request } = context;

  try {
    requireMethod(request, "POST");

    return jsonResponse(
      { ok: true },
      200,
      {
        "Set-Cookie": makeClearSessionCookie(request)
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
