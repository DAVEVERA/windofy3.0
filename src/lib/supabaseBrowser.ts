import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function isSupabaseBrowserConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseBrowserConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }

  return browserClient;
}

export async function getSupabaseAccessToken() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return "";
  }

  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? "";
}

export type SupabaseSession = Session;
