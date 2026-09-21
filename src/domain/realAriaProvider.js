const ARIA_TASK_ID = "process_rental_qualification";
const ARIA_ROUTE_TASK_ID = "aria_route_request";
const DEFAULT_ARIA_ROUTER_URL = "/api/aria-router";
const DEFAULT_TIMEOUT_MS = 180000;

export class RealAriaProvider {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.endpoint = options.endpoint ?? import.meta.env.VITE_ARIA_HANDOFF_URL ?? "";
    this.routerEndpoint = options.routerEndpoint ?? import.meta.env.VITE_ARIA_ROUTER_URL ?? DEFAULT_ARIA_ROUTER_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._taskSeq = 1;
  }

  assignTask(agent, agentConfig, taskDef, params = {}) {
    const parameters = taskDef.id === ARIA_ROUTE_TASK_ID
      ? { request: String(params.request || "").trim(), specialist: params.specialist || "auto", context: params.context || null }
      : { leadId: String(params.leadId || "").trim() };
    const task = {
      id: "aria-" + this._taskSeq++,
      agentId: agent.id,
      type: taskDef.id,
      title: taskDef.label,
      parameters,
      status: "queued",
      stage: "Assigned",
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
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
      if (task.type === ARIA_ROUTE_TASK_ID) {
        await this.runRouterTask(task);
        return;
      }

      validateAriaTask(task, this.endpoint);
      task.status = "processing";
      task.stage = "Preparing";
      task.startedAt = Date.now();
      this.bus.emit("task.started", { agentId: task.agentId, task: { ...task } });

      task.stage = "Working";
      this.bus.emit("task.progress", {
        agentId: task.agentId,
        task: { ...task, result: "Reviewing renter qualification information." },
      });

      const response = await postAriaHandoff(this.endpoint, { leadId: task.parameters.leadId }, this.timeoutMs);
      const normalized = normalizeAriaResponse(response, task.parameters.leadId);

      if (!normalized.success) {
        throw new AriaProviderError(normalized.error || "Aria could not process this rental qualification.", normalized.statusCode);
      }

      task.status = "completed";
      task.stage = "Complete";
      task.completedAt = Date.now();
      task.result = normalized.summary || "Rental qualification processing is complete.";
      task.resultMeta = {
        leadId: normalized.leadId,
        status: normalized.status,
        taskId: normalized.taskId,
      };
      this.bus.emit("task.completed", { agentId: task.agentId, task: { ...task } });
    } catch (error) {
      const clean = normalizeAriaError(error);
      task.status = "failed";
      task.stage = "Error";
      task.completedAt = Date.now();
      task.error = clean.message;
      task.errorMeta = { statusCode: clean.statusCode, code: clean.code };
      console.error("[RealAriaProvider]", error);
      this.bus.emit("task.failed", { agentId: task.agentId, task: { ...task } });
    }
  }

  async runRouterTask(task) {
    validateAriaRouterTask(task, this.routerEndpoint);
    task.status = "processing";
    task.stage = "Preparing";
    task.startedAt = Date.now();
    this.bus.emit("task.started", { agentId: task.agentId, task: { ...task } });

    task.stage = "Working";
    this.bus.emit("task.progress", {
      agentId: task.agentId,
      task: { ...task, result: "ARIA is thinking..." },
    });

    const response = await postAriaHandoff(this.routerEndpoint, {
      message: buildAriaMessage(task.parameters.request || "", task.parameters.specialist || "auto"),
    }, this.timeoutMs);
    const body = response.body || {};
    if (body.success === false || body.status === "error" || body.status === "failed") {
      throw new AriaProviderError(safeMessageFromBody(body) || "ARIA could not finish that request.", response.statusCode, "router_error");
    }
    const formatted = formatAriaRouterResponse(body);
    const requiresApproval = normalizeRequiresApproval(body.requiresApproval);

    task.status = "completed";
    task.stage = "Complete";
    task.completedAt = Date.now();
    task.result = formatted;
    task.resultMeta = {
      raw: body,
      status: firstString(body.status, "completed"),
      publicSummary: formatted,
      agentsInvolved: normalizeAgentsInvolved(body.agentsInvolved, body.agent),
      requiresApproval,
      needsAttention: normalizeList(body.needsAttention),
      recommendations: normalizeList(body.recommendations),
      findings: normalizeList(body.findings),
      approvalQuestion: buildApprovalQuestion(body, formatted),
      proposedChange: firstString(body.proposedChange, body.change, body.action),
      executionEndpoint: firstString(body.executionEndpoint),
      changePayload: body.changePayload || body.payload || null,
    };
    this.bus.emit("task.completed", { agentId: task.agentId, task: { ...task } });
  }
}

export function isRealAriaTask(agent, taskDef) {
  return agent?.id === "data" && (taskDef?.id === ARIA_TASK_ID || taskDef?.id === ARIA_ROUTE_TASK_ID);
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

function formatAriaRouterResponse(body = {}) {
  const message = firstString(body.message);
  if (message) return message;

  console.warn("[RealAriaProvider] ARIA response did not include a message field.", body);
  const fallback = firstString(body.summary, body.reply, body.result?.message, body.result?.summary);
  if (fallback) return fallback;

  return "ARIA finished the task, but no message was returned.";
}

function normalizeRequiresApproval(value) {
  if (value === true) return true;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
}

function normalizeAgentsInvolved(agentsInvolved, agent) {
  const items = Array.isArray(agentsInvolved) ? [...agentsInvolved] : [];
  if (agent) items.push(agent);
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
  return [...new Set(items
    .map((item) => map[String(item || "").trim().toLowerCase()])
    .filter(Boolean))];
}

function normalizeList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item?.message === "string") return item.message.trim();
      if (typeof item?.summary === "string") return item.summary.trim();
      if (typeof item?.text === "string") return item.text.trim();
      return "";
    })
    .filter(Boolean);
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
    const body = parseJsonBody(text, { strict: response.ok });

    if (!response.ok) {
      const message = safeMessageFromBody(body) || httpStatusMessage(response.status);
      throw new AriaProviderError(message, response.status, "http_error");
    }

    return { statusCode: response.status, body };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AriaProviderError("ARIA took too long to answer.", 0, "timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonBody(text, options = {}) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    if (!options.strict) return {};
    throw new AriaProviderError("Aria returned a response the Village could not read.", 0, "invalid_json");
  }
}

export function normalizeAriaResponse(response, leadId) {
  const body = response?.body ?? {};
  const success = body.success !== false && body.status !== "error" && body.status !== "failed";
  const summary = firstString(
    body.summary,
    body.message,
    body.result?.summary,
    body.data?.summary,
    success ? "Rental qualification processing is complete." : "Aria could not finish this rental review."
  );

  return {
    success,
    taskId: firstString(body.taskId, body.task_id, body.executionId, body.id),
    leadId: firstString(body.leadId, body.lead_id, body.data?.leadId, leadId),
    status: firstString(body.status, body.result?.status, success ? "completed" : "failed"),
    summary,
    statusCode: response?.statusCode,
    error: success ? null : summary,
  };
}

function normalizeAriaError(error) {
  if (error instanceof AriaProviderError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
    };
  }
  if (error?.message === "Failed to fetch") {
    return { message: "ARIA could not be reached from the Village.", statusCode: 0, code: "network" };
  }
  return {
    message: "ARIA could not finish this request.",
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
  if (status === 400) return "ARIA could not process that request.";
  if (status === 401 || status === 403) return "ARIA is not authorized to access that service.";
  if (status === 404) return "ARIA could not find that service.";
  if (status === 504) return "ARIA is still waiting on the backend, but the host ended the request.";
  if (status >= 500) return "The ARIA service had a server error.";
  return "ARIA could not finish this request.";
}

class AriaProviderError extends Error {
  constructor(message, statusCode = 0, code = "aria_provider_error") {
    super(message);
    this.name = "AriaProviderError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
