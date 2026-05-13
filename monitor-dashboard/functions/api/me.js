import { verifySession } from "../_lib/auth.js";
import { errorResponse, jsonResponse, requireMethod } from "../_lib/http.js";

export async function onRequest(context) {
  const { request, env } = context;

  try {
    requireMethod(request, "GET");
    return jsonResponse({ authenticated: await verifySession(request, env) });
  } catch (error) {
    return errorResponse(error);
  }
}
