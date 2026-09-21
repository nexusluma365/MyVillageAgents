import { useVillageStore } from "../store/useVillageStore.js";

export default function TopBar() {
  const toggleActivityPanel = useVillageStore((s) => s.toggleActivityPanel);
  const providerLabel = useVillageStore((s) => s.providerLabel);
  const pushToast = useVillageStore((s) => s.pushToast);

  return (
    <div id="topbar">
      <div className="brand">
        <div className="mark">🏘️</div>
        <div className="brand-text">
          <h1>AI Agent Village</h1>
          <div className="sub">Your AI workforce, working in the open</div>
        </div>
      </div>
      <div className="actions">
        <button
          className="pill-btn"
          title="Backend provider mode"
          onClick={() => pushToast("Aria routes requests. Specialists require real backend URLs; live changes require approval.", "assigned")}
        >
          <span className="dot" /> <span className="label-full">{providerLabel}</span>
        </button>
        <button className="pill-btn" onClick={toggleActivityPanel}>
          <span>📋</span> <span className="label-full">Activity</span>
        </button>
      </div>
    </div>
  );
}
