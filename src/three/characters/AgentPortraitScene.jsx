import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AGENT_MODELS } from "../../domain/agentModels.js";

// Every model is normalized to this height first, so framing math below
// works in the same units regardless of a given GLB's native export scale.
const TARGET_HEIGHT = 1.82;
const FOV = 30;
// Camera look-at target, as a fraction of the normalized height — biased
// toward the head/shoulders rather than the geometric center.
const LOOK_HEIGHT_FRACTION = 0.8;
// How much of the normalized height fills the vertical frame. Kept wide
// (upper ~60%) instead of a tight head-only crop, since these characters'
// head-to-body proportions vary a lot (humanoid vs. chibi/creature designs)
// and a tight crop landed inside the head on some models.
const FRAME_HEIGHT_FRACTION = 0.62;

function PortraitModel({ agentId }) {
  const gltf = useGLTF(AGENT_MODELS[agentId]);
  const model = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const group = useRef();
  const spin = useRef(0);
  const { camera } = useThree();

  const { scale, offset } = useMemo(() => {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const height = size.y || 1;
    const s = TARGET_HEIGHT / height;
    return { scale: s, offset: { x: -center.x * s, y: -box.min.y * s, z: -center.z * s } };
  }, [model]);

  useEffect(() => {
    const lookY = TARGET_HEIGHT * LOOK_HEIGHT_FRACTION;
    const visibleHeight = TARGET_HEIGHT * FRAME_HEIGHT_FRACTION;
    const distance = visibleHeight / 2 / Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    camera.position.set(0, lookY, distance);
    camera.near = 0.05;
    camera.far = distance + TARGET_HEIGHT * 2;
    camera.updateProjectionMatrix();
    camera.lookAt(0, lookY, 0);
  }, [camera, scale]);

  useFrame((_, delta) => {
    spin.current += delta;
    if (group.current) group.current.rotation.y = Math.sin(spin.current * 0.6) * 0.22;
  });

  return (
    <group ref={group}>
      <group scale={scale} position={[offset.x, offset.y, offset.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

export default function AgentPortraitScene({ agentId }) {
  return (
    <Canvas
      className="agent-portrait-canvas"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: FOV, near: 0.05, far: 10 }}
    >
      <ambientLight intensity={0.9} color="#fff3da" />
      <directionalLight position={[1.1, 2.2, 1.6]} intensity={1.5} color="#ffe9c2" />
      <directionalLight position={[-1.4, 1.1, -0.8]} intensity={0.45} color="#a8c9e8" />
      <Suspense fallback={null}>
        <PortraitModel agentId={agentId} />
      </Suspense>
    </Canvas>
  );
}

Object.keys(AGENT_MODELS).forEach((id) => useGLTF.preload(AGENT_MODELS[id]));
