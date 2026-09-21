// VITE_APPROVAL_EXECUTION_URL — runs only after the owner approves a
// pending change in Aria's Approvals tab (see useVillageStore.js#decideApproval).
//
// Request body:
//   { approvalId, taskId, specialistId, proposedChange, changePayload }
// Response: plain text — the frontend shows it verbatim as decisionResult
// (src/store/useVillageStore.js:245-251, src/ui/ActivityPanel.jsx:73).
//
// IMPORTANT: there is no connected deployment/execution provider yet, so
// this intentionally does NOT claim to have applied a live change — see
// README "Known simplifications" and the project brief's explicit
// instruction not to fake deployment. Wire a real execution provider
// (e.g. a CMS API, a GitHub Actions dispatch, a feature-flag API) into the
// TODO below when one exists.
import { withHandler, text } from "./_shared/http.js";

export const handler = withHandler(async (payload) => {
  const { approvalId, taskId, specialistId, proposedChange, changePayload } = payload || {};

  if (!approvalId || !proposedChange) {
    return text(400, "Missing approvalId or proposedChange on this approval request.");
  }

  console.log("[approval-executor] owner approved change", {
    approvalId, taskId, specialistId, changePayload,
  });

  // TODO: connect a real execution provider here (CMS, deploy hook, etc.)
  // and only then return a message claiming the change is live.

  return text(
    200,
    `Approved. "${proposedChange}" has been logged for manual follow-through — ` +
    `no automated deployment provider is connected yet, so a developer needs to apply this change by hand.`
  );
});
