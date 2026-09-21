import { useState, useEffect } from "react";
import { useVillageStore } from "../store/useVillageStore.js";
import { isSpecialist } from "../domain/ariaRouter.js";

export default function TaskMenu() {
  const taskMenu = useVillageStore((s) => s.taskMenu);
  const agents = useVillageStore((s) => s.agents);
  const closeFloatingPanels = useVillageStore((s) => s.closeFloatingPanels);
  const openTaskMenu = useVillageStore((s) => s.openTaskMenu);
  const assignTaskToAgent = useVillageStore((s) => s.assignTaskToAgent);
  const openActivityPanel = useVillageStore((s) => s.openActivityPanel);

  const [values, setValues] = useState({});
  useEffect(() => { setValues({}); }, [taskMenu.taskDef]);

  if (!taskMenu.open || !taskMenu.agentId) return null;
  const cfg = agents[taskMenu.agentId].cfg;
  const taskDef = taskMenu.taskDef;
  if (isSpecialist(cfg.id)) return null;
  const isBusy = Boolean(agents[cfg.id]?.currentTask);
  const requestText = String(values.request || "").trim();
  const isAriaRequest = taskDef?.id === "aria_route_request";
  const canSubmit = !isBusy && (!isAriaRequest || requestText.length > 0);

  return (
    <div className="floating-panel" style={{ right: 16, top: 76 }}>
      {taskDef && <div className="fp-back" onClick={() => openTaskMenu(cfg.id, null)}>‹ Back</div>}
      <div className="fp-header">
        <div className="avatar" style={{ background: cfg.c1 }}>{cfg.emoji}</div>
        <div className="titles">
          <div className="name">{taskDef ? taskDef.label : cfg.name}</div>
          <div className="role">{taskDef ? `${cfg.name} · ${cfg.workstation}` : cfg.role}</div>
        </div>
        <button className="fp-close" onClick={closeFloatingPanels}>✕</button>
      </div>

      {!taskDef ? (
        <>
          <div className="fp-label">Choose Task</div>
          <div className="agent-identity-note">
            <strong>{cfg.workstation}</strong>
            <span>{cfg.responsibilities?.slice(0, 3).join(" · ")}</span>
          </div>
          <div className="task-list">
            {cfg.tasks.map((t) => (
              <div className="task-item" key={t.id} onClick={() => openTaskMenu(cfg.id, t)}>
                {t.label}<span className="arrow">›</span>
              </div>
            ))}
          </div>
          <button className="fp-btn ghost" onClick={() => { closeFloatingPanels(); openActivityPanel(); }}>View Activity</button>
        </>
      ) : (
        <>
          {(taskDef.fields || []).map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              {f.type === "select" ? (
                <select disabled={isBusy} value={values[f.key] || f.options[0]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea disabled={isBusy} rows={3} placeholder={f.placeholder || ""} value={values[f.key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              ) : (
                <input disabled={isBusy} type={f.type} placeholder={f.placeholder || ""} value={values[f.key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              )}
            </div>
          ))}
          <button
            className="fp-btn"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              closeFloatingPanels();
              assignTaskToAgent(cfg.id, taskDef.id, values);
            }}
          >
            {isBusy ? "ARIA is thinking..." : "Assign Task"}
          </button>
        </>
      )}
    </div>
  );
}
