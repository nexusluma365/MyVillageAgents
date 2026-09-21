import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { nodePos } from "../../domain/nodes.js";
import { FARM_MODEL_URL } from "../../domain/environmentModels.js";
import { FARM_WORKER_IDS } from "../../domain/interactions.js";
import { useVillageStore } from "../../store/useVillageStore.js";
import EnvironmentBuilding from "./EnvironmentBuilding.jsx";

useGLTF.preload(FARM_MODEL_URL);

const TARGET_HEIGHT = 2.6;

// Shared workplace for every specialist agent. Lights up whenever any
// specialist is actually working inside (real task state, not a timer) —
// reads the same buildingGlow flags each agent's task lifecycle already sets.
function useAnyWorkerActive() {
  return useVillageStore((s) => FARM_WORKER_IDS.some((id) => s.buildingGlow[id]));
}

export default function Farm() {
  const p = nodePos("farmWork");
  const doorP = nodePos("farmDoor");
  const active = useAnyWorkerActive();
  const glowRef = useRef();

  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    const pulse = active ? 0.6 + Math.sin(clock.getElapsedTime() * 4) * 0.25 : 0.08;
    glowRef.current.emissiveIntensity = pulse;
  });

  return (
    <group>
      <EnvironmentBuilding
        url={FARM_MODEL_URL}
        targetHeight={TARGET_HEIGHT}
        position={[p.x, 0, p.y]}
        rotationY={Math.PI}
      />
      {/* work-light over the entrance — the visual "someone's in there working" tell */}
      <mesh position={[doorP.x, 1.9, doorP.y + 0.05]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial
          ref={glowRef}
          color="#ffe9a8"
          emissive="#ffcf5c"
          emissiveIntensity={0.08}
        />
      </mesh>
      <pointLight position={[doorP.x, 1.9, doorP.y + 0.05]} intensity={active ? 0.6 : 0.15} distance={3} color="#ffcf5c" />
    </group>
  );
}
