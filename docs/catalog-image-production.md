# Catalog Image Production

Windofy requires one truthful, inspected product image for every catalog product.

Current production rule:

- `src/data/catalog.ts` is the source of truth for every product image prompt.
- `npm run catalog:images` writes `docs/catalog-image-backlog.json` for every product still marked `pending-generation`.
- Generated images must be saved to `public/catalog/products/<product.image.fileName>`.
- A product may only move to `status: "ready"` after visual inspection against its `qaChecklist`.
- Ready products must include `reviewNotes` explaining the inspection result.

## Acceptance Criteria

Each ready image must show:

- Correct product type and construction for the category or curtain subgroup.
- Correct color and material family.
- Realistic mounting in or on a white window frame.
- No text, logo, watermark, packaging, people, hands, or decorative clutter.
- Plausible scale, lighting, perspective, shadow, edges, and fabric/slat/mesh detail.

Run after each image batch:

```powershell
npm run catalog:images
npm run catalog:verify
```
