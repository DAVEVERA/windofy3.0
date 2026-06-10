# TODO

## Goal

Harden the Windofy app across the requested engineering disciplines: AI window analysis/rendering, frontend/mobile/responsive UX, 3D visual quality, backend/API contracts, Supabase readiness, SEO/content, and codebase hygiene.

## Tasks

- [x] Inspect current implementation across frontend, AI service, backend API routes, Docker/runtime, Supabase configuration, SEO metadata, and project hygiene
- [x] Identify the highest-impact implementation gap
- [x] Implement the smallest safe change that moves the full objective forward
- [x] Run narrow verification for the changed area
- [x] Run broader verification when feasible
- [x] Update documentation if behavior, setup, or commands changed
- [x] Add crawlable site identity metadata, robots, sitemap, and conservative Organization/WebSite JSON-LD
- [x] Audit Supabase/back-end contracts for production data ownership and security readiness
- [x] Audit mobile purchase flow and checkout responsiveness with browser screenshots
- [x] Persist checkout customer details and prepared order state across reloads
- [x] Route checkout order preparation through a server-side draft order API
- [x] Persist and display server draft order metadata after checkout
- [x] Surface live AI guidance confidence/status and repeatable spoken instruction controls
- [x] Send live measuring stage context with each AI guidance request
- [x] Make apply-current-configuration-to-all-windows functional and persistent
- [x] Make room rename controls functional and persistent across checkout
- [x] Make manual measurement input save real measurements and unlock the flow without requiring a photo
- [x] Make the preview before-after slider control the actual rendered comparison
- [x] Add downloadable order summary export after draft order preparation
- [x] Add server-side payment session preparation and redirect-ready payment page
- [x] Remove customer-facing demo/mock wording from the production runtime UI
- [x] Add broad catalog/account domain model for all requested window-decoration categories
- [x] Add local catalog seed with 15 products per concrete product group/subgroup
- [x] Add Supabase catalog/account/project/window/sample-order schema draft with RLS and explicit grants
- [ ] Generate, store, inspect, and approve accurate product images for every catalog product
- [x] Connect catalog products to the configurator product choices
- [x] Replace hardcoded checkout pricing with catalog-driven per-window pricing and real window count
- [x] Merge configuration and visualization into one customer step
- [ ] Support multi-window photo upload route with dimensions per window and saved project state
- [x] Add My Account environment for saved projects, windows, visualizations, draft orders, later ordering, and sample orders
- [x] Add color sample ordering per visualized window color
- [x] Redesign the UI palette and mobile-first layout into a calm, modern, cohesive interface
- [ ] Add Dutch journey copy, instructions, info bullets, and infotutorial context per phase
- [ ] Apply codebase-refactor-hygiene-auditor final pass
- [ ] Final review against every explicit requirement

## Completion Marker

ALL_TASKS_COMPLETE: false
