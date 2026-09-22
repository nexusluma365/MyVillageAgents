import { normalizeAriaResponse, normalizeAriaTransportError } from "./ariaResponseNormalizer.js";
import { buildSafeEnvelope } from "./transportParse.js";

const ARIA_TASK_ID = "process_rental_qualification";
const ARIA_ROUTE_TASK_ID = "aria_route_request";
const DEFAULT_ARIA_ROUTER_URL = "/api/aria-router";
const DEFAULT_TIMEOUT_MS = 330000;

export class RealAriaProvider {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.endpoint = options.endpoint ?? import.meta.env.VITE_ARIA_HANDOFF_URL ?? "";
    this.routerEndpoint = options.routerEndpoint ?? import.meta.env.VITE_ARIA_ROUTER_URL ?? DEFAULT_ARIA_ROUTER_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._taskSeq = 1;
  }

  assignTask(agent, agentConfig, taskDef, params = {}) {
    const parameters = taskDef.id === ARIA_TASK_ID
      ? { leadId: String(params.leadId || "").trim() }
      : {
        request: buildOwnerRequest(taskDef, params),
        specialist: params.specialist || "auto",
        context: params.context || null,
      };
    const requestId = createRequestId();
    const userMessage = taskDef.id === ARIA_TASK_ID ? String(parameters.leadId || "") : String(parameters.request || "");
    const task = {
      id: "aria-" + this._taskSeq++,
      requestId,
      agentId: agent.id,
      type: taskDef.id,
      title: taskDef.label,
      parameters,
      userMessage,
      route: parameters.specialist || "aria",
      status: "queued",
      requestState: "idle",
      stage: "Assigned",
      createdAt: Date.now(),
      startedAt: null,
      startedPerf: null,
      completedAt: null,
      elapsedMs: null,
      result: null,
      resultMeta: null,
      error: null,
    };

    this.bus.emit("agent.task.assigned", { agentId: agent.id, task: { ...task } });
    queueMicrotask(() => this.runTask(task, agentConfig));
    return task;
  }

  async runTask(task) {
    try {
      if (task.type !== ARIA_TASK_ID) {
        await this.runRouterTask(task);
        return;
      }

      validateAriaTask(task, this.endpoint);
      task.status = "processing";
      task.requestState = "sending";
      task.stage = "Preparing";
      task.startedAt = Date.now();
      task.startedPerf = performance.now();
      this.bus.emit("task.started", { agentId: task.agentId, task: { ...task } });

      task.stage = "Working";
      task.requestState = "working";
      this.bus.emit("task.progress", {
        agentId: task.agentId,
        task: { ...task, result: "Reviewing renter qualification information." },
      });

      const response = await postAriaHandoff(this.endpoint, { leadId: task.parameters.leadId, requestId: task.requestId }, this.timeoutMs);
      const normalized = normalizeAriaResponse(response, { leadId: task.parameters.leadId });

      if (!normalized.success) {
        throw new AriaProviderError(normalized.error || "Aria could not process this rental qualification.", normalized.statusCode);
      }

      task.status = "completed";
      task.requestState = "completed";
      task.stage = "Complete";
      task.completedAt = Date.now();
      task.elapsedMs = elapsedSince(task.startedPerf);
      task.result = normalized.message || "Rental qualification processing is complete.";
      task.resultMeta = {
        leadId: normalized.leadId,
        status: normalized.status,
        taskId: normalized.taskId,
        normalizedResponse: normalized,
        requestId: task.requestId,
        userMessage: task.userMessage,
        route: task.route,
        elapsedMs: task.elapsedMs,
      };
      this.bus.emit("task.completed", { agentId: task.agentId, task: { ...task } });
    } catch (error) {
      const clean = normalizeAriaError(error);
      task.status = clean.code === "long_running" || clean.code === "timeout" ? "timed_out" : "failed";
      task.requestState = task.status;
      task.stage = clean.code === "long_running" || clean.code === "timeout" ? "Working" : "Error";
      task.completedAt = Date.now();
      task.elapsedMs = elapsedSince(task.startedPerf, task.startedAt, task.completedAt);
      task.error = clean.message;
      task.errorMeta = { statusCode: clean.statusCode, code: clean.code };
      console.error("[RealAriaProvider]", error);
      this.bus.emit("task.failed", { agentId: task.agentId, task: { ...task } });
    }
  }

  async runRouterTask(task) {
    validateAriaRouterTask(task, this.routerEndpoint);
    task.status = "processing";
    task.requestState = "sending";
    task.stage = "Preparing";
    task.startedAt = Date.now();
    task.startedPerf = performance.now();
    this.bus.emit("task.started", { agentId: task.agentId, task: { ...task } });

    task.stage = "Working";
    task.requestState = "working";
    this.bus.emit("task.progress", {
      agentId: task.agentId,
      task: { ...task, result: "ARIA is thinking..." },
    });

    const response = await postAriaHandoff(this.routerEndpoint, {
      message: buildAriaMessage(task.parameters.request || "", task.parameters.specialist || "auto"),
      requestId: task.requestId,
    }, this.timeoutMs);
    task.requestState = "processing";
    this.bus.emit("task.progress", {
      agentId: task.agentId,
      task: { ...task, result: "ARIA is putting everything together..." },
    });

    const normalized = normalizeAriaResponse(response);
    if (import.meta.env.DEV) {
      console.debug("[RealAriaProvider] normalized ARIA response", {
        requestId: task.requestId,
        statusCode: response.statusCode,
        elapsedMs: elapsedSince(task.startedPerf, task.startedAt),
        normalizationPath: normalized.debug?.paths,
        parseErrors: normalized.debug?.parseErrors,
      });
    }

    if (!normalized.success) {
      throw new AriaProviderError(normalized.error || "I finished the job, but I had trouble reading the result.", response.statusCode, "invalid_response");
    }
    const body = normalized.raw || {};
    const formatted = normalized.message;
    const requiresApproval = normalized.requiresApproval;

    task.status = "completed";
    task.requestState = requiresApproval ? "needs_approval" : "completed";
    task.stage = "Complete";
    task.completedAt = Date.now();
    task.elapsedMs = elapsedSince(task.startedPerf);
    task.result = formatted;
    task.resultMeta = {
      raw: body,
      normalizedResponse: normalized,
      status: normalized.status,
      publicSummary: formatted,
      agentsInvolved: normalized.agentsInvolved,
      requiresApproval,
      needsAttention: normalized.needsAttention,
      recommendations: normalized.recommendations,
      findings: normalized.findings,
      approvalQuestion: buildApprovalQuestion(normalized, formatted),
      proposedChange: normalized.proposedChange,
      executionEndpoint: normalized.executionEndpoint,
      changePayload: normalized.changePayload,
      requestId: task.requestId,
      userMessage: task.userMessage,
      route: task.route,
      elapsedMs: task.elapsedMs,
    };
    this.bus.emit("task.completed", { agentId: task.agentId, task: { ...task } });
  }
}

export function isRealAriaTask(agent, taskDef) {
  return agent?.id === "data" && Boolean(taskDef?.id);
}

function buildOwnerRequest(taskDef, params = {}) {
  const direct = firstString(params.request, params.instructions, params.dataset, params.source, params.recordType, params.topic);
  if (!direct) return "";
  if (taskDef?.id === ARIA_ROUTE_TASK_ID || taskDef?.quickRequest || taskDef?.requestTemplate) return direct;
  return `Owner selected "${taskDef?.label || "Ask Aria"}" in the Village.\n\n${direct}`;
}

function validateAriaTask(task, endpoint) {
  if (!endpoint) {
    throw new AriaProviderError("Aria backend URL is not configured. Set VITE_ARIA_HANDOFF_URL.", 0, "missing_endpoint");
  }
  if (!task.parameters.leadId) {
    throw new AriaProviderError("Lead ID is required before Aria can process this rental qualification.", 400, "invalid_lead_id");
  }
}

function validateAriaRouterTask(task, endpoint) {
  if (!endpoint) {
    throw new AriaProviderError("Aria router URL is not configured.", 0, "missing_router_endpoint");
  }
  if (!firstString(task.parameters.request)) {
    throw new AriaProviderError("Tell Aria what you need before she can route the request.", 400, "invalid_request");
  }
}

function buildAriaMessage(request, specialist) {
  const cleanRequest = String(request || "").trim();
  const hint = normalizeSpecialistHint(specialist);
  if (!hint) return cleanRequest;
  return `${cleanRequest}\n\nOwner route hint: Please have ${hint} look at this if that makes sense. Do not bypass ARIA. ARIA should decide and reply to the owner.`;
}

function normalizeSpecialistHint(specialist) {
  const map = {
    sage: "SAGE",
    milo: "MILO",
    forge: "FORGE",
    atlas: "ATLAS",
    research: "SAGE",
    content: "MILO",
    automation: "FORGE",
    manager: "ATLAS",
  };
  const key = String(specialist || "auto").trim().toLowerCase();
  if (!key || key === "auto" || key === "all") return "";
  return map[key] || key.toUpperCase();
}

function buildApprovalQuestion(body = {}, fallback = "") {
  return firstString(
    body.approvalQuestion,
    body.question,
    body.requiresApproval ? body.message : "",
    fallback,
    "ARIA needs your approval before the next step. Should she go ahead?"
  );
}

async function postAriaHandoff(endpoint, payload, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      const body = buildSafeEnvelope(text, { httpOk: false });
      const message = safeMessageFromBody(body) || httpStatusMessage(response.status);
      throw new AriaProviderError(message, response.status, response.status === 524 ? "long_running" : "http_error");
    }

    // Same fix as server/ariaProxy.js: a readable 200 response body must
    // never be discarded just because it isn't strict JSON.
    const body = buildSafeEnvelope(text, { httpOk: true });
    return { statusCode: response.status, body };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AriaProviderError("This job is taking longer than expected.", 0, "timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAriaError(error) {
  if (error instanceof AriaProviderError) {
    const clean = normalizeAriaTransportError(error);
    return {
      message: clean.message,
      statusCode: error.statusCode,
      code: clean.code,
    };
  }
  if (error?.message === "Failed to fetch") {
    return { message: "I'm having trouble reaching the backend right now.", statusCode: 0, code: "network" };
  }
  return {
    message: "The backend had a problem while I was working.",
    statusCode: 0,
    code: "unknown",
  };
}

function firstString(...values) {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}

function safeMessageFromBody(body) {
  return firstString(body?.message, body?.error, body?.detail, body?.result?.message);
}

function httpStatusMessage(status) {
  if (status === 400) return "I could not process that request as written.";
  if (status === 401 || status === 403) return "I do not have permission to reach that service right now.";
  if (status === 404) return "I could not find the backend route for that request.";
  if (status === 408 || status === 504) return "This job is taking longer than expected.";
  if (status === 524) return "This job is taking longer than expected.";
  if (status === 429) return "The backend is busy right now. Please wait a moment before trying again.";
  if (status >= 500) return "The backend had a problem while I was working.";
  return "I could not finish this request.";
}

function createRequestId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `aria-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function elapsedSince(startPerf, startedAt, completedAt) {
  if (typeof startPerf === "number" && completedAt == null) return Math.max(0, Math.round(performance.now() - startPerf));
  if (typeof startPerf === "number" && startedAt && completedAt) return Math.max(0, completedAt - startedAt);
  return startedAt ? Math.max(0, completedAt - startedAt) : null;
}

class AriaProviderError extends Error {
  constructor(message, statusCode = 0, code = "aria_provider_error") {
    super(message);
    this.name = "AriaProviderError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
