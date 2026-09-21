import { Component, Suspense, useEffect, useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { agentMotion, getMotion } from "../../store/motion.js";
import { useVillageStore } from "../../store/useVillageStore.js";
import { STATUS_COLORS } from "../../domain/agentsConfig.js";
import { WORLD_SCALE } from "../../domain/worldScale.js";
import { AGENT_MODELS } from "../../domain/agentModels.js";
import { WORK_INTERACTIONS } from "../../domain/interactions.js";
import { RoleHat, RoleTool, RoleClothing, Face, Hair, Hand, Boot } from "./characterParts.jsx";
import { applyWorkAnimation } from "./workAnimations.js";
import { STATUS_POSE } from "./animationController.js";

const SKIN = "#f2c49b";
const PERSONAL_SPACE_RADIUS = 0.62;
const TARGET_CHARACTER_HEIGHT = 1.82;
const MODEL_FALLBACK_HEIGHT = 1;

const MODEL_CORRECTIONS = {
  data: { rotationY: 0 },
  content: { rotationY: 0 },
  research: { rotationY: 0 },
  automation: { rotationY: 0 },
  manager: { rotationY: 0 },
};

// Bubble emoji -> a distinct idle silhouette so "taking a break" reads as
// an actual action (sitting, checking a phone, waving) instead of the
// same idle sway for every socializing agent.
const BUBBLE_POSE = { "💺": "sit", "📱": "phone", "👋": "wave", "👀": "look", "🙆": "stretch", "🔧": "inspect" };
const BUSY_STATUSES = new Set(["assigned", "walking_to_work", "working", "waiting", "handoff"]);

function stableAvoidanceDirection(agentId) {
  const ids = [...agentMotion.keys()].sort();
  const idx = Math.max(0, ids.indexOf(agentId));
  const angle = idx * 2.399963229728653; // golden-angle spacing
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

function crowdOffset(agentId, motion) {
  let ox = 0;
  let oz = 0;
  const fallback = stableAvoidanceDirection(agentId);
  agentMotion.forEach((other, otherId) => {
    if (otherId === agentId) return;
    const dx = motion.pos.x - other.pos.x;
    const dz = motion.pos.z - other.pos.z;
    const dist = Math.hypot(dx, dz);
    const minDist = PERSONAL_SPACE_RADIUS * 2;
    if (dist < minDist) {
      const dirX = dist > 0.001 ? dx / dist : fallback.x;
      const dirZ = dist > 0.001 ? dz / dist : fallback.z;
      const push = (minDist - Math.max(dist, 0.001)) * 0.32;
      ox += dirX * push;
      oz += dirZ * push;
    }
  });
  return {
    x: THREE.MathUtils.clamp(ox, -0.46, 0.46),
    z: THREE.MathUtils.clamp(oz, -0.46, 0.46),
  };
}

function ShortAgentLabel({ cfg, status, statusColor, isExpanded }) {
  if (!isExpanded) {
    return (
      <div className="agent-mini-indicator">
        <span>{cfg.emoji}</span>
        <i style={{ background: statusColor }} />
      </div>
    );
  }

  return (
    <div className="agent-compact-label">
      <span className="agent-label-icon">{cfg.emoji}</span>
      <span>{cfg.name.replace(" Agent", "")}</span>
      <i style={{ background: statusColor }} />
    </div>
  );
}

function WorkingLoader({ cfg, status }) {
  return (
    <div className="agent-working-loader" aria-label={`${cfg.name} is ${status === "waiting" ? "waiting" : "working"}`}>
      <span className="agent-working-ring" style={{ borderTopColor: cfg.c1, borderRightColor: cfg.c1 }} />
      <span className="agent-working-dot" style={{ background: cfg.c1 }} />
    </div>
  );
}

function pickAnimationName(names, status) {
  const lower = names.map((name) => [name, name.toLowerCase()]);
  const isWalking = status === "walking" || status === "wandering" || status === "walking_to_work" || status === "returning";
  const candidates = isWalking
    ? ["walk", "walking", "run"]
    : status === "working"
      ? ["work", "working", "action", "attack"]
      : status === "success" || status === "completed"
        ? ["celebrate", "happy", "cheer", "success", "victory"]
        : ["idle", "stand", "breath"];
  return candidates
    .map((needle) => lower.find(([, value]) => value.includes(needle))?.[0])
    .find(Boolean) || names[0];
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error("[CharacterModel] Failed to load GLB for " + this.props.agentId, error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function AgentGLBVisual({ cfg, status, bubble, isHovered, isSelected, statusColor, hideLabel }) {
  const modelUrl = AGENT_MODELS[cfg.id];
  const gltf = useGLTF(modelUrl);
  const modelRoot = useRef();
  const model = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const clips = gltf.animations || [];
  const { actions, names } = useAnimations(clips, modelRoot);
  const correction = MODEL_CORRECTIONS[cfg.id] || { rotationY: 0 };

  const bounds = useMemo(() => {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const height = size.y || MODEL_FALLBACK_HEIGHT;
    const scale = TARGET_CHARACTER_HEIGHT / height;
    return { scale, yOffset: -box.min.y * scale };
  }, [model]);

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [model]);

  useEffect(() => {
    if (!names.length) return;
    const clipName = pickAnimationName(names, status);
    const action = actions[clipName];
    if (!action) return;
    Object.values(actions).forEach((other) => {
      if (other && other !== action) other.fadeOut(0.18);
    });
    action.reset().fadeIn(0.18).play();
    return () => action.fadeOut(0.18);
  }, [actions, names, status]);

  return (
    <>
      <group ref={modelRoot} rotation={[0, correction.rotationY, 0]} scale={bounds.scale} position={[0, bounds.yOffset, 0]}>
        <primitive object={model} dispose={null} />
      </group>
      {!hideLabel && (
        <Html position={[0, TARGET_CHARACTER_HEIGHT + 0.26, 0]} center zIndexRange={[10, 0]} occlude={false}>
          <div className="agent-world-labels">
            {bubble && <div className="agent-bubble">{bubble}</div>}
            <ShortAgentLabel
              cfg={cfg}
              status={status}
              statusColor={statusColor}
              isExpanded={isHovered || isSelected}
            />
          </div>
        </Html>
      )}
    </>
  );
}

function ProceduralCharacterBody({ cfg, role, status, bubble, isHovered, isSelected, statusColor, refs, hideLabel }) {
  const { legL, legR, armL, armR, upperBody, head } = refs;
  return (
    <>
      {/* legs */}
      <group ref={legL} position={[-0.1, 0.55, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
          <meshStandardMaterial color={cfg.c2} roughness={0.8} />
        </mesh>
        <Boot />
      </group>
      <group ref={legR} position={[0.1, 0.55, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
          <meshStandardMaterial color={cfg.c2} roughness={0.8} />
        </mesh>
        <Boot />
      </group>

      <group ref={upperBody}>
        <mesh position={[0.22, 1.55, 0.15]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.5} />
        </mesh>

        <mesh position={[0, 0.95, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.42, 4, 10]} />
          <meshStandardMaterial color={cfg.c1} roughness={0.7} />
        </mesh>
        <RoleClothing role={role} color={cfg.c1} />
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.1, 10]} />
          <meshStandardMaterial color={cfg.c2} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.78, 0.23]}>
          <boxGeometry args={[0.08, 0.06, 0.02]} />
          <meshStandardMaterial color="#d8b64c" metalness={0.5} roughness={0.4} />
        </mesh>

        <group ref={armL} position={[-0.3, 1.12, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.32, 4, 8]} />
            <meshStandardMaterial color={cfg.c1} roughness={0.75} />
          </mesh>
          <Hand />
        </group>
        <group ref={armR} position={[0.3, 1.12, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.32, 4, 8]} />
            <meshStandardMaterial color={cfg.c1} roughness={0.75} />
          </mesh>
          <Hand />
          <RoleTool role={role} color={cfg.c2} />
        </group>

        <group ref={head} position={[0, 1.5, 0]}>
          <group scale={1.3}>
            <mesh castShadow>
              <sphereGeometry args={[0.26, 16, 16]} />
              <meshStandardMaterial color={SKIN} roughness={0.6} />
            </mesh>
            <Face role={role} status={status} />
            <Hair role={role} color={cfg.c2} />
            <RoleHat role={role} color={cfg.c1} />

            {!hideLabel && (
              <Html position={[0, 0.46, 0]} center zIndexRange={[10, 0]} occlude={false}>
                <div className="agent-world-labels">
                  {bubble && <div className="agent-bubble">{bubble}</div>}
                  <ShortAgentLabel
                    cfg={cfg}
                    status={status}
                    statusColor={statusColor}
                    isExpanded={isHovered || isSelected}
                  />
                </div>
              </Html>
            )}
          </group>
        </group>
      </group>
    </>
  );
}

Object.values(AGENT_MODELS).forEach((url) => useGLTF.preload(url));

export default function Character({ cfg }) {
  const group = useRef();
  const legL = useRef();
  const legR = useRef();
  const armL = useRef();
  const armR = useRef();
  const bodyWrap = useRef();
  const upperBody = useRef();
  const head = useRef();

  const status = useVillageStore((s) => s.agents[cfg.id].status);
  const bubble = useVillageStore((s) => s.agents[cfg.id].bubble);
  const selectedAgentId = useVillageStore((s) => s.selectedAgentId);
  const onAgentClicked = useVillageStore((s) => s.onAgentClicked);
  const isSelected = selectedAgentId === cfg.id;
  const [isHovered, setIsHovered] = useState(false);

  const clock = useRef(0);
  const workRefs = useMemo(() => ({ armL, armR, legL, legR, head, bodyWrap, upperBody }), []);
  const hiddenAtWorkScale = useRef(1);

  // Real task state only — an agent is hidden inside the Farm exactly when
  // the task lifecycle (AgentRuntime) has actually put them in "working" at
  // a work location flagged hideWhileWorking. No independent fake timer.
  const hideAtWork = status === "working" && !!WORK_INTERACTIONS[cfg.id]?.hideWhileWorking;
  const showWorkingLoader = BUSY_STATUSES.has(status);

  useFrame((_, delta) => {
    const motion = getMotion(cfg.id);
    if (!motion || !group.current) return;
    clock.current += delta;

    hiddenAtWorkScale.current = THREE.MathUtils.lerp(hiddenAtWorkScale.current, hideAtWork ? 0 : 1, 0.12);
    group.current.scale.setScalar(WORLD_SCALE.agent);
    if (bodyWrap.current) {
      bodyWrap.current.scale.setScalar(Math.max(hiddenAtWorkScale.current, 0.001));
    }

    // Position — read straight from the shared motion map every frame.
    // No React state involved, so this never triggers a re-render.
    const isBenchSit = motion.interaction?.type === "bench" && BUBBLE_POSE[bubble] === "sit";
    const avoid = isBenchSit ? { x: 0, z: 0 } : crowdOffset(cfg.id, motion);
    if (!motion.visualOffset) motion.visualOffset = { x: 0, z: 0 };
    motion.visualOffset.x = THREE.MathUtils.lerp(motion.visualOffset.x, avoid.x, 0.18);
    motion.visualOffset.z = THREE.MathUtils.lerp(motion.visualOffset.z, avoid.z, 0.18);
    group.current.position.set(motion.pos.x + motion.visualOffset.x, isBenchSit ? 0.02 : 0, motion.pos.z + motion.visualOffset.z);
    const targetYaw = motion.targetYaw ?? 0;
    const yawDelta = Math.atan2(Math.sin(targetYaw - motion.yaw), Math.cos(targetYaw - motion.yaw));
    motion.yaw += yawDelta * 0.16;
    group.current.rotation.y = motion.yaw;

    const pose = STATUS_POSE[status] || STATUS_POSE.idle;
    const isWalking = status === "walking" || status === "wandering" || status === "walking_to_work" || status === "returning";
    const bubblePose = status === "socializing" ? BUBBLE_POSE[bubble] : null;
    const settleUpperBody = (amount = 0.15) => {
      if (upperBody.current) upperBody.current.position.y = THREE.MathUtils.lerp(upperBody.current.position.y, 0, amount);
    };

    if (isWalking) {
      settleUpperBody(0.24);
      const swing = Math.sin(motion.walkPhase * Math.PI * 2) * 0.5;
      const bounce = Math.abs(Math.sin(motion.walkPhase * Math.PI * 2)) * 0.06;
      if (legL.current) legL.current.rotation.x = swing;
      if (legR.current) legR.current.rotation.x = -swing;
      if (armL.current) armL.current.rotation.x = -swing * 0.75;
      if (armR.current) armR.current.rotation.x = swing * 0.75;
      if (bodyWrap.current) bodyWrap.current.position.y = bounce;
    } else if (status === "working") {
      settleUpperBody();
      // Role-specific tool animation takes over the arms/head entirely
      // while working, so what an agent is doing is visible at a glance.
      applyWorkAnimation(cfg.id, clock.current, workRefs);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
      if (bodyWrap.current) bodyWrap.current.position.y = Math.sin(clock.current * 2.2) * 0.015;
    } else if (status === "handoff") {
      settleUpperBody();
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -1.15, 0.14);
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, -0.45 + Math.sin(clock.current * 3) * 0.08, 0.12);
      if (head.current) head.current.rotation.y = Math.sin(clock.current * 1.2) * 0.18;
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, Math.sin(clock.current * 4) * 0.012, 0.14);
    } else if (status === "success" || status === "completed") {
      settleUpperBody();
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, -1.9, 0.16);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -1.9, 0.16);
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, Math.abs(Math.sin(clock.current * 4)) * 0.05, 0.16);
    } else if (bubblePose === "sit") {
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 1.55, 0.18);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 1.55, 0.18);
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, -0.35, 0.12);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -0.35, 0.12);
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, 0, 0.16);
      if (upperBody.current) upperBody.current.position.y = THREE.MathUtils.lerp(upperBody.current.position.y, -0.26, 0.16);
      if (head.current) head.current.rotation.y = Math.sin(clock.current * 0.4) * 0.15;
    } else if (bubblePose === "phone") {
      settleUpperBody();
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -2.1, 0.15);
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, 0, 0.1);
      if (head.current) head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, 0.3, 0.1);
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, 0, 0.1);
    } else if (bubblePose === "wave") {
      settleUpperBody();
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
      if (armR.current) {
        armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -2.3, 0.2);
        armR.current.rotation.z = Math.sin(clock.current * 6) * 0.35;
      }
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, 0, 0.1);
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, 0, 0.1);
    } else if (bubblePose === "stretch") {
      settleUpperBody();
      // arms raised overhead with a slow rise/settle, torso lifts slightly
      const liftT = Math.sin(clock.current * 1.1) * 0.5 + 0.5;
      if (armL.current) {
        armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, -2.6, 0.1);
        armL.current.rotation.z = 0.3;
      }
      if (armR.current) {
        armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -2.6, 0.1);
        armR.current.rotation.z = -0.3;
      }
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, liftT * 0.05, 0.1);
    } else if (bubblePose === "inspect") {
      settleUpperBody();
      // leaning forward, head and hands directed down at something held
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, -0.8, 0.1);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, -0.9 + Math.sin(clock.current * 2) * 0.06, 0.1);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
      if (head.current) head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, 0.4, 0.1);
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, 0, 0.1);
    } else {
      settleUpperBody();
      const idleBob = Math.sin(clock.current * 2.2) * 0.02 * pose.bob;
      const idleSway = Math.sin(clock.current * 1.1) * 0.05 * pose.sway;
      if (bodyWrap.current) bodyWrap.current.position.y = THREE.MathUtils.lerp(bodyWrap.current.position.y, idleBob, 0.15);
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, idleSway * 0.3, 0.1);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, idleSway * -0.3, 0.1);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.15);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.15);
    }

    if (head.current && status !== "working" && bubblePose !== "phone" && bubblePose !== "sit" && bubblePose !== "inspect") {
      head.current.rotation.z = Math.sin(clock.current * 1.6) * 0.04 * pose.sway;
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, 0, 0.08);
      // Idle/waiting agents occasionally glance side to side — two
      // mismatched sine frequencies read as a natural "look around"
      // instead of a metronome tick.
      const canLook = status === "idle" || status === "waiting" || bubblePose === "look";
      const lookAmp = bubblePose === "look" ? 0.85 : 0.5;
      const lookTarget = canLook
        ? (Math.sin(clock.current * 0.35) * 0.5 + Math.sin(clock.current * 0.13 + 1.7) * 0.5) * lookAmp
        : 0;
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, lookTarget, 0.05);
    }

    // Selection ring bob
    if (isSelected && group.current.userData.ring) {
      group.current.userData.ring.rotation.z += delta * 0.8;
    }
  });

  const statusColor = STATUS_COLORS[status] || "#8bd17f";
  const role = cfg.id;

  return (
    <group ref={group} scale={WORLD_SCALE.agent}>
      {/* selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} ref={(r) => { if (group.current) group.current.userData.ring = r; }}>
          <ringGeometry args={[0.42, 0.5, 32]} />
          <meshBasicMaterial color={cfg.c1} transparent opacity={0.85} />
        </mesh>
      )}

      {/* contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.3, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      <group
        ref={bodyWrap}
        onClick={(e) => { e.stopPropagation(); onAgentClicked(cfg.id); }}
        onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setIsHovered(false); document.body.style.cursor = "auto"; }}
      >
        <ModelErrorBoundary
          agentId={cfg.id}
          fallback={
            <ProceduralCharacterBody
              cfg={cfg}
              role={role}
              status={status}
              bubble={bubble}
              isHovered={isHovered}
              isSelected={isSelected}
              statusColor={statusColor}
              refs={{ legL, legR, armL, armR, upperBody, head }}
              hideLabel={hideAtWork}
            />
          }
        >
          <Suspense
            fallback={
              <ProceduralCharacterBody
                cfg={cfg}
                role={role}
                status={status}
                bubble={bubble}
                isHovered={isHovered}
                isSelected={isSelected}
                statusColor={statusColor}
                refs={{ legL, legR, armL, armR, upperBody, head }}
                hideLabel={hideAtWork}
              />
            }
          >
            <AgentGLBVisual
              cfg={cfg}
              status={status}
              bubble={bubble}
              isHovered={isHovered}
              isSelected={isSelected}
              statusColor={statusColor}
              hideLabel={hideAtWork}
            />
          </Suspense>
        </ModelErrorBoundary>
      </group>
      {showWorkingLoader && (
        <Html position={[0, TARGET_CHARACTER_HEIGHT + 0.56, 0]} center zIndexRange={[20, 0]} occlude={false}>
          <WorkingLoader cfg={cfg} status={status} />
        </Html>
      )}
    </group>
  );
}
