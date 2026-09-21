// ============================================================
// Waypoint / navigation graph — logic UNCHANGED from the original build.
// Tree rooted at "hub": every node knows its way back to hub, so a path
// between any two nodes is A -> ... -> hub -> ... -> B. Keeps agents on
// paths instead of cutting through buildings/trees/props.
//
// Coordinates are world-space meters (x, z) on the ground plane, scaled
// down 1:60 from the original's pixel layout so the geometry works nicely
// with the 3D camera. "y" below is a legacy name kept from the 2D version;
// it is used as the Z axis by the renderer.
// ============================================================
export const NODES = {
  hub:            { x: 0,     y: 0,    parent: null },

  studioYard:     { x: -5.3,  y: -1.2, parent: "hub" },
  studioWork:     { x: -7.7,  y: -4.3, parent: "studioYard" },
  studioDoor:     { x: -7.7,  y: -4.15, parent: "studioYard" },
  studioLookout:   { x: -6.4,  y: -2.8, parent: "studioYard" },
  studioSign:      { x: -8.35, y: -3.8, parent: "studioYard" },

  labYard:        { x: 0,     y: -2.5, parent: "hub" },
  labWork:        { x: 0,     y: -4.5, parent: "labYard" },
  labDoor:        { x: -0.78, y: -4.25, parent: "labYard" },
  labMapSpot:     { x: 0.8,   y: -3.35, parent: "labYard" },
  labReadingSpot: { x: -0.8,  y: -3.15, parent: "labYard" },

  dataYard:       { x: 5.3,   y: -1.2, parent: "hub" },
  dataWork:       { x: 7.7,   y: -4.3, parent: "dataYard" },
  dataDoor:       { x: 8.1,   y: -4.15, parent: "dataYard" },
  dataConsoleSpot:{ x: 6.65,  y: -2.95, parent: "dataYard" },
  dataWaterSpot:  { x: 8.9,   y: -3.25, parent: "dataYard" },

  workshopYard:   { x: -5.3,  y: 2.0,  parent: "hub" },
  workshopWork:   { x: -7.7,  y: 3.7,  parent: "workshopYard" },
  workshopDoor:   { x: -7.2,  y: 3.55, parent: "workshopYard" },
  workshopAnvil:  { x: -6.75, y: 3.05, parent: "workshopYard" },
  workshopLogs:   { x: -8.6,  y: 3.1,  parent: "workshopYard" },

  commandYard:    { x: 0,     y: 2.5,  parent: "hub" },
  commandWork:    { x: 0,     y: 4.7,  parent: "commandYard" },
  commandDoor:    { x: 0,     y: 4.55, parent: "commandYard" },
  commandBoard:   { x: -1.2,  y: 3.5,  parent: "commandYard" },
  commandLookout: { x: 1.2,   y: 3.5,  parent: "commandYard" },

  pondside:       { x: 7.7,   y: 3.0,  parent: "hub" },
  pondNorth:      { x: 6.6,   y: 1.8,  parent: "pondside" },
  pondWest:       { x: 5.7,   y: 3.2,  parent: "pondside" },
  bench1:         { x: -10.5, y: 0,    parent: "hub" },
  bench1Approach: { x: -9.7,  y: 0,    parent: "bench1" },
  bench1Seat:     { x: -10.5, y: 0,    parent: "bench1Approach" },
  bench2:         { x: 10.5,  y: 0,    parent: "hub" },
  bench2Approach: { x: 9.7,   y: 0,    parent: "bench2" },
  bench2Seat:     { x: 10.5,  y: 0,    parent: "bench2Approach" },

  // ARIA's headquarters — an open pocket between the plaza and the outer
  // treeline, clear of the pond, Command Hall, and Studio.
  ariaHouseYard:  { x: 1.5,   y: 12.2, parent: "hub" },
  ariaHouseDoor:  { x: 1.3,   y: 10.9, parent: "ariaHouseYard" },

  // The Farm — shared specialist workplace, tucked south of the plaza
  // between the Lab and Data compounds, short of the southern hill.
  farmYard:       { x: 3.6,   y: -7.2, parent: "hub" },
  farmDoor:       { x: 4.0,   y: -8.6, parent: "farmYard" },
  farmWork:       { x: 4.0,   y: -9.4, parent: "farmYard" },
};

export const IDLE_NODES = ["hub", "pondside", "bench1", "bench2"];

export function nodePos(id) {
  return NODES[id];
}

export function pathToHub(nodeId) {
  const chain = [];
  let cur = nodeId;
  while (cur) {
    chain.push(cur);
    cur = NODES[cur].parent;
  }
  return chain;
}

// Route between two nodes via their nearest common ancestor (always "hub"
// for leaves, but sibling-under-same-parent stays local).
export function routeBetween(fromId, toId) {
  if (fromId === toId) return [fromId];
  const upFrom = pathToHub(fromId);
  const upTo = pathToHub(toId);
  const toSet = new Set(upTo);
  let meetIndex = -1;
  for (let i = 0; i < upFrom.length; i++) {
    if (toSet.has(upFrom[i])) { meetIndex = i; break; }
  }
  const ascend = upFrom.slice(0, meetIndex + 1);
  const meetNode = ascend[ascend.length - 1];
  const descendFull = upTo.slice(0, upTo.indexOf(meetNode));
  const descend = descendFull.slice().reverse();
  return ascend.concat(descend);
}

export function routeCoords(fromId, toId) {
  return routeBetween(fromId, toId).map((id) => nodePos(id));
}

export function distBetween(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export const NAV_PATH_PAIRS = [
  ["hub", "studioYard"], ["studioYard", "studioWork"], ["studioYard", "studioDoor"], ["studioYard", "studioLookout"], ["studioYard", "studioSign"],
  ["hub", "labYard"], ["labYard", "labWork"], ["labYard", "labDoor"], ["labYard", "labMapSpot"], ["labYard", "labReadingSpot"],
  ["hub", "dataYard"], ["dataYard", "dataWork"], ["dataYard", "dataDoor"], ["dataYard", "dataConsoleSpot"], ["dataYard", "dataWaterSpot"],
  ["hub", "workshopYard"], ["workshopYard", "workshopWork"], ["workshopYard", "workshopDoor"], ["workshopYard", "workshopAnvil"], ["workshopYard", "workshopLogs"],
  ["hub", "commandYard"], ["commandYard", "commandWork"], ["commandYard", "commandDoor"], ["commandYard", "commandBoard"], ["commandYard", "commandLookout"],
  ["hub", "pondside"], ["pondside", "pondNorth"], ["pondside", "pondWest"],
  ["hub", "bench1"], ["bench1", "bench1Approach"], ["bench1Approach", "bench1Seat"],
  ["hub", "bench2"], ["bench2", "bench2Approach"], ["bench2Approach", "bench2Seat"],
  ["hub", "ariaHouseYard"], ["ariaHouseYard", "ariaHouseDoor"],
  ["hub", "farmYard"], ["farmYard", "farmDoor"], ["farmYard", "farmWork"],
];

// Visible dirt path segments. Keep this close to the original art layout;
// logical interaction spurs are part of NAV_PATH_PAIRS and debug mode only.
export const PATH_PAIRS = [
  ["hub", "studioYard"], ["studioYard", "studioWork"],
  ["hub", "labYard"], ["labYard", "labWork"],
  ["hub", "dataYard"], ["dataYard", "dataWork"],
  ["hub", "workshopYard"], ["workshopYard", "workshopWork"],
  ["hub", "commandYard"], ["commandYard", "commandWork"],
  ["hub", "pondside"], ["hub", "bench1"], ["hub", "bench2"],
  ["hub", "ariaHouseYard"], ["hub", "farmYard"], ["farmYard", "farmDoor"],
];
