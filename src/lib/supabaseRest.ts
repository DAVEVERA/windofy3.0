type SupabaseFetchOptions = {
  accessToken: string;
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  prefer?: string;
};

export type SupabaseAuthUser = {
  id: string;
  email?: string;
};

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}

function supabaseUrl() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!url) {
    throw new Error("SUPABASE_URL is not configured.");
  }
  return url;
}

function supabaseKey() {
  const key = process.env.SUPABASE_KEY;
  if (!key) {
    throw new Error("SUPABASE_KEY is not configured.");
  }
  return key;
}

export async function getSupabaseUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey(),
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as { id?: unknown; email?: unknown } | null;
  if (typeof payload?.id !== "string") {
    return null;
  }

  return {
    id: payload.id,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

export async function supabaseRest<T>(path: string, options: SupabaseFetchOptions): Promise<T> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: supabaseKey(),
      authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
      ...(options.prefer ? { prefer: options.prefer } : {}),
    },
    body: typeof options.body === "undefined" ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : `Supabase request failed with status ${response.status}.`,
    );
  }

  return payload as T;
}
