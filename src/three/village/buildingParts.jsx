import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================
// Shared handcrafted-building details, reused across all five village
// buildings so each one gets the same level of polish (foundation, corner
// beams, window frames, a real door + steps, a chimney, signage) without
// duplicating the geometry five times over.
// ============================================================

export function Foundation({ w, d, color = "#7d7261", apronColor = "#c9bda3" }) {
  return (
    <group>
      {/* stone plinth the walls sit on */}
      <mesh position={[0, 0.09, 0]} receiveShadow castShadow>
        <boxGeometry args={[w + 0.22, 0.18, d + 0.22]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* worn stone apron blending the building into the path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <circleGeometry args={[Math.max(w, d) * 0.95, 24]} />
        <meshStandardMaterial color={apronColor} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function CornerBeams({ w, d, h, color = "#5a3d20" }) {
  const hx = w / 2 - 0.08, hz = d / 2 - 0.08;
  const corners = [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]];
  return (
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2 + 0.18, z]} castShadow>
          <boxGeometry args={[0.1, h, 0.1]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

export function WindowFrame({ position, rotation = [0, 0, 0], size = [0.32, 0.36], glowRef, litColor = "#ffe9a8" }) {
  const [w, h] = size;
  return (
    <group position={position} rotation={rotation}>
      {/* frame */}
      <mesh>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.05]} />
        <meshStandardMaterial color="#4a3018" roughness={0.8} />
      </mesh>
      {/* glowing pane */}
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial ref={glowRef} color={litColor} emissive={litColor} emissiveIntensity={0.05} />
      </mesh>
      {/* mullion cross */}
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[w, 0.02, 0.01]} />
        <meshStandardMaterial color="#4a3018" />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[0.02, h, 0.01]} />
        <meshStandardMaterial color="#4a3018" />
      </mesh>
      {/* shutters */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (w / 2 + 0.1), 0, -0.01]} castShadow>
          <boxGeometry args={[0.09, h + 0.04, 0.03]} />
          <meshStandardMaterial color="#2f5c3a" roughness={0.8} />
        </mesh>
      ))}
      {/* flower box */}
      <mesh position={[0, -h / 2 - 0.09, 0.06]} castShadow>
        <boxGeometry args={[w + 0.1, 0.08, 0.1]} />
        <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function DoorWithSteps({ position, rotation = [0, 0, 0], w = 0.48, h = 0.72, color = "#5a3d20" }) {
  return (
    <group position={position} rotation={rotation}>
      {/* frame */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w + 0.1, h + 0.1, 0.08]} />
        <meshStandardMaterial color="#3a2712" roughness={0.85} />
      </mesh>
      {/* door planks */}
      <mesh position={[0, h / 2, 0.05]} castShadow>
        <boxGeometry args={[w, h, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {[-0.13, 0, 0.13].map((x) => (
        <mesh key={x} position={[x, h / 2, 0.08]}>
          <boxGeometry args={[0.015, h - 0.06, 0.01]} />
          <meshStandardMaterial color="#2f1d0c" />
        </mesh>
      ))}
      {/* handle */}
      <mesh position={[w / 2 - 0.08, h / 2 - 0.05, 0.09]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#d8b64c" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* steps */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[0, 0.05 - i * 0.09, 0.24 + i * 0.22]} receiveShadow castShadow>
          <boxGeometry args={[w + 0.36 - i * 0.14, 0.1, 0.24]} />
          <meshStandardMaterial color="#a89478" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function Chimney({ position, smoking = false, color = "#6b5a4a" }) {
  const puffs = useRef([]);
  const group = useRef();
  const data = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ phase: i * 0.9, offset: i })), []);

  useFrame(({ clock }) => {
    if (!smoking) return;
    const t = clock.getElapsedTime();
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const d = data[i];
      const cycle = ((t * 0.35 + d.phase) % 3) / 3;
      m.position.set(Math.sin(t * 0.4 + d.offset) * 0.06, 0.3 + cycle * 0.9, Math.cos(t * 0.3 + d.offset) * 0.06);
      const s = 0.06 + cycle * 0.16;
      m.scale.setScalar(s);
      m.material.opacity = 0.5 * (1 - cycle);
    });
  });

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.55, 0.18]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.24, 0.06, 0.24]} />
        <meshStandardMaterial color="#4a3d33" roughness={0.9} />
      </mesh>
      {smoking && (
        <group ref={group}>
          {data.map((_, i) => (
            <mesh key={i} ref={(r) => (puffs.current[i] = r)}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial color="#e8e4dc" transparent opacity={0.4} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function SignPost({ position, rotation = [0, 0, 0], color, emoji }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.7, 6]} />
        <meshStandardMaterial color="#5a3d20" roughness={0.85} />
      </mesh>
      <mesh position={[0.18, 0.6, 0]} castShadow>
        <boxGeometry args={[0.34, 0.22, 0.03]} />
        <meshStandardMaterial color="#e7d6ab" roughness={0.8} />
      </mesh>
      <mesh position={[0.18, 0.6, 0.02]}>
        <planeGeometry args={[0.26, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

// Layered/hipped roof: a wide lower skirt + a steeper cap, giving buildings
// a handcrafted, tiered silhouette instead of one plain cone/pyramid.
export function LayeredRoof({ radius = 1.4, skirtH = 0.4, capH = 0.7, sides = 4, rotationY = Math.PI / 4, colorSkirt, colorCap, y = 0 }) {
  return (
    <group position={[0, y, 0]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, skirtH / 2, 0]} castShadow>
        <coneGeometry args={[radius, skirtH, sides]} />
        <meshStandardMaterial color={colorSkirt} roughness={0.78} />
      </mesh>
      <mesh position={[0, skirtH + capH / 2 - 0.05, 0]} castShadow>
        <coneGeometry args={[radius * 0.62, capH, sides]} />
        <meshStandardMaterial color={colorCap} roughness={0.72} />
      </mesh>
      {/* ridge cap ornament */}
      <mesh position={[0, skirtH + capH - 0.06, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#e0a831" emissive="#e0a831" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}
