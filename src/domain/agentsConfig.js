// ============================================================
// SECTION 1 — DOMAIN MODEL / CONFIG
// Single source of truth for permanent agent identities, task menus,
// role colors, workstation ownership, and human-readable status language.
// ============================================================
export const AGENTS_CONFIG = [
  {
    id: "content", name: "Milo", role: "Marketing Specialist",
    workstation: "Creative Studio",
    personality: "Creative, expressive, upbeat.",
    responsibilities: ["Write content", "Create messaging", "Prepare drafts", "Organize creative ideas", "Create campaign material"],
    emoji: "📝", c1: "#e85b57", c2: "#9f3430",
    workNode: "studioWork", yardNode: "studioYard", building: "b-studio",
    tasks: [
      { id: "aria_specialist_task", label: "Marketing Work", fields: [] },
    ],
  },
  {
    id: "research", name: "Sage", role: "Conversion Specialist",
    workstation: "Research Lodge / Library",
    personality: "Curious, thoughtful, observant.",
    responsibilities: ["Research topics", "Gather information", "Compare sources", "Organize findings", "Prepare research"],
    emoji: "🔎", c1: "#4ea8de", c2: "#2f7fb8",
    workNode: "labWork", yardNode: "labYard", building: "b-lab",
    tasks: [
      { id: "aria_specialist_task", label: "Conversion Work", fields: [] },
    ],
  },
  {
    id: "data", name: "Aria", role: "Head Agent / Client Contact",
    workstation: "Data / Qualification Station",
    personality: "Focused, analytical, calm.",
    responsibilities: ["Receive every request", "Route work to specialists", "Summarize team results", "Own approvals", "Protect live changes"],
    emoji: "📊", c1: "#9b6bce", c2: "#7847a8",
    workNode: "dataWork", yardNode: "dataYard", building: "b-data",
    tasks: [
      { id: "aria_route_request", label: "Ask Aria", delegates: true, fields: [
        { key: "request", label: "Request", type: "textarea", placeholder: "Tell Aria what you need done." },
        { key: "specialist", label: "Route", type: "select", options: ["auto", "sage", "milo", "forge", "atlas"] },
      ] },
      { id: "process_rental_qualification", label: "Process Rental Qualification", realBackend: true, fields: [
        { key: "leadId", label: "Lead ID", type: "text", placeholder: "lead_..." },
      ] },
      { id: "analyze_data", label: "Analyze Data", fields: [
        { key: "dataset", label: "Dataset Description", type: "textarea" },
      ] },
      { id: "organize_leads", label: "Organize Leads", fields: [
        { key: "source", label: "Lead Source", type: "text" },
      ] },
      { id: "process_records", label: "Process Records", fields: [
        { key: "recordType", label: "Record Type", type: "text" },
      ] },
      { id: "generate_report", label: "Generate Report", fields: [
        { key: "topic", label: "Report Topic", type: "text" },
      ] },
      { id: "clean_data", label: "Clean Data", fields: [
        { key: "dataset", label: "Dataset Name", type: "text" },
      ] },
      { id: "custom", label: "Custom Task", fields: [
        { key: "instructions", label: "Instructions", type: "textarea" },
      ] },
    ],
  },
  {
    id: "automation", name: "Forge", role: "Website / Developer Specialist",
    workstation: "Workshop",
    personality: "Energetic, practical, hardworking.",
    responsibilities: ["Execute workflows", "Automate repetitive processes", "Connect systems", "Maintain workflows"],
    emoji: "⚙️", c1: "#f2994a", c2: "#b86422",
    workNode: "workshopWork", yardNode: "workshopYard", building: "b-workshop",
    tasks: [
      { id: "aria_specialist_task", label: "Website / Developer Work", fields: [] },
    ],
  },
  {
    id: "manager", name: "Atlas", role: "Listings Specialist",
    workstation: "Command Hall",
    personality: "Confident, organized, calm leader.",
    responsibilities: ["Prepare listings", "Check listing details", "Package listing updates", "Report status to Aria"],
    emoji: "🧭", c1: "#2fa66b", c2: "#1d7d4e",
    workNode: "commandWork", yardNode: "commandYard", building: "b-command",
    tasks: [
      { id: "aria_specialist_task", label: "Listings Work", fields: [] },
    ],
  },
];

export const STAGE_LABELS = ["Assigned", "Preparing", "Working", "Reviewing", "Complete"];

export const STATUS_COLORS = {
  idle: "#8bd17f", wandering: "#9fcf72", walking: "#f2c94c", walking_to_work: "#f2c94c", returning: "#c9b57b",
  assigned: "#f2994a", handoff: "#b894ff", working: "#4ea8de", waiting: "#dba13b", success: "#2fa66b",
  completed: "#2fa66b", timed_out: "#dba13b", error: "#d1494a", socializing: "#8bd17f",
};

export function statusLabel(status) {
  const map = {
    idle: "Ready for work", wandering: "Exploring the village", walking: "On the move",
    walking_to_work: "Walking to workstation", returning: "Returning to post", socializing: "Socializing",
    assigned: "Task assigned", handoff: "Handing off work", working: "Working", waiting: "Waiting for input",
    success: "Success", completed: "Just finished", timed_out: "Taking longer than expected", error: "Needs attention",
  };
  return map[status] || status;
}

export function displayAgentName(cfg, withRole = false) {
  return withRole ? `${cfg.name} — ${cfg.role}` : cfg.name;
}
