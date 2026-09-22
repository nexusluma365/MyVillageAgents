// Robust, side-effect-free transport parsing for ARIA/specialist HTTP responses.
//
// This is the ONE place that turns a raw HTTP response body (a string) into
// either a parsed JSON value or a safe "readable text" envelope. It is used
// on the server (server/ariaProxy.js) and can be reused on the client
// (src/domain/realAriaProvider.js) so both paths behave identically.
//
// Hard rules:
//   - Never dynamically execute response content (no eval, no `new Function`).
//   - NEVER throw a readable 200 response away. If JSON parsing fails but the
//     body contains visible text, that text becomes the message.
//   - Bounded recursion/unwrap depth. No infinite loops on adversarial input.

const MAX_UNWRAP_DEPTH = 6;
const WRAPPER_KEYS = ["data", "body", "result", "response", "output", "payload"];

/**
 * Parse a raw HTTP response body into a JS value, tolerating the transport
 * noise that real backends (n8n, OpenAI-shaped APIs, proxies) commonly add.
 *
 * Returns one of:
 *   { ok: true, value, unwrapped: false }              -- strict JSON.parse succeeded
 *   { ok: true, value, unwrapped: true, via }           -- recovered via fence/prose/brace extraction
 *   { ok: false, rawText, reason }                      -- nothing usable found
 */
export function parseTransportBody(text) {
  if (text == null) return { ok: false, rawText: "", reason: "empty" };

  const original = String(text);
  const stripped = stripBom(original).trim();

  if (!stripped) return { ok: false, rawText: "", reason: "empty" };

  // 1) Strict JSON, the common/fast path.
  const strict = tryJsonParse(stripped);
  if (strict.ok) return { ok: true, value: strict.value, unwrapped: false };

  // 2) Markdown-fenced JSON: ```json ... ``` or ``` ... ```
  const fenced = extractFencedJson(stripped);
  if (fenced) {
    const parsed = tryJsonParse(fenced);
    if (parsed.ok) return { ok: true, value: parsed.value, unwrapped: true, via: "markdown_fence" };
  }

  // 3) A JSON object/array embedded in surrounding prose — extract the first
  //    balanced {...} or [...] span using bracket counting (never regex that
  //    could truncate nested structures).
  const balanced = extractBalancedJson(stripped);
  if (balanced) {
    const parsed = tryJsonParse(balanced);
    if (parsed.ok) return { ok: true, value: parsed.value, unwrapped: true, via: "balanced_extract" };
  }

  // 4) Not JSON at all, but readable text. This is the case the original
  //    proxy discarded — never do that. HTML error pages are excluded here;
  //    callers decide whether HTML counts as "readable" (it does not).
  if (looksLikeHtml(stripped)) {
    return { ok: false, rawText: original, reason: "html" };
  }

  return { ok: false, rawText: original, reason: "not_json" };
}

/**
 * Given the raw response text and the HTTP status, build the canonical
 * transport-level envelope the rest of the app can safely consume:
 *   { success, status, message, ...rest }
 * This is where "readable text survives" is guaranteed.
 */
export function buildSafeEnvelope(text, { httpOk = true } = {}) {
  const parsed = parseTransportBody(text);

  if (parsed.ok) {
    const unwrapped = unwrapWrappers(parsed.value, 0);
    // A parsed JSON value that isn't an object/string (e.g. a bare number)
    // still shouldn't be thrown away.
    if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
      return unwrapped;
    }
    if (Array.isArray(unwrapped) && unwrapped.length) {
      const first = unwrapWrappers(unwrapped[0], 0);
      if (first && typeof first === "object") return first;
    }
    const asText = safeVisibleText(unwrapped);
    if (asText) {
      return { success: true, status: "completed", message: asText };
    }
    // Parsed but empty/unusable (null, {}, []) — treat as empty response.
    return httpOk
      ? { success: false, status: "failed", message: "" }
      : { success: false, status: "failed", message: "" };
  }

  if (parsed.reason === "empty") {
    return { success: false, status: "failed", message: "" };
  }

  if (parsed.reason === "html") {
    // Never show raw HTML (Cloudflare/edge error pages) to the owner.
    return { success: false, status: "failed", message: "" };
  }

  // reason === "not_json": we have readable text from a response that (per
  // the caller) came back with a successful HTTP status. Preserve it.
  const text2 = safeVisibleText(parsed.rawText);
  if (httpOk && text2) {
    return { success: true, status: "completed", message: text2 };
  }
  return { success: false, status: "failed", message: text2 };
}

function unwrapWrappers(value, depth) {
  if (depth >= MAX_UNWRAP_DEPTH) return value;
  if (value == null) return value;

  if (typeof value === "string") {
    const inner = tryJsonParse(value.trim());
    if (inner.ok) return unwrapWrappers(inner.value, depth + 1);
    return value;
  }

  if (Array.isArray(value)) {
    return value.length ? unwrapWrappers(value[0], depth + 1) : value;
  }

  if (typeof value === "object") {
    if (hasReadableMessage(value)) return value;

    const openAiText = extractOpenAiText(value);
    if (openAiText) return unwrapWrappers(openAiText, depth + 1);

    for (const key of WRAPPER_KEYS) {
      if (value[key] != null) return unwrapWrappers(value[key], depth + 1);
    }
    return value;
  }

  return value;
}

// OpenAI Responses-API-shaped output: { output: [{ content: [{ text }] }] }
// or the bare { content: [{ text }] } block form.
function extractOpenAiText(value) {
  const content = Array.isArray(value?.output) ? value.output[0]?.content : value?.content;
  if (!Array.isArray(content)) return null;
  const text = firstNonEmptyString(content[0]?.text, content.find((item) => typeof item?.text === "string")?.text);
  return text || null;
}

function hasReadableMessage(value) {
  return Boolean(
    firstNonEmptyString(value?.message, value?.text, value?.content, value?.summary, value?.reply)
  );
}

function firstNonEmptyString(...values) {
  return values.find((v) => typeof v === "string" && v.trim());
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function tryJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}

function extractFencedJson(text) {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1].trim() : null;
}

// Bounded balanced-bracket extraction: scans for the first `{` or `[` and
// walks forward counting nesting depth (respecting string literals and
// escapes) until it returns to zero. This never truncates nested JSON and
// never backtracks catastrophically like a greedy regex would.
function extractBalancedJson(text) {
  const openers = { "{": "}", "[": "]" };
  let startIdx = -1;
  let opener = null;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" || text[i] === "[") {
      startIdx = i;
      opener = text[i];
      break;
    }
  }
  if (startIdx === -1) return null;

  const closer = openers[opener];
  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;
  const MAX_SCAN = 2_000_000; // hard bound, never scan unbounded input forever

  for (let i = startIdx; i < text.length && i - startIdx < MAX_SCAN; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      continue;
    }

    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }

  return null; // unbalanced / truncated — do not guess
}

function looksLikeHtml(text) {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text) || /^\s*<\?xml/i.test(text);
}

function safeVisibleText(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  if (["undefined", "null", "[object object]"].includes(text.toLowerCase())) return "";
  if (looksLikeHtml(text)) return "";
  return text;
}

export const __internal = {
  extractBalancedJson,
  extractFencedJson,
  stripBom,
};
