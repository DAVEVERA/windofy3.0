-- Adds a client-side window identifier used by the Next.js sync route to map
-- submitted draft windows back to inserted Supabase rows.

alter table public.project_windows
  add column if not exists client_id text;
