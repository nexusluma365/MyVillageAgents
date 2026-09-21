import { useEffect } from "react";
import Scene from "./three/Scene.jsx";
import TopBar from "./ui/TopBar.jsx";
import ZoomControls from "./ui/ZoomControls.jsx";
import Legend from "./ui/Legend.jsx";
import Toasts from "./ui/Toasts.jsx";
import TaskMenu from "./ui/TaskMenu.jsx";
import DetailPanel from "./ui/DetailPanel.jsx";
import ActivityPanel from "./ui/ActivityPanel.jsx";
import AgentAlert from "./ui/AgentAlert.jsx";
import AuthGate from "./ui/AuthGate.jsx";
import UiErrorBoundary from "./ui/UiErrorBoundary.jsx";
import { useVillageStore } from "./store/useVillageStore.js";

export default function App() {
  return (
    <AuthGate>
      <VillageApp />
    </AuthGate>
  );
}

function VillageApp() {
  const initAgents = useVillageStore((s) => s.initAgents);
  const receiveBusinessEvent = useVillageStore((s) => s.receiveBusinessEvent);
  const setProviderHealth = useVillageStore((s) => s.setProviderHealth);
  const pushToast = useVillageStore((s) => s.pushToast);

  useEffect(() => {
    initAgents();
  }, [initAgents]);

  useEffect(() => {
    const onBusinessEvent = (event) => {
      receiveBusinessEvent(event.detail);
    };
    const onWindowMessage = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "rentready:business-event") return;
      receiveBusinessEvent(event.data.payload);
    };
    const onServiceWorkerMessage = (event) => {
      if (event.data?.type !== "rentready:business-event") return;
      receiveBusinessEvent({ ...event.data.payload, suppressNotification: true });
    };

    window.addEventListener("rentready:business-event", onBusinessEvent);
    window.addEventListener("message", onWindowMessage);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    window.RentReadyVillage = {
      ...(window.RentReadyVillage || {}),
      receiveBusinessEvent,
    };

    return () => {
      window.removeEventListener("rentready:business-event", onBusinessEvent);
      window.removeEventListener("message", onWindowMessage);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [receiveBusinessEvent]);

  useEffect(() => {
    const onOffline = () => {
      setProviderHealth("offline");
      pushToast("Connection lost. Waiting for internet...", "error");
    };
    const onOnline = () => {
      setProviderHealth("connected");
      pushToast("Connection restored.", "completed");
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (!navigator.onLine) onOffline();
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [pushToast, setProviderHealth]);

  return (
    <div id="app">
      <TopBar />
      <div id="viewport">
        <Scene />
        <UiErrorBoundary>
          <Toasts />
          <TaskMenu />
          <DetailPanel />
          <AgentAlert />
        </UiErrorBoundary>
        <ZoomControls />
        <Legend />
      </div>
      <ActivityPanel />
    </div>
  );
}
