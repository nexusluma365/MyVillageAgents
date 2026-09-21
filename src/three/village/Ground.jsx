import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { NODES, PATH_PAIRS, nodePos } from "../../domain/nodes.js";
import { fbm2D, distToSegment } from "../utils/noise.js";
import { POND_CENTER, POND_BANK_RADIUS } from "./pondGeometry.js";

// ============================================================
// Terrain — a single displaced, vertex-colored mesh instead of a flat
// circle. Height and color are both driven by the SAME path/plaza masks
// derived from the live navigation graph (NODES/PATH_PAIRS), so:
//   - the ground is always perfectly flat exactly where agents walk and
//     buildings sit (no floating props, no clipping),
//   - everywhere else gets gentle procedural hills + two-tone grass,
//   - paths read as worn dirt/stone with a soft blended edge into grass.
// Built once in useMemo; this is not a per-frame cost.
// ============================================================

const PLAZA_RADIUS = 2.3;
const PATH_HALF = 0.52;
const NODE_FLATTEN = 1.75;
const HALF_SIZE = 30;
const SEGMENTS = 108;

// A few deliberate hill mounds, placed well clear of every path/building
// pad, so "small hills" read as an intentional feature, not just noise.
const HILLS = [
  { x: -12.5, z: -11.5, r: 4.2, h: 1.15 },
  { x: 12.8, z: -10.8, r: 3.6, h: 0.95 },
  { x: -13.2, z: 10.5, r: 3.8, h: 1.05 },
  { x: 9.5, z: 12.5, r: 4.5, h: 1.3 },
  { x: 0, z: -13.5, r: 3.2, h: 0.85 },
];

const GRASS_DARK = new THREE.Color("#4c7a3c");
const GRASS_LIGHT = new THREE.Color("#8fc169");
const GRASS_HILL = new THREE.Color("#a9d17e");
const DIRT_A = new THREE.Color("#8a6339");
const DIRT_B = new THREE.Color("#9c7648");
const STONE_A = new THREE.Color("#b6a68c");
const STONE_B = new THREE.Color("#a89478");

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function useTerrainGeometry() {
  return useMemo(() => {
    const geo = new THREE.PlaneGeometry(HALF_SIZE * 2, HALF_SIZE * 2, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const nodePoints = Object.values(NODES).map((n) => ({ x: n.x, z: n.y }));
    const segments = PATH_PAIRS.map(([a, b]) => {
      const pa = nodePos(a), pb = nodePos(b);
      return { ax: pa.x, az: pa.y, bx: pb.x, bz: pb.y };
    });

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      let dPath = Infinity;
      for (const s of segments) {
        const d = distToSegment(x, z, s.ax, s.az, s.bx, s.bz);
        if (d < dPath) dPath = d;
      }
      let dNode = Infinity;
      for (const n of nodePoints) {
        const d = Math.hypot(x - n.x, z - n.z);
        if (d < dNode) dNode = d;
      }
      const dPlaza = Math.hypot(x, z);
      const dPond = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);

      const flatFromPath = 1 - smoothstep(PATH_HALF, PATH_HALF + 1.3, dPath);
      const flatFromNode = 1 - smoothstep(NODE_FLATTEN, NODE_FLATTEN + 1.3, dNode);
      const flatFromPlaza = 1 - smoothstep(PLAZA_RADIUS, PLAZA_RADIUS + 1.3, dPlaza);
      const flatFromPond = 1 - smoothstep(POND_BANK_RADIUS, POND_BANK_RADIUS + 1.3, dPond);
      const flatMask = Math.max(flatFromPath, flatFromNode, flatFromPlaza, flatFromPond);

      let h = (fbm2D(x * 0.085, z * 0.085, 4) - 0.5) * 1.6;
      for (const hill of HILLS) {
        const dd = (x - hill.x) ** 2 + (z - hill.z) ** 2;
        h += hill.h * Math.exp(-dd / (2 * hill.r * hill.r));
      }
      h *= (1 - flatMask);

      const distFromCenter = Math.hypot(x, z);
      const edgeFalloff = 1 - smoothstep(23, 29, distFromCenter);
      h = h * edgeFalloff - (1 - edgeFalloff) * 1.4;

      pos.setY(i, h);

      // --- color ---
      const colorNoise = fbm2D(x * 0.15 + 50, z * 0.15 + 50, 3);
      let grass = tmpColor.copy(GRASS_DARK).lerp(GRASS_LIGHT, colorNoise);
      if (h > 0.25) grass = grass.lerp(GRASS_HILL, smoothstep(0.25, 1.1, h));

      const dirtNoise = fbm2D(x * 0.4 + 200, z * 0.4 + 200, 2);
      const dirt = new THREE.Color().copy(DIRT_A).lerp(DIRT_B, dirtNoise);

      const tileSeam = Math.max(
        Math.abs(((x * 2) % 1 + 1) % 1 - 0.5),
        Math.abs(((z * 2) % 1 + 1) % 1 - 0.5)
      );
      const stoneNoise = fbm2D(x * 0.5 + 400, z * 0.5 + 400, 2);
      const stone = new THREE.Color().copy(STONE_A).lerp(STONE_B, stoneNoise);
      stone.multiplyScalar(tileSeam > 0.46 ? 0.85 : 1);

      const tPath = 1 - smoothstep(PATH_HALF - 0.1, PATH_HALF + 0.55, dPath);
      const tPlaza = 1 - smoothstep(PLAZA_RADIUS - 0.3, PLAZA_RADIUS + 0.5, dPlaza);

      const final = grass.clone().lerp(dirt, tPath).lerp(stone, tPlaza);
      colors[i * 3] = final.r;
      colors[i * 3 + 1] = final.g;
      colors[i * 3 + 2] = final.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
}

// Small border stones tracing every path edge + the plaza rim, so paths
// read as deliberately built rather than just tinted grass.
function PathBorders() {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const items = useMemo(() => {
    const arr = [];
    const segments = PATH_PAIRS.map(([a, b]) => [nodePos(a), nodePos(b)]);
    for (const [pa, pb] of segments) {
      const dx = pb.x - pa.x, dz = pb.y - pa.y;
      const len = Math.hypot(dx, dz);
      const nx = -dz / len, nz = dx / len;
      const steps = Math.max(3, Math.floor(len / 0.42));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = pa.x + dx * t, z = pa.y + dz * t;
        // skip stones that would sit inside the plaza
        if (Math.hypot(x, z) < PLAZA_RADIUS + 0.2) continue;
        for (const side of [-1, 1]) {
          const jitter = (Math.random() - 0.5) * 0.12;
          arr.push({
            x: x + nx * (PATH_HALF + 0.14 + jitter) * side,
            z: z + nz * (PATH_HALF + 0.14 + jitter) * side,
            scale: 0.05 + Math.random() * 0.045,
            rot: Math.random() * Math.PI,
          });
        }
      }
    }
    const rimCount = 44;
    for (let i = 0; i < rimCount; i++) {
      const a = (i / rimCount) * Math.PI * 2;
      arr.push({
        x: Math.cos(a) * (PLAZA_RADIUS + 0.18),
        z: Math.sin(a) * (PLAZA_RADIUS + 0.18),
        scale: 0.07 + Math.random() * 0.04,
        rot: Math.random() * Math.PI,
      });
    }
    return arr;
  }, []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    items.forEach((it, i) => {
      dummy.position.set(it.x, 0.06, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.setScalar(it.scale);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(i, new THREE.Color(i % 3 === 0 ? "#9c9182" : "#847a6c"));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items, dummy]);

  return (
    <instancedMesh ref={ref} args={[null, null, items.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.95} />
    </instancedMesh>
  );
}

// A small tileable noise swatch multiplied over the vertex-colored terrain.
// meshStandardMaterial multiplies `map` and vertex colors together, so this
// adds fine mottled texture on top of the smooth color gradient without
// fighting it or needing a second material pass.
function useGrassTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const n = 0.82 + Math.random() * 0.18;
      const v = Math.floor(n * 255);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(HALF_SIZE * 3, HALF_SIZE * 3);
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  }, []);
}

export default function Ground() {
  const geometry = useTerrainGeometry();
  const grassTexture = useGrassTexture();

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow position={[0, 0, 0]}>
        <meshStandardMaterial vertexColors map={grassTexture} roughness={0.98} metalness={0} />
      </mesh>
      <PathBorders />
    </group>
  );
}
