const MAX_UNWRAP_DEPTH = 6;

const FRIENDLY_ERRORS = {
  network: "I'm having trouble reaching the backend right now.",
  timeout: "This job is taking longer than expected.",
  long_running: "This is a bigger job. It may still be running.",
  invalid_json: "I finished the job, but I had trouble reading the result.",
  empty_response: "I finished the job, but I did not receive a readable result.",
  server: "The backend had a problem while I was working.",
  auth: "I do not have permission to reach that service right now.",
  not_found: "I could not find the backend route for that request.",
  rate_limited: "The backend is busy right now. Please wait a moment before trying again.",
  request: "I could not process that request as written.",
};

export function normalizeAriaResponse(rawResponse, options = {}) {
  const debug = { paths: [], parseErrors: [] };
  const root = unwrapTransport(rawResponse?.body ?? rawResponse, debug);
  const message = extractMessage(root, debug);
  const status = firstString(root?.status, root?.state, message ? "completed" : "failed");
  const success = Boolean(message) && root?.success !== false && !isFailureStatus(status);

  return {
    success,
    agent: firstString(root?.agent, "aria").toLowerCase(),
    status,
    message: message || "",
    agentsInvolved: normalizeAgentsInvolved(root?.agentsInvolved ?? root?.agents ?? root?.agent),
    findings: normalizeList(root?.findings),
    recommendations: normalizeList(root?.recommendations),
    needsAttention: normalizeList(root?.needsAttention ?? root?.needs_attention),
    requiresApproval: normalizeRequiresApproval(root?.requiresApproval ?? root?.requires_approval),
    approvalQuestion: firstString(root?.approvalQuestion, root?.question),
    proposedChange: firstString(root?.proposedChange, root?.change, root?.action),
    executionEndpoint: firstString(root?.executionEndpoint),
    changePayload: root?.changePayload || root?.payload || null,
    taskId: firstString(root?.taskId, root?.task_id, root?.executionId, root?.id),
    leadId: firstString(root?.leadId, root?.lead_id, root?.data?.leadId, options.leadId),
    statusCode: rawResponse?.statusCode,
    raw: root && typeof root === "object" ? root : {},
    debug,
    error: success ? null : friendlyErrorForStatus(rawResponse?.statusCode, "invalid_json"),
  };
}

export function normalizeAriaTransportError(error) {
  const statusCode = Number(error?.statusCode || 0);
  const code = error?.code || statusCodeToCode(statusCode) || (error?.message === "Failed to fetch" ? "network" : "unknown");
  return {
    message: friendlyErrorForStatus(statusCode, code),
    statusCode,
    code,
    rawMessage: error?.message || "",
  };
}

export function splitAriaMessageSections(message) {
  const clean = String(message || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const sections = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.length <= 360) {
      sections.push(paragraph);
      return;
    }

    const thoughts = paragraph
      .match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/gu)
      ?.map((part) => part.trim())
      .filter(Boolean) || [paragraph];
    let bucket = "";
    thoughts.forEach((thought) => {
      const next = bucket ? `${bucket} ${thought}` : thought;
      if (next.length > 420 && bucket) {
        sections.push(bucket);
        bucket = thought;
      } else {
        bucket = next;
      }
    });
    if (bucket) sections.push(bucket);
  });

  return sections.length ? sections : [clean];
}

export function formatElapsed(ms = 0) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (!minutes) return `${seconds} sec`;
  return `${minutes} min${minutes === 1 ? "" : "s"} ${seconds} sec`;
}

function unwrapTransport(value, debug, depth = 0) {
  if (depth >= MAX_UNWRAP_DEPTH) return value;
  const parsed = parseIfJsonString(value, debug);
  if (parsed !== value) return unwrapTransport(parsed, debug, depth + 1);
  if (Array.isArray(parsed)) {
    debug.paths.push("array[0]");
    return unwrapTransport(parsed[0], debug, depth + 1);
  }
  if (!parsed || typeof parsed !== "object") return parsed;

  const text = openAiText(parsed);
  if (text) {
    debug.paths.push("output[0].content[0].text");
    return unwrapTransport(text, debug, depth + 1);
  }

  const wrappers = ["data", "body", "result", "response", "output", "payload"];
  for (const key of wrappers) {
    if (parsed[key] == null) continue;
    if (key === "output" && Array.isArray(parsed[key]) && !openAiText(parsed)) continue;
    if (hasHumanMessage(parsed)) return parsed;
    debug.paths.push(key);
    return unwrapTransport(parsed[key], debug, depth + 1);
  }
  return parsed;
}

function extractMessage(root, debug) {
  const candidates = [
    root?.message,
    root?.data?.message,
    root?.body?.message,
    root?.result?.message,
    root?.response?.message,
    root?.text,
    root?.content,
    root?.summary,
    root?.reply,
  ];
  for (const candidate of candidates) {
    const parsed = parseIfJsonString(candidate, debug);
    if (parsed && typeof parsed === "object") {
      const nested = extractMessage(parsed, debug);
      if (nested) return nested;
    }
    const text = safeVisibleText(parsed);
    if (text) return text;
  }
  const outputText = openAiText(root);
  if (outputText) {
    const parsed = parseIfJsonString(outputText, debug);
    if (parsed && typeof parsed === "object") return extractMessage(parsed, debug);
    return safeVisibleText(outputText);
  }
  return "";
}

function parseIfJsonString(value, debug) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!looksLikeJson(text)) return value;
  try {
    return JSON.parse(text);
  } catch (error) {
    debug.parseErrors.push(error.message);
    return value;
  }
}

function looksLikeJson(text) {
  return (text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"));
}

function openAiText(value) {
  const content = Array.isArray(value?.output) ? value.output[0]?.content : value?.content;
  if (!Array.isArray(content)) return "";
  return firstString(content[0]?.text, content.find((item) => typeof item?.text === "string")?.text);
}

function hasHumanMessage(value) {
  return Boolean(firstString(value?.message, value?.text, value?.content, value?.summary, value?.reply));
}

function safeVisibleText(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || ["undefined", "null", "[object object]"].includes(text.toLowerCase())) return "";
  if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) return "";
  if (text.includes("{{ $json") || text.includes("JSON.parse") || text.includes("output[0].content[0].text")) return "";
  if (/^\s*(at\s+\S+|\w*Error:)/m.test(text)) return "";
  return text;
}

function normalizeRequiresApproval(value) {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

function normalizeAgentsInvolved(value) {
  const items = Array.isArray(value) ? value : [value];
  const map = {
    aria: "data",
    data: "data",
    sage: "research",
    research: "research",
    conversion: "research",
    milo: "content",
    content: "content",
    marketing: "content",
    forge: "automation",
    automation: "automation",
    developer: "automation",
    atlas: "manager",
    manager: "manager",
    operations: "manager",
  };
  return [...new Set(items.map((item) => map[String(item || "").trim().toLowerCase()]).filter(Boolean))];
}

function normalizeList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => {
    if (typeof item === "string") return item.trim();
    return firstString(item?.message, item?.summary, item?.text, item?.title);
  }).filter(Boolean);
}

function isFailureStatus(status) {
  return ["error", "failed", "failure"].includes(String(status || "").trim().toLowerCase());
}

function statusCodeToCode(statusCode) {
  if (statusCode === 408 || statusCode === 504) return "timeout";
  if (statusCode === 524) return "long_running";
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode === 404) return "not_found";
  if (statusCode >= 500) return "server";
  if (statusCode >= 400) return "request";
  return "";
}

function friendlyErrorForStatus(statusCode, code) {
  return FRIENDLY_ERRORS[statusCodeToCode(statusCode)] || FRIENDLY_ERRORS[code] || FRIENDLY_ERRORS.server;
}

function firstString(...values) {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}
