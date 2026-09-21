export const ARIA_AGENT_ID = "data";

export const SPECIALIST_AGENT_IDS = ["content", "research", "automation", "manager"];

export const SPECIALIST_LABELS = {
  content: "Marketing",
  research: "Conversion",
  automation: "Website / Developer",
  manager: "Listings",
};

export function isAria(agentId) {
  return agentId === ARIA_AGENT_ID;
}

export function isSpecialist(agentId) {
  return SPECIALIST_AGENT_IDS.includes(agentId);
}

// Snapshot of live agent state sent to Aria's backend so she can answer
// "what's the team doing" style questions with real status instead of
// guessing. Aria-only — never forwarded to specialists.
export function buildAgentContextSnapshot(agents = {}, specialistStatus = {}) {
  const snapshot = {};
  Object.values(agents).forEach((agent) => {
    const id = agent.cfg.id;
    snapshot[id] = {
      name: agent.cfg.name,
      role: agent.cfg.role,
      status: agent.status,
      currentTask: agent.currentTask?.title || null,
      lastResult: specialistStatus[id]?.lastResult || null,
    };
  });
  return snapshot;
}

export function sanitizeTaskForSpecialistPanel(task) {
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    stage: task.stage,
    currentTask: task.title,
    lastResult: summarizeResult(task),
    updatedAt: task.completedAt || task.startedAt || task.createdAt || Date.now(),
  };
}

export function summarizeResult(task) {
  if (!task) return "";
  if (task.error) return task.error;
  if (task.resultMeta?.publicSummary) return task.resultMeta.publicSummary;
  if (typeof task.result !== "string") return "";
  const firstLine = task.result.split("\n").find((line) => line.trim()) || task.result;
  return firstLine.slice(0, 180);
}

export function approvalFromTask(task, agentConfig) {
  const meta = task?.resultMeta || {};
  const requiresApproval = meta.requiresApproval === true;
  if (!requiresApproval || task?.status !== "completed") return null;

  const label = SPECIALIST_LABELS[task.agentId] || agentConfig?.role || "Specialist";
  return {
    id: "approval-" + task.id,
    taskId: task.id,
    agentId: ARIA_AGENT_ID,
    specialistId: task.agentId,
    title: meta.approvalTitle || task.title,
    question: meta.approvalQuestion || `The ${label} specialist recommends this change. Approve or reject?`,
    summary: meta.publicSummary || summarizeResult(task) || "A specialist result is ready for your review.",
    proposedChange: meta.proposedChange || task.result || "",
    executionEndpoint: meta.executionEndpoint || "",
    changePayload: meta.changePayload || null,
    status: "pending",
    createdAt: Date.now(),
    decidedAt: null,
    decisionResult: null,
  };
}
