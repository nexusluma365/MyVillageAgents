import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PATH_PAIRS, nodePos } from "../../domain/nodes.js";
import { distToSegment } from "../utils/noise.js";
import { TREE_MODEL_URL } from "../../domain/environmentModels.js";

useGLTF.preload(TREE_MODEL_URL);

// The real oak GLB is a detailed hero asset (tens of thousands of
// triangles even after offline decimation — see environmentModels.js) so
// it's used sparingly, as landscaping around the Farm and ARIA's House,
// each instance a cheap clone sharing one geometry/material. The village's
// existing outer-woodland ring (ForestBorder.jsx) already provides the
// bulk "surrounded by woods" density via lightweight procedural geometry,
// which is the right tool for dozens of far-away, low-detail trees —
// mixing in the heavy hero asset there would multiply its cost for props
// that are barely legible at that distance anyway.
const TARGET_HEIGHT = 2.8;
const PATH_CLEARANCE = 1.7;

function makeBuildingRingChecker(center, footprintRadius, openAngle, openHalfSpreadRad, segments) {
  return function isClear(x, z) {
    const dx = x - center.x, dz = z - center.z;
    const dist = Math.hypot(dx, dz);
    if (dist < footprintRadius) return false;
    const angle = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(angle - openAngle), Math.cos(angle - openAngle));
    if (Math.abs(diff) < openHalfSpreadRad) return false;
    for (const s of segments) {
      if (distToSegment(x, z, s.ax, s.az, s.bx, s.bz) < PATH_CLEARANCE) return false;
    }
    return true;
  };
}

function ring(center, r0, r1, count, clearFn, out) {
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 30) {
    tries++;
    const angle = Math.random() * Math.PI * 2;
    const radius = r0 + Math.random() * (r1 - r0);
    const x = center.x + Math.cos(angle) * radius;
    const z = center.z + Math.sin(angle) * radius;
    if (!clearFn(x, z)) continue;
    out.push({ x, z, scale: 0.85 + Math.random() * 0.3, rot: Math.random() * Math.PI * 2 });
    placed++;
  }
}

function usePlacements() {
  return useMemo(() => {
    const hub = { x: 0, z: 0 };
    const segments = PATH_PAIRS.map(([a, b]) => {
      const pa = nodePos(a), pb = nodePos(b);
      return { ax: pa.x, az: pa.y, bx: pb.x, bz: pb.y };
    });
    const placements = [];

    // Zone B — Farm tree line: cluster south/east/west of the Farm,
    // leaving the hub-facing approach and doorway open.
    const farmCenter = nodePos("farmWork");
    const farmC = { x: farmCenter.x, z: farmCenter.y };
    const hubDirFromFarm = Math.atan2(hub.x - farmC.x, hub.z - farmC.z);
    ring(
      farmC, 2.0, 4.2, 13,
      makeBuildingRingChecker(farmC, 1.9, hubDirFromFarm, THREE.MathUtils.degToRad(55), segments),
      placements
    );

    // Zone C — ARIA House landscaping: fewer, tighter trees flanking the
    // house, leaving the hub-facing entrance open.
    const houseCenter = nodePos("ariaHouseYard");
    const houseC = { x: houseCenter.x, z: houseCenter.y };
    const hubDirFromHouse = Math.atan2(hub.x - houseC.x, hub.z - houseC.z);
    ring(
      houseC, 1.7, 3.4, 6,
      makeBuildingRingChecker(houseC, 1.6, hubDirFromHouse, THREE.MathUtils.degToRad(55), segments),
      placements
    );

    return placements;
  }, []);
}

function Tree({ x, z, scale, rot, yOffset, model }) {
  const clone = useMemo(() => model.clone(true), [model]);
  useEffect(() => {
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [clone]);
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <group scale={scale} position={[0, yOffset, 0]}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

export default function VillageTrees() {
  const gltf = useGLTF(TREE_MODEL_URL);
  const placements = usePlacements();

  const { model, baseScale, yOffset } = useMemo(() => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = size.y || 1;
    const s = TARGET_HEIGHT / height;
    return { model: scene, baseScale: s, yOffset: -box.min.y * s };
  }, [gltf]);

  return (
    <group>
      {placements.map((p, i) => (
        <Tree
          key={i}
          x={p.x}
          z={p.z}
          rot={p.rot}
          scale={baseScale * p.scale}
          model={model}
        />
      ))}
      {/* Baked ground offset can't vary per-instance scale via the wrapper
          above (scale is applied to the whole group including position),
          so instead each Tree's own primitive sits pre-offset here. */}
    </group>
  );
}
