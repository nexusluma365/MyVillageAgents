import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { POND_CENTER, POND_RADIUS } from "./pondGeometry.js";

const waterVert = `
  varying vec2 vUv;
  varying float vWave;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 p = position;
    float wave = sin((p.x + uTime * 0.6) * 3.0) * 0.02 + cos((p.y + uTime * 0.5) * 3.0) * 0.02;
    p.z += wave;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const waterFrag = `
  varying vec2 vUv;
  varying float vWave;
  uniform float uTime;
  void main() {
    float ripple = sin((vUv.x + vUv.y) * 20.0 + uTime * 1.5) * 0.5 + 0.5;
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    vec3 deep = vec3(0.08, 0.38, 0.58);
    vec3 mid = vec3(0.24, 0.63, 0.74);
    vec3 shallow = vec3(0.76, 0.94, 0.92);
    vec3 col = mix(deep, mid, smoothstep(0.0, 0.82, 1.0 - d));
    col = mix(col, shallow, smoothstep(0.74, 1.0, d));
    col += ripple * 0.055;
    col += vWave * 1.5;
    float caustic = sin(vUv.x * 44.0 + uTime * 1.2) * sin(vUv.y * 38.0 - uTime * 0.9);
    col += max(caustic, 0.0) * 0.035 * (1.0 - smoothstep(0.2, 1.0, d));
    float edgeGlow = smoothstep(0.78, 1.0, d) * 0.32;
    col += edgeGlow;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function LilyPad({ position, rot }) {
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.22, 10, 0.4, Math.PI * 1.8]} />
        <meshStandardMaterial color="#3f8a4c" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function FloatingLeaf({ data }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * data.speed + data.phase;
    ref.current.position.set(
      POND_CENTER.x + Math.cos(t) * data.r,
      0.045,
      POND_CENTER.z + Math.sin(t) * data.r
    );
    ref.current.rotation.y = t;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.06, 6]} />
      <meshStandardMaterial color="#c9a24a" roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Reed({ position }) {
  const group = useRef();
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.z = Math.sin(clock.getElapsedTime() * 1.4 + phase) * 0.06;
  });
  return (
    <group position={position} ref={group}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.05 - 0.05, 0.35, 0]} rotation={[0, 0, (i - 1) * 0.15]} castShadow>
          <cylinderGeometry args={[0.012, 0.018, 0.7, 5]} />
          <meshStandardMaterial color="#5a8a3f" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

export default function Pond() {
  const mat = useRef();
  const rippleA = useRef();
  const rippleB = useRef();
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const rocks = useMemo(() => Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2 + Math.random() * 0.12;
    return { x: Math.cos(a) * (POND_RADIUS + 0.15), z: Math.sin(a) * (POND_RADIUS + 0.15), s: 0.1 + Math.random() * 0.09, rot: Math.random() * Math.PI };
  }), []);
  const reeds = useMemo(() => Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2 + 0.3;
    return { x: Math.cos(a) * (POND_RADIUS + 0.3), z: Math.sin(a) * (POND_RADIUS + 0.3) };
  }), []);
  const leaves = useMemo(() => Array.from({ length: 4 }, () => ({
    r: 0.5 + Math.random() * (POND_RADIUS - 0.8),
    speed: 0.06 + Math.random() * 0.05,
    phase: Math.random() * Math.PI * 2,
  })), []);

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    const t = uniforms.uTime.value;
    if (rippleA.current) {
      const s = 1 + Math.sin(t * 1.2) * 0.05;
      rippleA.current.scale.setScalar(s);
      rippleA.current.material.opacity = 0.16 + Math.sin(t * 1.2) * 0.06;
    }
    if (rippleB.current) {
      const s = 1 + Math.sin(t * 0.9 + 1.7) * 0.04;
      rippleB.current.scale.setScalar(s);
      rippleB.current.material.opacity = 0.12 + Math.sin(t * 0.9 + 1.7) * 0.05;
    }
  });

  return (
    <group position={[POND_CENTER.x, 0, POND_CENTER.z]}>
      {/* muddy bank ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <ringGeometry args={[POND_RADIUS, POND_RADIUS + 0.5, 96]} />
        <meshStandardMaterial color="#a9713f" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} receiveShadow>
        <ringGeometry args={[POND_RADIUS + 0.48, POND_RADIUS + 0.62, 96]} />
        <meshStandardMaterial color="#6f8d3e" roughness={0.96} />
      </mesh>
      {/* pale foam ring right at the shoreline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[POND_RADIUS - 0.08, POND_RADIUS + 0.04, 96]} />
        <meshStandardMaterial color="#f3fff8" transparent opacity={0.52} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, 0]} receiveShadow>
        <circleGeometry args={[POND_RADIUS - 0.12, 96]} />
        <meshStandardMaterial color="#4dc5d8" roughness={0.36} metalness={0.03} emissive="#1b7890" emissiveIntensity={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]}>
        <circleGeometry args={[POND_RADIUS, 96]} />
        <meshPhysicalMaterial
          ref={mat}
          color="#8de7ed"
          roughness={0.18}
          metalness={0.02}
          transmission={0}
          thickness={0.08}
          clearcoat={0.75}
          clearcoatRoughness={0.25}
        />
      </mesh>
      <mesh ref={rippleA} rotation={[-Math.PI / 2, 0, 0.2]} position={[0, 0.032, 0]}>
        <ringGeometry args={[0.65, 0.68, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh ref={rippleB} rotation={[-Math.PI / 2, 0, -0.7]} position={[0.25, 0.033, -0.2]}>
        <ringGeometry args={[1.25, 1.28, 96, 1, 0, Math.PI * 1.75]} />
        <meshBasicMaterial color="#dffcff" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -0.35]} position={[-0.35, 0.031, -0.35]}>
        <ringGeometry args={[0.75, 0.78, 72, 1, 0.2, Math.PI * 1.45]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.38} />
      </mesh>
      <LilyPad position={[-1.0, 0, 0.5]} rot={0.4} />
      <LilyPad position={[0.8, 0, -0.7]} rot={1.6} />
      <LilyPad position={[0.2, 0, 1.1]} rot={2.4} />
      {leaves.map((l, i) => <FloatingLeaf key={i} data={l} />)}
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, r.s * 0.4, r.z]} rotation={[r.rot * 0.3, r.rot, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[r.s, 0]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#8f8878" : "#9c9182"} roughness={0.95} />
        </mesh>
      ))}
      {reeds.map((r, i) => <Reed key={i} position={[r.x, 0, r.z]} />)}
    </group>
  );
}
