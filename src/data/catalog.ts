import type { CatalogGroup, CatalogProduct, CatalogSubgroup } from "@/domain/types";

type ProductSpec = {
  groupId: CatalogProduct["groupId"];
  subgroupId?: CatalogProduct["subgroupId"];
  namePrefix: string;
  materialFamily: string;
  transparency: CatalogProduct["transparency"];
  controlType: CatalogProduct["controlType"];
  basePriceCents: number;
  pricePerSquareMeterCents: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
  referenceSourceUrl: string;
  commerceBullets: string[];
  measurementWarnings: string[];
};

const catalogSourceUrls = {
  tuiss: "https://www.raamdecoratievantuiss.nl/",
  luxaflex: "https://www.luxaflex.nl/",
  veneta: "https://www.veneta.com/nl/nl/",
  raamdecoratie: "https://www.raamdecoratie.com/",
  copahomeRoof: "https://www.copahome.com/nl/advies/raamdecoratie-gordijnen-dakraam",
};

export const catalogGroups: CatalogGroup[] = [
  {
    id: "wood-blinds",
    name: "Houten jaloezieen",
    description: "Maatwerk jaloezieen met warme houtstructuur en sterke lichtcontrole.",
    customerPromise: "Rustige luxe voor woonkamers, slaapkamers en hoge ramen.",
    measureNote: "Meet breedte, hoogte en nisdiepte; controleer of de lamellen vrij kunnen kantelen.",
    visualizationMode: "slats",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.tuiss, catalogSourceUrls.veneta, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "aluminium-blinds",
    name: "Aluminium jaloezieen",
    description: "Strakke horizontale jaloezieen voor moderne, vochtige of functionele ruimtes.",
    customerPromise: "Technisch, licht en precies regelbaar.",
    measureNote: "Meet op drie punten; gebruik de kleinste maat bij montage in de dag.",
    visualizationMode: "slats",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.tuiss, catalogSourceUrls.veneta, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "roller-blinds",
    name: "Rolgordijnen",
    description: "Compacte rolgordijnen in transparante, privacy en verduisterende stoffen.",
    customerPromise: "Minimalistische basis voor elk raam.",
    measureNote: "Controleer obstakels zoals klinken en ventilatieroosters voordat de stofbreedte wordt bepaald.",
    visualizationMode: "fabric",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.tuiss, catalogSourceUrls.veneta, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "duo-roller-blinds",
    name: "Duo-rolgordijnen",
    description: "Dubbele stofbanen waarmee privacy en lichtinval traploos worden afgewisseld.",
    customerPromise: "Dag en avond controle zonder zware gordijnlook.",
    measureNote: "Meet extra zorgvuldig op vrije kettingloop en cassettepositie.",
    visualizationMode: "fabric",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.tuiss, catalogSourceUrls.veneta, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "electric-roller-blinds",
    name: "Elektrische rolgordijnen",
    description: "Gemotoriseerde rolgordijnen voor hoge ramen, brede puien en slimme routines.",
    customerPromise: "Comfort, veiligheid en bediening zonder loshangende ketting.",
    measureNote: "Controleer motorzijde, stroomvoorziening of accutoegang per raam.",
    visualizationMode: "fabric",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.luxaflex, catalogSourceUrls.veneta, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "curtains",
    name: "Gordijnen",
    description: "Plooigordijnen, ringgordijnen, vitrage en overgordijnen met zachte stofval.",
    customerPromise: "Akoestiek, sfeer en privacy in een complete textiellaag.",
    measureNote: "Meet railbreedte, pakketruimte, gewenste vloerhoogte en overlap.",
    visualizationMode: "fabric",
    minimumProductsRequired: 90,
    sourceUrls: [catalogSourceUrls.luxaflex, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "vertical-blinds",
    name: "Verticale lamellen",
    description: "Verticale stof- of kunststoflamellen voor brede ramen en schuifpuien.",
    customerPromise: "Strak bij grote glaspartijen en makkelijk te richten.",
    measureNote: "Meet railbreedte, bedieningszijde en vrijloop voor pakketzijde.",
    visualizationMode: "panels",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.luxaflex, catalogSourceUrls.tuiss, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "shutters",
    name: "Shutters",
    description: "Vaste raamluiken met kantelbare lamellen en maatwerk frame.",
    customerPromise: "Architectonisch, duurzaam en zeer precies in lichtregeling.",
    measureNote: "Leg kozijnvorm, draai-kiepfunctie en framevrijheid per raam vast.",
    visualizationMode: "frame",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.luxaflex, catalogSourceUrls.veneta],
  },
  {
    id: "insect-screens",
    name: "Horren",
    description: "Insectenwering voor ramen en deuren, inclusief vaste en plisse oplossingen.",
    customerPromise: "Ventileren zonder insecten binnen te laten.",
    measureNote: "Controleer raamtype, draairichting, profielruimte en handgreepvrijheid.",
    visualizationMode: "mesh",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.luxaflex, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "perfect-fit",
    name: "Perfect Fit",
    description: "Raamdecoratie in een klemframe dat in de glaslat wordt geplaatst zonder boren.",
    customerPromise: "Ideaal voor draai-kiepramen en huurwoningen.",
    measureNote: "Meet glaslatdiepte en controleer of klemmen rondom vrij passen.",
    visualizationMode: "frame",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.veneta, catalogSourceUrls.raamdecoratie],
  },
  {
    id: "roof-window-decoration",
    name: "Dakraam decoratie",
    description: "Ingespannen rolgordijnen, plisse en jaloezieen voor schuine dakramen.",
    customerPromise: "Strak geleid, ook bij hellende ramen.",
    measureNote: "Leg merk/typeplaatje, glasdagmaat en zijgeleiding vast.",
    visualizationMode: "roof-system",
    minimumProductsRequired: 15,
    sourceUrls: [catalogSourceUrls.luxaflex, catalogSourceUrls.copahomeRoof],
  },
];

export const catalogSubgroups: CatalogSubgroup[] = [
  {
    id: "single-pleat-curtains",
    groupId: "curtains",
    name: "Enkele plooi",
    description: "Rustige gordijnval met beperkte stofhoeveelheid.",
    customerPromise: "Subtiel en prijsefficient voor kleinere ramen.",
    minimumProductsRequired: 15,
  },
  {
    id: "double-pleat-curtains",
    groupId: "curtains",
    name: "Dubbele plooi",
    description: "Volle stofval met klassiek maatwerkbeeld.",
    customerPromise: "Meer volume en een rijkere uitstraling.",
    minimumProductsRequired: 15,
  },
  {
    id: "triple-pleat-curtains",
    groupId: "curtains",
    name: "Driedubbele plooi",
    description: "Maximale stofrijkdom voor hoge of brede raampartijen.",
    customerPromise: "Hotelkwaliteit met diepe, consistente plooien.",
    minimumProductsRequired: 15,
  },
  {
    id: "eyelet-curtains",
    groupId: "curtains",
    name: "Ringgordijnen",
    description: "Gordijnen met zichtbare ringen voor een informele, moderne slag.",
    customerPromise: "Snel te plaatsen en sterk decoratief.",
    minimumProductsRequired: 15,
  },
  {
    id: "voile-curtains",
    groupId: "curtains",
    name: "Vitrage",
    description: "Transparante gordijnen voor privacy overdag en zacht licht.",
    customerPromise: "Licht, luchtig en goed te combineren met overgordijnen.",
    minimumProductsRequired: 15,
  },
  {
    id: "blackout-curtains",
    groupId: "curtains",
    name: "Overgordijnen",
    description: "Dichte gordijnen voor sfeer, isolatie en verduistering.",
    customerPromise: "Meer privacy, warmte en avondcomfort.",
    minimumProductsRequired: 15,
  },
];

const palette = [
  ["Krijtwit", "#f2eee6"],
  ["Linnen", "#d9d0bf"],
  ["Zand", "#c7b79d"],
  ["Greige", "#a99d8b"],
  ["Saliegroen", "#8a9a82"],
  ["Olijfgrijs", "#6f7a64"],
  ["Mistgrijs", "#b8bbb4"],
  ["Steen", "#85827a"],
  ["Warm taupe", "#8c7563"],
  ["Notenhout", "#5b3d2e"],
  ["Brons", "#8a6b42"],
  ["Antraciet", "#333535"],
  ["Zwartbruin", "#241f1c"],
  ["Room", "#eee3cf"],
  ["Nachtblauw", "#263142"],
] as const;

const productSpecs: ProductSpec[] = [
  spec("wood-blinds", "Hout", "Basswood", "privacy", "koord", 15900, 14800, 400, 3000, 400, 3000),
  spec("aluminium-blinds", "Aluminium", "Aluminium", "privacy", "stang", 11900, 9800, 300, 3000, 300, 3000),
  spec("roller-blinds", "Rolgordijn", "Textiel", "lichtdoorlatend", "ketting", 8900, 7200, 300, 3200, 300, 3200),
  spec("duo-roller-blinds", "Duo rolgordijn", "Duo textiel", "privacy", "ketting", 12900, 9600, 400, 2800, 400, 3000),
  spec("electric-roller-blinds", "Elektrisch rolgordijn", "Gemotoriseerd textiel", "verduisterend", "motor", 22900, 12800, 500, 3500, 500, 3500),
  spec("vertical-blinds", "Verticale lamel", "Stoflamel", "privacy", "koord", 14900, 8800, 600, 5000, 800, 3500),
  spec("shutters", "Shutter", "Paulownia hout", "privacy", "stang", 34900, 28400, 350, 2600, 400, 3000),
  spec("insect-screens", "Hor", "Mesh", "transparant", "handgreep", 9900, 6900, 300, 2400, 300, 2600),
  spec("perfect-fit", "Perfect Fit", "Klemframe", "privacy", "handgreep", 16900, 13200, 250, 1800, 300, 2400),
  spec("roof-window-decoration", "Dakraam", "Zijgeleid textiel", "verduisterend", "handgreep", 13900, 11800, 300, 1800, 300, 2200, catalogSourceUrls.copahomeRoof),
  spec("curtains", "Enkele plooi", "Gordijnstof", "lichtdoorlatend", "vast", 17900, 11200, 600, 6000, 1000, 3500, catalogSourceUrls.raamdecoratie, "single-pleat-curtains"),
  spec("curtains", "Dubbele plooi", "Gordijnstof", "privacy", "vast", 21900, 13600, 600, 6000, 1000, 3500, catalogSourceUrls.raamdecoratie, "double-pleat-curtains"),
  spec("curtains", "Driedubbele plooi", "Gordijnstof", "privacy", "vast", 26900, 16800, 800, 7000, 1200, 3800, catalogSourceUrls.raamdecoratie, "triple-pleat-curtains"),
  spec("curtains", "Ringgordijn", "Gordijnstof met ringen", "lichtdoorlatend", "vast", 18900, 12400, 600, 5000, 1000, 3200, catalogSourceUrls.raamdecoratie, "eyelet-curtains"),
  spec("curtains", "Vitrage", "Transparante voile", "transparant", "vast", 14900, 9200, 600, 6000, 1000, 3500, catalogSourceUrls.luxaflex, "voile-curtains"),
  spec("curtains", "Overgordijn", "Dichte gordijnstof", "verduisterend", "vast", 22900, 14800, 600, 6000, 1000, 3500, catalogSourceUrls.luxaflex, "blackout-curtains"),
];

const readyProductImages: Record<string, { url: string; reviewNotes: string }> = {
  "wood-blinds-01": {
    url: "/catalog/products/wood-blinds-01.png",
    reviewNotes: "AI-generated product mockup visually inspected: realistic chalk-white basswood slats, ladder cords, bottom rail and white frame, no text, no logo, no watermark.",
  },
  "aluminium-blinds-07": {
    url: "/catalog/products/aluminium-blinds-mistgrijs.png",
    reviewNotes: "AI-generated product mockup visually inspected: realistic grey aluminium slats, white frame, no text, no logo, no watermark.",
  },
  "duo-roller-blinds-01": {
    url: "/catalog/products/duo-roller-blinds-01.png",
    reviewNotes: "AI-generated product mockup visually inspected: realistic chalk-white duo roller blind with alternating opaque and sheer textile bands, top roll, bottom rail and white frame, no text, no logo, no watermark.",
  },
  "roller-blinds-02": {
    url: "/catalog/products/roller-blinds-linnen.png",
    reviewNotes: "AI-generated product mockup visually inspected: realistic linen roller blind fabric, correct top tube, no text, no logo, no watermark.",
  },
  "voile-curtains-01": {
    url: "/catalog/products/voile-curtains-krijtwit.png",
    reviewNotes: "AI-generated product mockup visually inspected: realistic translucent voile curtains, rail, folds, no text, no logo, no watermark.",
  },
  "wood-blinds-03": {
    url: "/catalog/products/wood-blinds-zand.png",
    reviewNotes: "AI-generated product mockup visually inspected: realistic wooden slats, white frame, no text, no logo, no watermark.",
  },
};

export const catalogProducts: CatalogProduct[] = productSpecs.flatMap((productSpec) =>
  palette.map(([colorName, colorHex], index) => {
    const serial = String(index + 1).padStart(2, "0");
    const group = catalogGroups.find((item) => item.id === productSpec.groupId);
    const subgroup = productSpec.subgroupId
      ? catalogSubgroups.find((item) => item.id === productSpec.subgroupId)
      : undefined;
    const productName = `${productSpec.namePrefix} ${colorName}`;
    const productId = `${productSpec.subgroupId ?? productSpec.groupId}-${serial}`;
    const readyImage = readyProductImages[productId];
    return {
      id: productId,
      groupId: productSpec.groupId,
      subgroupId: productSpec.subgroupId,
      name: productName,
      shortDescription: `${productSpec.materialFamily} in ${colorName.toLowerCase()} voor ${subgroup?.name.toLowerCase() ?? group?.name.toLowerCase()}.`,
      materialFamily: productSpec.materialFamily,
      colorName,
      colorHex,
      transparency: productSpec.transparency,
      controlType: productSpec.controlType,
      compatibleMountingMethods: ["inside-recess", "outside-recess"],
      sampleAvailable: productSpec.groupId !== "insect-screens",
      basePriceCents: productSpec.basePriceCents + index * 250,
      pricePerSquareMeterCents: productSpec.pricePerSquareMeterCents + index * 175,
      minWidthMm: productSpec.minWidthMm,
      maxWidthMm: productSpec.maxWidthMm,
      minHeightMm: productSpec.minHeightMm,
      maxHeightMm: productSpec.maxHeightMm,
      image: {
        status: readyImage ? "ready" : "pending-generation",
        alt: `${productName} als waarheidsgetrouwe raamdecoratie productvisual.`,
        fileName: `${productId}.png`,
        prompt: [
          "Realistische studio productfoto voor een Nederlandse raamdecoratie webshop.",
          `Product: ${productName}.`,
          `Categorie: ${subgroup?.name ?? group?.name}.`,
          `Materiaal/familie: ${productSpec.materialFamily}. Kleur: ${colorName} (${colorHex}).`,
          "Toon het product gemonteerd in of op een wit kozijn, zonder tekst, logo of fictieve verpakking.",
          "Rustige lichte achtergrond, rechte lens, correcte schaal en herkenbare productconstructie.",
        ].join(" "),
        negativePrompt: [
          "Geen logo's, watermerken, prijsteksten, labels, mensen, handen, extra meubels of rommel.",
          "Geen vervormd raam, zwevend product, onjuiste lamelrichting, onrealistische plooien of verkeerde kleur.",
          "Geen generieke stoftextuur wanneer het product jaloezie, shutter, hor of dakraamsysteem moet zijn.",
        ].join(" "),
        qaChecklist: [
          "Producttype en constructie komen overeen met categorie en subcategorie.",
          "Kleur en materiaal passen bij colorHex, colorName en materialFamily.",
          "Product is gemonteerd in of op een realistisch wit kozijn met correcte schaal.",
          "Beeld bevat geen tekst, logo, watermerk, verpakking, mensen of afleidende props.",
          "Licht, schaduw, randen en perspectief ogen realistisch voor webshopgebruik.",
        ],
        url: readyImage?.url,
        referenceSourceUrl: productSpec.referenceSourceUrl,
        reviewNotes: readyImage?.reviewNotes,
      },
      commerceBullets: productSpec.commerceBullets,
      measurementWarnings: productSpec.measurementWarnings,
    };
  }),
);

export const catalogCompleteness = {
  requiredLeafProductCount: productSpecs.length * 15,
  actualProductCount: catalogProducts.length,
  productsPerLeaf: productSpecs.map((productSpec) => ({
    groupId: productSpec.groupId,
    subgroupId: productSpec.subgroupId,
    count: catalogProducts.filter(
      (product) => product.groupId === productSpec.groupId && product.subgroupId === productSpec.subgroupId,
    ).length,
  })),
  imageStatus: {
    ready: catalogProducts.filter((product) => product.image.status === "ready").length,
    pendingGeneration: catalogProducts.filter((product) => product.image.status === "pending-generation").length,
  },
};

function spec(
  groupId: ProductSpec["groupId"],
  namePrefix: string,
  materialFamily: string,
  transparency: ProductSpec["transparency"],
  controlType: ProductSpec["controlType"],
  basePriceCents: number,
  pricePerSquareMeterCents: number,
  minWidthMm: number,
  maxWidthMm: number,
  minHeightMm: number,
  maxHeightMm: number,
  referenceSourceUrl = catalogSourceUrls.raamdecoratie,
  subgroupId?: ProductSpec["subgroupId"],
): ProductSpec {
  return {
    groupId,
    subgroupId,
    namePrefix,
    materialFamily,
    transparency,
    controlType,
    basePriceCents,
    pricePerSquareMeterCents,
    minWidthMm,
    maxWidthMm,
    minHeightMm,
    maxHeightMm,
    referenceSourceUrl,
    commerceBullets: [
      "Prijs wordt per raam berekend op basis van breedte, hoogte en gekozen uitvoering.",
      "Geschikt voor visualisatie per geupload of live ingemeten raam.",
      "Kleurstaal beschikbaar waar materiaalkeuze dit logisch ondersteunt.",
    ],
    measurementWarnings: [
      "Controleer breedte links, midden en rechts voordat je bestelt.",
      "Controleer hoogte links, midden en rechts en noteer obstakels.",
    ],
  };
}
