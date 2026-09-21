import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { nodePos } from "../../domain/nodes.js";
import { useVillageStore } from "../../store/useVillageStore.js";
import { WORLD_SCALE } from "../../domain/worldScale.js";
import { Foundation, CornerBeams, WindowFrame, DoorWithSteps, Chimney, SignPost, LayeredRoof } from "./buildingParts.jsx";
import AriaHouse from "./AriaHouse.jsx";
import Farm from "./Farm.jsx";

function useGlow(agentId) {
  const ref = useRef();
  const on = useVillageStore((s) => s.buildingGlow[agentId]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = on ? 0.55 + Math.sin(clock.getElapsedTime() * 4) * 0.25 : 0.05;
    ref.current.emissiveIntensity = pulse;
  });
  return ref;
}

// Creative Studio — market-stall building: warm terracotta walls, striped
// awning, layered thatch-look roof, flower boxes, a sign out front.
function StudioBuilding() {
  const glow = useGlow("content");
  const p = nodePos("studioWork");
  const w = 1.9, d = 1.5, h = 1.1;
  return (
    <group position={[p.x, 0, p.y - 0.9]} scale={WORLD_SCALE.building}>
      <Foundation w={w} d={d} />
      <CornerBeams w={w} d={d} h={h} />
      <mesh position={[0, h / 2 + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#c9752a" roughness={0.82} />
      </mesh>
      {/* horizontal trim band */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[w + 0.04, 0.08, d + 0.04]} />
        <meshStandardMaterial color="#8a4a1e" roughness={0.8} />
      </mesh>
      <LayeredRoof radius={1.55} skirtH={0.35} capH={0.55} colorSkirt="#f2994a" colorCap="#d97c33" y={h + 0.18} />
      {/* striped awning over the door */}
      <mesh position={[0, h + 0.02, d / 2 + 0.35]} rotation={[0.45, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1.7, 6, 1, true]} />
        <meshStandardMaterial color="#fff" side={2} />
      </mesh>
      <mesh position={[0, 0.98, d / 2 + 0.3]} rotation={[0.35, 0, 0]}>
        <planeGeometry args={[1.5, 0.7]} />
        <meshStandardMaterial color="#f4ead0" side={2} />
      </mesh>
      <WindowFrame position={[-0.55, 0.75, d / 2 + 0.03]} glowRef={glow} />
      <WindowFrame position={[0.55, 0.75, d / 2 + 0.03]} litColor="#ffe9a8" />
      <DoorWithSteps position={[0, 0.18, d / 2 + 0.02]} w={0.5} h={WORLD_SCALE.doorHeight} color="#8a4a1e" />
      <SignPost position={[-w / 2 - 0.35, 0, d / 2]} color="#f2994a" />
    </group>
  );
}

// Research Lab — round tower cottage with an observation cap and balcony.
function LabBuilding() {
  const glow = useGlow("research");
  const p = nodePos("labWork");
  return (
    <group position={[p.x, 0, p.y - 0.9]} scale={WORLD_SCALE.building}>
      <Foundation w={1.9} d={1.9} />
      <mesh position={[0, 0.79, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.0, 1.4, 14]} />
        <meshStandardMaterial color="#2f7fb8" roughness={0.68} />
      </mesh>
      {/* stone banding rings */}
      {[0.35, 0.95].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.95 - (y - 0.35) * 0.06, 0.035, 8, 20]} />
          <meshStandardMaterial color="#1c5c8f" roughness={0.7} />
        </mesh>
      ))}
      {/* small balcony ring */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.05, 0.06, 14]} />
        <meshStandardMaterial color="#5a3d20" roughness={0.85} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.02, 1.62, Math.sin(a) * 1.02]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.22, 5]} />
            <meshStandardMaterial color="#3a2712" />
          </mesh>
        );
      })}
      <LayeredRoof radius={1.05} skirtH={0.3} capH={0.9} sides={14} rotationY={0} colorSkirt="#1c5c8f" colorCap="#194e79" y={1.55} />
      <WindowFrame position={[0, 0.9, 0.95]} size={[0.3, 0.34]} glowRef={glow} />
      <WindowFrame position={[0.95, 0.9, 0]} rotation={[0, Math.PI / 2, 0]} size={[0.28, 0.3]} />
      <DoorWithSteps position={[-0.65, 0.18, 0.68]} rotation={[0, 0.5, 0]} w={0.48} h={WORLD_SCALE.doorHeight} color="#1c3f5c" />
      <SignPost position={[1.4, 0, 0.8]} color="#4ea8de" />
    </group>
  );
}

// Data Center — timber mill house with a slow-turning water wheel and
// antenna-like data spires.
function DataBuilding() {
  const glow = useGlow("data");
  const wheelRef = useRef();
  const p = nodePos("dataWork");
  const w = 1.85, d = 1.6, h = 1.2;
  useFrame((_, delta) => { if (wheelRef.current) wheelRef.current.rotation.z += delta * 0.6; });
  return (
    <group position={[p.x, 0, p.y - 0.9]} scale={WORLD_SCALE.building}>
      <Foundation w={w} d={d} />
      <CornerBeams w={w} d={d} h={h} />
      <mesh position={[0, h / 2 + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#7847a8" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[w + 0.04, 0.08, d + 0.04]} />
        <meshStandardMaterial color="#4a2f6b" roughness={0.8} />
      </mesh>
      <LayeredRoof radius={1.5} skirtH={0.4} capH={0.55} colorSkirt="#9b6bce" colorCap="#7847a8" y={h + 0.18} />
      <group ref={wheelRef} position={[w / 2 + 0.12, 0.85, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.5, 0.07, 8, 16]} />
          <meshStandardMaterial color="#5a3d20" roughness={0.9} />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} rotation={[0, Math.PI / 2, a]}>
              <boxGeometry args={[0.02, 0.9, 0.08]} />
              <meshStandardMaterial color="#6b4a2b" />
            </mesh>
          );
        })}
      </group>
      {/* small blinking data spires on the roof */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, h + 0.85, 0]}>
          <cylinderGeometry args={[0.02, 0.03, 0.4, 6]} />
          <meshStandardMaterial color="#d8b64c" emissive="#d8b64c" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <WindowFrame position={[0, 0.75, d / 2 + 0.03]} glowRef={glow} />
      <WindowFrame position={[-w / 2 - 0.03, 0.75, 0.2]} rotation={[0, -Math.PI / 2, 0]} size={[0.26, 0.3]} />
      <DoorWithSteps position={[0.35, 0.18, d / 2 + 0.02]} w={0.5} h={WORLD_SCALE.doorHeight} color="#4a2f6b" />
      <SignPost position={[-w / 2 - 0.35, 0, -d / 2]} color="#9b6bce" />
    </group>
  );
}

// Automation Workshop — a squat forge with a smoking chimney, anvil, and
// stacked crates out front.
function WorkshopBuilding() {
  const glow = useGlow("automation");
  const p = nodePos("workshopWork");
  const w = 1.85, d = 1.55, h = 1.0;
  return (
    <group position={[p.x, 0, p.y - 0.9]} scale={WORLD_SCALE.building}>
      <Foundation w={w} d={d} />
      <CornerBeams w={w} d={d} h={h} />
      <mesh position={[0, h / 2 + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#b8433f" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[w + 0.04, 0.08, d + 0.04]} />
        <meshStandardMaterial color="#6b2b28" roughness={0.8} />
      </mesh>
      <LayeredRoof radius={1.5} skirtH={0.32} capH={0.5} colorSkirt="#e0625f" colorCap="#b8433f" y={h + 0.18} />
      <Chimney position={[0.6, h + 0.18, 0.25]} smoking color="#5f594c" />
      {/* anvil */}
      <group position={[0, 0.18, d / 2 + 0.55]}>
        <mesh position={[0, 0.16, 0]} castShadow>
          <boxGeometry args={[0.1, 0.32, 0.1]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.32, 0.12, 0.14]} />
          <meshStandardMaterial color="#4a4a4a" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
      <WindowFrame position={[-0.5, 0.7, d / 2 + 0.03]} glowRef={glow} />
      <DoorWithSteps position={[0.4, 0.18, d / 2 + 0.02]} w={0.52} h={WORLD_SCALE.doorHeight} color="#6b2b28" />
      <SignPost position={[-w / 2 - 0.35, 0, d / 2]} color="#e0625f" />
    </group>
  );
}

// Command Center — the grandest hall: twin gables, a real banner, wide
// front steps, and lantern-flanked entrance.
function CommandBuilding() {
  const glow = useGlow("manager");
  const p = nodePos("commandWork");
  const w = 2.7, d = 1.9, h = 1.35;
  return (
    <group position={[p.x, 0, p.y - 1.05]} scale={WORLD_SCALE.majorBuilding}>
      <Foundation w={w} d={d} apronColor="#d3c6a5" />
      <CornerBeams w={w} d={d} h={h} color="#3a2712" />
      <mesh position={[0, h / 2 + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#1d7d4e" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[w + 0.04, 0.1, d + 0.04]} />
        <meshStandardMaterial color="#123f2a" roughness={0.8} />
      </mesh>
      <LayeredRoof radius={1.15} skirtH={0.35} capH={0.65} colorSkirt="#2fa66b" colorCap="#1d7d4e" y={h + 0.18} rotationY={Math.PI / 4} />
      <group position={[-0.72, 0, 0]}>
        <LayeredRoof radius={0.75} skirtH={0.25} capH={0.45} colorSkirt="#2fa66b" colorCap="#1d7d4e" y={h + 0.05} />
      </group>
      <group position={[0.72, 0, 0]}>
        <LayeredRoof radius={0.75} skirtH={0.25} capH={0.45} colorSkirt="#2fa66b" colorCap="#1d7d4e" y={h + 0.05} />
      </group>
      {/* banner */}
      <mesh position={[0, h + 0.05, d / 2 + 0.02]}>
        <boxGeometry args={[0.05, 1.15, 0.02]} />
        <meshStandardMaterial color="#5a3d20" />
      </mesh>
      <mesh position={[0.14, h + 0.35, d / 2 + 0.03]}>
        <planeGeometry args={[0.26, 0.4]} />
        <meshStandardMaterial color="#e8c34a" side={2} />
      </mesh>
      <Chimney position={[-1.0, h + 0.18, -0.4]} smoking color="#4a3d33" />
      <WindowFrame position={[-0.85, 0.85, d / 2 + 0.03]} glowRef={glow} />
      <WindowFrame position={[0.85, 0.85, d / 2 + 0.03]} litColor="#ffe9a8" />
      <DoorWithSteps position={[0, 0.18, d / 2 + 0.02]} w={0.68} h={1.12} color="#123f2a" />
      {/* flanking lantern posts */}
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x, 0, d / 2 + 0.7]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 1.0, 8]} />
            <meshStandardMaterial color="#3a2712" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color="#ffe9a8" emissive="#ffcf5c" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[0, 1.02, 0]} intensity={0.35} distance={2.6} color="#ffcf5c" />
        </group>
      ))}
    </group>
  );
}

export default function Buildings() {
  return (
    <group>
      <StudioBuilding />
      <LabBuilding />
      <DataBuilding />
      <WorkshopBuilding />
      <CommandBuilding />
      <AriaHouse />
      <Farm />
    </group>
  );
}
