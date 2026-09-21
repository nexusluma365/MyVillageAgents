// Optional sound architecture placeholder.
// No assets are bundled and nothing auto-plays; this gives future real audio
// a clean, muted-by-default interface without changing simulation logic.
export const SOUND_EVENTS = {
  ambientBirds: "ambient.birds",
  ambientWind: "ambient.wind",
  pond: "ambient.pond",
  footsteps: "agent.footsteps",
  hammer: "workshop.hammer",
  paper: "desk.paper",
  success: "ui.success",
  alert: "ui.alert",
};

let muted = true;

export function setSoundMuted(nextMuted) {
  muted = Boolean(nextMuted);
}

export function isSoundMuted() {
  return muted;
}

export function playSoundCue(cue) {
  if (muted || !cue) return false;
  // Future implementation point: route `cue` to WebAudio/HTMLAudio once
  // original, licensed assets exist.
  return false;
}
