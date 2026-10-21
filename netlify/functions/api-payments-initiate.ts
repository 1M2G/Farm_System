import type { Handler } from "@netlify/functions";
import { badOrigin, jsonResponse, methodNotAllowed, optionsResponse, originAllowed } from "./_shared/http";

export const handler: Handler = async (event) => {
  if (!originAllowed(event)) return badOrigin(event);
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  if (event.httpMethod !== "POST") return methodNotAllowed(event, ["POST", "OPTIONS"]);

  return jsonResponse(event, 503, {
    error: "Payment provider integration is not configured. No payment was initiated.",
    code: "PAYMENT_PROVIDER_UNAVAILABLE",
  });
};
