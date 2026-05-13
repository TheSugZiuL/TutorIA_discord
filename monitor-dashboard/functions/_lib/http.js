export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function errorResponse(error) {
  const status = error instanceof HttpError ? error.statusCode : 500;
  const message = status === 500 ? "Internal server error" : error.message;
  return jsonResponse({ error: message }, status);
}

export async function readJson(request, maxBytes = 64 * 1024) {
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

export function requireMethod(request, method) {
  if (request.method !== method) {
    throw new HttpError(405, "Method not allowed");
  }
}
