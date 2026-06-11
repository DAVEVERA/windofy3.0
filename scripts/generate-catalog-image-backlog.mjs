import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { catalogProducts } from "../src/data/catalog.ts";

const outputPath = path.join(process.cwd(), "docs", "catalog-image-backlog.json");

const backlog = catalogProducts
  .filter((product) => product.image.status !== "ready")
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
    totalPending: backlog.length,
    outputDirectory: "public/catalog/products",
    items: backlog,
  }, null, 2)}\n`,
);

console.log(JSON.stringify({ outputPath, totalPending: backlog.length }));
