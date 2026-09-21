import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A ring of stylized trees around the village edge — three distinct
// silhouettes (pine, round leafy, layered fir) plus scattered boulders —
// drawn via a handful of InstancedMeshes so a couple hundred props cost
// only a few draw calls total. Each tree sways gently via a per-instance
// phase baked in at generation time, not by touching transforms outside
// useFrame's per-tree loop (still O(n) but n is small and it's the only
// thing recomputed every frame — no React state involved).
export default function ForestBorder() {
  const count = 150;
  const trunkRef = useRef();
  const coneRef = useRef();
  const roundRef = useRef();
  const pineLowerRef = useRef();
  const pineUpperRef = useRef();
  const rockRef = useRef();

  const { all, cones, rounds, layered, rocks } = useMemo(() => {
    const all = [];
    const counters = { cone: 0, round: 0, layered: 0 };
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.06;
      const radius = 15.2 + Math.random() * 3.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.8 + Math.random() * 0.65;
      const roll = Math.random();
      const kind = roll < 0.45 ? "cone" : roll < 0.75 ? "layered" : "round";
      const typeIndex = counters[kind]++;
      all.push({ x, z, scale, kind, typeIndex, phase: Math.random() * Math.PI * 2, rot: Math.random() * Math.PI * 2 });
    }
    const rocks = [];
    for (let i = 0; i < 34; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 14.4 + Math.random() * 4.6;
      rocks.push({
        x: Math.cos(angle) * radius, z: Math.sin(angle) * radius,
        s: 0.25 + Math.random() * 0.45, rot: Math.random() * Math.PI,
      });
    }
    return {
      all,
      cones: all.filter((t) => t.kind === "cone"),
      rounds: all.filter((t) => t.kind === "round"),
      layered: all.filter((t) => t.kind === "layered"),
      rocks,
    };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.s * 0.35, r.z);
      dummy.rotation.set(r.rot * 0.3, r.rot, r.rot * 0.5);
      dummy.scale.set(r.s, r.s * 0.7, r.s);
      dummy.updateMatrix();
      rockRef.current.setMatrixAt(i, dummy.matrix);
      rockRef.current.setColorAt(i, new THREE.Color(i % 2 === 0 ? "#8f8878" : "#9c9182"));
    });
    rockRef.current.instanceMatrix.needsUpdate = true;
    if (rockRef.current.instanceColor) rockRef.current.instanceColor.needsUpdate = true;
  }, [rocks, dummy]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    all.forEach((d, i) => {
      const sway = Math.sin(t * 1.2 + d.phase) * 0.03;
      dummy.position.set(d.x, 0.4 * d.scale, d.z);
      dummy.rotation.set(0, d.rot, 0);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      trunkRef.current.setMatrixAt(i, dummy.matrix);

      dummy.position.set(d.x, 1.1 * d.scale, d.z);
      dummy.rotation.set(sway, d.rot, sway * 0.6);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();

      if (d.kind === "cone") coneRef.current.setMatrixAt(d.typeIndex, dummy.matrix);
      if (d.kind === "round") roundRef.current.setMatrixAt(d.typeIndex, dummy.matrix);
    });
    trunkRef.current.instanceMatrix.needsUpdate = true;
    if (cones.length) coneRef.current.instanceMatrix.needsUpdate = true;
    if (rounds.length) roundRef.current.instanceMatrix.needsUpdate = true;

    layered.forEach((d, i) => {
      const sway = Math.sin(t * 1.1 + d.phase) * 0.025;
      dummy.rotation.set(sway, d.rot, sway * 0.6);
      dummy.scale.setScalar(d.scale);

      dummy.position.set(d.x, 1.0 * d.scale, d.z);
      dummy.updateMatrix();
      pineLowerRef.current.setMatrixAt(i, dummy.matrix);

      dummy.position.set(d.x, 1.55 * d.scale, d.z);
      dummy.updateMatrix();
      pineUpperRef.current.setMatrixAt(i, dummy.matrix);
    });
    if (layered.length) {
      pineLowerRef.current.instanceMatrix.needsUpdate = true;
      pineUpperRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[null, null, count]} castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.14, 0.8, 6]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
      </instancedMesh>
      {cones.length > 0 && (
        <instancedMesh ref={coneRef} args={[null, null, cones.length]} castShadow>
          <coneGeometry args={[0.65, 1.7, 7]} />
          <meshStandardMaterial color="#3f8a4c" roughness={0.85} />
        </instancedMesh>
      )}
      {rounds.length > 0 && (
        <instancedMesh ref={roundRef} args={[null, null, rounds.length]} castShadow>
          <icosahedronGeometry args={[0.75, 1]} />
          <meshStandardMaterial color="#5fa64a" roughness={0.85} />
        </instancedMesh>
      )}
      {layered.length > 0 && (
        <>
          <instancedMesh ref={pineLowerRef} args={[null, null, layered.length]} castShadow>
            <coneGeometry args={[0.62, 1.1, 8]} />
            <meshStandardMaterial color="#356b3f" roughness={0.85} />
          </instancedMesh>
          <instancedMesh ref={pineUpperRef} args={[null, null, layered.length]} castShadow>
            <coneGeometry args={[0.4, 0.9, 8]} />
            <meshStandardMaterial color="#3f8a4c" roughness={0.85} />
          </instancedMesh>
        </>
      )}
      <instancedMesh ref={rockRef} args={[null, null, rocks.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
    </group>
  );
}
