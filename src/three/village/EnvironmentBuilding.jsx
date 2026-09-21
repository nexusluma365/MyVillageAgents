import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Generic loader for a single-mesh environment GLB (house/farm/tree-style
// assets export at an arbitrary native scale) — normalizes to a target
// height, sits the base on y=0, and reuses one cached GLTF scene per url.
export default function EnvironmentBuilding({ url, targetHeight, position, rotationY = 0 }) {
  const gltf = useGLTF(url);
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const { scale, xOffset, yOffset, zOffset } = useMemo(() => {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = size.y || 1;
    const s = targetHeight / height;
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { scale: s, xOffset: -center.x * s, yOffset: -box.min.y * s, zOffset: -center.z * s };
  }, [model, targetHeight]);

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [model]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group scale={scale} position={[xOffset, yOffset, zOffset]}>
        <primitive object={model} />
      </group>
    </group>
  );
}
