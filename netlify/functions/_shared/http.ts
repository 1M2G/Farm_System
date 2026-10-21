import type { HandlerEvent, HandlerResponse } from "@netlify/functions";

const localOrigins = new Set([
  "http://localhost:8443",
  "http://localhost:8888",
  "http://127.0.0.1:8443",
  "http://127.0.0.1:8888",
]);

function allowedOrigins(): Set<string> {
  const configured = process.env.ALLOWED_ORIGINS;
  if (!configured) return localOrigins;
  return new Set(configured.split(",").map((origin) => origin.trim()).filter(Boolean));
}

export function jsonResponse(
  event: HandlerEvent,
  statusCode: number,
  payload: unknown,
): HandlerResponse {
  const origin = event.headers.origin;
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };

  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  }

  return { statusCode, headers, body: JSON.stringify(payload) };
}

export function originAllowed(event: HandlerEvent): boolean {
  const origin = event.headers.origin;
  return !origin || allowedOrigins().has(origin);
}

export function methodNotAllowed(event: HandlerEvent, allowed: string[]): HandlerResponse {
  return jsonResponse(event, 405, { error: "Method not allowed.", allowed });
}

export function unauthorized(event: HandlerEvent): HandlerResponse {
  return jsonResponse(event, 401, { error: "A valid signed-in user session is required." });
}

export function optionsResponse(event: HandlerEvent): HandlerResponse {
  return { ...jsonResponse(event, 204, null), body: "" };
}

export function badOrigin(event: HandlerEvent): HandlerResponse {
  return jsonResponse(event, 403, { error: "This site is not allowed to call the API." });
}
