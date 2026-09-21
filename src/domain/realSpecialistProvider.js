import { SPECIALIST_LABELS } from "./ariaRouter.js";

const DEFAULT_TIMEOUT_MS = 60000;

const ENDPOINT_ENV = {
  content: "VITE_MARKETING_AGENT_URL",
  research: "VITE_CONVERSION_AGENT_URL",
  automation: "VITE_WEBSITE_AGENT_URL",
  manager: "VITE_LISTINGS_AGENT_URL",
};

export class RealSpecialistProvider {
  constructor(bus, options = {}) {
    this.bus = bus;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._taskSeq = 1;
  }

  assignTask(agent, agentConfig, taskDef, params = {}) {
    const task = {
      id: "real-" + this._taskSeq++,
      agentId: agent.id,
      type: taskDef.id,
      title: taskDef.label,
      parameters: params,
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

  async runTask(task, agentConfig) {
    try {
      const endpoint = specialistEndpoint(task.agentId);
      if (!endpoint) {
        throw new SpecialistProviderError(
          `${SPECIALIST_LABELS[task.agentId] || agentConfig.name} is not connected. Set ${ENDPOINT_ENV[task.agentId]} or VITE_SPECIALIST_AGENT_URL.`,
          0,
          "missing_endpoint"
        );
      }

      task.status = "processing";
      task.stage = "Preparing";
      task.startedAt = Date.now();
      this.bus.emit("task.started", { agentId: task.agentId, task: { ...task } });

      task.stage = "Working";
      this.bus.emit("task.progress", { agentId: task.agentId, task: { ...task } });

      const response = await postJson(endpoint, {
        agentId: task.agentId,
        specialist: SPECIALIST_LABELS[task.agentId],
        taskType: task.type,
        title: task.title,
        parameters: task.parameters,
      }, this.timeoutMs);
      const normalized = normalizeSpecialistResponse(response, task);

      if (!normalized.success) {
        throw new SpecialistProviderError(normalized.error || "The specialist backend could not finish the task.", normalized.statusCode);
      }

      task.status = "completed";
      task.stage = "Complete";
      task.completedAt = Date.now();
      task.result = normalized.result;
      task.resultMeta = normalized.meta;
      this.bus.emit("task.completed", { agentId: task.agentId, task: { ...task } });
    } catch (error) {
      const clean = normalizeSpecialistError(error);
      task.status = "failed";
      task.stage = "Error";
      task.completedAt = Date.now();
      task.error = clean.message;
      task.errorMeta = { statusCode: clean.statusCode, code: clean.code };
      console.error("[RealSpecialistProvider]", error);
      this.bus.emit("task.failed", { agentId: task.agentId, task: { ...task } });
    }
  }
}

function specialistEndpoint(agentId) {
  const specific = import.meta.env[ENDPOINT_ENV[agentId]];
  return specific || import.meta.env.VITE_SPECIALIST_AGENT_URL || "";
}

async function postJson(endpoint, payload, timeoutMs) {
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
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new SpecialistProviderError(firstString(body.message, body.error, body.detail) || "Specialist backend request failed.", response.status, "http_error");
    }
    return { statusCode: response.status, body };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new SpecialistProviderError("The specialist backend timed out.", 0, "timeout");
    }
    if (error instanceof SyntaxError) {
      throw new SpecialistProviderError("The specialist backend returned unreadable JSON.", 0, "invalid_json");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSpecialistResponse(response, task) {
  const body = response.body || {};
  const success = body.success !== false && body.status !== "error" && body.status !== "failed";
  const result = firstString(body.result, body.summary, body.message, body.data?.result, body.data?.summary, "Specialist task complete.");
  return {
    success,
    result,
    statusCode: response.statusCode,
    error: success ? null : result,
    meta: {
      publicSummary: firstString(body.publicSummary, body.public_summary, body.summary, body.message, result),
      requiresApproval: Boolean(body.requiresApproval || body.requires_approval || body.approvalRequired),
      approvalTitle: firstString(body.approvalTitle, body.approval_title),
      approvalQuestion: firstString(body.approvalQuestion, body.approval_question),
      proposedChange: firstString(body.proposedChange, body.proposed_change, body.change?.summary),
      executionEndpoint: firstString(body.executionEndpoint, body.execution_endpoint, body.approval?.executionEndpoint),
      changePayload: body.changePayload || body.change_payload || body.change || null,
      backendTaskId: firstString(body.taskId, body.task_id, body.id),
      sourceTaskId: task.id,
    },
  };
}

function normalizeSpecialistError(error) {
  if (error instanceof SpecialistProviderError) {
    return { message: error.message, statusCode: error.statusCode, code: error.code };
  }
  if (error?.message === "Failed to fetch") {
    return { message: "Aria could not reach the specialist backend.", statusCode: 0, code: "network" };
  }
  return { message: "The specialist backend could not finish this task.", statusCode: 0, code: "unknown" };
}

function firstString(...values) {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}

class SpecialistProviderError extends Error {
  constructor(message, statusCode = 0, code = "specialist_provider_error") {
    super(message);
    this.name = "SpecialistProviderError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
