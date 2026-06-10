export type WindowStatus = "complete" | "missing-photo" | "missing-measurement" | "needs-review";
export type CatalogGroupId =
  | "wood-blinds"
  | "aluminium-blinds"
  | "roller-blinds"
  | "duo-roller-blinds"
  | "electric-roller-blinds"
  | "curtains"
  | "vertical-blinds"
  | "shutters"
  | "insect-screens"
  | "perfect-fit"
  | "roof-window-decoration";
export type CatalogSubgroupId =
  | "single-pleat-curtains"
  | "double-pleat-curtains"
  | "triple-pleat-curtains"
  | "eyelet-curtains"
  | "voile-curtains"
  | "blackout-curtains";
export type ProductTypeId = CatalogGroupId;
export type MaterialId = "oak" | "walnut" | "matte-aluminium" | "brushed-aluminium";
export type ControlSide = "left" | "right";
export type LadderKind = "ladder-tape" | "ladder-cord";
export type MountingMethod = "inside-recess" | "outside-recess";
export type LightingModeId = "cloudy" | "golden-hour" | "evening";
export type BuilderBlockScope = "retailer" | "project" | "license";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Retailer {
  id: string;
  name: string;
  slug: string;
  brandColor: string;
  active: boolean;
}

export interface Project {
  id: string;
  userId: string;
  retailerId: string;
  name: string;
  savedAt: string;
  rooms: Room[];
  cart: Cart;
}

export interface Room {
  id: string;
  name: string;
  windows: WindowOpening[];
}

export interface WindowOpening {
  id: string;
  roomId: string;
  name: string;
  status: WindowStatus;
  measurement?: Measurement;
  photos: WindowPhoto[];
  configuration?: BlindConfiguration;
  preview?: VisualizationPreview;
  notes?: string;
}

export interface Measurement {
  id: string;
  widthMm: number;
  heightMm: number;
  depthMm?: number;
  source: "manual" | "live-vision";
  confidence: number;
}

export interface WindowPhoto {
  id: string;
  url: string;
  alt: string;
  capturedAt: string;
  aiDetectionConfidence?: number;
}

export interface BlindConfiguration {
  id: string;
  catalogProductId?: string;
  productTypeId: ProductTypeId;
  materialId: MaterialId;
  colorOptionId: string;
  slatWidthId: string;
  controlSide: ControlSide;
  ladderKind: LadderKind;
  ladderOptionId: string;
  mountingMethod: MountingMethod;
  lightTransmission: number;
  lightingModeId: LightingModeId;
}

export interface VisualizationPreview {
  id: string;
  windowId: string;
  originalPhotoUrl: string;
  renderedPreviewUrl?: string;
  renderStatus: "queued" | "processing" | "ready" | "mocked";
  maskConfidence: number;
  perspectiveConfidence: number;
  lightingModeId: LightingModeId;
}

export interface Cart {
  id: string;
  projectId: string;
  items: CartItem[];
  currency: "EUR";
}

export interface CartItem {
  id: string;
  windowId: string;
  roomName: string;
  windowName: string;
  configuration: BlindConfiguration;
  measurement: Measurement;
  preview: VisualizationPreview;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  cartId: string;
  status: "draft" | "pending-payment" | "paid" | "production" | "fulfilled";
  paymentProvider?: "mollie" | "stripe";
  totalCents: number;
}

export interface ProductType {
  id: ProductTypeId;
  name: string;
  description: string;
}

export interface CatalogGroup {
  id: CatalogGroupId;
  name: string;
  description: string;
  customerPromise: string;
  measureNote: string;
  visualizationMode: "slats" | "fabric" | "panels" | "mesh" | "frame" | "roof-system";
  minimumProductsRequired: number;
  sourceUrls: string[];
}

export interface CatalogSubgroup {
  id: CatalogSubgroupId;
  groupId: CatalogGroupId;
  name: string;
  description: string;
  customerPromise: string;
  minimumProductsRequired: number;
}

export interface CatalogProductImage {
  status: "pending-generation" | "ready";
  alt: string;
  prompt: string;
  url?: string;
  referenceSourceUrl?: string;
  reviewNotes?: string;
}

export interface CatalogProduct {
  id: string;
  groupId: CatalogGroupId;
  subgroupId?: CatalogSubgroupId;
  name: string;
  shortDescription: string;
  materialFamily: string;
  colorName: string;
  colorHex: string;
  transparency: "transparant" | "lichtdoorlatend" | "privacy" | "verduisterend";
  controlType: "koord" | "ketting" | "stang" | "motor" | "handgreep" | "vast";
  compatibleMountingMethods: MountingMethod[];
  sampleAvailable: boolean;
  basePriceCents: number;
  pricePerSquareMeterCents: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
  image: CatalogProductImage;
  commerceBullets: string[];
  measurementWarnings: string[];
}

export interface Material {
  id: MaterialId;
  productTypeId: ProductTypeId;
  name: string;
  finish: string;
}

export interface ColorOption {
  id: string;
  materialId: MaterialId;
  name: string;
  hex: string;
}

export interface SlatWidth {
  id: string;
  label: string;
  widthMm: number;
  productTypeIds: ProductTypeId[];
}

export interface ControlOption {
  id: ControlSide;
  label: string;
}

export interface LadderOption {
  id: string;
  kind: LadderKind;
  name: string;
  colorHex: string;
}

export interface LightingMode {
  id: LightingModeId;
  name: string;
  description: string;
}

export interface BuilderBlock {
  id: string;
  name: string;
  description: string;
  enabledByDefault: boolean;
}

export interface FeatureEntitlement {
  id: string;
  builderBlockId: string;
  scope: BuilderBlockScope;
  scopeId: string;
  enabled: boolean;
}
