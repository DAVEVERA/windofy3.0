import type {
  BuilderBlock,
  Cart,
  ColorOption,
  FeatureEntitlement,
  LadderOption,
  LightingMode,
  Material,
  ProductType,
  Project,
  SlatWidth,
} from "@/domain/types";

export const productTypes: ProductType[] = [
  {
    id: "wood-blinds",
    name: "Houten jaloezieen",
    description: "Warme textuur, rustige luxe en sterke lichtcontrole.",
  },
  {
    id: "aluminium-blinds",
    name: "Aluminium jaloezieen",
    description: "Strak, licht, vochtbestendig en technisch precies.",
  },
];

export const materials: Material[] = [
  { id: "oak", productTypeId: "wood-blinds", name: "Eikenhout", finish: "Mat gelakt" },
  { id: "walnut", productTypeId: "wood-blinds", name: "Walnoot", finish: "Zijdeglans" },
  { id: "matte-aluminium", productTypeId: "aluminium-blinds", name: "Mat aluminium", finish: "Poedercoat" },
  { id: "brushed-aluminium", productTypeId: "aluminium-blinds", name: "Geborsteld aluminium", finish: "Geborsteld" },
];

export const colorOptions: ColorOption[] = [
  { id: "warm-white", materialId: "oak", name: "Warm wit", hex: "#F2EEE6" },
  { id: "natural-oak", materialId: "oak", name: "Naturel eiken", hex: "#C59B62" },
  { id: "deep-walnut", materialId: "walnut", name: "Diep walnoot", hex: "#4A3023" },
  { id: "soft-black", materialId: "matte-aluminium", name: "Soft black", hex: "#1C1C1C" },
  { id: "sage-grey", materialId: "matte-aluminium", name: "Sage grey", hex: "#8A9690" },
  { id: "champagne", materialId: "brushed-aluminium", name: "Champagne", hex: "#D6C2A1" },
];

export const slatWidths: SlatWidth[] = [
  { id: "25mm", label: "25 mm", widthMm: 25, productTypeIds: ["aluminium-blinds"] },
  { id: "35mm", label: "35 mm", widthMm: 35, productTypeIds: ["wood-blinds", "aluminium-blinds"] },
  { id: "50mm", label: "50 mm", widthMm: 50, productTypeIds: ["wood-blinds"] },
];

export const ladderOptions: LadderOption[] = [
  { id: "linen-tape", kind: "ladder-tape", name: "Linnen band", colorHex: "#ECEAE6" },
  { id: "bronze-tape", kind: "ladder-tape", name: "Bronze detail", colorHex: "#B08D57" },
  { id: "black-cord", kind: "ladder-cord", name: "Zwart koord", colorHex: "#111111" },
  { id: "sand-cord", kind: "ladder-cord", name: "Zand koord", colorHex: "#D6C2A1" },
];

export const lightingModes: LightingMode[] = [
  { id: "cloudy", name: "Bewolkt", description: "Zacht, neutraal licht voor kleurcontrole." },
  { id: "golden-hour", name: "Golden hour", description: "Warm strijklicht met lange schaduw." },
  { id: "evening", name: "Avond", description: "Gedimd interieurlicht met meer contrast." },
];

const cart: Cart = {
  id: "cart-1",
  projectId: "project-1",
  currency: "EUR",
  items: [],
};

export const mockProject: Project = {
  id: "project-1",
  userId: "user-1",
  retailerId: "retailer-windofy",
  name: "Appartement Amstelveen",
  savedAt: "2026-06-08T05:12:00.000Z",
  cart,
  rooms: [
    {
      id: "room-living",
      name: "Woonkamer",
      windows: [
        {
          id: "window-front",
          roomId: "room-living",
          name: "Voorraam",
          status: "complete",
          measurement: {
            id: "measure-front",
            widthMm: 1820,
            heightMm: 1460,
            depthMm: 78,
            source: "live-vision",
            confidence: 0.94,
          },
          photos: [
            {
              id: "photo-front",
              url: "/window.svg",
              alt: "Woonkamerraam met detectiekader",
              capturedAt: "2026-06-08T05:08:00.000Z",
              aiDetectionConfidence: 0.92,
            },
          ],
          configuration: {
            id: "config-front",
            productTypeId: "wood-blinds",
            materialId: "oak",
            colorOptionId: "natural-oak",
            slatWidthId: "50mm",
            controlSide: "right",
            ladderKind: "ladder-tape",
            ladderOptionId: "linen-tape",
            mountingMethod: "inside-recess",
            lightTransmission: 42,
            lightingModeId: "cloudy",
          },
          preview: {
            id: "preview-front",
            windowId: "window-front",
            originalPhotoUrl: "/window.svg",
            renderStatus: "mocked",
            maskConfidence: 0.91,
            perspectiveConfidence: 0.88,
            lightingModeId: "cloudy",
          },
        },
        {
          id: "window-garden",
          roomId: "room-living",
          name: "Tuindeur",
          status: "needs-review",
          measurement: {
            id: "measure-garden",
            widthMm: 880,
            heightMm: 2140,
            source: "manual",
            confidence: 0.72,
          },
          photos: [],
          notes: "Foto nog toevoegen voor realistische preview.",
        },
      ],
    },
    {
      id: "room-bedroom",
      name: "Slaapkamer",
      windows: [
        {
          id: "window-bedroom-left",
          roomId: "room-bedroom",
          name: "Raam links",
          status: "missing-measurement",
          photos: [
            {
              id: "photo-bedroom",
              url: "/window.svg",
              alt: "Slaapkamerraam klaar voor meting",
              capturedAt: "2026-06-08T05:10:00.000Z",
              aiDetectionConfidence: 0.86,
            },
          ],
        },
      ],
    },
  ],
};

export const builderBlocks: BuilderBlock[] = [
  {
    id: "live-vision-measurement",
    name: "Live Vision AI inmeten",
    description: "Camera- of fotobegeleiding voor raamdetectie, maatadvies en meetcontrole.",
    enabledByDefault: true,
  },
  {
    id: "advanced-shadow-rendering",
    name: "Geavanceerde schaduwvisualisatie",
    description: "Diepte, occlusie, perspectief en lichtmodi voor hoogwaardige previews.",
    enabledByDefault: false,
  },
  {
    id: "retailer-branding",
    name: "Retailer branding",
    description: "Merkaccenten, collectiebeheer en licentiegestuurde storefront-instellingen.",
    enabledByDefault: false,
  },
];

export const featureEntitlements: FeatureEntitlement[] = [
  {
    id: "entitlement-live-vision-retailer",
    builderBlockId: "live-vision-measurement",
    scope: "retailer",
    scopeId: "retailer-windofy",
    enabled: true,
  },
  {
    id: "entitlement-shadow-project",
    builderBlockId: "advanced-shadow-rendering",
    scope: "project",
    scopeId: "project-1",
    enabled: true,
  },
];
