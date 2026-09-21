import * as THREE from "three";

// Per-role "working" tool animations. Purely a visual layer driven by the
// existing `status === "working"` flag from AgentRuntime — no domain/state
// changes. Each function mutates the same armL/armR/head refs the idle
// pose logic already owns, just with a distinct motion per role so a
// glance at an agent's arms tells you what job they're doing.
const lerp = THREE.MathUtils.lerp;

export const WORK_ANIMATIONS = {
  // Hammer swing: quick raise, sharp strike, short hold — a sawtooth, not
  // a smooth sine, so it reads as an "impact" instead of a wobble.
  automation(t, { armR, armL }) {
    const cycle = (t * 1.8) % 1;
    const swing = cycle < 0.35 ? cycle / 0.35 : 1 - (cycle - 0.35) / 0.65;
    if (armR.current) armR.current.rotation.x = lerp(-0.3, -2.1, swing);
    if (armL.current) armL.current.rotation.x = lerp(0, -0.3, Math.sin(t * 1.8 * Math.PI * 2) * 0.5 + 0.5);
  },
  // Reading/annotating: small steady page-turn motion, head tilted down
  // toward the book instead of forward.
  research(t, { armR, armL, head }) {
    if (armR.current) armR.current.rotation.x = -0.9 + Math.sin(t * 2.2) * 0.12;
    if (armL.current) armL.current.rotation.x = -0.85;
    if (head.current) head.current.rotation.x = lerp(head.current.rotation.x, 0.32, 0.08);
  },
  // Quick alternating taps at a console, small amplitude, high frequency.
  data(t, { armR, armL }) {
    if (armR.current) armR.current.rotation.x = -0.6 + Math.sin(t * 9) * 0.14;
    if (armL.current) armL.current.rotation.x = -0.55 + Math.sin(t * 9 + Math.PI) * 0.14;
  },
  // Writing: a small elliptical wrist-level motion (x + z combined).
  content(t, { armR, armL }) {
    if (armR.current) {
      armR.current.rotation.x = -0.75 + Math.sin(t * 3.4) * 0.1;
      armR.current.rotation.z = Math.cos(t * 3.4) * 0.08;
    }
    if (armL.current) armL.current.rotation.x = -0.4;
  },
  // Slow sweeping "pointing at the map" gesture with an occasional
  // surveying head turn — deliberately slower than the others, reads as
  // someone reviewing rather than doing manual labor.
  manager(t, { armR, armL, head }) {
    if (armR.current) armR.current.rotation.z = Math.sin(t * 0.9) * 0.3 - 0.2;
    if (armR.current) armR.current.rotation.x = -0.5;
    if (armL.current) armL.current.rotation.x = -0.3;
    if (head.current) head.current.rotation.y = lerp(head.current.rotation.y, Math.sin(t * 0.5) * 0.3, 0.05);
  },
};

export function applyWorkAnimation(role, t, refs) {
  const fn = WORK_ANIMATIONS[role];
  if (fn) fn(t, refs);
}
