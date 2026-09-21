import { AGENTS_CONFIG } from "../domain/agentsConfig.js";
import { useVillageStore } from "../store/useVillageStore.js";

export default function Legend() {
  const selectedAgentId = useVillageStore((s) => s.selectedAgentId);
  const onAgentClicked = useVillageStore((s) => s.onAgentClicked);

  return (
    <div id="legend" aria-label="Agents">
      {AGENTS_CONFIG.map((cfg) => (
        <button
          type="button"
          className={"legend-chip" + (selectedAgentId === cfg.id ? " selected" : "")}
          key={cfg.id}
          onClick={() => onAgentClicked(cfg.id)}
          title={`Assign task to ${cfg.name}`}
          aria-label={`Assign task to ${cfg.name}`}
        >
          <span className="swatch" style={{ background: cfg.c1 }} />
          <span>{cfg.emoji} {cfg.name} <small>{cfg.role.split(" ")[0]}</small></span>
        </button>
      ))}
    </div>
  );
}
