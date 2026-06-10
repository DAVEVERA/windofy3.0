# Windofy Catalog and Account Architecture

## Scope

This pass establishes the backend foundation for the requested webshop flow:

- full product group coverage for window decoration;
- at least 15 local catalog products for each concrete product group or curtain subgroup;
- Supabase tables for catalog, projects, windows, visualizations, configurations and sample orders;
- owner-based RLS for customer data;
- public read-only catalog access with RLS enabled.

## Product Coverage

The local catalog seed lives in `src/data/catalog.ts` and currently contains:

- wooden blinds;
- aluminium blinds;
- roller blinds;
- duo roller blinds;
- electric roller blinds;
- curtains split into single pleat, double pleat, triple pleat, eyelet, voile and blackout curtains;
- vertical blinds;
- shutters;
- insect screens;
- Perfect Fit;
- roof-window decoration.

Every leaf collection has 15 products. This produces 240 products total.

## Image Policy

Product images are intentionally marked as `pending-generation`.

That is required because the final requirement is not just "has an image"; each product needs an accurate, truthful product image. The current seed stores:

- a Dutch product name;
- material and color;
- a source URL for category reference;
- a generation prompt;
- alt text.

The next implementation pass must generate or attach real product images, save them to stable project/Supabase storage, visually inspect them, then flip the asset status to `ready`.

## Supabase Notes

The SQL schema is in `supabase/migrations/20260610210000_catalog_account_schema.sql`.

The generated catalog seed is in `supabase/seed/catalog_seed.sql`. Regenerate it from the webshop source data with:

```powershell
npm run catalog:seed
npm run catalog:verify
```

`catalog:verify` must report 240 products and 15 products for every concrete group/subgroup before the seed is applied to Supabase. It also checks every `ready` image URL against a real file under `public/`, validates basic image format, validates non-trivial file size, and requires visual QA review notes.

Supabase CLI is not installed in this workspace, so the migration file was created manually instead of via `supabase migration new`.

Current Supabase guidance checked on 2026-06-10:

- Changelog: new public tables are not automatically exposed to the Data and GraphQL APIs after the April 28, 2026 breaking change.
- Securing your API docs: enable RLS on exposed public tables and grant Data API roles intentionally.
- RLS docs: write policies around explicit ownership predicates for user data.

Sources:

- https://supabase.com/changelog
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security

## Project Sync API

`POST /api/projects/sync` is the server-side bridge for saving customer projects to Supabase.

Current behavior:

- Requires `SUPABASE_URL` and server-side `SUPABASE_KEY`.
- Requires a Supabase Auth bearer token in the `Authorization` header.
- Verifies the user by calling Supabase Auth server-side.
- Inserts into `customer_projects`, `project_windows`, and `project_window_configurations`.
- Uses the authenticated user's token for PostgREST calls so RLS ownership policies remain active.
- Returns `401` when the browser has no login token yet; local browser draft persistence remains the fallback.

Frontend auth flow:

- The Account UI uses the official Supabase browser client from `@supabase/supabase-js`.
- Customers request a magic link through `supabase.auth.signInWithOtp`.
- Cloud sync reads the current session through `supabase.auth.getSession()` and sends the official access token to the server route.
- The temporary `localStorage["windofy.supabase.accessToken"]` bridge has been removed.

`POST /api/samples/sync` uses the same server-side Auth/RLS pattern for color samples:

- Requires `SUPABASE_URL`, server-side `SUPABASE_KEY`, and a Supabase Auth bearer token.
- Inserts a submitted `sample_orders` row for the authenticated user.
- Inserts `sample_order_items` for the selected catalog product colors.
- Keeps sample pricing at `0` cents until shipping/payment rules are finalized.

## Pricing Model

The catalog supports per-window pricing:

```txt
unit price = base_price_cents + area_m2 * price_per_square_meter_cents
quantity = one configured product per measured window
project total = sum(window unit prices)
```

Checkout and Account totals use catalog-driven per-window pricing for every configured window. Payment-provider settlement is still a separate production integration.
