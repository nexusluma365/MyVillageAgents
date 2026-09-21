export const AGENT_ANIMATION_STATES = {
  idle: "IDLE",
  wandering: "WANDERING",
  walking: "WALKING",
  walking_to_work: "WALKING_TO_WORK",
  returning: "RETURNING",
  socializing: "SOCIALIZING",
  assigned: "ASSIGNED",
  handoff: "HANDOFF",
  working: "WORKING",
  waiting: "WAITING_FOR_OWNER",
  success: "SUCCESS",
  completed: "SUCCESS",
  error: "ERROR",
};

export const STATUS_POSE = {
  idle: { bob: 0.15, sway: 0.4 },
  wandering: { bob: 0, sway: 0 },
  walking: { bob: 0, sway: 0 },
  walking_to_work: { bob: 0, sway: 0 },
  returning: { bob: 0, sway: 0 },
  socializing: { bob: 0.1, sway: 0.6 },
  assigned: { bob: 0.3, sway: 0.2 },
  handoff: { bob: 0.2, sway: 0.55 },
  working: { bob: 0.5, sway: 0.15, workBob: true },
  waiting: { bob: 0.2, sway: 0.3 },
  success: { bob: 0.75, sway: 0.15 },
  completed: { bob: 0.6, sway: 0 },
  error: { bob: 0.1, sway: 1.1 },
};

export function animationStateForStatus(status) {
  return AGENT_ANIMATION_STATES[status] || AGENT_ANIMATION_STATES.idle;
}
