import { useEffect, useState } from "react";
import { useVillageStore } from "../store/useVillageStore.js";
import { HistoryStore } from "../domain/historyStore.js";
import { STATUS_COLORS, statusLabel } from "../domain/agentsConfig.js";
import { formatElapsed } from "../domain/ariaResponseNormalizer.js";

export default function ActivityPanel() {
  const activityPanel = useVillageStore((s) => s.activityPanel);
  const setActivityTab = useVillageStore((s) => s.setActivityTab);
  const closeActivityPanel = useVillageStore((s) => s.closeActivityPanel);
  const agents = useVillageStore((s) => s.agents);
  const openHistoryDetail = useVillageStore((s) => s.openHistoryDetail);
  const pendingApprovals = useVillageStore((s) => s.pendingApprovals);
  const decideApproval = useVillageStore((s) => s.decideApproval);
  const [, forceTick] = useState(0);

  // Active tab needs a light poll so elapsed-time / live tasks stay current,
  // same 2s cadence the original used.
  useEffect(() => {
    if (!activityPanel.open || activityPanel.tab !== "active") return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activityPanel.open, activityPanel.tab]);

  if (!activityPanel.open) return null;

  const activeItems = Object.values(agents).filter((a) => a.currentTask);
  const history = HistoryStore.load().slice().reverse();
  const filtered = activityPanel.tab === "errors"
    ? history.filter((h) => h.status === "failed" || h.status === "timed_out")
    : history.filter((h) => h.status === "completed");

  return (
    <div id="activity-panel" className={activityPanel.open ? "open" : ""}>
      <div className="ap-header">
        <h2>Activity</h2>
        <button className="ap-close" onClick={closeActivityPanel} aria-label="Close activity panel">x</button>
      </div>
      <div className="ap-tabs">
        {["active", "approvals", "completed", "errors"].map((tab) => (
          <button key={tab} className={"ap-tab" + (activityPanel.tab === tab ? " active" : "")} onClick={() => setActivityTab(tab)}>
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="ap-body">
        {activityPanel.tab === "active" ? (
          activeItems.length ? activeItems.map((a) => (
            <div className="ap-item" key={a.cfg.id}>
              <div className="row1">
                <div className="agentname">{a.cfg.emoji} {a.cfg.name}</div>
                <div className="status-chip" style={{ background: STATUS_COLORS[a.status] + "22", color: STATUS_COLORS[a.status] }}>{statusLabel(a.status)}</div>
              </div>
              <div className="tasktitle">{a.currentTask.title}</div>
              <div className="meta-line">{a.currentTask.stage} · {activeElapsed(a.currentTask)}</div>
            </div>
          )) : <div className="ap-empty">No active tasks. Your agents are idle right now.</div>
        ) : activityPanel.tab === "approvals" ? (
          pendingApprovals.length ? pendingApprovals.slice().reverse().map((approval) => (
            <div className="ap-item approval-item" key={approval.id}>
              <div className="row1">
                <div className="agentname">📊 Aria Approval</div>
                <div className="status-chip">{approval.status}</div>
              </div>
              <div className="tasktitle">{approval.title}</div>
              <div className="meta-line">{approval.question}</div>
              {approval.summary && <div className="approval-summary">{approval.summary}</div>}
              {approval.status === "pending" && (
                <div className="approval-actions">
                  <button className="fp-btn" onClick={() => decideApproval(approval.id, "approve")}>Approve</button>
                  <button className="fp-btn ghost" onClick={() => decideApproval(approval.id, "reject")}>Reject</button>
                </div>
              )}
              {approval.decisionResult && <div className="meta-line">{approval.decisionResult}</div>}
            </div>
          )) : <div className="ap-empty">No pending approvals. Live changes are locked until Aria asks you.</div>
        ) : (
          filtered.length ? filtered.slice(0, 30).map((h) => {
            const color = h.status === "failed" ? STATUS_COLORS.error : STATUS_COLORS[h.status] || STATUS_COLORS.completed;
            return (
              <div className="ap-item" key={h.id} onClick={() => openHistoryDetail(h)}>
                <div className="row1">
                  <div className="agentname">{h.emoji} {h.agentName}</div>
                  <div className="status-chip" style={{ background: color + "22", color }}>{historyStatusLabel(h.status)}</div>
                </div>
                <div className="tasktitle">{h.title}</div>
                <div className="meta-line">{new Date(h.completedAt).toLocaleTimeString()}{h.elapsedMs != null ? ` · ${formatElapsed(h.elapsedMs)}` : ""}</div>
              </div>
            );
          }) : <div className="ap-empty">Nothing here yet.</div>
        )}
      </div>
    </div>
  );
}

function activeElapsed(task) {
  if (task.elapsedMs != null) return formatElapsed(task.elapsedMs);
  if (!task.startedAt) return "Queued";
  return formatElapsed(Date.now() - task.startedAt);
}

function historyStatusLabel(status) {
  if (status === "timed_out") return "Taking longer";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return status;
}
