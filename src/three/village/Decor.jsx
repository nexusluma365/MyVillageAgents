import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { NODES, nodePos } from "../../domain/nodes.js";
import { fbm2D } from "../utils/noise.js";
import { POND_CENTER, POND_BANK_RADIUS } from "./pondGeometry.js";

function Bench({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.06, 0.28]} />
        <meshStandardMaterial color="#e8e2d4" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.4, -0.11]} castShadow>
        <boxGeometry args={[0.7, 0.3, 0.05]} />
        <meshStandardMaterial color="#3a3d63" roughness={0.6} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]} castShadow>
          <boxGeometry args={[0.06, 0.2, 0.26]} />
          <meshStandardMaterial color="#5a3d20" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.14, 8]} />
        <meshStandardMaterial color="#3a2712" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 1.2, 8]} />
        <meshStandardMaterial color="#5a3d20" roughness={0.8} />
      </mesh>
      {/* little roof cap over the lantern */}
      <mesh position={[0, 1.44, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.16, 0.14, 4]} />
        <meshStandardMaterial color="#3a2712" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.32, 0]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#ffe9a8" emissive="#ffcf5c" emissiveIntensity={0.7} />
      </mesh>
      <pointLight position={[0, 1.32, 0]} intensity={0.4} distance={3} color="#ffcf5c" />
    </group>
  );
}

function FlowerCluster({ position, hue, hue2 }) {
  const flowers = useMemo(() => Array.from({ length: 6 }, () => ({
    x: (Math.random() - 0.5) * 0.55,
    z: (Math.random() - 0.5) * 0.55,
    two: Math.random() > 0.5,
    s: 0.05 + Math.random() * 0.025,
  })), []);
  return (
    <group position={position}>
      {/* low bush base so flowers don't float over bare dirt */}
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.32, 8, 6]} />
        <meshStandardMaterial color="#3f7a3f" roughness={0.9} />
      </mesh>
      {flowers.map((f, i) => (
        <mesh key={i} position={[f.x, 0.16, f.z]} castShadow>
          <sphereGeometry args={[f.s, 6, 6]} />
          <meshStandardMaterial color={f.two ? hue2 : hue} />
        </mesh>
      ))}
    </group>
  );
}

function Well({ position }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.85, 20]} />
        <meshStandardMaterial color="#c9bda3" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.5, 14]} />
        <meshStandardMaterial color="#b9b3a5" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <torusGeometry args={[0.46, 0.04, 8, 16]} />
        <meshStandardMaterial color="#8d867a" roughness={0.8} />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.75, 0]} castShadow>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshStandardMaterial color="#6b4a2b" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
        <meshStandardMaterial color="#3a2712" />
      </mesh>
      <mesh position={[0, 1.05, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.65, 0.35, 4]} />
        <meshStandardMaterial color="#b8873a" roughness={0.8} />
      </mesh>
      {/* bucket on a rope */}
      <mesh position={[0.15, 0.85, 0]}>
        <cylinderGeometry args={[0.03, 0.02, 0.3, 4]} />
        <meshStandardMaterial color="#8d867a" />
      </mesh>
      <mesh position={[0.15, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.07, 0.12, 10]} />
        <meshStandardMaterial color="#6b5a4a" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

function GardenPlot({ position, w = 2.2, d = 1.3 }) {
  const rows = 3;
  const items = useMemo(() => {
    const arr = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 6; c++) {
        arr.push({ x: (c - 2.5) * (w / 7), z: (r - 1) * (d / 3), leafy: (r + c) % 2 === 0 });
      }
    }
    return arr;
  }, [w, d]);
  return (
    <group position={position}>
      {/* low stone border */}
      {[[-w / 2 - 0.06, 0], [w / 2 + 0.06, 0]].map(([x], i) => (
        <mesh key={i} position={[x, 0.06, 0]} castShadow>
          <boxGeometry args={[0.12, 0.12, d + 0.24]} />
          <meshStandardMaterial color="#a89478" roughness={0.9} />
        </mesh>
      ))}
      {[[0, -d / 2 - 0.06], [0, d / 2 + 0.06]].map(([, z], i) => (
        <mesh key={i} position={[0, 0.06, z]} castShadow>
          <boxGeometry args={[w + 0.24, 0.12, 0.12]} />
          <meshStandardMaterial color="#a89478" roughness={0.9} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#5a3d20" roughness={1} />
      </mesh>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, 0.09, it.z]} castShadow>
          <sphereGeometry args={[0.09, 6, 6]} />
          <meshStandardMaterial color={it.leafy ? "#5fa64a" : "#7cc766"} />
        </mesh>
      ))}
    </group>
  );
}

// Wooden crate / barrel prop clusters, the kind of ambient set-dressing
// that makes a base-builder village feel lived-in.
function PropCluster({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[-0.15, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#8a6339" roughness={0.85} />
      </mesh>
      <mesh position={[-0.15, 0.15, 0]}>
        <boxGeometry args={[0.31, 0.02, 0.31]} />
        <meshStandardMaterial color="#5a3d20" />
      </mesh>
      <mesh position={[0.22, 0.19, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.38, 12]} />
        <meshStandardMaterial color="#9c7648" roughness={0.85} />
      </mesh>
      {[-0.1, 0.1].map((y) => (
        <mesh key={y} position={[0.22, 0.19 + y, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.015, 6, 16]} />
          <meshStandardMaterial color="#3a2712" />
        </mesh>
      ))}
      <mesh position={[-0.15, 0.31, -0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.32, 12]} />
        <meshStandardMaterial color="#8a6339" roughness={0.85} />
      </mesh>
    </group>
  );
}

function FencePost({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 0.4, 6]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.14, 0.25]} castShadow>
        <boxGeometry args={[0.03, 0.05, 0.5]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.26, 0.25]} castShadow>
        <boxGeometry args={[0.03, 0.05, 0.5]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.85} />
      </mesh>
    </group>
  );
}

// A short rail hugging the near bank of the pond, facing the village —
// reads as a deliberate safety border rather than a random prop, and keeps
// the water's edge visually "owned" ground instead of empty grass.
function PondFenceArc() {
  const hub = nodePos("hub");
  const items = useMemo(() => {
    const baseAngle = Math.atan2(hub.y - POND_CENTER.z, hub.x - POND_CENTER.x);
    const spread = 0.55;
    const count = 5;
    const r = POND_BANK_RADIUS + 0.28;
    const arr = [];
    for (let i = 0; i < count; i++) {
      const a = baseAngle - spread / 2 + (spread * i) / (count - 1);
      arr.push({
        x: POND_CENTER.x + Math.cos(a) * r,
        z: POND_CENTER.z + Math.sin(a) * r,
        rot: a + Math.PI / 2,
      });
    }
    return arr;
  }, [hub.y, hub.x]);
  return (
    <group>
      {items.map((p, i) => (
        <FencePost key={i} position={[p.x, 0, p.z]} rotation={p.rot} />
      ))}
    </group>
  );
}

function FenceRun({ from, to, count }) {
  const items = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      arr.push({ x: from[0] + (to[0] - from[0]) * t, z: from[1] + (to[1] - from[1]) * t });
    }
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
    return { arr, angle };
  }, [from, to, count]);
  return (
    <group>
      {items.arr.map((p, i) => (
        <FencePost key={i} position={[p.x, 0, p.z]} rotation={items.angle} />
      ))}
    </group>
  );
}

function CompoundFence({ center, w, d, gap = "south" }) {
  const cx = center[0], cz = center[1];
  const x1 = cx - w / 2, x2 = cx + w / 2;
  const z1 = cz - d / 2, z2 = cz + d / 2;
  const runs = [
    { from: [x1, z1], to: [x2, z1], open: gap === "south" },
    { from: [x1, z2], to: [x2, z2], open: gap === "north" },
    { from: [x1, z1], to: [x1, z2], open: gap === "west" },
    { from: [x2, z1], to: [x2, z2], open: gap === "east" },
  ];
  return (
    <group>
      {runs.map((run, i) => {
        if (!run.open) return <FenceRun key={i} from={run.from} to={run.to} count={Math.max(3, Math.round((i < 2 ? w : d) / 0.65))} />;
        const mx = (run.from[0] + run.to[0]) / 2;
        const mz = (run.from[1] + run.to[1]) / 2;
        const horizontal = Math.abs(run.to[0] - run.from[0]) > Math.abs(run.to[1] - run.from[1]);
        const halfGap = 0.58;
        return horizontal ? (
          <group key={i}>
            <FenceRun from={run.from} to={[mx - halfGap, mz]} count={Math.max(2, Math.round((w / 2 - halfGap) / 0.65))} />
            <FenceRun from={[mx + halfGap, mz]} to={run.to} count={Math.max(2, Math.round((w / 2 - halfGap) / 0.65))} />
          </group>
        ) : (
          <group key={i}>
            <FenceRun from={run.from} to={[mx, mz - halfGap]} count={Math.max(2, Math.round((d / 2 - halfGap) / 0.65))} />
            <FenceRun from={[mx, mz + halfGap]} to={run.to} count={Math.max(2, Math.round((d / 2 - halfGap) / 0.65))} />
          </group>
        );
      })}
    </group>
  );
}

function TrainingSign({ position, label, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.76, 6]} />
        <meshStandardMaterial color="#4a3018" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <boxGeometry args={[0.72, 0.28, 0.05]} />
        <meshStandardMaterial color="#f0dfaa" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.82, 0.031]}>
        <planeGeometry args={[0.58, 0.16]} />
        <meshStandardMaterial color={label === "Research" ? "#4ea8de" : label === "Plan" ? "#2fa66b" : "#e0a831"} roughness={0.7} />
      </mesh>
    </group>
  );
}

// Instanced rocks + low bushes scattered across the open terrain (never on
// paths/plaza/building pads) for natural imperfection and ground clutter.
function ScatteredNature() {
  const rockRef = useRef();
  const bushRef = useRef();
  const stumpRef = useRef();
  const saplingRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { rocks, bushes, stumps, saplings, logs } = useMemo(() => {
    const nodePoints = Object.values(NODES).map((n) => ({ x: n.x, z: n.y }));
    const isClear = (x, z) => {
      const dHub = Math.hypot(x, z);
      if (dHub < 3.2) return false;
      for (const n of nodePoints) if (Math.hypot(x - n.x, z - n.z) < 2.1) return false;
      if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < POND_BANK_RADIUS + 1.4) return false;
      return true;
    };
    const rocks = [];
    const bushes = [];
    const stumps = [];
    const saplings = [];
    const logs = [];
    let tries = 0;
    while (rocks.length < 26 && tries < 800) {
      tries++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 14;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (!isClear(x, z)) continue;
      rocks.push({ x, z, s: 0.12 + Math.random() * 0.22, rot: Math.random() * Math.PI, tilt: Math.random() * 0.3 });
    }
    tries = 0;
    while (bushes.length < 34 && tries < 800) {
      tries++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 3.5 + Math.random() * 15;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (!isClear(x, z)) continue;
      bushes.push({ x, z, s: 0.18 + Math.random() * 0.16, tone: fbm2D(x * 0.3, z * 0.3, 2) });
    }
    // Stumps, saplings and fallen logs cluster near the forest edge —
    // "this used to be forest, someone's been through here" storytelling
    // rather than uniformly scattered like the rocks/bushes above.
    tries = 0;
    while (stumps.length < 7 && tries < 400) {
      tries++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 11 + Math.random() * 4.5;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (!isClear(x, z)) continue;
      stumps.push({ x, z, s: 0.7 + Math.random() * 0.4, rot: Math.random() * Math.PI });
    }
    tries = 0;
    while (saplings.length < 14 && tries < 500) {
      tries++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 6;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (!isClear(x, z)) continue;
      saplings.push({ x, z, s: 0.4 + Math.random() * 0.35 });
    }
    tries = 0;
    while (logs.length < 4 && tries < 400) {
      tries++;
      const angle = Math.random() * Math.PI * 2;
      const radius = 12 + Math.random() * 4;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (!isClear(x, z)) continue;
      logs.push({ x, z, rot: Math.random() * Math.PI, s: 0.8 + Math.random() * 0.4 });
    }
    return { rocks, bushes, stumps, saplings, logs };
  }, []);

  useLayoutEffect(() => {
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, 0.05, r.z);
      dummy.rotation.set(r.tilt, r.rot, r.tilt * 0.6);
      dummy.scale.set(r.s, r.s * 0.75, r.s);
      dummy.updateMatrix();
      rockRef.current.setMatrixAt(i, dummy.matrix);
      rockRef.current.setColorAt(i, new THREE.Color(i % 2 === 0 ? "#8f8878" : "#a39c8c"));
    });
    rockRef.current.instanceMatrix.needsUpdate = true;
    if (rockRef.current.instanceColor) rockRef.current.instanceColor.needsUpdate = true;

    bushes.forEach((b, i) => {
      dummy.position.set(b.x, b.s * 0.5, b.z);
      dummy.rotation.set(0, b.tone * 6, 0);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      bushRef.current.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color("#3f7a3f").lerp(new THREE.Color("#6fa04a"), b.tone);
      bushRef.current.setColorAt(i, c);
    });
    bushRef.current.instanceMatrix.needsUpdate = true;
    if (bushRef.current.instanceColor) bushRef.current.instanceColor.needsUpdate = true;

    stumps.forEach((s, i) => {
      dummy.position.set(s.x, s.s * 0.09, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      stumpRef.current.setMatrixAt(i, dummy.matrix);
    });
    stumpRef.current.instanceMatrix.needsUpdate = true;

    saplings.forEach((s, i) => {
      dummy.position.set(s.x, s.s * 0.25, s.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      saplingRef.current.setMatrixAt(i, dummy.matrix);
    });
    saplingRef.current.instanceMatrix.needsUpdate = true;
  }, [rocks, bushes, stumps, saplings, dummy]);

  return (
    <group>
      <instancedMesh ref={rockRef} args={[null, null, rocks.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={bushRef} args={[null, null, bushes.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={stumpRef} args={[null, null, stumps.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.18, 12]} />
        <meshStandardMaterial color="#8a6339" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={saplingRef} args={[null, null, saplings.length]} castShadow>
        <coneGeometry args={[0.12, 0.5, 6]} />
        <meshStandardMaterial color="#6fa04a" roughness={0.85} />
      </instancedMesh>
      {logs.map((l, i) => (
        <mesh key={i} position={[l.x, 0.13 * l.s, l.z]} rotation={[0, l.rot, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.13 * l.s, 0.15 * l.s, 1.1 * l.s, 10]} />
          <meshStandardMaterial color="#6b4a2b" roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

export default function Decor() {
  const b1 = nodePos("bench1"), b2 = nodePos("bench2");
  return (
    <group>
      <Bench position={[b1.x, 0, b1.y]} rotation={[0, Math.PI / 2, 0]} />
      <Bench position={[b2.x, 0, b2.y]} rotation={[0, -Math.PI / 2, 0]} />
      <Lamp position={[b1.x - 0.9, 0, b1.y - 0.9]} />
      <Lamp position={[b2.x + 0.9, 0, b2.y - 0.9]} />
      <Lamp position={[-1.3, 0, 1.6]} />
      <Lamp position={[1.3, 0, -1.6]} />
      <Well position={[3.6, 0, 1.2]} />
      <GardenPlot position={[-8.2, 0, 6.5]} />
      <GardenPlot position={[10.6, 0, 7.5]} w={1.8} d={1.1} />
      {[
        [2.8, 5.6, "#e07fbf", "#f2994a"], [-4.4, -6.8, "#e07fbf", "#c98bf0"],
        [4.9, -6.4, "#f2c94c", "#e07fbf"], [-2.2, 6.9, "#f2c94c", "#f2994a"],
        [1.4, -8.6, "#c98bf0", "#f2c94c"], [-6.6, -2.4, "#f2994a", "#f2c94c"],
      ].map(([x, z, hue, hue2], i) => (
        <FlowerCluster key={i} position={[x, 0, z]} hue={hue} hue2={hue2} />
      ))}
      <PropCluster position={[-8.6, 0, 3.4]} rotation={0.4} />
      <PropCluster position={[8.9, 0, -3.6]} rotation={-0.6} />
      <PropCluster position={[-9.0, 0, -1.5]} rotation={1.1} />
      <CompoundFence center={[-7.7, -4.9]} w={3.5} d={2.8} gap="north" />
      <CompoundFence center={[0, -5.1]} w={3.2} d={3.0} gap="north" />
      <CompoundFence center={[7.7, -4.9]} w={3.5} d={2.8} gap="north" />
      <CompoundFence center={[-7.7, 2.9]} w={3.5} d={2.8} gap="south" />
      <CompoundFence center={[0, 3.75]} w={4.3} d={3.4} gap="south" />
      <TrainingSign position={[1.75, 0, -3.35]} label="Research" rotation={-0.25} />
      <TrainingSign position={[2.25, 0, 3.1]} label="Plan" rotation={0.25} />
      <TrainingSign position={[-5.65, 0, 2.2]} label="Craft" rotation={0.65} />
      <FenceRun from={[-6.4, -3.0]} to={[-6.4, -5.6]} count={4} />
      <PondFenceArc />
      <ScatteredNature />
    </group>
  );
}
