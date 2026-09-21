import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";
import Ground from "./village/Ground.jsx";
import Pond from "./village/Pond.jsx";
import ForestBorder from "./village/ForestBorder.jsx";
import Buildings from "./village/Buildings.jsx";
import Decor from "./village/Decor.jsx";
import Workstations from "./village/Workstations.jsx";
import VillageTrees from "./village/VillageTrees.jsx";
import Character from "./characters/Character.jsx";
import Ambient from "./effects/Ambient.jsx";
import Beams from "./effects/Beams.jsx";
import CameraRig from "./CameraRig.jsx";
import NavDebug from "./debug/NavDebug.jsx";
import { AGENTS_CONFIG } from "../domain/agentsConfig.js";
import { useVillageStore } from "../store/useVillageStore.js";

export default function Scene() {
  const clearSelection = useVillageStore((s) => s.clearSelection);
  const closeFloatingPanels = useVillageStore((s) => s.closeFloatingPanels);

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      onPointerMissed={() => { clearSelection(); closeFloatingPanels(); }}
      style={{ background: "linear-gradient(180deg, #d9edc7 0%, #b9dfb0 45%, #e8ddb0 100%)" }}
    >
      <OrthographicCamera makeDefault position={[18, 24, 18]} zoom={34} near={0.1} far={120} />
      <CameraRig />

      <ambientLight intensity={0.55} color="#fff2d6" />
      <directionalLight
        position={[11, 17, 7]}
        intensity={1.5}
        color="#ffddaa"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0003}
        shadow-radius={4}
      />
      {/* cool fill light from the opposite side, keeps shadow-side detail readable */}
      <directionalLight position={[-8, 6, -10]} intensity={0.25} color="#a8c9e8" />
      <hemisphereLight args={["#e8ddb0", "#3d5c34", 0.55]} />
      <fog attach="fog" args={["#cfe6be", 24, 46]} />

      <Suspense fallback={null}>
        <Ground />
        <Pond />
        <ForestBorder />
        <Buildings />
        <Decor />
        <Workstations />
        {/* <VillageTrees /> */}
        <Ambient />
        <Beams />
        <NavDebug />
        {AGENTS_CONFIG.map((cfg) => (
          <Character key={cfg.id} cfg={cfg} />
        ))}
      </Suspense>
    </Canvas>
  );
}
