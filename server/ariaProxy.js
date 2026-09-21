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
    const body = parseBody(text);

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: {
          success: false,
          message: readableError(body) || `ARIA returned an error (${response.status}).`,
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

function parseBody(text) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: "I finished the job, but I had trouble reading the result." };
  }
}

function readableError(body) {
  return [body?.message, body?.error, body?.detail, body?.result?.message]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}
