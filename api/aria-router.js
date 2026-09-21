import { proxyAriaRequest } from "../server/ariaProxy.js";

export const config = {
  maxDuration: 60,
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, JSON_HEADERS);
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { success: false, message: "Method not allowed. Use POST." });
    return;
  }

  const payload = typeof request.body === "object" && request.body
    ? request.body
    : parseBody(request.body);

  if (!payload) {
    sendJson(response, 400, { success: false, message: "Invalid JSON body." });
    return;
  }

  const result = await proxyAriaRequest(payload);
  sendJson(response, result.statusCode, result.body);
}

function sendJson(response, statusCode, body) {
  Object.entries(JSON_HEADERS).forEach(([key, value]) => response.setHeader(key, value));
  response.status(statusCode).json(body);
}

function parseBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
