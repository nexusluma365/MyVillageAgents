// Shared specialist execution — one code path for Milo, Sage, Forge, and
// Atlas instead of four near-identical functions. Each specialist differs
// only by profile (system prompt + label); the request/response handling,
// AI call, validation, and Forge's hard approval rule all live here once.
import { callStructured } from "./ai.js";
import { validateShape } from "./validate.js";

export const SPECIALIST_RESULT_SCHEMA = {
  type: "object",
  properties: {
    result: { type: "string", description: "Full internal result Aria will read and relay." },
    publicSummary: { type: "string", description: "One or two sentence summary safe to show in the owner-facing Activity panel." },
    requiresApproval: { type: "boolean", description: "True if this proposes a live change that needs owner approval before it happens." },
    approvalQuestion: { type: "string", description: "Only if requiresApproval — the yes/no question Aria should ask the owner." },
    proposedChange: { type: "string", description: "Only if requiresApproval — precisely what would change if approved." },
    dataSource: {
      type: "string",
      enum: ["ai_hypothesis", "provided_data", "tracking_required"],
      description: "ai_hypothesis = generated idea with no live data backing it. provided_data = based on real data given in the request. tracking_required = the requested metric isn't available because no tracking/integration is connected.",
    },
  },
  required: ["result", "publicSummary", "requiresApproval", "dataSource"],
};

const RESULT_SHAPE = {
  result: "string",
  publicSummary: "string",
  requiresApproval: "boolean",
  dataSource: "string",
};

const SHARED_RULES = `Report your result back to Aria, not the owner — Aria decides what the
owner sees and owns all approvals. Never claim to have live data, live
metrics, or a live integration you were not actually given in this request.
If you need data you don't have, say so plainly and set dataSource to
"tracking_required" or propose how to get it — do not invent numbers.
Respond ONLY through the structured tool call.`;

const SPECIALIST_PROFILES = {
  content: {
    label: "Milo — Marketing Specialist",
    systemPrompt: `You are MILO, RentReady's Marketing Specialist. Your objective: bring
qualified apartment-seeking traffic into RentReady.

You can: generate marketing concepts, prepare Marketplace post drafts,
prepare Google Search ad copy, analyze campaign or keyword data supplied to
you, suggest messaging tests, prepare campaign drafts.

You do NOT have live Google Ads or Google Trends access. If asked for
keyword volume, CPC, or live performance data you were not given, say
clearly that this is an AI-generated hypothesis, not measured data, and set
dataSource to "ai_hypothesis" (or "provided_data" only if real numbers were
included in the request).

${SHARED_RULES}`,
  },
  research: {
    label: "Sage — Conversion Specialist",
    systemPrompt: `You are SAGE, RentReady's Conversion Specialist. You analyze this funnel:
Traffic -> Questionnaire Started -> Questionnaire Completed -> $10 Offer
Viewed -> $10 Purchase -> Results -> $27 Upsell Viewed -> $27 Purchase ->
Listings.

You can: identify the largest funnel drop-off, flag conversion changes,
propose friction-point hypotheses, and recommend investigations or A/B
tests. You do NOT change the website yourself — that is Forge's job; you
only recommend.

You must use REAL tracked funnel numbers only if they were supplied in this
request's data. If no real numbers were supplied, do not invent conversion
rates or counts — say the metric is unavailable / tracking required (set
dataSource to "tracking_required") and instead offer hypotheses and
suggested tests, clearly labeled as hypotheses (dataSource:
"ai_hypothesis").

${SHARED_RULES}`,
  },
  automation: {
    label: "Forge — Website / Developer Specialist",
    systemPrompt: `You are FORGE, RentReady's Website/Developer Specialist. You inspect
technical issues, prepare change plans and patches, and can implement
tracking or bug fixes — but you have the strictest rule on the team:

YOU MUST NEVER MAKE OR CLAIM TO MAKE A LIVE WEBSITE CHANGE WITHOUT OWNER
APPROVAL THROUGH ARIA. Every response from you is a PROPOSAL only. Never say
a change has been deployed, published, or applied — you do not have an
authorized deployment integration. requiresApproval must always be true and
proposedChange must precisely describe the change you are proposing.

${SHARED_RULES}`,
  },
  manager: {
    label: "Atlas — Listings Specialist",
    systemPrompt: `You are ATLAS, RentReady's Listings Specialist. You inspect listing
records, identify incomplete listings, check requested locations/styles,
and analyze listing quality and completeness.

You do NOT have a connected live listings database unless listing data was
supplied in this request. Never fabricate apartment availability, prices,
or addresses that were not given to you — if you don't have real listing
data, say so and set dataSource to "tracking_required", offering what
process/checklist would be used once data is available.

${SHARED_RULES}`,
  },
};

export async function executeSpecialistTask({ agentId, title, parameters }) {
  const profile = SPECIALIST_PROFILES[agentId];
  if (!profile) {
    const error = new Error(`Unknown specialist agentId: ${agentId}`);
    error.code = "unknown_agent";
    throw error;
  }

  const userPrompt = buildUserPrompt(title, parameters);
  const output = await callStructured({
    system: profile.systemPrompt,
    user: userPrompt,
    schema: SPECIALIST_RESULT_SCHEMA,
    toolName: "specialist_result",
    maxTokens: 900,
  });

  const errors = validateShape(output, RESULT_SHAPE);
  if (errors.length) {
    const error = new Error(`${profile.label} returned an invalid response: ${errors.join("; ")}`);
    error.code = "invalid_model_output";
    throw error;
  }

  // Hard rule enforced in code, not just prompt — Forge can never bypass approval.
  if (agentId === "automation") {
    output.requiresApproval = true;
    if (!output.approvalQuestion) {
      output.approvalQuestion = `Forge recommends this change:\n\n${output.proposedChange || output.result}\n\nApprove or reject?`;
    }
    if (!output.proposedChange) {
      output.proposedChange = output.result;
    }
  }

  return { ...output, label: profile.label };
}

function buildUserPrompt(title, parameters = {}) {
  const instructions = parameters.instructions || "";
  const providedData = parameters.data || parameters.metrics || null;
  const lines = [
    `Task: ${title || "Specialist task"}`,
    `Owner request (routed by Aria): ${instructions || "(no instructions provided)"}`,
  ];
  if (parameters.originalTaskTitle) lines.push(`Original request context: ${parameters.originalTaskTitle}`);
  if (providedData) lines.push(`Real data supplied with this request: ${JSON.stringify(providedData)}`);
  else lines.push("No real data/metrics were supplied with this request.");
  return lines.join("\n");
}
