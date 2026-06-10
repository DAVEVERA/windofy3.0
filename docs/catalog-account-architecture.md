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

Supabase CLI is not installed in this workspace, so the migration file was created manually instead of via `supabase migration new`.

Current Supabase guidance checked on 2026-06-10:

- Changelog: new public tables are not automatically exposed to the Data and GraphQL APIs after the April 28, 2026 breaking change.
- Securing your API docs: enable RLS on exposed public tables and grant Data API roles intentionally.
- RLS docs: write policies around explicit ownership predicates for user data.

Sources:

- https://supabase.com/changelog
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security

## Pricing Model

The catalog supports per-window pricing:

```txt
unit price = base_price_cents + area_m2 * price_per_square_meter_cents
quantity = one configured product per measured window
project total = sum(window unit prices)
```

The existing checkout still uses a temporary hardcoded price calculation. Replacing that with catalog-driven pricing is the next commerce-critical step.
