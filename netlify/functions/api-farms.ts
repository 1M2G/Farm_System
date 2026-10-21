import type { Handler } from "@netlify/functions";
import { badOrigin, jsonResponse, methodNotAllowed, optionsResponse, originAllowed, unauthorized } from "./_shared/http";
import { authenticateRequest, isSupabaseConfigured } from "./_shared/supabase";

export const handler: Handler = async (event) => {
  if (!originAllowed(event)) return badOrigin(event);
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return methodNotAllowed(event, ["GET", "POST", "OPTIONS"]);
  }

  if (!isSupabaseConfigured()) {
    return jsonResponse(event, 503, { error: "Backend authentication is not configured." });
  }

  try {
    const session = await authenticateRequest(event.headers.authorization);
    if (!session) return unauthorized(event);

    if (event.httpMethod === "GET") {
      const { data, error } = await session.client
        .from("farms")
        .select("id, name, created_at, updated_at")
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Farm list query failed", { code: error.code });
        return jsonResponse(event, 500, { error: "Farm records could not be loaded." });
      }
      return jsonResponse(event, 200, { farms: data });
    }

    if (!event.body) {
      return jsonResponse(event, 400, { error: "A JSON farm name is required." });
    }
    if (!event.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return jsonResponse(event, 415, { error: "Content-Type must be application/json." });
    }
    if (event.body.length > 4096) {
      return jsonResponse(event, 413, { error: "Request body is too large." });
    }
    const body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) as {
      name?: unknown;
    } | null;
    if (typeof body?.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      return jsonResponse(event, 400, { error: "Farm name must contain 1 to 100 characters." });
    }

    const { data: farmId, error: createError } = await session.client.rpc("create_farm", {
      farm_name: body.name.trim(),
    });
    if (createError || typeof farmId !== "string") {
      if (createError) console.error("Farm creation failed", { code: createError.code });
      return jsonResponse(event, 500, { error: "Farm record could not be created." });
    }

    const { data, error } = await session.client
      .from("farms")
      .select("id, name, created_at, updated_at")
      .eq("id", farmId)
      .single();
    if (error || !data) {
      if (error) console.error("Created farm could not be retrieved", { code: error.code });
      return jsonResponse(event, 500, { error: "Farm was created but could not be retrieved." });
    }
    return jsonResponse(event, 201, { farm: data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(event, 400, { error: "Request body must be valid JSON." });
    }
    console.error("Farm request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return jsonResponse(event, 500, { error: "Farm request could not be completed." });
  }
};
