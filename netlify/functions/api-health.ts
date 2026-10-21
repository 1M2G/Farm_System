import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { badOrigin, jsonResponse, methodNotAllowed, optionsResponse, originAllowed } from "./_shared/http";
import { isSupabaseConfigured } from "./_shared/supabase";

export const handler: Handler = async (event) => {
  if (!originAllowed(event)) return badOrigin(event);
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  if (event.httpMethod !== "GET") return methodNotAllowed(event, ["GET", "OPTIONS"]);

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!isSupabaseConfigured() || !url || !anonKey) {
    return jsonResponse(event, 503, {
      status: "not_configured",
      services: { database: "not_configured" },
      message: "Backend environment variables have not been configured.",
    });
  }

  try {
    const supabase = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.rpc("api_health_check");
    if (error || data !== true) {
      if (error) console.error("Supabase health RPC failed", { code: error.code });
      return jsonResponse(event, 503, {
        status: "degraded",
        services: { database: "unavailable" },
        message: "The backend is running, but its database check did not succeed.",
      });
    }

    return jsonResponse(event, 200, {
      status: "ok",
      services: { database: "connected" },
    });
  } catch (error) {
    console.error("Supabase health check failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return jsonResponse(event, 503, {
      status: "degraded",
      services: { database: "unavailable" },
      message: "The backend is running, but its database could not be reached.",
    });
  }
};
