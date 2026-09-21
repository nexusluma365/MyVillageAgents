// Same-origin proxy for the production ARIA n8n webhook.
//
// The browser calls this Netlify Function, then the function calls n8n from
// the server. That avoids browser CORS failures and keeps ARIA as the real
// router/manager for the Village.
import { withHandler, json } from "./_shared/http.js";
import { proxyAriaRequest } from "../../server/ariaProxy.js";

export const handler = withHandler(async (payload) => {
  const result = await proxyAriaRequest(payload);
  return json(result.statusCode, result.body);
});
