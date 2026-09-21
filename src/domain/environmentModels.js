// Custom environment GLB assets (village3d/environment/*.glb), loaded once
// and reused wherever they're placed — mirrors the agentModels.js pattern.
//
// The *_optimized.glb files are decimated + texture-compressed copies of
// the originals (via `gltf-transform optimize`, run once offline — see
// environment/README not required, this comment is the record of it):
// the raw Meshy AI exports are extremely over-tessellated (the tree alone
// was ~2M triangles), which is fine for a single hero asset but unusable
// once the tree is repeated dozens of times across the village. Original
// files are kept in environment/ for reference; only the optimized copies
// are imported by the app.
export const HOUSE_MODEL_URL = new URL(
  "../../environment/Golden_Gables_optimized.glb",
  import.meta.url
).href;

export const FARM_MODEL_URL = new URL(
  "../../environment/Red_Barn_optimized.glb",
  import.meta.url
).href;

export const TREE_MODEL_URL = new URL(
  "../../environment/Verdant_Oak_optimized.glb",
  import.meta.url
).href;
