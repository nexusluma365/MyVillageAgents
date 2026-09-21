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

  useEffect(() => {
    initAgents();
  }, [initAgents]);

  return (
    <div id="app">
      <TopBar />
      <div id="viewport">
        <Scene />
        <Toasts />
        <TaskMenu />
        <DetailPanel />
        <AgentAlert />
        <ZoomControls />
        <Legend />
      </div>
      <ActivityPanel />
    </div>
  );
}
