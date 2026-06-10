import { catalogCompleteness, catalogGroups, catalogProducts, catalogSubgroups } from "@/data/catalog";

export const dynamic = "force-static";

export async function GET() {
  return Response.json({
    ok: true,
    groups: catalogGroups,
    subgroups: catalogSubgroups,
    products: catalogProducts,
    completeness: catalogCompleteness,
  });
}
