// Small, isolated "ARIA is working" three-dot indicator.
//
// Deliberately its own component (not global Three.js/scene state) so it can
// re-render on its own animation tick without touching the Village scene or
// causing sibling re-renders. See PERFORMANCE ISOLATION in the product spec.
import { useEffect, useState } from "react";

export default function ReceivingDots({ inline = false }) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    // Static, non-animated fallback — still communicates "waiting" without motion.
    return <span className={"receiving-dots" + (inline ? " inline" : "")} aria-hidden="true">···</span>;
  }

  return (
    <span className={"receiving-dots" + (inline ? " inline" : "")} aria-hidden="true">
      <i className="receiving-dot" />
      <i className="receiving-dot" />
      <i className="receiving-dot" />
    </span>
  );
}

function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    setPrefersReduced(media.matches);
    const onChange = () => setPrefersReduced(media.matches);
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);
  return prefersReduced;
}
