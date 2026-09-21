import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nodePos } from "../../domain/nodes.js";
import { useVillageStore } from "../../store/useVillageStore.js";

// Small per-role prop clusters at each work node — environmental
// storytelling so a glance at a workstation says what that agent does,
// independent of the building itself. Offset CONTINUING PAST the work
// node in the same direction the agent already walks in from its yard —
// guaranteed clear of both the approach path and the building's front
// (door/sign/etc. all face back toward that same approach direction).
function offsetPastWork(workId, yardId, dist) {
  const w = nodePos(workId), y = nodePos(yardId);
  const dx = w.x - y.x, dz = w.y - y.y;
  const len = Math.hypot(dx, dz) || 1;
  return { x: w.x + (dx / len) * dist, z: w.y + (dz / len) * dist };
}

function WoodPile({ position, rotation = 0 }) {
  const logs = useMemo(() => [
    { x: -0.1, y: 0.09, rot: 0.1 }, { x: 0.1, y: 0.09, rot: -0.08 },
    { x: 0, y: 0.24, rot: 0.05 }, { x: -0.06, y: 0.39, rot: -0.03 },
  ], []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {logs.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, 0]} rotation={[0, 0, Math.PI / 2 + l.rot]} castShadow receiveShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.55, 10]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#8a6339" : "#9c7648"} roughness={0.85} />
        </mesh>
      ))}
      {logs.map((l, i) => (
        <mesh key={`cap-${i}`} position={[l.x - 0.275, l.y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.09, 10]} />
          <meshStandardMaterial color="#c9a876" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function ChoppingBlock({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.27, 0.44, 14]} />
        <meshStandardMaterial color="#9c7648" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 14]} />
        <meshStandardMaterial color="#c9a876" roughness={0.85} />
      </mesh>
      {/* axe stuck in the block */}
      <group position={[0.05, 0.46, 0]} rotation={[0, 0, -0.25]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.4, 6]} />
          <meshStandardMaterial color="#5a3d20" roughness={0.8} />
        </mesh>
        <mesh position={[0.05, 0.38, 0]} rotation={[0, 0, 0.3]} castShadow>
          <boxGeometry args={[0.12, 0.11, 0.02]} />
          <meshStandardMaterial color="#8d867a" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function BookStack({ position, rotation = 0 }) {
  const colors = ["#4ea8de", "#b8433f", "#2fa66b", "#e0a831"];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {colors.map((c, i) => (
        <mesh key={i} position={[0, 0.03 + i * 0.055, 0]} rotation={[0, i * 0.15, 0]} castShadow>
          <boxGeometry args={[0.26, 0.05, 0.34]} />
          <meshStandardMaterial color={c} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function StudyTable({ position, rotation = 0, children }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.05, 0.4]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.85} />
      </mesh>
      {[[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.15], [0.22, 0.15]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.15, z]} castShadow>
          <boxGeometry args={[0.04, 0.3, 0.04]} />
          <meshStandardMaterial color="#4a3018" roughness={0.85} />
        </mesh>
      ))}
      <group position={[0, 0.35, 0]}>{children}</group>
    </group>
  );
}

function WorkPulse({ position, color = "#ffe9a8", active = false }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.scale.setScalar(active ? 0.85 + Math.sin(t * 3) * 0.08 : 0.65);
    ref.current.material.opacity = active ? 0.22 + Math.sin(t * 3.4) * 0.06 : 0.08;
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.55, 28]} />
      <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
    </mesh>
  );
}

function GlowScreen({ position, rotation = 0, active = false }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const speed = active ? 4 : 2;
    ref.current.material.emissiveIntensity = (active ? 0.85 : 0.45) + Math.sin(clock.getElapsedTime() * speed) * (active ? 0.22 : 0.12);
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[0.32, 0.22, 0.03]} />
        <meshStandardMaterial color="#241a3a" roughness={0.6} />
      </mesh>
      <mesh ref={ref} position={[0, 0.16, 0.02]}>
        <planeGeometry args={[0.26, 0.16]} />
        <meshStandardMaterial color="#c98bf0" emissive="#c98bf0" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, -0.02, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.3, 0.16, 0.02]} />
        <meshStandardMaterial color="#3a2a52" roughness={0.6} />
      </mesh>
    </group>
  );
}

function CableCoil({ position }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[0.09, 0.02, 8, 16]} />
      <meshStandardMaterial color="#2a2016" roughness={0.7} />
    </mesh>
  );
}

function WritingDesk({ position, rotation = 0, active = false }) {
  const paperRef = useRef();
  useFrame(({ clock }) => {
    if (!paperRef.current) return;
    paperRef.current.rotation.z = active ? 0.1 + Math.sin(clock.getElapsedTime() * 4) * 0.03 : 0.1;
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.3, 0]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.03, 0.3]} />
        <meshStandardMaterial color="#8a6339" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.15, 0.1]} castShadow>
        <boxGeometry args={[0.42, 0.28, 0.04]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.85} />
      </mesh>
      {/* papers on the slanted desk */}
      <mesh ref={paperRef} position={[-0.06, 0.34, -0.02]} rotation={[0.35, 0, 0.1]}>
        <planeGeometry args={[0.14, 0.19]} />
        <meshStandardMaterial color="#f4ead0" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.09, 0.345, 0.03]} rotation={[0.35, 0, -0.06]}>
        <planeGeometry args={[0.14, 0.19]} />
        <meshStandardMaterial color="#f4ead0" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* inkwell */}
      <mesh position={[0.16, 0.36, -0.06]}>
        <cylinderGeometry args={[0.03, 0.035, 0.05, 8]} />
        <meshStandardMaterial color="#2a2016" roughness={0.5} />
      </mesh>
    </group>
  );
}

function PlanningTable({ position, rotation = 0, active = false }) {
  const markerRef = useRef();
  useFrame(({ clock }) => {
    if (!markerRef.current) return;
    markerRef.current.position.y = 0.44 + (active ? Math.abs(Math.sin(clock.getElapsedTime() * 3)) * 0.04 : 0);
  });
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.85, 0.06, 0.55]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.8} />
      </mesh>
      {[[-0.38, -0.24], [0.38, -0.24], [-0.38, 0.24], [0.38, 0.24]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.19, z]} castShadow>
          <boxGeometry args={[0.06, 0.38, 0.06]} />
          <meshStandardMaterial color="#4a3018" roughness={0.85} />
        </mesh>
      ))}
      {/* map with painted regions */}
      <mesh position={[0, 0.415, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, 0.42]} />
        <meshStandardMaterial color="#e7d6ab" roughness={0.9} />
      </mesh>
      {[[-0.18, -0.1, "#8fc169", 0.18, 0.12], [0.15, 0.08, "#a8c9e8", 0.14, 0.1], [0.05, -0.12, "#e0a831", 0.1, 0.08]].map(([x, z, c, w, d], i) => (
        <mesh key={i} position={[x, 0.417, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={c} roughness={0.85} />
        </mesh>
      ))}
      {/* small marker pieces */}
      {[[-0.1, -0.05], [0.2, 0.1]].map(([x, z], i) => (
        <mesh key={i} ref={i === 0 ? markerRef : undefined} position={[x, 0.44, z]} castShadow>
          <coneGeometry args={[0.025, 0.06, 6]} />
          <meshStandardMaterial color={i === 0 ? "#b8433f" : "#2fa66b"} />
        </mesh>
      ))}
    </group>
  );
}

export default function Workstations() {
  const agents = useVillageStore((s) => s.agents);
  const isActive = (id) => ["working", "waiting", "handoff"].includes(agents[id]?.status);
  const studio = offsetPastWork("studioWork", "studioYard", 1.1);
  const lab = offsetPastWork("labWork", "labYard", 1.15);
  const data = offsetPastWork("dataWork", "dataYard", 1.15);
  const workshop = offsetPastWork("workshopWork", "workshopYard", 1.15);
  const command = offsetPastWork("commandWork", "commandYard", 1.3);

  return (
    <group>
      {/* Automation — wood + forge yard */}
      <WorkPulse position={[workshop.x, 0.035, workshop.z]} color="#f2994a" active={isActive("automation")} />
      <WoodPile position={[workshop.x - 0.3, 0, workshop.z + 0.2]} rotation={0.3} />
      <ChoppingBlock position={[workshop.x + 0.25, 0, workshop.z - 0.15]} />

      {/* Research — study table with books and a rolled map */}
      <WorkPulse position={[lab.x, 0.035, lab.z]} color="#4ea8de" active={isActive("research")} />
      <StudyTable position={[lab.x, 0, lab.z]} rotation={-0.4}>
        <BookStack position={[-0.1, 0, -0.05]} rotation={0.2} />
        <mesh position={[0.15, 0.03, 0.08]} rotation={[Math.PI / 2, 0, 0.4]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.28, 10]} />
          <meshStandardMaterial color="#e7d6ab" roughness={0.85} />
        </mesh>
      </StudyTable>

      {/* Data — glowing console + cable coils */}
      <WorkPulse position={[data.x, 0.035, data.z]} color="#9b6bce" active={isActive("data")} />
      <GlowScreen position={[data.x, 0, data.z]} rotation={0.5} active={isActive("data")} />
      <CableCoil position={[data.x + 0.25, 0.02, data.z + 0.1]} />
      <CableCoil position={[data.x + 0.32, 0.02, data.z - 0.05]} />

      {/* Content — a writing desk with papers */}
      <WorkPulse position={[studio.x, 0.035, studio.z]} color="#e85b57" active={isActive("content")} />
      <WritingDesk position={[studio.x, 0, studio.z]} rotation={0.6} active={isActive("content")} />

      {/* Manager — a planning table with a painted map */}
      <WorkPulse position={[command.x, 0.035, command.z]} color="#2fa66b" active={isActive("manager")} />
      <PlanningTable position={[command.x, 0, command.z]} rotation={0.2} active={isActive("manager")} />
    </group>
  );
}
