import { create } from "zustand";
import { AGENTS_CONFIG } from "../domain/agentsConfig.js";
import { EventBus } from "../domain/eventBus.js";
import { AgentProviderRouter } from "../domain/agentProviderRouter.js";
import { HistoryStore } from "../domain/historyStore.js";
import {
  ARIA_AGENT_ID,
  SPECIALIST_AGENT_IDS,
  approvalFromTask,
  buildAgentContextSnapshot,
  isAria,
  isSpecialist,
  sanitizeTaskForSpecialistPanel,
} from "../domain/ariaRouter.js";
import { createMotion } from "./motion.js";
import { AgentRuntime } from "./AgentRuntime.js";
import { playNewSaleSound } from "../domain/soundSystem.js";
import { showBusinessNotification } from "../domain/notificationSystem.js";

const bus = new EventBus();
const provider = new AgentProviderRouter(bus);
const runtimes = {};
let toastSeq = 1;
let agentsInitialized = false;
const BUSINESS_EVENT_DEDUPE_KEY = "rentready_business_event_ids_v1";
const handledBusinessEventIds = loadHandledBusinessEventIds();

const initialAgents = {};
AGENTS_CONFIG.forEach((cfg) => {
  initialAgents[cfg.id] = { cfg, status: "idle", currentTask: null, bubble: "" };
});

export const useVillageStore = create((set, get) => ({
  bus,
  provider,
  agents: initialAgents,
  selectedAgentId: null,
  taskMenu: { open: false, agentId: null, taskDef: null },
  detailPanel: { open: false, agentId: null, mode: null }, // mode: 'progress' | 'error' | 'history'
  historyView: null, // history record being viewed in detailPanel when mode === 'history'
  activityPanel: { open: false, tab: "active" },
  pendingApprovals: [],
  specialistStatus: {},
  toasts: [],
  agentAlert: { open: false, agentId: null, type: null, message: "", task: null },
  buildingGlow: {},
  beams: [],
  providerHealth: "connected",
  providerLabel: "Aria Router — Real Backends",

  // ---- bootstrap ----
  initAgents: () => {
    if (agentsInitialized) return;
    agentsInitialized = true;
    AGENTS_CONFIG.forEach((cfg) => {
      createMotion(cfg);
      runtimes[cfg.id] = new AgentRuntime(cfg, bus, provider, { getState: get, setState: set });
    });
    Object.values(runtimes).forEach((r) => r.init());
  },

  // ---- per-agent setters used by AgentRuntime ----
  setAgentStatus: (id, status) => set((s) => ({
    agents: { ...s.agents, [id]: { ...s.agents[id], status } },
  })),
  setAgentTask: (id, task) => set((s) => ({
    agents: { ...s.agents, [id]: { ...s.agents[id], currentTask: task } },
  })),
  setAgentBubble: (id, bubble) => set((s) => ({
    agents: { ...s.agents, [id]: { ...s.agents[id], bubble } },
  })),
  setBuildingGlow: (id, on) => set((s) => ({
    buildingGlow: { ...s.buildingGlow, [id]: on },
  })),
  pushToast: (message, kind) => {
    const toastId = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id: toastId, message, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toastId) }));
    }, 3600);
  },
  openAgentAlert: (agentId, type, message, priority = "normal", task = null) => set({ agentAlert: { open: true, agentId, type, message, priority, task } }),
  closeAgentAlert: () => set({ agentAlert: { open: false, agentId: null, type: null, message: "", task: null } }),
  setProviderHealth: (providerHealth) => set({
    providerHealth,
    providerLabel: providerHealth === "offline"
      ? "Aria Router — Offline"
      : providerHealth === "working"
        ? "Aria Router — Working"
        : providerHealth === "degraded"
          ? "Aria Router — Degraded"
          : "Aria Router — Real Backends",
  }),
  addHistory: (record) => { HistoryStore.add(record); },
  receiveBusinessEvent: (eventPayload) => {
    const event = normalizeBusinessEvent(eventPayload);
    if (!event) return false;
    if (event.eventId) {
      if (handledBusinessEventIds.has(event.eventId)) return false;
      rememberBusinessEventId(event.eventId);
    }

    const record = {
      id: event.eventId ? `business-${event.eventId}` : `business-${event.event}-${Date.now()}`,
      agentId: ARIA_AGENT_ID,
      agentName: "Aria",
      emoji: "📊",
      title: event.event === "new_sale" ? "New Sale" : "New Lead",
      status: "completed",
      result: event.message,
      error: null,
      completedAt: event.timestamp ? Date.parse(event.timestamp) || Date.now() : Date.now(),
      sourceAgentId: ARIA_AGENT_ID,
      event,
    };
    HistoryStore.add(record);
    get().setAgentBubble(ARIA_AGENT_ID, event.event === "new_sale" ? "💰" : "!");
    get().openAgentAlert(ARIA_AGENT_ID, "update", event.message, event.event);
    get().pushToast(event.message, event.event === "new_sale" ? "completed" : "assigned");
    get().openActivityPanel();
    get().setActivityTab("completed");
    if (event.event === "new_sale") {
      playNewSaleSound();
    }
    if (!event.suppressNotification) {
      showBusinessNotification(event).catch((error) => {
        console.warn("[businessEvent] Browser notification could not be shown.", error);
      });
    }
    setTimeout(() => {
      get().setAgentBubble(ARIA_AGENT_ID, "");
    }, 3600);
    return true;
  },

  // ---- SECTION 8 — ARIA ROUTER / ORCHESTRATOR ----
  assignTaskToAgent: (agentId, taskId, params) => {
    if (!isAria(agentId)) {
      get().pushToast("Talk to Aria. Specialists only show private status.", "assigned");
      get().onAgentClicked(agentId);
      return;
    }
    if (get().agents[agentId]?.currentTask) {
      get().pushToast("Aria is currently working. Please wait for this request to finish.", "assigned");
      get().openActivityPanel();
      get().setActivityTab("active");
      return;
    }
    const runtime = runtimes[agentId];
    const cfg = runtime.cfg;
    const taskDef = cfg.tasks.find((t) => t.id === taskId);
    const runParams = taskDef.id !== "process_rental_qualification"
      ? { ...params, context: buildAgentContextSnapshot(get().agents, get().specialistStatus) }
      : params;
    const task = runtime.assign(taskDef, runParams);
    if (task && taskDef.delegates) {
      get().startVisualDelegation(task, runParams);
    }
    get().setProviderHealth("working");
    get().pushToast("Request sent to Aria.", "assigned");
  },
  retryTask: (task) => {
    if (!task?.agentId || !task?.type) return;
    if (get().agents[task.agentId]?.currentTask) {
      get().pushToast("Aria is currently working. Please wait before retrying.", "assigned");
      return;
    }
    const params = task.parameters || {};
    get().closeAgentAlert();
    get().assignTaskToAgent(task.agentId, task.type, params);
  },
  // Visual handoff cue: a brief traveling light from Aria's building
  // to the delegate's building whenever work gets handed off between agents.
  fireBeam: (fromAgentId, toAgentId) => {
    const beamId = Math.random().toString(36).slice(2);
    set((s) => ({ beams: [...s.beams, { id: beamId, from: fromAgentId, to: toAgentId, start: performance.now() }] }));
    setTimeout(() => {
      set((s) => ({ beams: s.beams.filter((b) => b.id !== beamId) }));
    }, 1100);
  },

  // ---- UI: selection / panels ----
  onAgentClicked: (agentId) => {
    const state = get();
    const agent = state.agents[agentId];
    set({ selectedAgentId: agentId });
    if (isSpecialist(agentId)) {
      set({ taskMenu: { open: false, agentId: null, taskDef: null }, detailPanel: { open: true, agentId, mode: "specialistStatus" } });
      return;
    }
    if (
      agent.currentTask ||
      agent.status === "working" ||
      agent.status === "waiting" ||
      agent.status === "assigned" ||
      agent.status === "walking_to_work" ||
      agent.status === "success"
    ) {
      set({ taskMenu: { open: false, agentId: null, taskDef: null }, detailPanel: { open: true, agentId, mode: "progress" } });
    } else if (agent.status === "error") {
      set({ taskMenu: { open: false, agentId: null, taskDef: null }, detailPanel: { open: true, agentId, mode: "error" } });
    } else {
      set({ detailPanel: { open: false, agentId: null, mode: null }, taskMenu: { open: true, agentId, taskDef: null } });
    }
  },
  openTaskMenu: (agentId, taskDef = null) => set({ taskMenu: { open: true, agentId, taskDef } }),
  closeFloatingPanels: () => set({
    taskMenu: { open: false, agentId: null, taskDef: null },
    detailPanel: { open: false, agentId: null, mode: null },
  }),
  clearSelection: () => set({ selectedAgentId: null }),
  openHistoryDetail: (record) => set({
    taskMenu: { open: false, agentId: null, taskDef: null },
    detailPanel: { open: true, agentId: isSpecialist(record.agentId) ? ARIA_AGENT_ID : record.agentId, mode: "history" },
    historyView: record,
  }),

  recordTaskOutcome: (agentId, cfg, task, success) => {
    const sanitized = sanitizeTaskForSpecialistPanel({ ...task, agentId });
    if (isAria(agentId)) {
      get().setProviderHealth(success ? "connected" : "degraded");
      get().finishVisualDelegation(task, success);
    }
    if (isSpecialist(agentId)) {
      set((s) => ({
        specialistStatus: {
          ...s.specialistStatus,
          [agentId]: {
            status: success ? "completed" : "waiting",
            currentTask: null,
            task: sanitized?.title || task.title,
            lastResult: sanitized?.lastResult || (success ? "Completed. Report sent to Aria." : task.error),
            updatedAt: Date.now(),
          },
        },
      }));
      const approval = approvalFromTask({ ...task, agentId }, cfg);
      if (approval) {
        set((s) => ({ pendingApprovals: upsertApproval(s.pendingApprovals, approval) }));
        get().openAgentAlert(ARIA_AGENT_ID, "waiting", approval.question, "approval_required", { ...task, approvalId: approval.id });
      } else {
        get().openAgentAlert(
          ARIA_AGENT_ID,
          success ? "complete" : "error",
          success ? `${cfg.role} reported back. I summarized the result in Activity.` : `${cfg.role} needs attention: ${task.error}`,
          success ? "normal" : "error"
        );
      }
      return;
    }
    if (isAria(agentId) && success) {
      const agentsInvolved = task.resultMeta?.agentsInvolved || [];
      agentsInvolved
        .filter((involvedId) => involvedId !== ARIA_AGENT_ID && SPECIALIST_AGENT_IDS.includes(involvedId))
        .forEach((involvedId) => {
          get().fireBeam(ARIA_AGENT_ID, involvedId);
          get().setSpecialistLiveStatus(involvedId, {
            status: "completed",
            currentTask: null,
            task: task.title,
            lastResult: task.resultMeta?.publicSummary || task.result || "Report sent to Aria.",
          });
        });

      if (task.resultMeta?.requiresApproval) {
        const approval = approvalFromAriaTask(task);
        set((s) => ({ pendingApprovals: upsertApproval(s.pendingApprovals, approval) }));
        get().openAgentAlert(ARIA_AGENT_ID, "waiting", approval.question, "approval_required", { ...task, approvalId: approval.id });
        return;
      }

      get().openAgentAlert(ARIA_AGENT_ID, "complete", task.result || "I checked everything and the request is complete.", "normal");
    }
  },

  setSpecialistLiveStatus: (agentId, patch) => {
    if (!SPECIALIST_AGENT_IDS.includes(agentId)) return;
    set((s) => ({
      specialistStatus: {
        ...s.specialistStatus,
        [agentId]: {
          status: s.agents[agentId]?.status || "idle",
          currentTask: s.agents[agentId]?.currentTask?.title || null,
          task: s.agents[agentId]?.currentTask?.title || "Idle",
          lastResult: s.specialistStatus[agentId]?.lastResult || "",
          updatedAt: Date.now(),
          ...patch,
        },
      },
    }));
  },

  startVisualDelegation: (ariaTask, params = {}) => {
    const delegatedIds = specialistIdsFromRouteHint(params.specialist);
    if (!ariaTask?.id || delegatedIds.length === 0) return;
    delegatedIds.forEach((delegateId) => {
      const runtime = runtimes[delegateId];
      const agent = get().agents[delegateId];
      if (!runtime || !agent || agent.currentTask) return;
      const task = buildVisualDelegationTask(ariaTask, agent.cfg);
      get().fireBeam(ARIA_AGENT_ID, delegateId);
      get().setSpecialistLiveStatus(delegateId, {
        status: "assigned",
        currentTask: task.title,
        task: task.title,
        lastResult: "Aria handed this to me. Working now.",
      });
      runtime.startVisualWork(task);
    });
  },

  finishVisualDelegation: (ariaTask, success) => {
    if (!ariaTask?.id) return;
    const delegatedIds = SPECIALIST_AGENT_IDS.filter((agentId) => {
      const currentTask = get().agents[agentId]?.currentTask;
      return currentTask?.sourceAriaTaskId === ariaTask.id;
    });
    delegatedIds.forEach((delegateId) => {
      const runtime = runtimes[delegateId];
      const currentTask = get().agents[delegateId]?.currentTask;
      if (!runtime || !currentTask) return;
      runtime.finishVisualWork({
        ...currentTask,
        status: success ? "completed" : "failed",
        stage: success ? "Complete" : "Error",
        completedAt: Date.now(),
        result: success ? (ariaTask.resultMeta?.publicSummary || ariaTask.result || "Report sent back to Aria.") : null,
        error: success ? null : (ariaTask.error || "Aria could not complete this delegated request."),
      }, success);
    });
  },

  decideApproval: async (approvalId, decision) => {
    const approval = get().pendingApprovals.find((item) => item.id === approvalId);
    if (!approval || approval.status !== "pending") return;
    if (decision === "reject") {
      set((s) => ({
        pendingApprovals: s.pendingApprovals.map((item) => item.id === approvalId
          ? { ...item, status: "rejected", decidedAt: Date.now(), decisionResult: "Rejected by owner." }
          : item),
      }));
      get().pushToast("Aria rejected the proposed change.", "completed");
      return;
    }

    set((s) => ({
      pendingApprovals: s.pendingApprovals.map((item) => item.id === approvalId ? { ...item, status: "executing" } : item),
    }));
    try {
      const endpoint = approval.executionEndpoint || import.meta.env.VITE_APPROVAL_EXECUTION_URL || "";
      if (!endpoint) throw new Error("No approval execution endpoint is configured. Set VITE_APPROVAL_EXECUTION_URL or return executionEndpoint from the specialist backend.");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId,
          taskId: approval.taskId,
          specialistId: approval.specialistId,
          proposedChange: approval.proposedChange,
          changePayload: approval.changePayload,
        }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || "Approval execution failed.");
      set((s) => ({
        pendingApprovals: s.pendingApprovals.map((item) => item.id === approvalId
          ? { ...item, status: "approved", decidedAt: Date.now(), decisionResult: text || "Approved and executed." }
          : item),
      }));
      get().pushToast("Aria approved and executed the change.", "completed");
    } catch (error) {
      set((s) => ({
        pendingApprovals: s.pendingApprovals.map((item) => item.id === approvalId
          ? { ...item, status: "waiting", decisionResult: error.message }
          : item),
      }));
      get().openAgentAlert(ARIA_AGENT_ID, "error", error.message, "approval_error");
    }
  },

  requestApprovalDetails: (approvalId) => {
    const approval = get().pendingApprovals.find((item) => item.id === approvalId);
    if (!approval || approval.status !== "pending") return;
    const specialistId = SPECIALIST_AGENT_IDS.includes(approval.specialistId) ? approval.specialistId : null;
    set((s) => ({
      pendingApprovals: s.pendingApprovals.map((item) => item.id === approvalId
        ? { ...item, status: "investigating", decisionResult: "Aria asked for more details before a decision." }
        : item),
    }));
    get().closeAgentAlert();
    get().pushToast("Aria asked the specialist for more details.", "assigned");

    if (!specialistId) {
      reopenApprovalAfterDetails(get, approval, null);
      return;
    }

    const runtime = runtimes[specialistId];
    const agent = get().agents[specialistId];
    const detailTask = agent ? buildApprovalDetailTask(approval, agent.cfg) : null;
    if (runtime && agent && detailTask && !agent.currentTask) {
      get().fireBeam(ARIA_AGENT_ID, specialistId);
      get().setSpecialistLiveStatus(specialistId, {
        status: "assigned",
        currentTask: detailTask.title,
        task: detailTask.title,
        lastResult: "Aria asked me to look further before approval.",
      });
      runtime.startVisualWork(detailTask);
      setTimeout(() => {
        runtime.finishVisualWork({
          ...detailTask,
          status: "completed",
          stage: "Complete",
          completedAt: Date.now(),
          result: "Additional details sent back to Aria for the owner.",
        }, true);
        reopenApprovalAfterDetails(get, approval, agent.cfg);
      }, 7000);
      return;
    }

    reopenApprovalAfterDetails(get, approval, agent?.cfg || null);
  },

  // ---- activity panel ----
  toggleActivityPanel: () => set((s) => ({ activityPanel: { ...s.activityPanel, open: !s.activityPanel.open } })),
  openActivityPanel: () => set((s) => ({ activityPanel: { ...s.activityPanel, open: true } })),
  closeActivityPanel: () => set((s) => ({ activityPanel: { ...s.activityPanel, open: false } })),
  setActivityTab: (tab) => set((s) => ({ activityPanel: { ...s.activityPanel, tab } })),
  clearActivityTab: (tab) => {
    if (tab === "errors") {
      HistoryStore.clear(["failed", "timed_out"]);
      get().pushToast("Cleared old error activity.", "completed");
      return;
    }
    if (tab === "completed") {
      HistoryStore.clear(["completed"]);
      get().pushToast("Cleared completed activity.", "completed");
      return;
    }
    if (tab === "approvals") {
      set({ pendingApprovals: [] });
      get().pushToast("Cleared approval activity.", "completed");
    }
  },
}));

function loadHandledBusinessEventIds() {
  try {
    const raw = localStorage.getItem(BUSINESS_EVENT_DEDUPE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function rememberBusinessEventId(eventId) {
  handledBusinessEventIds.add(eventId);
  try {
    localStorage.setItem(BUSINESS_EVENT_DEDUPE_KEY, JSON.stringify([...handledBusinessEventIds].slice(-100)));
  } catch {}
}

function normalizeBusinessEvent(payload) {
  if (!payload || typeof payload !== "object") return null;
  const eventName = String(payload.event || "").trim().toLowerCase();
  if (eventName !== "new_lead" && eventName !== "new_sale") return null;
  const fallback = eventName === "new_sale"
    ? "Congratulations Boss! You have a new sale!"
    : "Hey Boss, a new lead just came in.";
  return {
    ...payload,
    event: eventName,
    eventId: typeof payload.eventId === "string" && payload.eventId.trim() ? payload.eventId.trim() : null,
    message: typeof payload.message === "string" && payload.message.trim() ? payload.message.trim() : fallback,
    timestamp: typeof payload.timestamp === "string" ? payload.timestamp : null,
    suppressNotification: payload.suppressNotification === true,
  };
}

function upsertApproval(list, approval) {
  const idx = list.findIndex((item) => item.id === approval.id);
  if (idx === -1) return [...list, approval];
  return list.map((item, i) => i === idx ? { ...item, ...approval } : item);
}

function approvalFromAriaTask(task) {
  const meta = task?.resultMeta || {};
  const specialistId = (meta.agentsInvolved || []).find((id) => SPECIALIST_AGENT_IDS.includes(id)) || ARIA_AGENT_ID;
  return {
    id: "approval-" + task.id,
    taskId: task.id,
    agentId: ARIA_AGENT_ID,
    specialistId,
    title: task.title,
    question: meta.approvalQuestion || "ARIA needs your approval before the next step. Should she go ahead?",
    summary: meta.publicSummary || task.result || "ARIA has a recommendation ready for approval.",
    proposedChange: meta.proposedChange || task.result || "",
    executionEndpoint: meta.executionEndpoint || "",
    changePayload: meta.changePayload || null,
    status: "pending",
    createdAt: Date.now(),
    decidedAt: null,
    decisionResult: null,
  };
}

function specialistIdsFromRouteHint(specialist) {
  const key = String(specialist || "auto").trim().toLowerCase();
  if (!key || key === "auto") return [];
  if (key === "all" || key === "team") return SPECIALIST_AGENT_IDS;
  const map = {
    milo: "content",
    marketing: "content",
    content: "content",
    sage: "research",
    conversion: "research",
    research: "research",
    forge: "automation",
    website: "automation",
    developer: "automation",
    automation: "automation",
    atlas: "manager",
    listings: "manager",
    manager: "manager",
  };
  return map[key] ? [map[key]] : [];
}

function buildVisualDelegationTask(ariaTask, specialistConfig) {
  const now = Date.now();
  return {
    id: `aria-delegation-${ariaTask.id}-${specialistConfig.id}`,
    agentId: specialistConfig.id,
    sourceAriaTaskId: ariaTask.id,
    requestId: ariaTask.requestId,
    type: "aria_visual_delegation",
    title: `${specialistConfig.role} Work`,
    parameters: { delegatedBy: ARIA_AGENT_ID, sourceAriaTaskId: ariaTask.id },
    status: "processing",
    requestState: "working",
    stage: "Working",
    createdAt: now,
    startedAt: now,
    completedAt: null,
    elapsedMs: null,
    result: null,
    resultMeta: null,
    error: null,
  };
}

function buildApprovalDetailTask(approval, specialistConfig) {
  const now = Date.now();
  return {
    id: `approval-detail-${approval.id}-${specialistConfig.id}-${now}`,
    agentId: specialistConfig.id,
    sourceAriaTaskId: approval.taskId,
    requestId: approval.taskId,
    type: "aria_more_details",
    title: `More Details: ${specialistConfig.role}`,
    parameters: { delegatedBy: ARIA_AGENT_ID, approvalId: approval.id },
    status: "processing",
    requestState: "working",
    stage: "Working",
    createdAt: now,
    startedAt: now,
    completedAt: null,
    elapsedMs: null,
    result: null,
    resultMeta: null,
    error: null,
  };
}

function reopenApprovalAfterDetails(get, approval, specialistConfig) {
  const specialistName = specialistConfig?.name || "the specialist";
  const detailsLine = `More details requested from ${specialistName}. Review the recommendation again when ready.`;
  setTimeout(() => {
    useVillageStore.setState((s) => ({
      pendingApprovals: s.pendingApprovals.map((item) => item.id === approval.id
        ? { ...item, status: "pending", decisionResult: detailsLine }
        : item),
    }));
    get().setActivityTab("approvals");
    get().openActivityPanel();
    get().openAgentAlert(
      ARIA_AGENT_ID,
      "waiting",
      `${approval.question}\n\n${detailsLine}`,
      "approval_required",
      { id: approval.taskId, title: approval.title, approvalId: approval.id }
    );
  }, 350);
}
