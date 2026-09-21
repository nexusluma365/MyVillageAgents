import { useVillageStore } from "../store/useVillageStore.js";
import { STAGE_LABELS, STATUS_COLORS, statusLabel } from "../domain/agentsConfig.js";
import { isSpecialist } from "../domain/ariaRouter.js";

export default function DetailPanel() {
  const detailPanel = useVillageStore((s) => s.detailPanel);
  const agents = useVillageStore((s) => s.agents);
  const historyView = useVillageStore((s) => s.historyView);
  const specialistStatus = useVillageStore((s) => s.specialistStatus);
  const closeFloatingPanels = useVillageStore((s) => s.closeFloatingPanels);

  if (!detailPanel.open || !detailPanel.agentId) return null;
  const agentState = agents[detailPanel.agentId];
  const cfg = agentState.cfg;

  return (
    <div className="floating-panel" style={{ right: 16, top: 76 }}>
      <div className="fp-header">
        {/* "portrait" — the agent's role avatar, matching the emoji + color
            identity carried by their in-world character */}
        <div className="avatar" style={{ background: cfg.c1 }}>{cfg.emoji}</div>
        <div className="titles">
          <div className="name">{cfg.name}</div>
          <div className="role">
            {detailPanel.mode === "progress" && agentState.currentTask ? agentState.currentTask.title : cfg.role}
          </div>
        </div>
        <button className="fp-close" onClick={closeFloatingPanels}>✕</button>
      </div>

      {detailPanel.mode === "progress" && agentState.currentTask && (
        <ProgressBody task={agentState.currentTask} status={agentState.status} />
      )}
      {detailPanel.mode === "specialistStatus" && isSpecialist(cfg.id) && (
        <SpecialistStatusBody status={specialistStatus[cfg.id]} agentState={agentState} />
      )}
      {detailPanel.mode === "error" && (
        <ErrorBody cfg={cfg} onDismiss={closeFloatingPanels} />
      )}
      {detailPanel.mode === "history" && historyView && (
        <HistoryBody record={historyView} />
      )}
    </div>
  );
}

function ProgressBody({ task, status }) {
  const curIdx = STAGE_LABELS.indexOf(task.stage);
  const startedAgo = task.startedAt ? Math.max(0, Math.round((Date.now() - task.startedAt) / 1000)) : 0;
  return (
    <>
      <div className="fp-status-row">
        <span className="sdot" style={{ background: STATUS_COLORS[status] }} />
        {statusLabel(status)}
      </div>
      <div className="stage-track">
        {STAGE_LABELS.map((s, i) => (
          <div className={"stage-row" + (i < curIdx ? " done" : "") + (i === curIdx ? " active" : "")} key={s}>
            <span className="stage-dot" />{s}
          </div>
        ))}
      </div>
      <div className="meta-line">{task.startedAt ? `Started ${startedAgo}s ago` : "Queued"}</div>
      {task.parameters?.handoffFrom && <div className="meta-line">Received by handoff from {task.parameters.handoffFrom}</div>}
    </>
  );
}

function SpecialistStatusBody({ status, agentState }) {
  const liveTask = agentState.currentTask?.title || status?.currentTask || null;
  const safeStatus = status?.status || agentState.status || "idle";
  return (
    <>
      <div className="fp-label">Specialist Status</div>
      <div className="fp-status-row">
        <span className="sdot" style={{ background: STATUS_COLORS[safeStatus] || STATUS_COLORS.idle }} />
        {statusLabel(safeStatus)}
      </div>
      <div className="status-grid">
        <div><strong>Current</strong><span>{liveTask ? "Yes" : "No"}</span></div>
        <div><strong>Task</strong><span>{liveTask || status?.task || "Idle"}</span></div>
        <div><strong>Last result</strong><span>{status?.lastResult || "No result reported to Aria yet."}</span></div>
      </div>
      <div className="privacy-note">Specialists report only to Aria. Sensitive request data and full outputs stay hidden here.</div>
    </>
  );
}

function ErrorBody({ cfg, onDismiss }) {
  return (
    <>
      <div className="fp-status-row">
        <span className="sdot" style={{ background: STATUS_COLORS.error }} />Task failed
      </div>
      <div className="result-box">Something went wrong — check Activity → Errors for details.</div>
      <button className="fp-btn" onClick={onDismiss}>Dismiss</button>
    </>
  );
}

function HistoryBody({ record }) {
  return (
    <>
      <div className="fp-label">{record.status === "failed" ? "Error" : "Result"}</div>
      <div className="result-box">{record.status === "failed" ? record.error : record.result}</div>
    </>
  );
}
