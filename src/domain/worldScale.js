export const WORLD_SCALE = {
  agent: 0.74,
  building: 1.22,
  majorBuilding: 1.28,
  doorHeight: 0.98,
};

export const MODEL_FORWARD = {
  // The handcrafted character faces +Z: facial features and tools are placed
  // on positive local Z, so yaw can be calculated directly from x/z travel.
  characterLocalForward: "+Z",
};
