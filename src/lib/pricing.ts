import { catalogProducts } from "@/data/catalog";
import type { BlindConfiguration, CatalogProduct, Measurement } from "@/domain/types";

export type WindowPrice = {
  product: CatalogProduct;
  areaSquareMeters: number;
  totalCents: number;
};

export function priceWindowConfiguration(configuration: BlindConfiguration, measurement: Measurement): WindowPrice {
  const product =
    catalogProducts.find((item) => item.id === configuration.catalogProductId) ??
    catalogProducts.find(
      (item) => item.groupId === configuration.productTypeId && item.id.includes(configuration.colorOptionId),
    ) ??
    catalogProducts.find((item) => item.groupId === configuration.productTypeId) ??
    catalogProducts[0];
  const areaSquareMeters = Math.max(0.1, (measurement.widthMm / 1000) * (measurement.heightMm / 1000));
  const totalCents = Math.round(product.basePriceCents + areaSquareMeters * product.pricePerSquareMeterCents);

  return {
    product,
    areaSquareMeters,
    totalCents,
  };
}
