import { useEffect, useMemo, useRef, useState } from "react";
import { useVillageStore } from "../store/useVillageStore.js";
import { statusLabel } from "../domain/agentsConfig.js";
import { formatElapsed, splitAriaMessageSections } from "../domain/ariaResponseNormalizer.js";
import AgentPortraitScene from "../three/characters/AgentPortraitScene.jsx";
import ReceivingDots from "./ReceivingDots.jsx";

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
  const retryTask = useVillageStore((s) => s.retryTask);
  const pendingApprovals = useVillageStore((s) => s.pendingApprovals);
  const decideApproval = useVillageStore((s) => s.decideApproval);
  const requestApprovalDetails = useVillageStore((s) => s.requestApprovalDetails);

  if (!alert?.open || !alert.agentId) return null;
  const cfg = agents[alert.agentId]?.cfg;
  if (!cfg) return null;
  const message = alert.message || ALERT_COPY[alert.type] || ALERT_COPY.update;
  const status = agents[alert.agentId]?.status || "idle";
  const sections = splitAriaMessageSections(message);
  const isFailure = alert.type === "error" || alert.type === "timed_out";
  const isApproval = alert.type === "waiting";
  const approval = isApproval ? findAlertApproval(alert, pendingApprovals) : null;
  const primaryLabel = alert.type === "error"
    ? "Open Errors"
    : alert.type === "timed_out"
      ? "Open Status"
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
          {alert.task?.elapsedMs != null && (
            <div className="agent-alert-elapsed">
              {isFailure ? "Worked for " : "Response received in "}{formatElapsed(alert.task.elapsedMs)}
            </div>
          )}
          <DialogueText
            sections={sections}
            alertId={`${alert.agentId}-${alert.type}-${alert.task?.id || message}`}
            finalActions={(
              <div className="agent-alert-actions">
                {isFailure && alert.task && <button className="fp-btn" onClick={() => retryTask(alert.task)}>Retry</button>}
                {approval ? (
                  <>
                    <button className="fp-btn" onClick={() => { closeAgentAlert(); decideApproval(approval.id, "approve"); }}>Approve</button>
                    <button className="fp-btn ghost danger" onClick={() => { closeAgentAlert(); decideApproval(approval.id, "reject"); }}>Reject</button>
                    <button className="fp-btn ghost" onClick={() => requestApprovalDetails(approval.id)}>Give Me More Details</button>
                  </>
                ) : (
                  <>
                    <button
                      className="fp-btn"
                      onClick={() => {
                        closeAgentAlert();
                        setActivityTab(alert.type === "error" || alert.type === "timed_out" ? "errors" : alert.type === "waiting" ? "approvals" : "completed");
                        openActivityPanel();
                      }}
                    >
                      {isApproval ? "Review" : primaryLabel}
                    </button>
                    <button className="fp-btn ghost" onClick={closeAgentAlert}>{isApproval ? "Later" : "Done"}</button>
                  </>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

function findAlertApproval(alert, approvals) {
  const approvalId = alert.task?.approvalId || (alert.task?.id ? `approval-${alert.task.id}` : "");
  if (approvalId) {
    const exact = approvals.find((item) => item.id === approvalId && item.status === "pending");
    if (exact) return exact;
  }
  return approvals.find((item) => item.status === "pending") || null;
}

function DialogueText({ sections, alertId, finalActions }) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [visibleLength, setVisibleLength] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const timerRef = useRef(null);
  const section = sections[sectionIndex] || "";
  const visibleText = useMemo(() => Array.from(section).slice(0, visibleLength).join(""), [section, visibleLength]);
  const hasNext = sectionIndex < sections.length - 1;
  const isComplete = visibleLength >= Array.from(section).length;

  useEffect(() => {
    setSectionIndex(0);
    setVisibleLength(0);
  }, [alertId]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    const chars = Array.from(section);
    if (reducedMotion) {
      setVisibleLength(chars.length);
      setIsTyping(false);
      return;
    }
    if (visibleLength >= chars.length) {
      setIsTyping(false);
      return;
    }
    setIsTyping(true);
    const current = chars[visibleLength - 1] || "";
    const delay = /[.!?]/u.test(current) ? 120 : /[,;:]/u.test(current) ? 70 : 24;
    timerRef.current = setTimeout(() => setVisibleLength((count) => count + 1), delay);
    return () => clearTimeout(timerRef.current);
  }, [section, visibleLength, reducedMotion]);

  const finishSection = () => {
    setVisibleLength(Array.from(section).length);
    setIsTyping(false);
  };

  const nextSection = () => {
    if (!isComplete) {
      finishSection();
      return;
    }
    if (!hasNext) return;
    setSectionIndex((idx) => idx + 1);
    setVisibleLength(0);
  };

  return (
    <div className="dialogue-wrap">
      <button className="dialogue-text" type="button" onClick={finishSection} aria-live="polite">
        <span>{visibleText}</span>
        {isTyping && <i className="typing-cursor" aria-hidden="true" />}
        {isTyping && <ReceivingDots inline />}
      </button>
      {hasNext && isComplete && (
        <button className="dialogue-next" type="button" onClick={nextSection}>
          Next →
        </button>
      )}
      {!hasNext && isComplete && finalActions}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    setPrefersReduced(media.matches);
    const onChange = () => setPrefersReduced(media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);
  return prefersReduced;
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
