# Customer Journey And Mobile Audit

Audit date: 2026-06-11

## Scope

Checked the main Windofy journey on a 390px mobile viewport:

- Home
- Keuze
- Invoer
- Ramencheck
- Configuratie
- Checkout
- Account

## Current Result

All primary journey steps render without horizontal overflow at 390px.

The journey order is logically coherent:

1. Choose route: live AI measuring or manual/photo input.
2. Add photos and dimensions per window.
3. Review detected/saved windows.
4. Configure and visualize per window in one combined step.
5. Review cart and exact window-count pricing.
6. Save/recover project in Account and order samples.

## Design Notes

- The palette is now calmer than the original saturated treatment: paper, warm wood, sage and bronze accents.
- Primary actions are visible and clear on mobile.
- Product and measurement copy is Dutch and stage-specific.
- The previous fake CSS 3D hero has been replaced with an interactive Three.js wood blind model.

## Three.js Hero Acceptance

The landing hero now includes:

- Real WebGL canvas rendered with Three.js.
- Separate wood-textured slat geometry.
- Head rail and bottom rail.
- Ladder/pull cords.
- Interactive tilt control.
- Interactive lift control.
- Drag-to-inspect horizontal scene rotation.
- Desktop and mobile screenshots verified as nonblank with no horizontal overflow.

## Remaining UX Risks

- The 3D model is now real and interactive, but can be refined further with curved slat geometry, cord knots, and higher fidelity wood normals.
- Account recovery depends on Supabase Auth being fully configured and tested with real user sessions.
- Live production health still depends on deploying the Python AI service and setting Vercel `AI_SERVICE_URL`.
