import { useVillageStore } from "../store/useVillageStore.js";
import { STATUS_COLORS } from "../domain/agentsConfig.js";

export default function Toasts() {
  const toasts = useVillageStore((s) => s.toasts);
  return (
    <div id="toast-container">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <div className="tdot" style={{ background: STATUS_COLORS[t.kind] || "var(--accent)" }} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
