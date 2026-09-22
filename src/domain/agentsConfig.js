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
    id: "data", name: "Aria", role: "Head Agent / AI Manager",
    workstation: "ARIA Command Center",
    personality: "Focused, analytical, calm.",
    responsibilities: ["Manage RentReady", "Delegate work", "Report results", "Own approvals", "Protect live changes"],
    emoji: "📊", c1: "#9b6bce", c2: "#7847a8",
    workNode: "dataWork", yardNode: "dataYard", building: "b-data",
    tasks: [
      { id: "aria_route_request", label: "Ask Aria", subtext: "Type a custom request", delegates: true, fields: [
        { key: "request", label: "Request", type: "textarea", placeholder: "Tell Aria what you need done." },
      ] },
      {
        id: "quick_check_rentready",
        label: "Check RentReady",
        subtext: "Inspect the website and report issues",
        delegates: true,
        quickRequest: "Review the current RentReady project with FORGE. Inspect the existing website code and identify any important problems, broken functionality, obvious errors, or areas that need my attention. Do not make any changes. Have FORGE investigate first, then summarize the important findings for me in simple language. Only report issues supported by what FORGE can actually inspect.",
      },
      {
        id: "quick_check_leads",
        label: "Check My Leads",
        subtext: "Review leads and find opportunities",
        delegates: true,
        quickRequest: "Have SAGE review the current RentReady lead data available to the team. Tell me how many relevant leads we currently have, what meaningful patterns you see, which leads or groups may need attention, and what actions you recommend next. Do not contact, modify, delete, or automatically act on any lead. Summarize SAGE's findings for me and tell me what you recommend I do next.",
      },
      {
        id: "quick_analyze_sales",
        label: "Analyze Sales",
        subtext: "Review conversions and revenue",
        delegates: true,
        quickRequest: "Analyze the RentReady sales and conversion information currently available to the team. Use the appropriate specialist or specialists. Tell me what is working, where customers appear to be dropping off, any important conversion or revenue patterns supported by the available data, and the highest-priority opportunities worth investigating. Do not change the website, pricing, funnel, advertising, or customer records. Report the findings and recommended next steps to me first.",
      },
      {
        id: "quick_growth_opportunities",
        label: "Find Growth Opportunities",
        subtext: "Research traffic and marketing opportunities",
        delegates: true,
        quickRequest: "Have MILO research current growth opportunities relevant to RentReady. Focus on high-intent renters actively trying to solve apartment approval, bad credit, previous denial, eviction, broken lease, second-chance housing, rental requirements, or similar apartment-search problems. Use current research when available. Identify useful search themes, customer problems, messaging opportunities, and acquisition ideas. Do not launch ads, publish content, or change the website. Summarize MILO's findings and tell me which opportunities deserve my attention.",
      },
      {
        id: "quick_business_health",
        label: "Business Health Check",
        subtext: "Ask the team what needs attention",
        delegates: true,
        quickRequest: "Run a RentReady business health check using the specialists that are actually needed. Review the information currently available across the team and identify important issues, opportunities, unfinished work, or anything that needs my attention. Do not make changes or take external actions. Give me a concise owner-level summary organized as:\n1. What looks good\n2. What needs attention\n3. What you recommend doing next\n4. Which agent should handle each recommended action",
      },
      {
        id: "quick_research_idea",
        label: "Research an Idea",
        subtext: "Investigate a business question",
        delegates: true,
        submitLabel: "Start Research",
        fields: [
          { key: "ownerInput", label: "What should ARIA research?", type: "textarea", placeholder: "Example: Is $97 a good price for our second-chance apartment search?" },
        ],
        requestTemplate: "Research this question for me using the appropriate RentReady specialist or specialists:\n\n\"{ownerInput}\"\n\nUse current evidence where appropriate. Separate verified information from assumptions. Do not make business changes based on the research. Return the findings to me through ARIA along with practical options I can consider.",
      },
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
