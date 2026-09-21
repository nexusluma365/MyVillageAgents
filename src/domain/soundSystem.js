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
  newSale: "business.new_sale",
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
  if (cue === SOUND_EVENTS.newSale) return playAudioOnce("/sounds/new-sale.mp3");
  return false;
}

export function playNewSaleSound() {
  return playAudioOnce("/sounds/new-sale.mp3");
}

function playAudioOnce(src) {
  if (typeof Audio === "undefined") return false;
  try {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = 0.78;
    const playback = audio.play();
    if (playback?.catch) {
      playback.catch((error) => {
        console.warn("[soundSystem] Sale sound could not play. Add /public/sounds/new-sale.mp3 and make sure the owner has interacted with the page.", error);
      });
    }
    return true;
  } catch (error) {
    console.warn("[soundSystem] Sale sound could not start.", error);
    return false;
  }
}
