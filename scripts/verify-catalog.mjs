import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { catalogCompleteness, catalogProducts } from "../src/data/catalog.ts";

function fail(message) {
  throw new Error(message);
}

function assertCompleteness() {
  if (catalogCompleteness.actualProductCount !== 240) {
    fail(`Expected 240 products, got ${catalogCompleteness.actualProductCount}`);
  }

  const underfilled = catalogCompleteness.productsPerLeaf.filter((item) => item.count < 15);
  if (underfilled.length) {
    fail(`Leaf collections below 15 products: ${JSON.stringify(underfilled)}`);
  }
}

async function assertReadyImages() {
  for (const product of catalogProducts) {
    if (!product.image.fileName?.endsWith(".png")) {
      fail(`${product.id} image fileName must be a PNG filename`);
    }

    if (!product.image.prompt || product.image.prompt.length < 180) {
      fail(`${product.id} image prompt is too weak for production generation`);
    }

    if (!product.image.negativePrompt || product.image.negativePrompt.length < 120) {
      fail(`${product.id} image negativePrompt is too weak for production generation`);
    }

    if (!Array.isArray(product.image.qaChecklist) || product.image.qaChecklist.length < 5) {
      fail(`${product.id} image QA checklist must contain at least 5 checks`);
    }
  }

  const readyProducts = catalogProducts.filter((product) => product.image.status === "ready");
  for (const product of readyProducts) {
    if (!product.image.url?.startsWith("/")) {
      fail(`${product.id} is ready but has no root-relative image URL`);
    }

    const assetPath = path.join(process.cwd(), "public", product.image.url.slice(1));
    const assetStat = await stat(assetPath).catch(() => null);
    if (!assetStat?.isFile()) {
      fail(`${product.id} ready image does not exist: ${assetPath}`);
    }

    if (assetStat.size < 50_000) {
      fail(`${product.id} ready image is unexpectedly small: ${assetStat.size} bytes`);
    }

    const header = await readFile(assetPath, { encoding: null }).then((buffer) => buffer.subarray(0, 12));
    const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    const isJpeg = header[0] === 0xff && header[1] === 0xd8;
    const isWebp = header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isJpeg && !isWebp) {
      fail(`${product.id} ready image is not PNG/JPEG/WebP: ${assetPath}`);
    }

    if (!product.image.reviewNotes) {
      fail(`${product.id} is ready but has no visual QA review notes`);
    }
  }
}

function leafKey(product) {
  return `${product.groupId}:${product.subgroupId ?? ""}`;
}

function assertRepresentativeImageCoverage() {
  const leafKeys = new Set(catalogCompleteness.productsPerLeaf.map((item) => `${item.groupId}:${item.subgroupId ?? ""}`));
  const readyByLeaf = new Map();

  for (const product of catalogProducts.filter((item) => item.image.status === "ready")) {
    const key = leafKey(product);
    readyByLeaf.set(key, (readyByLeaf.get(key) ?? 0) + 1);
  }

  const uncovered = [...leafKeys].filter((key) => !readyByLeaf.has(key));
  if (uncovered.length) {
    fail(`Leaf collections without a representative ready image: ${JSON.stringify(uncovered)}`);
  }

  const overfilled = [...readyByLeaf.entries()].filter(([, count]) => count > 2);
  if (overfilled.length) {
    fail(`Leaf collections exceed the max 2 ready representative images: ${JSON.stringify(overfilled)}`);
  }
}

assertCompleteness();
await assertReadyImages();
assertRepresentativeImageCoverage();
console.log(JSON.stringify(catalogCompleteness));
