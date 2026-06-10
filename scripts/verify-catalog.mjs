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

assertCompleteness();
await assertReadyImages();
console.log(JSON.stringify(catalogCompleteness));
