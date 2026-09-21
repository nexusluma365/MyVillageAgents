import * as THREE from "three";
import { NODES, NAV_PATH_PAIRS, nodePos } from "../../domain/nodes.js";
import { AGENT_TERRITORIES, BENCH_INTERACTIONS, WORK_INTERACTIONS, NAV_OBSTACLES } from "../../domain/interactions.js";
import { AGENTS_CONFIG } from "../../domain/agentsConfig.js";

function Arrow({ nodeId, yaw, color = "#ffe36e" }) {
  const p = nodePos(nodeId);
  if (!p) return null;
  return (
    <group position={[p.x, 0.08, p.y]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0, 0.22]}>
        <boxGeometry args={[0.035, 0.035, 0.42]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.16, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function Edge({ a, b }) {
  const pa = nodePos(a);
  const pb = nodePos(b);
  if (!pa || !pb) return null;
  const dx = pb.x - pa.x;
  const dz = pb.y - pa.y;
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  return (
    <mesh position={[(pa.x + pb.x) / 2, 0.035, (pa.y + pb.y) / 2]} rotation={[0, yaw, 0]}>
      <boxGeometry args={[0.025, 0.025, len]} />
      <meshBasicMaterial color="#5fffd0" transparent opacity={0.45} />
    </mesh>
  );
}

export default function NavDebug() {
  if (!import.meta.env.DEV) return null;
  if (!new URLSearchParams(window.location.search).has("navdebug")) return null;

  return (
    <group>
      {NAV_PATH_PAIRS.map(([a, b]) => <Edge key={`${a}-${b}`} a={a} b={b} />)}
      {Object.entries(NODES).map(([id, p]) => (
        <mesh key={id} position={[p.x, 0.08, p.y]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={id.includes("Seat") ? "#ff80c8" : id.includes("Door") ? "#ffd166" : "#66d9ff"} />
        </mesh>
      ))}
      {Object.values(BENCH_INTERACTIONS).map((bench) => (
        <Arrow key={bench.id} nodeId={bench.seatNode} yaw={bench.seatYaw} color="#ff80c8" />
      ))}
      {Object.entries(WORK_INTERACTIONS).map(([id, work]) => (
        <Arrow key={id} nodeId={work.entranceNode} yaw={work.entranceYaw} color="#ffd166" />
      ))}
      {NAV_OBSTACLES.map((obstacle) => (
        <mesh
          key={obstacle.id}
          position={[obstacle.center[0], 0.03, obstacle.center[1]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {obstacle.type === "circle"
            ? <circleGeometry args={[obstacle.radius, 32]} />
            : <planeGeometry args={[obstacle.size[0], obstacle.size[1]]} />}
          <meshBasicMaterial color="#ff4d4d" transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {AGENTS_CONFIG.map((cfg) => {
        const territory = AGENT_TERRITORIES[cfg.id];
        const p = territory && nodePos(territory.homeNode);
        if (!p) return null;
        return (
          <mesh key={cfg.id} position={[p.x, 0.025, p.y]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[territory.homeRadius - 0.03, territory.homeRadius, 48]} />
            <meshBasicMaterial color={cfg.c1} transparent opacity={0.22} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}
