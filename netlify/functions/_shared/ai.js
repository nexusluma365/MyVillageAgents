// Server-side-only AI provider client. API keys live only in Netlify's
// server environment (ANTHROPIC_API_KEY / OPENAI_API_KEY) and are never
// exposed to the browser — nothing here is a VITE_ variable.
//
// callStructured() forces the model to answer through a schema-constrained
// tool/function call, so the caller gets validated JSON back instead of
// having to hope free text parses cleanly.

const ANTHROPIC_VERSION = "2023-06-01";

export async function callStructured({ system, user, schema, toolName = "respond", maxTokens = 900 }) {
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  if (provider === "openai") {
    return callOpenAIStructured({ system, user, schema, maxTokens });
  }
  return callAnthropicStructured({ system, user, schema, toolName, maxTokens });
}

async function callAnthropicStructured({ system, user, schema, toolName, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw providerError("missing_api_key", "The AI provider is not configured on the server. Set ANTHROPIC_API_KEY in Netlify environment variables.");
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        tools: [{ name: toolName, description: "Return the structured result for this task.", input_schema: schema }],
        tool_choice: { type: "tool", name: toolName },
      }),
    });
  } catch (networkError) {
    throw providerError("provider_error", "Could not reach the Anthropic API from the server.");
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw providerError("provider_error", `Anthropic API error (${response.status}): ${safeSlice(bodyText)}`);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw providerError("invalid_model_output", "Anthropic returned a response the gateway could not parse.");
  }

  const toolUse = (data.content || []).find((block) => block.type === "tool_use");
  if (!toolUse || typeof toolUse.input !== "object") {
    throw providerError("invalid_model_output", "The AI provider did not return a structured response.");
  }
  return toolUse.input;
}

async function callOpenAIStructured({ system, user, schema, maxTokens }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw providerError("missing_api_key", "The AI provider is not configured on the server. Set OPENAI_API_KEY in Netlify environment variables.");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${user}\n\nRespond with ONLY a single valid JSON object matching this shape (no prose, no markdown fences): ${JSON.stringify(schema)}` },
        ],
      }),
    });
  } catch (networkError) {
    throw providerError("provider_error", "Could not reach the OpenAI API from the server.");
  }

  const bodyText = await response.text();
  if (!response.ok) {
    throw providerError("provider_error", `OpenAI API error (${response.status}): ${safeSlice(bodyText)}`);
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw providerError("invalid_model_output", "OpenAI returned a response the gateway could not parse.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw providerError("invalid_model_output", "The AI provider did not return a response.");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw providerError("invalid_model_output", "The AI provider returned unreadable JSON.");
  }
}

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function safeSlice(value) {
  return (value || "").slice(0, 300);
}
