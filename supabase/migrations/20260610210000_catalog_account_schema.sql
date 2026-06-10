-- Windofy catalog, project account, visualization and sample-order schema.
-- Created manually because the Supabase CLI is not installed in this workspace.
-- Current Supabase docs checked on 2026-06-10:
-- - New public tables are not automatically exposed to the Data API after the 2026-04-28 breaking change.
-- - RLS must be enabled on exposed public tables.
-- - Use policy TO clauses with ownership predicates; do not rely on auth.role().

create extension if not exists pgcrypto;

create table if not exists public.catalog_product_groups (
  id text primary key,
  name text not null,
  description text not null,
  customer_promise text not null,
  measure_note text not null,
  visualization_mode text not null check (visualization_mode in ('slats', 'fabric', 'panels', 'mesh', 'frame', 'roof-system')),
  minimum_products_required integer not null default 15 check (minimum_products_required > 0),
  source_urls text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_product_subgroups (
  id text primary key,
  group_id text not null references public.catalog_product_groups(id) on delete cascade,
  name text not null,
  description text not null,
  customer_promise text not null,
  minimum_products_required integer not null default 15 check (minimum_products_required > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_products (
  id text primary key,
  group_id text not null references public.catalog_product_groups(id),
  subgroup_id text references public.catalog_product_subgroups(id),
  name text not null,
  short_description text not null,
  material_family text not null,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9a-fA-F]{6}$'),
  transparency text not null check (transparency in ('transparant', 'lichtdoorlatend', 'privacy', 'verduisterend')),
  control_type text not null check (control_type in ('koord', 'ketting', 'stang', 'motor', 'handgreep', 'vast')),
  compatible_mounting_methods text[] not null default '{inside-recess,outside-recess}',
  sample_available boolean not null default true,
  base_price_cents integer not null check (base_price_cents >= 0),
  price_per_square_meter_cents integer not null check (price_per_square_meter_cents >= 0),
  min_width_mm integer not null check (min_width_mm > 0),
  max_width_mm integer not null check (max_width_mm >= min_width_mm),
  min_height_mm integer not null check (min_height_mm > 0),
  max_height_mm integer not null check (max_height_mm >= min_height_mm),
  commerce_bullets text[] not null default '{}',
  measurement_warnings text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.catalog_products(id) on delete cascade,
  status text not null default 'pending-generation' check (status in ('pending-generation', 'ready', 'rejected')),
  asset_type text not null default 'product-photo' check (asset_type in ('product-photo', 'swatch', 'lifestyle', 'visualization-reference')),
  url text,
  alt text not null,
  prompt text not null,
  reference_source_url text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ready_asset_has_url check (status <> 'ready' or url is not null)
);

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  default_postal_code text,
  default_house_number text,
  default_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'ready-to-order', 'ordered', 'archived')),
  room_count integer not null default 0 check (room_count >= 0),
  window_count integer not null default 0 check (window_count >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_windows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.customer_projects(id) on delete cascade,
  room_name text not null,
  window_name text not null,
  status text not null default 'missing-photo' check (status in ('complete', 'missing-photo', 'missing-measurement', 'needs-review')),
  width_mm integer check (width_mm > 0),
  height_mm integer check (height_mm > 0),
  depth_mm integer check (depth_mm > 0),
  measurement_source text check (measurement_source in ('manual', 'live-vision')),
  measurement_confidence numeric(4, 3) check (measurement_confidence >= 0 and measurement_confidence <= 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_window_photos (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.project_windows(id) on delete cascade,
  storage_path text not null,
  alt text not null,
  captured_at timestamptz not null default now(),
  ai_detection_confidence numeric(4, 3) check (ai_detection_confidence >= 0 and ai_detection_confidence <= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.project_window_configurations (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.project_windows(id) on delete cascade,
  product_id text not null references public.catalog_products(id),
  mounting_method text not null check (mounting_method in ('inside-recess', 'outside-recess')),
  control_side text check (control_side in ('left', 'right')),
  light_transmission integer check (light_transmission >= 0 and light_transmission <= 100),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null default 1 check (quantity = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (window_id)
);

create table if not exists public.project_visualizations (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.project_windows(id) on delete cascade,
  original_photo_path text not null,
  rendered_preview_path text,
  render_status text not null default 'queued' check (render_status in ('queued', 'processing', 'ready', 'failed')),
  mask_confidence numeric(4, 3) check (mask_confidence >= 0 and mask_confidence <= 1),
  perspective_confidence numeric(4, 3) check (perspective_confidence >= 0 and perspective_confidence <= 1),
  lighting_mode_id text not null default 'cloudy',
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sample_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.customer_projects(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'shipped', 'cancelled')),
  shipping_name text,
  shipping_address text,
  shipping_postal_code text,
  total_cents integer not null default 0 check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sample_order_items (
  id uuid primary key default gen_random_uuid(),
  sample_order_id uuid not null references public.sample_orders(id) on delete cascade,
  product_id text not null references public.catalog_products(id),
  window_id uuid references public.project_windows(id) on delete set null,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9a-fA-F]{6}$'),
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists catalog_products_group_idx on public.catalog_products(group_id, subgroup_id, is_active);
create index if not exists catalog_product_assets_product_idx on public.catalog_product_assets(product_id, status);
create index if not exists customer_projects_user_idx on public.customer_projects(user_id, saved_at desc);
create index if not exists project_windows_project_idx on public.project_windows(project_id);
create index if not exists sample_orders_user_idx on public.sample_orders(user_id, created_at desc);

alter table public.catalog_product_groups enable row level security;
alter table public.catalog_product_subgroups enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_product_assets enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_projects enable row level security;
alter table public.project_windows enable row level security;
alter table public.project_window_photos enable row level security;
alter table public.project_window_configurations enable row level security;
alter table public.project_visualizations enable row level security;
alter table public.sample_orders enable row level security;
alter table public.sample_order_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.catalog_product_groups to anon, authenticated;
grant select on public.catalog_product_subgroups to anon, authenticated;
grant select on public.catalog_products to anon, authenticated;
grant select on public.catalog_product_assets to anon, authenticated;
grant select, insert, update, delete on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.customer_projects to authenticated;
grant select, insert, update, delete on public.project_windows to authenticated;
grant select, insert, update, delete on public.project_window_photos to authenticated;
grant select, insert, update, delete on public.project_window_configurations to authenticated;
grant select, insert, update, delete on public.project_visualizations to authenticated;
grant select, insert, update, delete on public.sample_orders to authenticated;
grant select, insert, update, delete on public.sample_order_items to authenticated;

create policy "Active catalog groups are public" on public.catalog_product_groups
  for select to anon, authenticated
  using (is_active);

create policy "Active catalog subgroups are public" on public.catalog_product_subgroups
  for select to anon, authenticated
  using (is_active);

create policy "Active catalog products are public" on public.catalog_products
  for select to anon, authenticated
  using (is_active);

create policy "Approved catalog assets are public" on public.catalog_product_assets
  for select to anon, authenticated
  using (status = 'ready');

create policy "Customers can read own profile" on public.customer_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can insert own profile" on public.customer_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Customers can update own profile" on public.customer_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Customers can delete own profile" on public.customer_profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can read own projects" on public.customer_projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can insert own projects" on public.customer_projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Customers can update own projects" on public.customer_projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Customers can delete own projects" on public.customer_projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can read own windows" on public.project_windows
  for select to authenticated
  using (exists (
    select 1 from public.customer_projects projects
    where projects.id = project_id
      and projects.user_id = (select auth.uid())
  ));

create policy "Customers can insert own windows" on public.project_windows
  for insert to authenticated
  with check (exists (
    select 1 from public.customer_projects projects
    where projects.id = project_id
      and projects.user_id = (select auth.uid())
  ));

create policy "Customers can update own windows" on public.project_windows
  for update to authenticated
  using (exists (
    select 1 from public.customer_projects projects
    where projects.id = project_id
      and projects.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.customer_projects projects
    where projects.id = project_id
      and projects.user_id = (select auth.uid())
  ));

create policy "Customers can delete own windows" on public.project_windows
  for delete to authenticated
  using (exists (
    select 1 from public.customer_projects projects
    where projects.id = project_id
      and projects.user_id = (select auth.uid())
  ));

create policy "Customers can manage own window photos" on public.project_window_photos
  for all to authenticated
  using (exists (
    select 1
    from public.project_windows windows
    join public.customer_projects projects on projects.id = windows.project_id
    where windows.id = window_id
      and projects.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.project_windows windows
    join public.customer_projects projects on projects.id = windows.project_id
    where windows.id = window_id
      and projects.user_id = (select auth.uid())
  ));

create policy "Customers can manage own configurations" on public.project_window_configurations
  for all to authenticated
  using (exists (
    select 1
    from public.project_windows windows
    join public.customer_projects projects on projects.id = windows.project_id
    where windows.id = window_id
      and projects.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.project_windows windows
    join public.customer_projects projects on projects.id = windows.project_id
    where windows.id = window_id
      and projects.user_id = (select auth.uid())
  ));

create policy "Customers can manage own visualizations" on public.project_visualizations
  for all to authenticated
  using (exists (
    select 1
    from public.project_windows windows
    join public.customer_projects projects on projects.id = windows.project_id
    where windows.id = window_id
      and projects.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.project_windows windows
    join public.customer_projects projects on projects.id = windows.project_id
    where windows.id = window_id
      and projects.user_id = (select auth.uid())
  ));

create policy "Customers can read own sample orders" on public.sample_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can insert own sample orders" on public.sample_orders
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Customers can update own sample orders" on public.sample_orders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Customers can delete own sample orders" on public.sample_orders
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can manage own sample order items" on public.sample_order_items
  for all to authenticated
  using (exists (
    select 1 from public.sample_orders orders
    where orders.id = sample_order_id
      and orders.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.sample_orders orders
    where orders.id = sample_order_id
      and orders.user_id = (select auth.uid())
  ));
