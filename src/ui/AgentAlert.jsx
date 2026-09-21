import { useVillageStore } from "../store/useVillageStore.js";
import { statusLabel } from "../domain/agentsConfig.js";
import AgentPortraitScene from "../three/characters/AgentPortraitScene.jsx";

const ALERT_COPY = {
  complete: "Task complete. Your result is ready for review.",
  error: "I couldn't complete this task. I need your attention.",
  waiting: "I need your approval before I continue.",
  question: "I found two possible options. Which should I use?",
  update: "I finished my part and passed the work forward.",
};

export default function AgentAlert() {
  const alert = useVillageStore((s) => s.agentAlert);
  const agents = useVillageStore((s) => s.agents);
  const closeAgentAlert = useVillageStore((s) => s.closeAgentAlert);
  const openActivityPanel = useVillageStore((s) => s.openActivityPanel);
  const setActivityTab = useVillageStore((s) => s.setActivityTab);

  if (!alert?.open || !alert.agentId) return null;
  const cfg = agents[alert.agentId]?.cfg;
  if (!cfg) return null;
  const message = alert.message || ALERT_COPY[alert.type] || ALERT_COPY.update;
  const status = agents[alert.agentId]?.status || "idle";
  const primaryLabel = alert.type === "error"
    ? "Open Errors"
    : alert.type === "waiting"
      ? "Review"
      : alert.type === "update"
        ? "Open Status"
        : "View Result";

  return (
    <div className="agent-alert-shell" role="dialog" aria-modal="true">
      <div className="agent-alert">
        <button className="agent-alert-close" onClick={closeAgentAlert}>x</button>
        <AgentPortrait cfg={cfg} />
        <div className="agent-alert-copy">
          <div className="agent-alert-role">{cfg.role}</div>
          <h2>{cfg.name}</h2>
          <div className="agent-alert-status">
            <span style={{ background: cfg.c1 }} />
            {statusLabel(status)}
            {alert.priority && <em>{String(alert.priority).replace("_", " ")}</em>}
          </div>
          <p>"{message}"</p>
          <div className="agent-alert-actions">
            <button
              className="fp-btn"
              onClick={() => {
                closeAgentAlert();
                setActivityTab(alert.type === "error" ? "errors" : alert.type === "waiting" ? "approvals" : "completed");
                openActivityPanel();
              }}
            >
              {primaryLabel}
            </button>
            <button className="fp-btn ghost" onClick={closeAgentAlert}>Later</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentPortrait({ cfg }) {
  return (
    <div className={"agent-portrait portrait-" + cfg.id}>
      <div className="portrait-glow" style={{ background: cfg.c1 }} />
      <AgentPortraitScene agentId={cfg.id} />
      <div className="portrait-tool" style={{ background: cfg.c1 }}>{cfg.emoji}</div>
    </div>
  );
}
