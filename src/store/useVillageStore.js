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

const bus = new EventBus();
const provider = new AgentProviderRouter(bus);
const runtimes = {};
let toastSeq = 1;
let agentsInitialized = false;

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
  agentAlert: { open: false, agentId: null, type: null, message: "" },
  buildingGlow: {},
  beams: [],
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
  openAgentAlert: (agentId, type, message, priority = "normal") => set({ agentAlert: { open: true, agentId, type, message, priority } }),
  closeAgentAlert: () => set({ agentAlert: { open: false, agentId: null, type: null, message: "" } }),
  addHistory: (record) => { HistoryStore.add(record); },

  // ---- SECTION 8 — ARIA ROUTER / ORCHESTRATOR ----
  assignTaskToAgent: (agentId, taskId, params) => {
    if (!isAria(agentId)) {
      get().pushToast("Talk to Aria. Specialists only show private status.", "assigned");
      get().onAgentClicked(agentId);
      return;
    }
    const runtime = runtimes[agentId];
    const cfg = runtime.cfg;
    const taskDef = cfg.tasks.find((t) => t.id === taskId);
    const runParams = taskDef.id !== "process_rental_qualification"
      ? { ...params, context: buildAgentContextSnapshot(get().agents, get().specialistStatus) }
      : params;
    runtime.assign(taskDef, runParams);
    get().pushToast("Request sent to Aria.", "assigned");
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
        get().openAgentAlert(ARIA_AGENT_ID, "waiting", approval.question, "approval_required");
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
        get().openAgentAlert(ARIA_AGENT_ID, "waiting", approval.question, "approval_required");
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

  // ---- activity panel ----
  toggleActivityPanel: () => set((s) => ({ activityPanel: { ...s.activityPanel, open: !s.activityPanel.open } })),
  openActivityPanel: () => set((s) => ({ activityPanel: { ...s.activityPanel, open: true } })),
  closeActivityPanel: () => set((s) => ({ activityPanel: { ...s.activityPanel, open: false } })),
  setActivityTab: (tab) => set((s) => ({ activityPanel: { ...s.activityPanel, tab } })),
}));

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
