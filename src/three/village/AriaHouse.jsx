import { useGLTF } from "@react-three/drei";
import { nodePos } from "../../domain/nodes.js";
import { HOUSE_MODEL_URL } from "../../domain/environmentModels.js";
import EnvironmentBuilding from "./EnvironmentBuilding.jsx";

useGLTF.preload(HOUSE_MODEL_URL);

const TARGET_HEIGHT = 2.5;

// ARIA's headquarters — a landmark building near her territory, reached by
// its own path off the plaza. Purely a visual/landscaping addition: ARIA's
// actual task-work still happens at her existing Data building, unchanged.
export default function AriaHouse() {
  const p = nodePos("ariaHouseYard");
  return (
    <group>
      <EnvironmentBuilding
        url={HOUSE_MODEL_URL}
        targetHeight={TARGET_HEIGHT}
        position={[p.x, 0, p.y]}
        rotationY={Math.PI}
      />
      {/* flanking lantern posts, echoing the Command Hall's entrance treatment */}
      {[-1.3, 1.3].map((x) => (
        <group key={x} position={[p.x + x, 0, p.y + 1.5]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 1.0, 8]} />
            <meshStandardMaterial color="#3a2712" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.1, 10, 10]} />
            <meshStandardMaterial color="#e9d8ff" emissive="#9b6bce" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[0, 1.02, 0]} intensity={0.35} distance={2.8} color="#c9a8ff" />
        </group>
      ))}
    </group>
  );
}
