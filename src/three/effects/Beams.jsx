import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useVillageStore } from "../../store/useVillageStore.js";
import { AGENTS_CONFIG } from "../../domain/agentsConfig.js";
import { nodePos } from "../../domain/nodes.js";

const workPos = {};
AGENTS_CONFIG.forEach((c) => { workPos[c.id] = nodePos(c.workNode); });

function Beam({ from, to, start }) {
  const ref = useRef();
  const a = workPos[from], b = workPos[to];
  useFrame(() => {
    if (!ref.current) return;
    const elapsed = (performance.now() - start) / 900;
    const t = Math.min(1, Math.max(0, elapsed));
    const arcH = 2.4;
    const x = THREE.MathUtils.lerp(a.x, b.x, t);
    const z = THREE.MathUtils.lerp(a.y, b.y, t);
    const y = 1.6 + Math.sin(t * Math.PI) * arcH;
    ref.current.position.set(x, y, z);
    ref.current.material.opacity = 1 - Math.pow(t, 3);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.11, 10, 10]} />
      <meshStandardMaterial color="#ffd866" emissive="#ffd866" emissiveIntensity={1.2} transparent opacity={1} />
    </mesh>
  );
}

export default function Beams() {
  const beams = useVillageStore((s) => s.beams);
  return (
    <group>
      {beams.map((b) => <Beam key={b.id} {...b} />)}
    </group>
  );
}
