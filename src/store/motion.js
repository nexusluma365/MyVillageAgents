import { nodePos } from "../domain/nodes.js";

// agentId -> { pos:{x,z}, currentNode, walkPhase, yaw, targetYaw, speedMps, strideLen, visualOffset }
// Three.js components read this map directly inside useFrame and imperatively
// set mesh.position / limb rotations — exactly the "position via transform,
// not layout" trick the original DOM build used, translated to WebGL.
export const agentMotion = new Map();

export function createMotion(cfg) {
  const start = nodePos(cfg.yardNode);
  const m = {
    pos: { x: start.x, z: start.y },
    currentNode: cfg.yardNode,
    walkPhase: 0,
    yaw: 0,
    targetYaw: 0,
    speedMps: 1.7,       // world units/sec — tuned for the rescaled node graph
    strideLen: 0.85,     // world units of travel per full leg-swing cycle
    visualOffset: { x: 0, z: 0 }, // smoothed personal-space offset, not part of route state
    path: [],
    destinationNode: null,
    interaction: null,
    moveToken: 0,        // bumped to cancel any in-flight movement/idle loop
  };
  agentMotion.set(cfg.id, m);
  return m;
}

export function getMotion(agentId) {
  return agentMotion.get(agentId);
}
