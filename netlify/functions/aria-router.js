// Same-origin proxy for the production ARIA n8n webhook.
//
// The browser calls this Netlify Function, then the function calls n8n from
// the server. That avoids browser CORS failures and keeps ARIA as the real
// router/manager for the Village.
import { withHandler, json } from "./_shared/http.js";

const ARIA_WEBHOOK_URL = "https://nexusluma.app.n8n.cloud/webhook/aria-router";
const DEFAULT_TIMEOUT_MS = 55000;

export const handler = withHandler(async (payload) => {
  const message = String(payload?.message || payload?.request || "").trim();
  if (!message) {
    return json(400, { success: false, message: "Tell ARIA what you need before she can help." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(ARIA_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });
    const text = await response.text();
    const body = parseBody(text);

    if (!response.ok) {
      return json(response.status, {
        success: false,
        message: readableError(body) || `ARIA returned an error (${response.status}).`,
      });
    }

    if (!text.trim()) {
      return json(502, {
        success: false,
        message: "ARIA answered with an empty response. Check the n8n Respond to Webhook step.",
      });
    }

    return json(200, body);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return json(504, {
      success: false,
      message: timedOut
        ? "ARIA took too long to answer."
        : "ARIA could not be reached from the Village.",
    });
  } finally {
    clearTimeout(timeout);
  }
});

function parseBody(text) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: "ARIA returned a response the Village could not read." };
  }
}

function readableError(body) {
  return [body?.message, body?.error, body?.detail, body?.result?.message]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}
