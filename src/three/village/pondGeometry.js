import { nodePos } from "../../domain/nodes.js";

// ============================================================
// The pond's visual center is deliberately OFFSET from the "pondside" nav
// node instead of sitting on top of it. Previously the water mesh was
// centered exactly at nodePos("pondside") — the same point agents idle-walk
// to — so an agent "visiting the pond" walked straight into the water.
// Pushing the water perpendicular to the hub->pondside path puts the node
// at the shore (a natural place to stand and look at the water) while the
// path segment leading to it stays outside the water's radius.
// ============================================================
const node = nodePos("pondside");
const hub = nodePos("hub");
const dx = node.x - hub.x;
const dz = node.y - hub.y;
const len = Math.hypot(dx, dz) || 1;
const perpX = -(dz / len);
const perpZ = dx / len;

export const POND_RADIUS = 2.15;
export const POND_BANK_RADIUS = POND_RADIUS + 0.35;
const OFFSET = 2.6;
export const POND_CENTER = {
  x: node.x + perpX * OFFSET,
  z: node.y + perpZ * OFFSET,
};
