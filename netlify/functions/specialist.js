// Shared specialist endpoint. Point ALL FOUR of VITE_MARKETING_AGENT_URL,
// VITE_CONVERSION_AGENT_URL, VITE_WEBSITE_AGENT_URL, VITE_LISTINGS_AGENT_URL
// at this same function (or set VITE_SPECIALIST_AGENT_URL alone, since
// src/domain/realSpecialistProvider.js already falls back to it) — the
// frontend tells us which agent via `agentId` in the request body, so one
// deployed function serves Milo, Sage, Forge, and Atlas.
//
// Request body (sent by src/domain/realSpecialistProvider.js):
//   { agentId, specialist, taskType, title, parameters: { instructions, routedBy, ... } }
// Response body consumed by realSpecialistProvider.js#normalizeSpecialistResponse:
//   { success, result|summary|message, publicSummary, requiresApproval,
//     approvalQuestion, proposedChange, executionEndpoint?, changePayload? }
import { withHandler, json, providerErrorStatus } from "./_shared/http.js";
import { executeSpecialistTask } from "./_shared/specialists.js";

const VALID_AGENT_IDS = ["content", "research", "automation", "manager"];

export const handler = withHandler(async (payload) => {
  const { agentId, taskType, title, parameters } = payload || {};

  if (!agentId || !VALID_AGENT_IDS.includes(agentId)) {
    return json(400, { success: false, message: `Unknown or missing agentId: "${agentId}".` });
  }
  if (!parameters?.instructions || !String(parameters.instructions).trim()) {
    return json(400, { success: false, message: "No instructions were provided for this task." });
  }

  let result;
  try {
    result = await executeSpecialistTask({ agentId, taskType, title, parameters });
  } catch (error) {
    console.error("[specialist]", agentId, error);
    return json(providerErrorStatus(error), { success: false, message: error.message });
  }

  const response = {
    success: true,
    result: result.result,
    publicSummary: result.publicSummary,
    requiresApproval: result.requiresApproval,
    dataSource: result.dataSource,
  };
  if (result.requiresApproval) {
    response.approvalQuestion = result.approvalQuestion;
    response.proposedChange = result.proposedChange;
    response.changePayload = {
      agentId,
      taskType,
      title,
      instructions: parameters.instructions,
      proposedChange: result.proposedChange || result.result,
    };
    // No executionEndpoint returned here on purpose — the frontend falls
    // back to the single global VITE_APPROVAL_EXECUTION_URL (see README).
  }
  return json(200, response);
});
