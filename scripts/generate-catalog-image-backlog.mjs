import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { catalogProducts } from "../src/data/catalog.ts";

const outputPath = path.join(process.cwd(), "docs", "catalog-image-backlog.json");

const readyCountByLeaf = new Map();
for (const product of catalogProducts.filter((item) => item.image.status === "ready")) {
  const key = `${product.groupId}:${product.subgroupId ?? ""}`;
  readyCountByLeaf.set(key, (readyCountByLeaf.get(key) ?? 0) + 1);
}

const selectedCountByLeaf = new Map();

const backlog = catalogProducts
  .filter((product) => {
    const key = `${product.groupId}:${product.subgroupId ?? ""}`;
    const readyCount = readyCountByLeaf.get(key) ?? 0;
    const selectedCount = selectedCountByLeaf.get(key) ?? 0;
    if (product.image.status === "ready" || readyCount + selectedCount >= 2) {
      return false;
    }
    selectedCountByLeaf.set(key, selectedCount + 1);
    return true;
  })
  .map((product) => ({
    id: product.id,
    groupId: product.groupId,
    subgroupId: product.subgroupId ?? null,
    name: product.name,
    materialFamily: product.materialFamily,
    colorName: product.colorName,
    colorHex: product.colorHex,
    outputPath: `public/catalog/products/${product.image.fileName}`,
    prompt: product.image.prompt,
    negativePrompt: product.image.negativePrompt,
    qaChecklist: product.image.qaChecklist,
    referenceSourceUrl: product.image.referenceSourceUrl,
  }));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: "max-two-ready-representative-images-per-leaf-product-group",
    totalPendingRepresentativeSlots: backlog.length,
    outputDirectory: "public/catalog/products",
    items: backlog,
  }, null, 2)}\n`,
);

console.log(JSON.stringify({ outputPath, totalPendingRepresentativeSlots: backlog.length }));
