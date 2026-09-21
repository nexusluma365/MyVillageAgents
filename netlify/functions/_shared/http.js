// Shared HTTP plumbing for all RentReady Agent Gateway functions:
// CORS, method guarding, JSON body parsing, and a catch-all error boundary
// so a thrown error never surfaces as an opaque 502 to the frontend.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

export function text(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
    body,
  };
}

// Wraps a Netlify Functions v1 handler: (payload, event) => response.
// Handles OPTIONS preflight, enforces POST, parses JSON, and converts any
// thrown error into a structured JSON error response instead of a crash.
export function withHandler(fn) {
  return async (event) => {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, message: "Method not allowed. Use POST." });
    }

    let payload;
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { success: false, message: "Invalid JSON body." });
    }

    try {
      return await fn(payload, event);
    } catch (error) {
      console.error("[gateway] unhandled error:", error);
      return json(500, { success: false, message: error?.message || "Internal gateway error." });
    }
  };
}

export function providerErrorStatus(error) {
  return error?.code === "missing_api_key" || error?.code === "provider_error" ? 502 : 500;
}
