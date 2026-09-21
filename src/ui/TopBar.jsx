import { useVillageStore } from "../store/useVillageStore.js";
import { notificationPermission, requestNotificationPermission } from "../domain/notificationSystem.js";
import { useEffect, useState } from "react";

export default function TopBar() {
  const toggleActivityPanel = useVillageStore((s) => s.toggleActivityPanel);
  const providerLabel = useVillageStore((s) => s.providerLabel);
  const pushToast = useVillageStore((s) => s.pushToast);
  const [permission, setPermission] = useState(notificationPermission());

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  async function handleNotificationsClick() {
    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      pushToast("Village notifications are enabled on this device.", "completed");
    } else if (nextPermission === "denied") {
      pushToast("Notifications are blocked in this browser.", "error");
    } else if (nextPermission === "unsupported") {
      pushToast("This browser does not support notifications.", "error");
    } else {
      pushToast("Notifications were not enabled.", "assigned");
    }
  }

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
        <button
          className="pill-btn"
          onClick={handleNotificationsClick}
          title="Enable browser notifications"
        >
          <span>{permission === "granted" ? "🔔" : "🔕"}</span> <span className="label-full">Notify</span>
        </button>
      </div>
    </div>
  );
}
