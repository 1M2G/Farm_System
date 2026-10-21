import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type UserClient = {
  client: SupabaseClient;
  userId: string;
};

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export function createUserClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase is not configured.");

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function authenticateRequest(
  authorization: string | undefined,
): Promise<UserClient | null> {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || !isSupabaseConfigured()) return null;

  const client = createUserClient(match[1]);
  const { data, error } = await client.auth.getUser(match[1]);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}
