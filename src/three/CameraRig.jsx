import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const DEFAULT_ZOOM = 34;

// Mutable camera state lives OUTSIDE React so drag/zoom never triggers a
// re-render — the camera reads it once per frame in useFrame, same pattern
// used for agent motion.
export const cameraState = {
  target: new THREE.Vector3(0, 0, 0),
  zoom: DEFAULT_ZOOM,
  minZoom: DEFAULT_ZOOM,
  maxZoom: 140,
  maxPanRadius: 15.5,
};

export function zoomIn() { cameraState.zoom = Math.min(cameraState.maxZoom, cameraState.zoom + 6); }
export function zoomOut() { cameraState.zoom = Math.max(cameraState.minZoom, cameraState.zoom - 6); }
export function resetView() { cameraState.target.set(0, 0, 0); cameraState.zoom = DEFAULT_ZOOM; }

const ISO_DIR = new THREE.Vector3(1, 1.35, 1).normalize();
const scratchPos = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchPan = new THREE.Vector3();
const MAX_GLIDE_SPEED = 0.018;

function clampToRadius(v, radius) {
  const len = Math.hypot(v.x, v.z);
  if (len > radius) {
    const s = radius / len;
    v.x *= s;
    v.z *= s;
  }
}

export default function CameraRig() {
  const { camera, gl, size } = useThree();
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const velocity = useRef({ x: 0, z: 0 });
  const lastMoveTime = useRef(0);

  useEffect(() => {
    cameraState.target.set(0, 0, 0);
    cameraState.zoom = DEFAULT_ZOOM;
    velocity.current = { x: 0, z: 0 };
  }, []);

  useEffect(() => {
    const dom = gl.domElement;

    const onDown = (e) => {
      if (e.target !== dom) return; // clicks on Html overlays shouldn't pan
      dragging.current = true;
      moved.current = false;
      velocity.current = { x: 0, z: 0 };
      last.current = { x: e.clientX, y: e.clientY };
      lastMoveTime.current = performance.now();
    };
    const onMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      last.current = { x: e.clientX, y: e.clientY };

      const now = performance.now();
      const dt = Math.max(1, now - lastMoveTime.current);
      lastMoveTime.current = now;

      // Screen-space drag -> world-space pan along the ground plane, scaled
      // by current zoom so panning speed stays consistent at any zoom level.
      const scale = 1 / Math.max(camera.zoom, 1);
      const right = scratchRight.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      const up = scratchUp.setFromMatrixColumn(camera.matrixWorld, 1).setY(0).normalize();
      const moveX = -dx * scale;
      const moveY = dy * scale;
      scratchPan.set(0, 0, 0).addScaledVector(right, moveX).addScaledVector(up, moveY);
      cameraState.target.add(scratchPan);
      clampToRadius(cameraState.target, cameraState.maxPanRadius);

      // Track velocity (world units/ms) for inertial glide after release.
      velocity.current.x = scratchPan.x / dt;
      velocity.current.z = scratchPan.z / dt;
      const speed = Math.hypot(velocity.current.x, velocity.current.z);
      if (speed > MAX_GLIDE_SPEED) {
        const s = MAX_GLIDE_SPEED / speed;
        velocity.current.x *= s;
        velocity.current.z *= s;
      }
    };
    const onUp = () => { dragging.current = false; };
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -4 : 4;
      cameraState.zoom = Math.min(cameraState.maxZoom, Math.max(cameraState.minZoom, cameraState.zoom + delta));
    };

    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dom.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl, size]);

  useFrame((_, delta) => {
    // Inertial glide: once the pointer is up, bleed off residual drag
    // velocity smoothly instead of stopping dead — reads as a polished,
    // weighted strategy-game camera rather than a snapped-to-cursor one.
    if (!dragging.current) {
      const speed = Math.hypot(velocity.current.x, velocity.current.z);
      if (speed > 0.0001) {
        cameraState.target.x += velocity.current.x * delta * 1000;
        cameraState.target.z += velocity.current.z * delta * 1000;
        clampToRadius(cameraState.target, cameraState.maxPanRadius);
        const damp = Math.pow(0.0015, delta);
        velocity.current.x *= damp;
        velocity.current.z *= damp;
      }
    }

    const dist = 24;
    scratchPos.copy(cameraState.target).addScaledVector(ISO_DIR, dist);
    camera.position.lerp(scratchPos, 1 - Math.pow(0.00003, delta));
    camera.lookAt(cameraState.target);
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, cameraState.zoom, 1 - Math.pow(0.0002, delta));
    camera.updateProjectionMatrix();
  });

  return null;
}

export function wasDragClick() {
  return false;
}
