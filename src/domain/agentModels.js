// Shared agent id -> GLB model URL map. Used by both the in-world 3D
// character (Character.jsx) and the UI portrait renderer (AgentPortraitScene.jsx)
// so alerts/panels show the agent's real model instead of a generic illustration.
export const AGENT_MODELS = {
  data: new URL("../../Characters/Meshy_AI_Sophia_0918001337_texture.glb", import.meta.url).href,
  content: new URL("../../Characters/Meshy_AI_Pink_Haired_Archer_0918000718_texture.glb", import.meta.url).href,
  research: new URL("../../Characters/Meshy_AI_Grape_Giggles_0918001236_texture.glb", import.meta.url).href,
  automation: new URL("../../Characters/Meshy_AI_Ruby_the_Little_Drago_0918003743_texture.glb", import.meta.url).href,
  manager: new URL("../../Characters/Meshy_AI_Little_Spear_Scout_0918003432_texture.glb", import.meta.url).href,
};
