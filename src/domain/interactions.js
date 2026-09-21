import { nodePos } from "./nodes.js";

export const INTERACTION_RESERVATION_TYPES = {
  bench: "bench",
  work: "work",
  local: "local",
  social: "social",
};

export const BENCH_INTERACTIONS = {
  bench1: {
    id: "bench1",
    approachNode: "bench1Approach",
    seatNode: "bench1Seat",
    seatYaw: Math.PI / 2,
    bubble: "💺",
  },
  bench2: {
    id: "bench2",
    approachNode: "bench2Approach",
    seatNode: "bench2Seat",
    seatYaw: -Math.PI / 2,
    bubble: "💺",
  },
};

// Specialist agents (everyone except ARIA) now do their actual task-work at
// the shared Farm rather than their own home building — the home building
// remains their idle territory (AGENT_TERRITORIES below is unchanged), but
// once assigned a real task they walk to the Farm, step inside, and are
// hidden there for the duration (see Character.jsx's hideWhileWorking use).
// ARIA is management — she keeps working from her own Data building.
export const WORK_INTERACTIONS = {
  content: {
    entranceNode: "farmDoor",
    workNode: "farmWork",
    entranceYaw: Math.PI,
    workYaw: Math.PI,
    hideWhileWorking: true,
  },
  research: {
    entranceNode: "farmDoor",
    workNode: "farmWork",
    entranceYaw: Math.PI,
    workYaw: Math.PI,
    hideWhileWorking: true,
  },
  data: {
    entranceNode: "dataDoor",
    workNode: "dataWork",
    entranceYaw: Math.PI,
    workYaw: Math.PI,
  },
  automation: {
    entranceNode: "farmDoor",
    workNode: "farmWork",
    entranceYaw: Math.PI,
    workYaw: Math.PI,
    hideWhileWorking: true,
  },
  manager: {
    entranceNode: "farmDoor",
    workNode: "farmWork",
    entranceYaw: Math.PI,
    workYaw: Math.PI,
    hideWhileWorking: true,
  },
};

// Agents whose real task-work happens at the shared Farm (everyone but ARIA).
export const FARM_WORKER_IDS = Object.keys(WORK_INTERACTIONS).filter(
  (id) => WORK_INTERACTIONS[id].hideWhileWorking
);

export const AGENT_TERRITORIES = {
  content: {
    homeNode: "studioYard",
    homeRadius: 3.2,
    localIdleNodes: ["studioYard", "studioLookout", "studioSign", "studioDoor"],
    inspectNodes: ["studioSign", "studioDoor"],
    longWalkNodes: ["hub", "bench1", "pondWest"],
  },
  research: {
    homeNode: "labYard",
    homeRadius: 3.0,
    localIdleNodes: ["labYard", "labReadingSpot", "labMapSpot", "labDoor"],
    inspectNodes: ["labMapSpot", "labReadingSpot"],
    longWalkNodes: ["pondNorth", "hub", "bench1"],
  },
  data: {
    homeNode: "dataYard",
    homeRadius: 3.2,
    localIdleNodes: ["dataYard", "dataConsoleSpot", "dataWaterSpot", "dataDoor"],
    inspectNodes: ["dataConsoleSpot", "dataDoor"],
    // ARIA's headquarters is a bit further out, so she visits it on her
    // longer idle walks rather than treating it as a local everyday spot.
    longWalkNodes: ["pondside", "hub", "bench2", "ariaHouseYard", "ariaHouseDoor"],
  },
  automation: {
    homeNode: "workshopYard",
    homeRadius: 3.3,
    localIdleNodes: ["workshopYard", "workshopAnvil", "workshopLogs", "workshopDoor"],
    inspectNodes: ["workshopAnvil", "workshopLogs"],
    longWalkNodes: ["bench1", "hub", "pondWest"],
  },
  manager: {
    homeNode: "commandYard",
    homeRadius: 5.5,
    localIdleNodes: ["commandYard", "commandBoard", "commandLookout", "hub"],
    inspectNodes: ["commandBoard", "commandLookout"],
    longWalkNodes: ["studioYard", "labYard", "dataYard", "workshopYard", "pondside"],
  },
};

export const NAV_OBSTACLES = [
  { id: "studio_building", type: "box", center: [-7.7, -5.2], size: [2.6, 2.1] },
  { id: "research_building", type: "circle", center: [0, -5.4], radius: 1.45 },
  { id: "data_building", type: "box", center: [7.7, -5.2], size: [2.55, 2.15] },
  { id: "workshop_building", type: "box", center: [-7.7, 2.8], size: [2.55, 2.1] },
  { id: "command_hall", type: "box", center: [0, 3.65], size: [3.65, 2.75] },
  { id: "pond_water", type: "circle", center: [7.7, 3.0], radius: 2.2 },
  { id: "well", type: "circle", center: [3.6, 1.2], radius: 0.55 },
  { id: "bench1_solid", type: "box", center: [-10.5, 0], size: [0.9, 0.55] },
  { id: "bench2_solid", type: "box", center: [10.5, 0], size: [0.9, 0.55] },
  { id: "aria_house", type: "circle", center: [6.0, 8.0], radius: 1.7 },
  { id: "farm", type: "circle", center: [4.0, -9.0], radius: 1.9 },
];

export function interactionYawToward(fromNodeId, toNodeId) {
  const from = nodePos(fromNodeId);
  const to = nodePos(toNodeId);
  if (!from || !to) return 0;
  return Math.atan2(to.x - from.x, to.y - from.y);
}

export function pickNode(nodes, fallback) {
  if (!nodes?.length) return fallback;
  return nodes[Math.floor(Math.random() * nodes.length)];
}
