import { buildSafeEnvelope } from "../src/domain/transportParse.js";

const ARIA_WEBHOOK_URL = "https://nexusluma.app.n8n.cloud/webhook/aria-router";

export async function proxyAriaRequest(payload, options = {}) {
  const message = String(payload?.message || payload?.request || "").trim();
  if (!message) {
    return {
      statusCode: 400,
      body: { success: false, message: "Tell ARIA what you need before she can help." },
    };
  }

  const timeoutMs = Number(options.timeoutMs || 0);
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(ARIA_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, requestId: payload?.requestId || payload?.clientRequestId || undefined }),
      signal: controller?.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      // Even on a non-2xx status, try to recover a readable message from the
      // body (n8n/OpenAI-shaped error bodies, or plain text) before falling
      // back to a generic status message. We never throw the body away.
      const errorBody = buildSafeEnvelope(text, { httpOk: false });
      return {
        statusCode: response.status,
        body: {
          success: false,
          message: readableError(errorBody) || statusFallbackMessage(response.status),
        },
      };
    }

    if (!text.trim()) {
      return {
        statusCode: 502,
        body: {
          success: false,
          message: "ARIA answered with an empty response. Check the n8n Respond to Webhook step.",
        },
      };
    }

    // This is the fix for the large-response bug: strict JSON.parse failing
    // no longer discards a readable answer. buildSafeEnvelope tries strict
    // JSON, then markdown-fenced JSON, then balanced-bracket extraction,
    // then falls back to the raw readable text itself — all before
    // src/domain/ariaResponseNormalizer.js ever sees it.
    const body = buildSafeEnvelope(text, { httpOk: true });

    return { statusCode: 200, body };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return {
      statusCode: timedOut ? 504 : 502,
      body: {
        success: false,
        message: timedOut
          ? "This job is taking longer than expected."
          : "I'm having trouble reaching the backend right now.",
      },
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function readableError(body) {
  return [body?.message, body?.error, body?.detail, body?.result?.message]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}

// 524 (Cloudflare "a timeout occurred") is a distinct failure mode from a
// generic server error or malformed JSON: the request path itself timed
// out, it does not mean the job failed or that the body was unreadable.
function statusFallbackMessage(status) {
  if (status === 524) return "This job is taking longer than expected.";
  if (status === 504 || status === 408) return "This job is taking longer than expected.";
  if (status === 502 || status === 503) return "The backend had a problem while I was working.";
  if (status === 429) return "The backend is busy right now. Please wait a moment before trying again.";
  return `ARIA returned an error (${status}).`;
}
