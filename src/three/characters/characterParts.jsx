// ============================================================
// Per-role headgear, hair, face detail, clothing layer, hands/boots and
// carried prop for each of the five agents. Built from primitives only (no
// external model files) — but layered densely enough to read as an actual
// stylized character silhouette rather than a bare capsule mannequin.
// Every part here is a passive child mesh; the animation rig in
// Character.jsx only ever rotates the existing legL/legR/armL/armR/head
// groups these parts live inside, so none of this touches the state
// machine or the per-frame pose logic.
// ============================================================
import * as THREE from "three";

const SKIN = "#f2c49b";

export function Ears() {
  return (
    <>
      <mesh position={[-0.245, -0.01, 0]} rotation={[0, 0, 0.2]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      <mesh position={[0.245, -0.01, 0]} rotation={[0, 0, -0.2]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
    </>
  );
}

export function Face({ role, status = "idle" }) {
  // Slight per-role brow angle so silhouettes read with a bit of
  // personality (stern manager, cheerful content agent, etc.) without
  // needing distinct meshes per expression.
  const baseTilt = { manager: -0.22, automation: -0.15, research: -0.05, data: -0.08, content: 0.12 }[role] ?? 0;
  const expression = {
    completed: { brow: 0.16, mouthY: -0.082, mouthRot: 0.18, cheek: "#f1a98f" },
    working: { brow: -0.16, mouthY: -0.095, mouthRot: 0, cheek: "#e6a07f" },
    waiting: { brow: -0.06, mouthY: -0.095, mouthRot: -0.08, cheek: "#e6a07f" },
    error: { brow: -0.34, mouthY: -0.105, mouthRot: -0.2, cheek: "#d9917a" },
    socializing: { brow: 0.18, mouthY: -0.078, mouthRot: 0.15, cheek: "#f1a98f" },
    idle: { brow: 0, mouthY: -0.09, mouthRot: 0.04, cheek: "#e6a07f" },
  }[status] || { brow: 0, mouthY: -0.09, mouthRot: 0.04, cheek: "#e6a07f" };
  const browTilt = baseTilt + expression.brow;
  return (
    <group>
      {/* dimensional eyes: sclera, iris, pupil and a tiny catchlight */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.085, 0.035, 0.235]}>
          <mesh scale={[1.25, 0.78, 0.28]}>
            <sphereGeometry args={[0.042, 12, 8]} />
            <meshStandardMaterial color="#fff7e6" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.018]} scale={[1, 1, 0.25]}>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color={role === "data" ? "#7ad7ff" : role === "manager" ? "#6bd58d" : "#5a7fbf"} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.031]} scale={[1, 1, 0.2]}>
            <sphereGeometry args={[0.011, 8, 6]} />
            <meshStandardMaterial color="#141414" />
          </mesh>
          <mesh position={[side * -0.006, 0.008, 0.04]} scale={[1, 1, 0.2]}>
            <sphereGeometry args={[0.0045, 6, 4]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 0.032, 0.016]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.075, 0.012, 0.012]} />
            <meshStandardMaterial color={SKIN} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* eyebrows */}
      <mesh position={[-0.09, 0.095, 0.245]} rotation={[0, 0, browTilt]}>
        <boxGeometry args={[0.09, 0.02, 0.02]} />
        <meshStandardMaterial color="#3a2712" />
      </mesh>
      <mesh position={[0.09, 0.095, 0.245]} rotation={[0, 0, -browTilt]}>
        <boxGeometry args={[0.09, 0.02, 0.02]} />
        <meshStandardMaterial color="#3a2712" />
      </mesh>
      {/* nose */}
      <mesh position={[0, -0.015, 0.263]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.035, 0.08, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.6} />
      </mesh>
      <mesh position={[-0.018, -0.035, 0.278]}>
        <sphereGeometry args={[0.006, 6, 4]} />
        <meshStandardMaterial color="#c88972" roughness={0.7} />
      </mesh>
      <mesh position={[0.018, -0.035, 0.278]}>
        <sphereGeometry args={[0.006, 6, 4]} />
        <meshStandardMaterial color="#c88972" roughness={0.7} />
      </mesh>
      {/* cheeks and chin plane */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.12, -0.055, 0.238]} scale={[1.5, 0.8, 0.18]}>
          <sphereGeometry args={[0.03, 8, 6]} />
          <meshStandardMaterial color={expression.cheek} transparent opacity={0.52} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, -0.15, 0.205]} scale={[1.2, 0.45, 0.55]}>
        <sphereGeometry args={[0.052, 8, 6]} />
        <meshStandardMaterial color="#e3aa87" roughness={0.68} />
      </mesh>
      {/* mouth */}
      <mesh position={[0, expression.mouthY, 0.256]} rotation={[0, 0, expression.mouthRot]}>
        <boxGeometry args={[0.09, 0.016, 0.014]} />
        <meshStandardMaterial color="#a15a4a" />
      </mesh>
      <Ears />
    </group>
  );
}

// Short hair peeking out from under/around the headgear — gives the head a
// finished silhouette instead of a bald sphere with a hat glued on.
export function Hair({ role, color = "#4a3018" }) {
  switch (role) {
    case "research": // side-swept scholar hair + small beard-free chin
      return (
        <group>
          <mesh position={[0, 0.12, -0.08]} scale={[1.05, 0.7, 1]}>
            <sphereGeometry args={[0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#e9e4da" roughness={0.75} />
          </mesh>
          {[-0.12, 0, 0.12].map((x, i) => (
            <mesh key={x} position={[x, 0.15 - i * 0.01, 0.08]} rotation={[0.2, 0, x * -2]} scale={[0.75, 0.55, 0.95]}>
              <sphereGeometry args={[0.065, 8, 6]} />
              <meshStandardMaterial color="#f2efe8" roughness={0.78} />
            </mesh>
          ))}
        </group>
      );
    case "manager": // groomed hair + short beard, a "wise leader" look
      return (
        <group>
          <mesh position={[0, 0.13, -0.06]} scale={[1.05, 0.65, 1]}>
            <sphereGeometry args={[0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#5a5a5a" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.16, 0.16]}>
            <coneGeometry args={[0.11, 0.14, 10]} />
            <meshStandardMaterial color="#5a5a5a" roughness={0.7} />
          </mesh>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, -0.1, 0.22]} scale={[0.7, 0.55, 0.28]}>
              <sphereGeometry args={[0.055, 8, 6]} />
              <meshStandardMaterial color="#f4f0e8" roughness={0.76} />
            </mesh>
          ))}
        </group>
      );
    case "automation": // buzzcut + small mustache
      return (
        <group>
          <mesh position={[0, 0.14, -0.05]} scale={[1.04, 0.55, 1]}>
            <sphereGeometry args={[0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#2a2016" roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.06, 0.245]}>
            <boxGeometry args={[0.09, 0.025, 0.02]} />
            <meshStandardMaterial color="#2a2016" />
          </mesh>
        </group>
      );
    case "data": // neat short crop, no facial hair
      return (
        <group>
          <mesh position={[0, 0.14, -0.06]} scale={[1.04, 0.6, 1]}>
            <sphereGeometry args={[0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#241a12" roughness={0.8} />
          </mesh>
          {[-0.13, -0.04, 0.06].map((x, i) => (
            <mesh key={x} position={[x, 0.12 + i * 0.015, 0.11]} rotation={[0.22, 0, -0.35 + i * 0.25]} scale={[1, 0.55, 0.7]}>
              <sphereGeometry args={[0.055, 8, 6]} />
              <meshStandardMaterial color="#20150f" roughness={0.82} />
            </mesh>
          ))}
        </group>
      );
    case "content":
    default: // shoulder-length friendly hair
      return (
        <group>
          <mesh position={[0, 0.1, -0.09]} scale={[1.08, 0.85, 1.05]}>
            <sphereGeometry args={[0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          {[-0.18, 0.18].map((x) => (
            <mesh key={x} position={[x, -0.03, -0.02]} scale={[0.55, 1.05, 0.55]}>
              <sphereGeometry args={[0.09, 8, 6]} />
              <meshStandardMaterial color={color} roughness={0.74} />
            </mesh>
          ))}
        </group>
      );
  }
}

export function RoleHat({ role, color }) {
  switch (role) {
    case "content": // floppy beret-ish cap + quill tucked in
      return (
        <group position={[0, 0.22, 0]}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <sphereGeometry args={[0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#7a4a24" roughness={0.8} />
          </mesh>
          <mesh position={[0.1, 0.08, -0.05]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.015, 0.32, 6]} />
            <meshStandardMaterial color="#f4ead0" roughness={0.5} />
          </mesh>
        </group>
      );
    case "research": // grad cap
      return (
        <group position={[0, 0.24, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.17, 0.1, 8]} />
            <meshStandardMaterial color="#294066" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.34, 0.34, 0.02]} />
            <meshStandardMaterial color="#1c2c4a" roughness={0.7} />
          </mesh>
          <mesh position={[0.17, 0.02, 0.17]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#e0a831" emissive="#e0a831" emissiveIntensity={0.3} />
          </mesh>
        </group>
      );
    case "data": // visor headband with glowing lens dots
      return (
        <group position={[0, 0.18, 0]}>
          <mesh>
            <torusGeometry args={[0.17, 0.03, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#4a2f6b" roughness={0.5} />
          </mesh>
          <mesh position={[-0.08, -0.01, 0.15]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#d8b64c" emissive="#d8b64c" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0.08, -0.01, 0.15]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color="#d8b64c" emissive="#d8b64c" emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    case "automation": // welding goggles pushed up + flat cap
      return (
        <group position={[0, 0.2, 0]}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 10]} />
            <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.02, 0.16]}>
            <torusGeometry args={[0.07, 0.02, 8, 12]} />
            <meshStandardMaterial color="#8d867a" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      );
    case "manager": // small crown/banner spike
    default:
      return (
        <group position={[0, 0.24, 0]}>
          <mesh>
            <coneGeometry args={[0.16, 0.14, 6]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#ffd866" emissive="#ffd866" emissiveIntensity={0.4} />
          </mesh>
        </group>
      );
  }
}

export function RoleTool({ role, color }) {
  switch (role) {
    case "content":
      return (
        <mesh rotation={[0, 0, 0.6]} position={[0.06, -0.02, 0]}>
          <coneGeometry args={[0.02, 0.22, 6]} />
          <meshStandardMaterial color="#f4ead0" />
        </mesh>
      );
    case "research":
      return (
        <mesh position={[0.02, -0.05, 0.05]}>
          <boxGeometry args={[0.16, 0.12, 0.03]} />
          <meshStandardMaterial color="#e8f2fa" />
        </mesh>
      );
    case "data":
      return (
        <mesh position={[0.02, -0.02, 0]}>
          <capsuleGeometry args={[0.035, 0.14, 4, 8]} />
          <meshStandardMaterial color="#c98bf0" emissive="#7847a8" emissiveIntensity={0.3} />
        </mesh>
      );
    case "automation":
      return (
        <group position={[0.04, -0.04, 0]} rotation={[0, 0, 0.3]}>
          <mesh>
            <boxGeometry args={[0.03, 0.2, 0.03]} />
            <meshStandardMaterial color="#8d867a" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      );
    case "manager":
    default:
      return (
        <group position={[0.03, 0.02, 0]}>
          <mesh>
            <boxGeometry args={[0.015, 0.26, 0.015]} />
            <meshStandardMaterial color="#5a3d20" />
          </mesh>
          <mesh position={[0.06, 0.08, 0]}>
            <planeGeometry args={[0.12, 0.09]} />
            <meshStandardMaterial color={color} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
  }
}

// A role-specific garment layer over the base torso — the single biggest
// lever for "these look like dressed characters, not painted capsules".
export function RoleClothing({ role, color }) {
  switch (role) {
    case "content": // canvas apron tied at the neck
      return (
        <group position={[0, 0.9, 0.16]}>
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.5, 0.04]} />
            <meshStandardMaterial color="#e8d9b0" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.27, -0.02]} rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.16, 5]} />
            <meshStandardMaterial color="#c9752a" />
          </mesh>
        </group>
      );
    case "research": // open scholar's robe, two front panels + collar
      return (
        <group>
          <mesh position={[-0.09, 0.88, 0.18]} rotation={[0, 0, 0.05]} castShadow>
            <boxGeometry args={[0.14, 0.55, 0.03]} />
            <meshStandardMaterial color="#e9e4da" roughness={0.75} />
          </mesh>
          <mesh position={[0.09, 0.88, 0.18]} rotation={[0, 0, -0.05]} castShadow>
            <boxGeometry args={[0.14, 0.55, 0.03]} />
            <meshStandardMaterial color="#e9e4da" roughness={0.75} />
          </mesh>
          <mesh position={[0, 1.14, 0.15]}>
            <torusGeometry args={[0.16, 0.03, 6, 12, Math.PI]} />
            <meshStandardMaterial color="#2f7fb8" roughness={0.7} />
          </mesh>
        </group>
      );
    case "data": // fitted tech vest with a glowing chest accent
      return (
        <group position={[0, 0.9, 0.17]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.48, 0.035]} />
            <meshStandardMaterial color="#3a2a52" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.05, 0.02]}>
            <circleGeometry args={[0.035, 12]} />
            <meshStandardMaterial color="#c98bf0" emissive="#c98bf0" emissiveIntensity={0.7} />
          </mesh>
        </group>
      );
    case "automation": // heavy leather work apron with a tool pouch
      return (
        <group position={[0, 0.85, 0.17]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.58, 0.045]} />
            <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
          </mesh>
          <mesh position={[0.1, -0.14, 0.03]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.05]} />
            <meshStandardMaterial color="#4a3018" roughness={0.85} />
          </mesh>
        </group>
      );
    case "manager": // diagonal leader's sash
    default:
      return (
        <mesh position={[0, 0.92, 0.02]} rotation={[0, 0, 0.55]} castShadow>
          <boxGeometry args={[0.13, 0.62, 0.06]} />
          <meshStandardMaterial color="#e8c34a" roughness={0.6} />
        </mesh>
      );
  }
}

// Positioned to sit at the actual tip of the arm/leg capsule they're
// attached to (capsule half-height + radius from its local center), not an
// eyeballed offset — otherwise hands/boots float mid-limb.
export function Hand({ color = SKIN }) {
  return (
    <group position={[0, -0.42, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.075, 10, 10]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {[-0.04, -0.014, 0.014, 0.04].map((x, i) => (
        <mesh key={x} position={[x, -0.055, 0.022]} rotation={[0.2, 0, (i - 1.5) * 0.08]} castShadow>
          <capsuleGeometry args={[0.009, 0.055, 3, 5]} />
          <meshStandardMaterial color={color} roughness={0.62} />
        </mesh>
      ))}
    </group>
  );
}

export function Boot({ color = "#4a3018" }) {
  return (
    <mesh position={[0, -0.52, 0.04]} castShadow>
      <boxGeometry args={[0.14, 0.1, 0.2]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}
