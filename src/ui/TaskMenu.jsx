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
  const requiredFields = (taskDef?.fields || []).filter((field) => field.type !== "select");
  const canSubmit = !isBusy && (!taskDef || requiredFields.every((field) => String(values[field.key] || "").trim().length > 0));

  function submitTask(def, submittedValues = values) {
    if (!def || isBusy) return;
    const params = buildTaskParams(def, submittedValues);
    closeFloatingPanels();
    assignTaskToAgent(cfg.id, def.id, params);
  }

  function chooseTask(def) {
    if (def.quickRequest) {
      submitTask(def, {});
      return;
    }
    openTaskMenu(cfg.id, def);
  }

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
          <div className="fp-label">Quick Commands</div>
          <div className="agent-identity-note">
            <strong>{cfg.workstation}</strong>
            <span>{cfg.responsibilities?.slice(0, 3).join(" · ")}</span>
          </div>
          <div className="task-list">
            {cfg.tasks.map((t) => (
              <div className="task-item" key={t.id} onClick={() => chooseTask(t)}>
                <span className="task-item-copy">
                  <strong>{t.label}</strong>
                  {t.subtext && <small>{t.subtext}</small>}
                </span>
                <span className="arrow">›</span>
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
              submitTask(taskDef, values);
            }}
          >
            {isBusy ? "ARIA is thinking..." : taskDef.submitLabel || "Assign Task"}
          </button>
        </>
      )}
    </div>
  );
}

function buildTaskParams(taskDef, values = {}) {
  if (taskDef.quickRequest) {
    return { request: taskDef.quickRequest, specialist: "auto" };
  }
  if (taskDef.requestTemplate) {
    return {
      request: applyRequestTemplate(taskDef.requestTemplate, values),
      specialist: "auto",
    };
  }
  return values;
}

function applyRequestTemplate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] || "").trim());
}
