import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nodePos } from "../../domain/nodes.js";

// Small, cheap "the world is alive" touches: a few birds circling above the
// village, butterflies drifting near the flower beds, and fireflies/pollen
// motes over the pond at dusk-brightness. All driven by useFrame math —
// no textures, no physics, just enough motion to sell a living place.
function Birds() {
  const count = 5;
  const data = useMemo(() => Array.from({ length: count }, (_, i) => ({
    radius: 7 + i * 1.1,
    speed: 0.25 + Math.random() * 0.15,
    height: 6 + Math.random() * 1.5,
    phase: Math.random() * Math.PI * 2,
  })), []);

  return (
    <group>
      {data.map((bird, i) => <Bird key={i} data={bird} index={i} />)}
    </group>
  );
}

function Bird({ data, index }) {
  const group = useRef();
  const wingL = useRef();
  const wingR = useRef();
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const a = t * data.speed + data.phase;
    group.current.position.set(
      Math.cos(a) * data.radius,
      data.height + Math.sin(t * 0.6 + index) * 0.4,
      Math.sin(a) * data.radius
    );
    group.current.rotation.set(0, -a + Math.PI / 2, 0);
    const flap = Math.sin(t * 10 + index) * 0.55;
    if (wingL.current) wingL.current.rotation.z = 0.3 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.3 - flap;
  });

  return (
    <group ref={group} scale={0.62}>
      <mesh castShadow>
        <capsuleGeometry args={[0.08, 0.18, 4, 8]} />
        <meshStandardMaterial color="#2f2b25" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.02, 0.16]} castShadow>
        <sphereGeometry args={[0.075, 8, 8]} />
        <meshStandardMaterial color="#38332b" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.02, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.07, 6]} />
        <meshStandardMaterial color="#d8a13d" roughness={0.55} />
      </mesh>
      <group ref={wingL} position={[-0.08, 0.02, 0.02]}>
        <mesh position={[-0.12, 0, 0]} rotation={[0, 0, 0.28]} castShadow>
          <boxGeometry args={[0.24, 0.018, 0.08]} />
          <meshStandardMaterial color="#211f1d" roughness={0.7} />
        </mesh>
      </group>
      <group ref={wingR} position={[0.08, 0.02, 0.02]}>
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, -0.28]} castShadow>
          <boxGeometry args={[0.24, 0.018, 0.08]} />
          <meshStandardMaterial color="#211f1d" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Butterflies() {
  const count = 6;
  const ref = useRef();
  const data = useMemo(() => Array.from({ length: count }, () => ({
    cx: (Math.random() - 0.5) * 16,
    cz: (Math.random() - 0.5) * 16,
    r: 0.4 + Math.random() * 0.6,
    speed: 0.6 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    color: Math.random() > 0.5 ? "#f2994a" : "#9b6bce",
  })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    data.forEach((d, i) => {
      const a = t * d.speed + d.phase;
      dummy.position.set(d.cx + Math.cos(a) * d.r, 0.5 + Math.sin(t * 3 + i) * 0.1, d.cz + Math.sin(a) * d.r);
      dummy.rotation.set(0, -a, Math.sin(t * 12 + i) * 0.6);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, count]}>
      <planeGeometry args={[0.12, 0.09]} />
      <meshStandardMaterial color="#e07fbf" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function PondFireflies() {
  const count = 18;
  const ref = useRef();
  const pond = nodePos("pondside");
  const data = useMemo(() => Array.from({ length: count }, () => ({
    x: pond.x + (Math.random() - 0.5) * 3.4,
    z: pond.y + (Math.random() - 0.5) * 3.4,
    baseY: 0.3 + Math.random() * 0.8,
    speed: 0.4 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
  })), [pond.x, pond.y]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    data.forEach((d, i) => {
      dummy.position.set(
        d.x + Math.sin(t * d.speed + d.phase) * 0.3,
        d.baseY + Math.sin(t * 1.7 + d.phase) * 0.15,
        d.z + Math.cos(t * d.speed + d.phase) * 0.3
      );
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, count]}>
      <sphereGeometry args={[0.025, 6, 6]} />
      <meshStandardMaterial color="#eafccb" emissive="#d8f27a" emissiveIntensity={1.2} />
    </instancedMesh>
  );
}

export default function Ambient() {
  return (
    <group>
      <Birds />
      <Butterflies />
      <PondFireflies />
    </group>
  );
}
