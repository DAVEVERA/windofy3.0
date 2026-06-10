"use client";

import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  CreditCard,
  Download,
  Eye,
  Home,
  Layers3,
  PackageCheck,
  PanelTop,
  Ruler,
  Save,
  Settings2,
  ShoppingBag,
  Sparkles,
  UserRound,
  Volume2,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { catalogGroups, catalogProducts } from "@/data/catalog";
import {
  builderBlocks,
  colorOptions,
  featureEntitlements,
  ladderOptions,
  lightingModes,
  materials,
  mockProject,
  productTypes,
  slatWidths,
} from "@/data/mockWindofy";
import type { BlindConfiguration, Measurement, WindowOpening, WindowStatus } from "@/domain/types";
import { priceWindowConfiguration } from "@/lib/pricing";

const flowSteps = ["Home", "Keuze", "Invoer", "Ramencheck", "Configuratie", "Checkout", "Account"] as const;
type FlowStep = (typeof flowSteps)[number];
type IconListItem = {
  title: string;
  body?: string;
  Icon: LucideIcon;
};
type PipelineStatus = "idle" | "loading" | "success" | "error";
type WindowDetectionBox = { x: number; y: number; w: number; h: number };
type LiveGuideResult = {
  instruction?: string;
  language?: string;
  measurementReady?: boolean;
  confidence?: number;
  issue?: string;
};
type LiveMeasurementStage = "positioning" | "stability-check" | "measurement-confirmation";
type LiveGuidanceMeta = {
  language: string;
  confidence: number;
  issue: string;
  stage: LiveMeasurementStage;
};
type DraftState = {
  activeStep?: FlowStep;
  selectedWindowId?: string;
  configuration?: BlindConfiguration;
  uploadedImageDataUrl?: string | null;
  uploadedFileName?: string;
  analysisResult?: AnalysisResult | null;
  renderedImageDataUrl?: string | null;
  configurationOverrides?: Record<string, BlindConfiguration>;
  paymentMethod?: "ideal" | "card";
  orderReference?: string;
  draftOrder?: PreparedDraftOrder | null;
  checkoutDetails?: CheckoutDetails;
  measurementOverrides?: Record<string, Measurement>;
  roomNameOverrides?: Record<string, string>;
  sampleRequests?: SampleRequest[];
  customWindows?: WindowOpening[];
};
type CheckoutDetails = {
  name: string;
  email: string;
  postalCode: string;
  houseNumber: string;
  address: string;
};
type CheckoutCartItem = {
  id: string;
  windowId: string;
  roomName: string;
  windowName: string;
  price: number;
  catalogProductId?: string;
  catalogProductName?: string;
  catalogColorName?: string;
  catalogColorHex?: string;
  areaSquareMeters?: number;
  measurement?: Measurement;
  configuration?: BlindConfiguration;
};
type DraftOrderResponse = {
  ok?: boolean;
  error?: string;
  order?: PreparedDraftOrder;
};
type PaymentSessionResponse = {
  ok?: boolean;
  error?: string;
  session?: {
    id: string;
    status: "ready";
    provider: "mollie" | "stripe";
    redirectUrl: string;
    expiresAt: string;
  };
};
type PreparedDraftOrder = {
  id: string;
  reference: string;
  status: "pending-payment";
  paymentMethod: "ideal" | "card";
  paymentProvider: "mollie" | "stripe";
  totalCents: number;
  itemCount: number;
  createdAt: string;
};
type SampleRequest = {
  id: string;
  windowId: string;
  windowName: string;
  roomName: string;
  catalogProductId: string;
  catalogProductName: string;
  colorName: string;
  requestedAt: string;
};
type AnalysisResult = {
  qualityFailed?: boolean;
  qualityFeedback?: string;
  style?: string;
  roomMood?: string;
  lightingConditions?: string;
  colour_palette?: Array<{ hex_code?: string; color_family?: string; design_role?: string }>;
  windowCheck?: {
    recommendation?: string;
    reasoning?: string;
    windowType?: string;
    detectedWindowCount?: number;
    specialConsiderations?: string;
  };
  windowBounds?: (WindowDetectionBox & { confidence?: number }) | null;
  windowOpenings?: WindowDetectionBox[];
  imageSize?: { w: number; h: number } | null;
  windowMask?: string | null;
  materialSuggestions?: string[];
  suggestions?: Array<{
    productType?: string;
    material?: string;
    colorName?: string;
    colorHex?: string;
    suitabilityScore?: number;
    reasoning?: string;
  }>;
};

const processItems: IconListItem[] = [
  { title: "Live camera", body: "AI kijkt mee met Nederlandse spraak", Icon: Camera },
  { title: "Raamdetectie", body: "Openingen en kozijnen apart herkend", Icon: Wand2 },
  { title: "Meetcontrole", body: "Begeleide controle voor elk raam", Icon: Ruler },
  { title: "AI preview", body: "Jaloezie direct in je interieur", Icon: Eye },
  { title: "Bestellen", body: "Configuratie klaar voor checkout", Icon: PackageCheck },
];

const operationalStats = [
  ["Live taal", "Nederlands"],
  ["AI zicht", "Vision + mask"],
  ["Render", "Realistische preview"],
  ["Checkout", "Order-ready"],
];

const checkoutSteps: IconListItem[] = [
  { title: "Controle afmetingen", Icon: ClipboardCheck },
  { title: "Klantgegevens", Icon: Save },
  { title: "Bezorggegevens", Icon: PackageCheck },
  { title: "Betaalmethode", Icon: CreditCard },
];

const statusLabels: Record<WindowStatus, string> = {
  complete: "Compleet",
  "missing-photo": "Foto ontbreekt",
  "missing-measurement": "Maat ontbreekt",
  "needs-review": "Controle nodig",
};
const guidanceIssueLabels: Record<string, string> = {
  angled: "Camera staat scheef",
  no_window: "Geen raam in beeld",
  none: "Frame bruikbaar",
  reflection: "Reflectie zichtbaar",
  too_blurry: "Beeld is onscherp",
  too_close: "Te dichtbij",
  too_dark: "Te donker",
  too_far: "Te ver weg",
  window_cut_off: "Raam valt buiten beeld",
};
const measurementStageLabels: Record<LiveMeasurementStage, string> = {
  positioning: "Positioneren",
  "stability-check": "Stabiliteit",
  "measurement-confirmation": "Meetbevestiging",
};

const DUTCH_LOCALE = "nl-NL";
const DRAFT_STORAGE_KEY = "windofy.configurator.draft.v1";
const emptyCheckoutDetails: CheckoutDetails = {
  name: "",
  email: "",
  postalCode: "",
  houseNumber: "",
  address: "",
};

const formatPrice = (cents: number) =>
  new Intl.NumberFormat(DUTCH_LOCALE, { style: "currency", currency: "EUR" }).format(cents / 100);

const formatConfidence = (value: number) =>
  new Intl.NumberFormat(DUTCH_LOCALE, { maximumFractionDigits: 0, style: "percent" }).format(value);

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Foto kon niet worden gelezen."));
    reader.readAsDataURL(file);
  });
}

function detectionBoxes(result: AnalysisResult | null): WindowDetectionBox[] {
  if (result?.windowOpenings?.length) {
    return result.windowOpenings;
  }
  return result?.windowBounds ? [result.windowBounds] : [];
}

function preferredDutchVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "nl-nl") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("nl")) ??
    null
  );
}

function readDraftState(): DraftState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
}

export function WindofyApp() {
  const [activeStep, setActiveStep] = useState<FlowStep>("Home");
  const [selectedWindowId, setSelectedWindowId] = useState("window-front");
  const [configuration, setConfiguration] = useState<BlindConfiguration>(
    mockProject.rooms[0].windows[0].configuration!,
  );
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<PipelineStatus>("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [renderedImageDataUrl, setRenderedImageDataUrl] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<PipelineStatus>("idle");
  const [renderError, setRenderError] = useState("");
  const [configurationOverrides, setConfigurationOverrides] = useState<Record<string, BlindConfiguration>>({});
  const [paymentMethod, setPaymentMethod] = useState<"ideal" | "card">("ideal");
  const [orderReference, setOrderReference] = useState("");
  const [draftOrder, setDraftOrder] = useState<PreparedDraftOrder | null>(null);
  const [checkoutDetails, setCheckoutDetails] = useState<CheckoutDetails>(emptyCheckoutDetails);
  const [measurementOverrides, setMeasurementOverrides] = useState<Record<string, Measurement>>({});
  const [roomNameOverrides, setRoomNameOverrides] = useState<Record<string, string>>({});
  const [sampleRequests, setSampleRequests] = useState<SampleRequest[]>([]);
  const [customWindows, setCustomWindows] = useState<WindowOpening[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);

  const allWindows = useMemo(
    () =>
      mockProject.rooms.flatMap((room) =>
        room.windows.map((window) => {
          const measurement = measurementOverrides[window.id] ?? window.measurement;
          const windowConfiguration = configurationOverrides[window.id] ?? window.configuration;
          const roomName = roomNameOverrides[room.id] ?? room.name;
          return {
            ...window,
            status: measurement ? window.status === "missing-measurement" ? "needs-review" : window.status : window.status,
            measurement,
            configuration: windowConfiguration,
            roomName,
          };
        }),
      ).concat(
        customWindows.map((window) => ({
          ...window,
          status: measurementOverrides[window.id] ? "needs-review" as WindowStatus : window.status,
          measurement: measurementOverrides[window.id] ?? window.measurement,
          configuration: configurationOverrides[window.id] ?? window.configuration,
          roomName: roomNameOverrides[window.roomId] ?? "Geuploade ramen",
        })),
      ),
    [configurationOverrides, customWindows, measurementOverrides, roomNameOverrides],
  );

  const selectedWindow = allWindows.find((window) => window.id === selectedWindowId) ?? allWindows[0];
  const selectedMaterial = materials.find((material) => material.id === configuration.materialId);
  const selectedColor = colorOptions.find((color) => color.id === configuration.colorOptionId);
  const selectedLighting = lightingModes.find((mode) => mode.id === configuration.lightingModeId);
  const cartItems: CheckoutCartItem[] = allWindows
    .filter((window) => window.measurement && (window.configuration || window.id === selectedWindowId))
    .map((window) => {
      const itemConfiguration = window.id === selectedWindowId ? configuration : window.configuration;
      const pricedWindow = itemConfiguration && window.measurement
        ? priceWindowConfiguration(itemConfiguration, window.measurement)
        : null;
      return {
        id: `cart-${window.id}`,
        windowId: window.id,
        roomName: window.roomName,
        windowName: window.name,
        price: pricedWindow?.totalCents ?? 0,
        catalogProductId: pricedWindow?.product.id,
        catalogProductName: pricedWindow?.product.name,
        catalogColorName: pricedWindow?.product.colorName,
        catalogColorHex: pricedWindow?.product.colorHex,
        areaSquareMeters: pricedWindow?.areaSquareMeters,
        measurement: window.measurement,
        configuration: itemConfiguration,
      };
    });
  const cartTotal = cartItems.reduce((total, item) => total + item.price, 0);
  const goTo = (step: FlowStep) => setActiveStep(step);
  const mountingLabel = configuration.mountingMethod === "inside-recess" ? "in de dag" : "op de dag";

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const draft = readDraftState();
      if (!draft) {
        setDraftRestored(true);
        return;
      }

      if (draft.activeStep && flowSteps.includes(draft.activeStep)) {
        setActiveStep(draft.activeStep);
      }
      if (draft.selectedWindowId) {
        setSelectedWindowId(draft.selectedWindowId);
      }
      if (draft.configuration) {
        setConfiguration(draft.configuration);
      }
      if (typeof draft.uploadedImageDataUrl !== "undefined") {
        setUploadedImageDataUrl(draft.uploadedImageDataUrl);
      }
      if (draft.uploadedFileName) {
        setUploadedFileName(draft.uploadedFileName);
      }
      if (typeof draft.analysisResult !== "undefined") {
        setAnalysisResult(draft.analysisResult);
        if (draft.analysisResult) {
          setAnalysisStatus("success");
        }
      }
      if (typeof draft.renderedImageDataUrl !== "undefined") {
        setRenderedImageDataUrl(draft.renderedImageDataUrl);
        if (draft.renderedImageDataUrl) {
          setRenderStatus("success");
        }
      }
      if (draft.configurationOverrides) {
        setConfigurationOverrides(draft.configurationOverrides);
      }
      if (draft.paymentMethod) {
        setPaymentMethod(draft.paymentMethod);
      }
      if (draft.orderReference) {
        setOrderReference(draft.orderReference);
      }
      if (typeof draft.draftOrder !== "undefined") {
        setDraftOrder(draft.draftOrder);
      }
      if (draft.checkoutDetails) {
        setCheckoutDetails({ ...emptyCheckoutDetails, ...draft.checkoutDetails });
      }
      if (draft.measurementOverrides) {
        setMeasurementOverrides(draft.measurementOverrides);
      }
      if (draft.roomNameOverrides) {
        setRoomNameOverrides(draft.roomNameOverrides);
      }
      if (draft.sampleRequests) {
        setSampleRequests(draft.sampleRequests);
      }
      if (draft.customWindows) {
        setCustomWindows(draft.customWindows);
      }
      setDraftRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!draftRestored) {
      return;
    }

    const draft: DraftState = {
      activeStep,
      selectedWindowId,
      configuration,
      uploadedImageDataUrl,
      uploadedFileName,
      analysisResult,
      renderedImageDataUrl,
      configurationOverrides,
      paymentMethod,
      orderReference,
      draftOrder,
      checkoutDetails,
      measurementOverrides,
      roomNameOverrides,
      sampleRequests,
      customWindows,
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    activeStep,
    analysisResult,
    checkoutDetails,
    customWindows,
    configuration,
    configurationOverrides,
    draftOrder,
    draftRestored,
    orderReference,
    paymentMethod,
    measurementOverrides,
    renderedImageDataUrl,
    roomNameOverrides,
    sampleRequests,
    selectedWindowId,
    uploadedFileName,
    uploadedImageDataUrl,
  ]);

  const clearDraft = () => {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    setActiveStep("Home");
    setSelectedWindowId("window-front");
    setConfiguration(mockProject.rooms[0].windows[0].configuration!);
    setUploadedImageDataUrl(null);
    setUploadedFileName("");
    setAnalysisResult(null);
    setAnalysisStatus("idle");
    setAnalysisError("");
    setRenderedImageDataUrl(null);
    setRenderStatus("idle");
    setRenderError("");
    setConfigurationOverrides({});
    setPaymentMethod("ideal");
    setOrderReference("");
    setDraftOrder(null);
    setCheckoutDetails(emptyCheckoutDetails);
    setMeasurementOverrides({});
    setRoomNameOverrides({});
    setSampleRequests([]);
    setCustomWindows([]);
  };

  const handleMeasurementSave = (windowId: string, measurement: Measurement) => {
    setMeasurementOverrides((current) => ({
      ...current,
      [windowId]: measurement,
    }));
  };

  const handleApplyConfigurationToAll = () => {
    const nextOverrides = allWindows.reduce<Record<string, BlindConfiguration>>((overrides, window) => {
      if (!window.measurement) {
        return overrides;
      }

      overrides[window.id] = {
        ...configuration,
        id: `${configuration.id}-${window.id}`,
      };
      return overrides;
    }, {});

    setConfigurationOverrides(nextOverrides);
  };

  const handleRoomRename = (roomId: string, currentName: string) => {
    const nextName = window.prompt("Nieuwe ruimtenaam", roomNameOverrides[roomId] ?? currentName)?.trim();
    if (!nextName) {
      return;
    }

    setRoomNameOverrides((current) => ({
      ...current,
      [roomId]: nextName,
    }));
  };

  const handleSampleRequest = (item: CheckoutCartItem) => {
    if (!item.catalogProductId || !item.catalogProductName) {
      return;
    }

    const catalogProductId = item.catalogProductId;
    const catalogProductName = item.catalogProductName;

    setSampleRequests((current) => {
      const existing = current.find(
        (request) => request.windowId === item.windowId && request.catalogProductId === catalogProductId,
      );
      if (existing) {
        return current;
      }

      const colorName = item.catalogColorName ?? selectedColor?.name ?? catalogProductName.split(" ").at(-1) ?? "Gekozen kleur";
      return [
        ...current,
        {
          id: crypto.randomUUID(),
          windowId: item.windowId,
          windowName: item.windowName,
          roomName: item.roomName,
          catalogProductId,
          catalogProductName,
          colorName,
          requestedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const analyzeImageDataUrl = async (imageDataUrl: string, label: string) => {
    setAnalysisStatus("loading");
    setAnalysisError("");
    setRenderedImageDataUrl(null);
    setRenderStatus("idle");
    setRenderError("");
    setUploadedImageDataUrl(imageDataUrl);
    setUploadedFileName(label);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Analyse is mislukt.");
      }

      setAnalysisResult(payload.data);
      setAnalysisStatus("success");
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysisError(error instanceof Error ? error.message : "Analyse is mislukt.");
    }
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
        throw new Error("Upload een PNG, JPG, JPEG of WEBP foto.");
      }
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("De foto is te groot. Gebruik maximaal 12 MB.");
      }

      const imageDataUrl = await readFileAsDataUrl(file);
      await analyzeImageDataUrl(imageDataUrl, file.name);
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysisError(error instanceof Error ? error.message : "Foto kon niet worden verwerkt.");
    }
  };

  const handlePhotoBatchUpload = async (files: File[]) => {
    const validFiles = files.filter((file) => /^image\/(png|jpe?g|webp)$/i.test(file.type) && file.size <= 12 * 1024 * 1024);
    if (!validFiles.length) {
      setAnalysisStatus("error");
      setAnalysisError("Upload minimaal een PNG, JPG, JPEG of WEBP foto van maximaal 12 MB.");
      return;
    }

    try {
      const createdAt = new Date().toISOString();
      const windows = await Promise.all(
        validFiles.map(async (file, index) => {
          const dataUrl = await readFileAsDataUrl(file);
          const id = `uploaded-window-${Date.now()}-${index}`;
          return {
            id,
            roomId: "room-uploads",
            name: `Upload raam ${customWindows.length + index + 1}`,
            status: "missing-measurement" as WindowStatus,
            photos: [
              {
                id: `photo-${id}`,
                url: dataUrl,
                alt: file.name,
                capturedAt: createdAt,
              },
            ],
            notes: "Toegevoegd via foto-upload route.",
          };
        }),
      );

      setCustomWindows((current) => [...current, ...windows]);
      setSelectedWindowId(windows[0].id);
      await analyzeImageDataUrl(windows[0].photos[0].url, validFiles[0].name);
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysisError(error instanceof Error ? error.message : "Fotos konden niet worden verwerkt.");
    }
  };

  const handleLiveFrameAnalyze = (imageDataUrl: string) =>
    analyzeImageDataUrl(imageDataUrl, `Live camera frame ${new Date().toLocaleTimeString(DUTCH_LOCALE)}`);

  const handleLiveGuidance = async (
    imageDataUrl: string,
    previousInstruction: string,
    measurementStage: LiveMeasurementStage,
  ) => {
    const response = await fetch("/api/ai/live-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        previousInstruction,
        measurementStage,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Live instructie is mislukt.");
    }
    return payload.data as LiveGuideResult;
  };

  const handleRenderPreview = async () => {
    if (!uploadedImageDataUrl) {
      setRenderStatus("error");
      setRenderError("Upload eerst een raamfoto.");
      return;
    }

    setRenderStatus("loading");
    setRenderError("");

    try {
      const slat = slatWidths.find((item) => item.id === configuration.slatWidthId);
      const response = await fetch("/api/ai/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: uploadedImageDataUrl,
          config: {
            productType: productTypes.find((product) => product.id === configuration.productTypeId)?.name,
            material: selectedMaterial?.name ?? "",
            colorName: selectedColor?.name ?? "",
            colorHex: selectedColor?.hex ?? "",
          },
          state: "Geheel uitgerold",
          mounting: mountingLabel,
          extraOptions: {
            lighting: selectedLighting?.name,
            ladderTape: configuration.ladderKind === "ladder-tape",
            slatWidth: slat?.label,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Visualisatie is mislukt.");
      }

      setRenderedImageDataUrl(payload.data.imageDataUrl);
      setRenderStatus("success");
    } catch (error) {
      setRenderStatus("error");
      setRenderError(error instanceof Error ? error.message : "Visualisatie is mislukt.");
    }
  };

  return (
    <div className="app-shell">
      <StickyHeader activeStep={activeStep} onNavigate={goTo} />
      <main>
        {activeStep === "Home" && <HomeView onStart={() => goTo("Keuze")} onExplain={() => goTo("Invoer")} />}
        {activeStep === "Keuze" && <ChoiceView onChooseManual={() => goTo("Invoer")} onChooseVision={() => goTo("Invoer")} />}
        {activeStep === "Invoer" && (
          <InputView
            key={selectedWindow.id}
            analysisError={analysisError}
            analysisResult={analysisResult}
            analysisStatus={analysisStatus}
            selectedWindow={selectedWindow}
            onContinue={() => goTo("Ramencheck")}
            onLiveFrameAnalyze={handleLiveFrameAnalyze}
            onLiveGuidance={handleLiveGuidance}
            onManualMeasurementSave={handleMeasurementSave}
            onPhotoBatchUpload={handlePhotoBatchUpload}
            onPhotoUpload={handlePhotoUpload}
            uploadedFileName={uploadedFileName}
            uploadedImageDataUrl={uploadedImageDataUrl}
          />
        )}
        {activeStep === "Ramencheck" && (
          <ProjectOverview
            analysisResult={analysisResult}
            measurementOverrides={measurementOverrides}
            roomNameOverrides={roomNameOverrides}
            selectedWindowId={selectedWindowId}
            onSelectWindow={setSelectedWindowId}
            onBackToMeasure={() => goTo("Invoer")}
            onContinue={() => goTo("Configuratie")}
            onMeasurementSave={handleMeasurementSave}
            onRoomRename={handleRoomRename}
          />
        )}
        {activeStep === "Configuratie" && (
          <ConfiguratorView
            configuration={configuration}
            renderError={renderError}
            renderedImageDataUrl={renderedImageDataUrl}
            renderStatus={renderStatus}
            selectedWindow={selectedWindow}
            selectedLighting={selectedLighting?.name ?? "Bewolkt"}
            selectedMaterial={selectedMaterial?.name ?? "Materiaal"}
            uploadedImageDataUrl={uploadedImageDataUrl}
            onApplyToAll={handleApplyConfigurationToAll}
            onChange={setConfiguration}
            onRender={handleRenderPreview}
            onCheckout={() => goTo("Checkout")}
          />
        )}
        {activeStep === "Checkout" && (
          <CheckoutView
            cartItems={cartItems}
            cartTotal={cartTotal}
            checkoutDetails={checkoutDetails}
            draftOrder={draftOrder}
            orderReference={orderReference}
            paymentMethod={paymentMethod}
            onClearDraft={clearDraft}
            onCheckoutDetailsChange={setCheckoutDetails}
            onDraftOrderChange={setDraftOrder}
            onOrderReferenceChange={setOrderReference}
            onPaymentMethodChange={setPaymentMethod}
          />
        )}
        {activeStep === "Account" && (
          <AccountView
            allWindows={allWindows}
            cartItems={cartItems}
            cartTotal={cartTotal}
            draftOrder={draftOrder}
            orderReference={orderReference}
            sampleRequests={sampleRequests}
            onContinueConfig={() => goTo("Ramencheck")}
            onOrderLater={() => goTo("Checkout")}
            onSampleRequest={handleSampleRequest}
          />
        )}
      </main>
    </div>
  );
}

function StickyHeader({ activeStep, onNavigate }: { activeStep: FlowStep; onNavigate: (step: FlowStep) => void }) {
  return (
    <header className="sticky-header">
      <button className="brand" onClick={() => onNavigate("Home")} aria-label="Ga naar Windofy home">
        <Image
          className="brand-logo"
          src="/watermark.png"
          alt="Windofy"
          width={145}
          height={41}
          priority
        />
      </button>
      <nav aria-label="Processtappen">
        {flowSteps.slice(1).map((step) => (
          <button className={activeStep === step ? "nav-pill active" : "nav-pill"} key={step} onClick={() => onNavigate(step)}>
            {step}
          </button>
        ))}
      </nav>
      <button className="ghost-button" onClick={() => onNavigate("Account")}>
        <UserRound size={18} />
        Account
      </button>
      <button className="ghost-button" onClick={() => onNavigate("Checkout")}>
        <ShoppingBag size={18} />
        Cart
      </button>
    </header>
  );
}

function StepIndicator({ current }: { current: FlowStep }) {
  return (
    <div className="step-indicator" aria-label={`Huidige stap: ${current}`}>
      {flowSteps.slice(1).map((step) => (
        <span key={step} className={step === current ? "step-dot active" : "step-dot"} />
      ))}
    </div>
  );
}

function HomeView({ onStart, onExplain }: { onStart: () => void; onExplain: () => void }) {
  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            Windofy live vision
          </span>
          <h1>Meet ramen live en zie je jaloezie voordat je bestelt.</h1>
          <p>Windofy begeleidt Nederlandse klanten met live vision, gesproken meetinstructies en een realistische AI-preview per raam.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onStart}>
              Start live inmeten
              <ArrowRight size={18} />
            </button>
            <button className="secondary-button" onClick={onExplain}>Foto of maten invoeren</button>
          </div>
          <div className="hero-status-grid" aria-label="Productiestatus">
            {operationalStats.map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
        </div>
        <Hero3DWindow />
      </section>
      <section className="process-band" id="hoe-werkt-het">
        {processItems.map(({ title, body, Icon }) => (
          <article className="process-item" key={title}>
            <Icon size={22} />
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="benefit-grid">
        <FeaturePanel icon={<BadgeCheck size={22} />} title="Foutbestendig meten" body="Maten, fotos en raamstatus blijven gekoppeld per ruimte." />
        <FeaturePanel icon={<Layers3 size={22} />} title="Eigen visualisatie-engine" body="Voorbereid op WebGL, OpenCV, masking, perspectief en schaduw." />
        <FeaturePanel icon={<PanelTop size={22} />} title="Hout en aluminium" body="Materiaal, kleur, lamelbreedte en ladderopties zijn modulair beheerbaar." />
      </section>
    </>
  );
}

function Hero3DWindow() {
  return (
    <div className="hero-visual" aria-label="3D raamvisualisatie">
      <div className="room-plane">
        <div className="window-frame">
          <div className="blind-stack">
            {Array.from({ length: 11 }).map((_, index) => (
              <span key={index} style={{ transform: `translateZ(${index * 1.5}px) rotateX(-${index % 2}deg)` }} />
            ))}
          </div>
          <div className="detection-box"><span>Live mask 92%</span></div>
        </div>
        <div className="hero-card-floating top"><Camera size={17} />Spraakcoach NL</div>
        <div className="hero-card-floating bottom"><Ruler size={17} />4 raamopeningen</div>
      </div>
    </div>
  );
}

function FeaturePanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <article className="feature-panel">
      <div className="icon-chip">{icon}</div>
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}

function ChoiceView({ onChooseManual, onChooseVision }: { onChooseManual: () => void; onChooseVision: () => void }) {
  return (
    <section className="flow-section">
      <StepIndicator current="Keuze" />
      <div className="section-heading">
        <span className="eyebrow">Start configuratie</span>
        <h1>Hoe wil je jouw ramen toevoegen?</h1>
        <p>Kies de snelste route. Je kunt later altijd corrigeren, fotos vervangen of live meten opnieuw openen.</p>
      </div>
      <div className="choice-grid">
        <button className="choice-card" onClick={onChooseManual}>
          <Ruler size={28} />
          <span>Ik heb alle afmetingen al</span>
          <small>Voeg ruimtes, ramen, breedtes, hoogtes en fotos handmatig toe.</small>
          <ChevronRight size={20} />
        </button>
        <button className="choice-card highlighted" onClick={onChooseVision}>
          <Wand2 size={28} />
          <span>Meet live met AI-spraakcoach</span>
          <small>Gebruik de camera; het visionmodel geeft Nederlandse instructies terwijl je het raam in beeld brengt.</small>
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}

function InputView({
  analysisError,
  analysisResult,
  analysisStatus,
  selectedWindow,
  onContinue,
  onLiveFrameAnalyze,
  onLiveGuidance,
  onManualMeasurementSave,
  onPhotoBatchUpload,
  onPhotoUpload,
  uploadedFileName,
  uploadedImageDataUrl,
}: {
  analysisError: string;
  analysisResult: AnalysisResult | null;
  analysisStatus: PipelineStatus;
  selectedWindow: WindowOpening & { roomName: string };
  onContinue: () => void;
  onLiveFrameAnalyze: (imageDataUrl: string) => Promise<void>;
  onLiveGuidance: (
    imageDataUrl: string,
    previousInstruction: string,
    measurementStage: LiveMeasurementStage,
  ) => Promise<LiveGuideResult>;
  onManualMeasurementSave: (windowId: string, measurement: Measurement) => void;
  onPhotoBatchUpload: (files: File[]) => void;
  onPhotoUpload: (file: File) => void;
  uploadedFileName: string;
  uploadedImageDataUrl: string | null;
}) {
  const isAnalyzing = analysisStatus === "loading";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guideTimerRef = useRef<number | null>(null);
  const guideInFlightRef = useRef(false);
  const lastInstructionRef = useRef("");
  const [liveStatus, setLiveStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [liveError, setLiveError] = useState("");
  const [voiceGuideActive, setVoiceGuideActive] = useState(false);
  const [voiceGuideStatus, setVoiceGuideStatus] = useState<PipelineStatus>("idle");
  const [voiceGuideError, setVoiceGuideError] = useState("");
  const [liveInstruction, setLiveInstruction] = useState("");
  const [liveGuidanceMeta, setLiveGuidanceMeta] = useState<LiveGuidanceMeta | null>(null);
  const [measurementReady, setMeasurementReady] = useState(false);
  const [manualWidthMm, setManualWidthMm] = useState(String(selectedWindow.measurement?.widthMm ?? ""));
  const [manualHeightMm, setManualHeightMm] = useState(String(selectedWindow.measurement?.heightMm ?? ""));
  const [manualDepthMm, setManualDepthMm] = useState(String(selectedWindow.measurement?.depthMm ?? ""));
  const [manualNote, setManualNote] = useState(selectedWindow.notes ?? "Binnen het kozijn monteren, vensterbank vrijhouden.");
  const [manualMessage, setManualMessage] = useState("");
  const hasMeasurement = Boolean(selectedWindow.measurement);

  useEffect(() => {
    return () => {
      if (guideTimerRef.current) {
        window.clearInterval(guideTimerRef.current);
      }
      window.speechSynthesis?.cancel();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (liveStatus === "active" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {
        setLiveStatus("error");
        setLiveError("Camera-feed kon niet automatisch starten.");
      });
    }
  }, [liveStatus]);

  const startLiveCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setLiveStatus("error");
      setLiveError("Deze browser ondersteunt geen live camera-feed.");
      return;
    }

    setLiveStatus("starting");
    setLiveError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setLiveStatus("active");
    } catch (error) {
      setLiveStatus("error");
      setLiveError(error instanceof Error ? error.message : "Camera kon niet worden gestart.");
    }
  };

  const stopLiveCamera = () => {
    stopVoiceGuide();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLiveStatus("idle");
    setLiveGuidanceMeta(null);
    setLiveInstruction("");
    setMeasurementReady(false);
  };

  const captureLiveFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setLiveStatus("error");
      setLiveError("Camera-feed is nog niet klaar. Richt de camera op het raam en probeer opnieuw.");
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setLiveStatus("error");
      setLiveError("Live frame kon niet worden uitgelezen.");
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  };

  const speakInstruction = (instruction: string) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(instruction);
    const dutchVoice = preferredDutchVoice();
    if (dutchVoice) {
      utterance.voice = dutchVoice;
    }
    utterance.lang = dutchVoice?.lang || DUTCH_LOCALE;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const requestVoiceGuidance = async () => {
    if (guideInFlightRef.current) {
      return;
    }

    const imageDataUrl = captureLiveFrame();
    if (!imageDataUrl) {
      return;
    }

    guideInFlightRef.current = true;
    setVoiceGuideStatus("loading");
    setVoiceGuideError("");
    const measurementStage: LiveMeasurementStage = measurementReady
      ? "measurement-confirmation"
      : liveGuidanceMeta
        ? "stability-check"
        : "positioning";

    try {
      const guidance = await onLiveGuidance(imageDataUrl, lastInstructionRef.current, measurementStage);
      const instruction = guidance.instruction?.trim() || "Houd de camera stil en richt hem op het hele raam.";
      lastInstructionRef.current = instruction;
      setLiveInstruction(instruction);
      setLiveGuidanceMeta({
        language: guidance.language || DUTCH_LOCALE,
        confidence: typeof guidance.confidence === "number" ? guidance.confidence : 0,
        issue: guidance.issue || "none",
        stage: measurementStage,
      });
      setMeasurementReady(Boolean(guidance.measurementReady));
      setVoiceGuideStatus("success");
      speakInstruction(instruction);
    } catch (error) {
      setVoiceGuideStatus("error");
      setVoiceGuideError(error instanceof Error ? error.message : "Live spraakinstructie is mislukt.");
    } finally {
      guideInFlightRef.current = false;
    }
  };

  const startVoiceGuide = () => {
    setVoiceGuideActive(true);
    void requestVoiceGuidance();
    if (guideTimerRef.current) {
      window.clearInterval(guideTimerRef.current);
    }
    guideTimerRef.current = window.setInterval(() => {
      void requestVoiceGuidance();
    }, 7000);
  };

  function stopVoiceGuide() {
    setVoiceGuideActive(false);
    if (guideTimerRef.current) {
      window.clearInterval(guideTimerRef.current);
      guideTimerRef.current = null;
    }
    window.speechSynthesis?.cancel();
  }

  const analyzeLiveFrame = async () => {
    const imageDataUrl = captureLiveFrame();
    if (imageDataUrl) {
      await onLiveFrameAnalyze(imageDataUrl);
    }
  };

  const saveManualMeasurement = () => {
    const width = Number(manualWidthMm);
    const height = Number(manualHeightMm);
    const depth = Number(manualDepthMm);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) {
      setManualMessage("Vul een geldige breedte en hoogte in millimeters in.");
      return;
    }

    onManualMeasurementSave(selectedWindow.id, {
      id: selectedWindow.measurement?.id ?? `measure-${selectedWindow.id}`,
      widthMm: Math.round(width),
      heightMm: Math.round(height),
      depthMm: Number.isFinite(depth) && depth > 0 ? Math.round(depth) : undefined,
      source: "manual",
      confidence: 0.98,
    });
    setManualMessage("Handmatige afmetingen opgeslagen voor dit raam.");
  };

  return (
    <section className="flow-section split-flow">
      <div>
        <StepIndicator current="Invoer" />
        <div className="section-heading compact">
          <span className="eyebrow">Live Vision AI</span>
          <h1>Meet live met camera, visionmodel en Nederlandse spraak.</h1>
          <p>Start de camera, laat de AI-spraakcoach meekijken en analyseer een live frame zodra het raam stabiel in beeld staat.</p>
        </div>
        <div className="vision-panel">
          {liveStatus === "active" && (
            <div className="live-meter-panel">
              <div>
                <strong>{voiceGuideActive ? "AI spraakcoach actief" : "Live camera actief"}</strong>
                <span>
                  {liveInstruction ||
                    "Start de spraakcoach voor live instructies op basis van wat het visionmodel ziet."}
                </span>
              </div>
              <button className="secondary-button" disabled={isAnalyzing} onClick={voiceGuideActive ? stopVoiceGuide : startVoiceGuide}>
                <Sparkles size={18} />
                {voiceGuideActive ? "Spraakcoach stoppen" : "AI spraakcoach starten"}
              </button>
              <button className="secondary-button" disabled={!liveInstruction || isAnalyzing} onClick={() => speakInstruction(liveInstruction)}>
                <Volume2 size={18} />
                Herhaal instructie
              </button>
              <button className="secondary-button" disabled={isAnalyzing || voiceGuideStatus === "loading"} onClick={analyzeLiveFrame}>
                <Wand2 size={18} />
                Analyseer live frame
              </button>
              {liveGuidanceMeta && (
                <div className="live-guidance-meta" aria-label="Live AI meetstatus">
                  <span>Fase <strong>{measurementStageLabels[liveGuidanceMeta.stage]}</strong></span>
                  <span>Taal <strong>{liveGuidanceMeta.language}</strong></span>
                  <span>Zekerheid <strong>{formatConfidence(liveGuidanceMeta.confidence)}</strong></span>
                  <span>Status <strong>{guidanceIssueLabels[liveGuidanceMeta.issue] ?? liveGuidanceMeta.issue}</strong></span>
                </div>
              )}
            </div>
          )}
          <div className={liveStatus === "active" ? "camera-frame has-live" : uploadedImageDataUrl ? "camera-frame has-photo" : "camera-frame"}>
            {liveStatus === "active" ? (
              <div
                className="live-camera-stage"
                style={analysisResult?.imageSize ? { aspectRatio: `${analysisResult.imageSize.w} / ${analysisResult.imageSize.h}` } : undefined}
              >
                <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera-feed voor AI inmeten" />
                {analysisStatus === "success" && analysisResult?.imageSize && (
                  <DetectionOverlay
                    boxes={detectionBoxes(analysisResult)}
                    imageSize={analysisResult.imageSize}
                  />
                )}
                <div className="live-target-overlay">
                  <span>Positioneer raam binnen kader</span>
                </div>
              </div>
            ) : uploadedImageDataUrl ? (
              <div
                className="analysis-image-stage"
                style={analysisResult?.imageSize ? { aspectRatio: `${analysisResult.imageSize.w} / ${analysisResult.imageSize.h}` } : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={uploadedImageDataUrl} alt={uploadedFileName || "Geuploade raamfoto"} />
                {analysisStatus === "success" && analysisResult?.imageSize && (
                  <DetectionOverlay
                    boxes={detectionBoxes(analysisResult)}
                    imageSize={analysisResult.imageSize}
                  />
                )}
              </div>
            ) : (
              <>
                <div className="scan-line" />
                <div className="scan-target"><span>Wacht op foto</span></div>
              </>
            )}
          </div>
          <PipelineNotice
            error={analysisError}
            result={analysisResult}
            status={analysisStatus}
          />
          {liveStatus === "error" && liveError && <div className="pipeline-notice error">{liveError}</div>}
          {voiceGuideStatus === "loading" && <div className="pipeline-notice active">Visionmodel kijkt mee en maakt een gesproken meetinstructie...</div>}
          {voiceGuideStatus === "error" && voiceGuideError && <div className="pipeline-notice error">{voiceGuideError}</div>}
          {voiceGuideStatus === "success" && liveInstruction && (
            <div className={measurementReady ? "pipeline-notice success" : "pipeline-notice active"}>
              <strong>{measurementReady ? "Frame klaar voor meten" : "Gesproken instructie"}</strong>
              <span>{liveInstruction}</span>
            </div>
          )}
          <div className="vision-actions">
            <button className="secondary-button" disabled={isAnalyzing || liveStatus === "starting"} onClick={liveStatus === "active" ? stopLiveCamera : startLiveCamera}>
              <Ruler size={18} />
              {liveStatus === "active" ? "Live camera stoppen" : liveStatus === "starting" ? "Camera start..." : "Live meten starten"}
            </button>
            <label className="secondary-button file-upload">
              <Camera size={18} />
              {uploadedImageDataUrl ? "Foto vervangen" : "Foto toevoegen"}
              <input
                accept="image/png,image/jpeg,image/webp"
                disabled={isAnalyzing}
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onPhotoUpload(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <label className="secondary-button file-upload">
              <Layers3 size={18} />
              Ramen uploaden
              <input
                accept="image/png,image/jpeg,image/webp"
                disabled={isAnalyzing}
                multiple
                type="file"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length) {
                    onPhotoBatchUpload(files);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button className="primary-button" disabled={isAnalyzing || (!uploadedImageDataUrl && !hasMeasurement)} onClick={onContinue}>
              {isAnalyzing ? "AI analyseert..." : "Ramen controleren"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="manual-form">
        <h2>Handmatige invoer</h2>
        <label>Ruimte<input value={selectedWindow.roomName} readOnly /></label>
        <label>Raamnaam<input value={selectedWindow.name} readOnly /></label>
        <div className="input-row">
          <label>Breedte<input inputMode="numeric" value={manualWidthMm} onChange={(event) => setManualWidthMm(event.target.value)} placeholder="Breedte in mm" /></label>
          <label>Hoogte<input inputMode="numeric" value={manualHeightMm} onChange={(event) => setManualHeightMm(event.target.value)} placeholder="Hoogte in mm" /></label>
        </div>
        <label>Diepte dagmaat<input inputMode="numeric" value={manualDepthMm} onChange={(event) => setManualDepthMm(event.target.value)} placeholder="Optioneel, in mm" /></label>
        <label>Notitie<textarea value={manualNote} onChange={(event) => setManualNote(event.target.value)} /></label>
        {manualMessage && <div className={manualMessage.startsWith("Handmatige") ? "pipeline-notice success" : "pipeline-notice error"}>{manualMessage}</div>}
        <button className="primary-button wide" onClick={saveManualMeasurement}>Afmetingen opslaan<Save size={18} /></button>
      </div>
    </section>
  );
}

function DetectionOverlay({
  boxes,
  imageSize,
}: {
  boxes: WindowDetectionBox[];
  imageSize: { w: number; h: number };
}) {
  if (!boxes.length || imageSize.w <= 0 || imageSize.h <= 0) {
    return null;
  }

  const pct = (value: number, total: number) => `${Math.max(0, Math.min(100, (value / total) * 100))}%`;

  return (
    <div className="detection-overlay" aria-label={`${boxes.length} raamopeningen gedetecteerd`}>
      {boxes.map((box, index) => (
        <span
          className="detected-opening"
          key={`${box.x}-${box.y}-${box.w}-${box.h}-${index}`}
          style={{
            left: pct(box.x, imageSize.w),
            top: pct(box.y, imageSize.h),
            width: pct(box.w, imageSize.w),
            height: pct(box.h, imageSize.h),
          }}
        >
          <strong>Raam {index + 1}</strong>
        </span>
      ))}
    </div>
  );
}

function PipelineNotice({
  error,
  result,
  status,
}: {
  error: string;
  result: AnalysisResult | null;
  status: PipelineStatus;
}) {
  if (status === "idle") {
    return <div className="pipeline-notice muted">Upload een foto om de AI-pipeline te starten.</div>;
  }
  if (status === "loading") {
    return <div className="pipeline-notice active">AI analyseert raam, stijl, kleuren en licht...</div>;
  }
  if (status === "error") {
    return <div className="pipeline-notice error">{error}</div>;
  }

  return (
    <div className="pipeline-notice success">
      <strong>{result?.style || "Analyse gereed"}</strong>
      <span>{result?.roomMood || result?.lightingConditions || "Raamfoto is verwerkt."}</span>
      {result?.windowCheck?.detectedWindowCount && (
        <span>{result.windowCheck.detectedWindowCount} raamopeningen gedetecteerd</span>
      )}
      {result?.windowCheck?.recommendation && <span>Montageadvies: {result.windowCheck.recommendation}</span>}
    </div>
  );
}

function ProjectOverview({
  analysisResult,
  measurementOverrides,
  roomNameOverrides,
  selectedWindowId,
  onSelectWindow,
  onBackToMeasure,
  onContinue,
  onMeasurementSave,
  onRoomRename,
}: {
  analysisResult: AnalysisResult | null;
  measurementOverrides: Record<string, Measurement>;
  roomNameOverrides: Record<string, string>;
  selectedWindowId: string;
  onSelectWindow: (id: string) => void;
  onBackToMeasure: () => void;
  onContinue: () => void;
  onMeasurementSave: (windowId: string, measurement: Measurement) => void;
  onRoomRename: (roomId: string, currentName: string) => void;
}) {
  const selectedProjectWindow = mockProject.rooms
    .flatMap((room) => room.windows.map((window) => ({ ...window, roomName: roomNameOverrides[room.id] ?? room.name })))
    .find((window) => window.id === selectedWindowId);
  const selectedMeasurement = selectedProjectWindow
    ? measurementOverrides[selectedProjectWindow.id] ?? selectedProjectWindow.measurement
    : undefined;

  return (
    <section className="flow-section">
      <StepIndicator current="Ramencheck" />
      <div className="section-heading">
        <span className="eyebrow">Projectoverzicht</span>
        <h1>Controleer je ramen voordat je configureert.</h1>
        <p>Alle ruimtes, afmetingen, fotos en waarschuwingen blijven zichtbaar voordat er iets naar de winkelwagen gaat.</p>
      </div>
      {analysisResult && (
        <div className="analysis-summary">
          <span><strong>Stijl</strong>{analysisResult.style || "-"}</span>
          <span><strong>Sfeer</strong>{analysisResult.roomMood || "-"}</span>
          <span><strong>Ramen</strong>{analysisResult.windowCheck?.detectedWindowCount || analysisResult.windowOpenings?.length || "-"}</span>
          <span><strong>Montage</strong>{analysisResult.windowCheck?.recommendation || "-"}</span>
          <span><strong>Mask confidence</strong>{Math.round((analysisResult.windowBounds?.confidence ?? 0) * 100)}%</span>
        </div>
      )}
      <div className="room-grid">
        {mockProject.rooms.map((room) => {
          const roomName = roomNameOverrides[room.id] ?? room.name;
          return (
            <article className="room-card" key={room.id}>
              <div className="room-card-header">
                <Home size={19} />
                <h2>{roomName}</h2>
                <button className="icon-button" aria-label={`${roomName} hernoemen`} onClick={() => onRoomRename(room.id, roomName)}><Settings2 size={17} /></button>
              </div>
              <div className="window-list">
                {room.windows.map((window) => (
                  <WindowSummaryButton
                    key={window.id}
                    isSelected={selectedWindowId === window.id}
                    measurement={measurementOverrides[window.id] ?? window.measurement}
                    onSelect={() => onSelectWindow(window.id)}
                    status={window.status}
                    windowName={window.name}
                    hasPhoto={Boolean(window.photos.length)}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {selectedProjectWindow && (
        <MeasurementEditor
          key={selectedProjectWindow.id}
          measurement={selectedMeasurement}
          roomName={selectedProjectWindow.roomName}
          windowId={selectedProjectWindow.id}
          windowName={selectedProjectWindow.name}
          onSave={onMeasurementSave}
        />
      )}
      <div className="section-actions">
        <button className="secondary-button" onClick={onBackToMeasure}><Wand2 size={18} />Terug naar live meten</button>
        <button className="primary-button" onClick={onContinue}>Doorgaan naar configuratie<ArrowRight size={18} /></button>
      </div>
    </section>
  );
}

function WindowSummaryButton({
  hasPhoto,
  isSelected,
  measurement,
  onSelect,
  status,
  windowName,
}: {
  hasPhoto: boolean;
  isSelected: boolean;
  measurement?: Measurement;
  onSelect: () => void;
  status: WindowStatus;
  windowName: string;
}) {
  const resolvedStatus: WindowStatus = measurement ? (status === "missing-measurement" ? "needs-review" : status) : status;

  return (
    <button
      className={isSelected ? "window-card selected" : "window-card"}
      onClick={onSelect}
    >
      <StatusBadge status={resolvedStatus} />
      <span>{windowName}</span>
      <small>{measurement ? `${measurement.widthMm} x ${measurement.heightMm} mm` : "Nog meten"}</small>
      <small>{hasPhoto ? "Foto gekoppeld" : "Foto ontbreekt"}</small>
    </button>
  );
}

function MeasurementEditor({
  measurement,
  roomName,
  windowId,
  windowName,
  onSave,
}: {
  measurement?: Measurement;
  roomName: string;
  windowId: string;
  windowName: string;
  onSave: (windowId: string, measurement: Measurement) => void;
}) {
  const [widthMm, setWidthMm] = useState(String(measurement?.widthMm ?? ""));
  const [heightMm, setHeightMm] = useState(String(measurement?.heightMm ?? ""));
  const [depthMm, setDepthMm] = useState(String(measurement?.depthMm ?? ""));
  const [message, setMessage] = useState("");

  const saveMeasurement = () => {
    const width = Number(widthMm);
    const height = Number(heightMm);
    const depth = Number(depthMm);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) {
      setMessage("Vul een geldige breedte en hoogte in millimeters in.");
      return;
    }

    onSave(windowId, {
      id: measurement?.id ?? `measure-${windowId}`,
      widthMm: Math.round(width),
      heightMm: Math.round(height),
      depthMm: Number.isFinite(depth) && depth > 0 ? Math.round(depth) : undefined,
      source: "manual",
      confidence: 0.98,
    });
    setMessage("Afmetingen opgeslagen en verwerkt in configuratie en checkout.");
  };

  return (
    <section className="measurement-editor">
      <div>
        <span className="eyebrow">Meetgegevens</span>
        <h2>{roomName} - {windowName}</h2>
      </div>
      <div className="input-row">
        <label>Breedte<input inputMode="numeric" value={widthMm} onChange={(event) => setWidthMm(event.target.value)} placeholder="Breedte in mm" /></label>
        <label>Hoogte<input inputMode="numeric" value={heightMm} onChange={(event) => setHeightMm(event.target.value)} placeholder="Hoogte in mm" /></label>
      </div>
      <label>Diepte dagmaat<input inputMode="numeric" value={depthMm} onChange={(event) => setDepthMm(event.target.value)} placeholder="Optioneel, in mm" /></label>
      {message && <div className={message.startsWith("Afmetingen") ? "pipeline-notice success" : "pipeline-notice error"}>{message}</div>}
      <button className="primary-button wide" onClick={saveMeasurement}>Afmetingen opslaan<Save size={18} /></button>
    </section>
  );
}

function StatusBadge({ status }: { status: WindowStatus }) {
  const isComplete = status === "complete";
  return (
    <span className={isComplete ? "status-badge complete" : "status-badge warning"}>
      {isComplete ? <Check size={14} /> : <CircleAlert size={14} />}
      {statusLabels[status]}
    </span>
  );
}

function ConfiguratorView({
  configuration,
  renderError,
  renderedImageDataUrl,
  renderStatus,
  selectedWindow,
  selectedLighting,
  selectedMaterial,
  uploadedImageDataUrl,
  onApplyToAll,
  onChange,
  onCheckout,
  onRender,
}: {
  configuration: BlindConfiguration;
  renderError: string;
  renderedImageDataUrl: string | null;
  renderStatus: PipelineStatus;
  selectedWindow: WindowOpening & { roomName: string };
  selectedLighting: string;
  selectedMaterial: string;
  uploadedImageDataUrl: string | null;
  onApplyToAll: () => void;
  onChange: (configuration: BlindConfiguration) => void;
  onCheckout: () => void;
  onRender: () => void;
}) {
  const selectedProduct = productTypes.find((product) => product.id === configuration.productTypeId)!;
  const availableMaterials = materials.filter((material) => material.productTypeId === configuration.productTypeId);
  const availableColors = colorOptions.filter((color) => color.materialId === configuration.materialId);
  const selectedColor = colorOptions.find((color) => color.id === configuration.colorOptionId) ?? availableColors[0];
  const activeCatalogProduct =
    catalogProducts.find((product) => product.id === configuration.catalogProductId) ??
    catalogProducts.find((product) => product.groupId === configuration.productTypeId) ??
    catalogProducts[0];
  const activeCatalogGroupId = activeCatalogProduct.groupId;
  const visibleCatalogProducts = catalogProducts
    .filter((product) => product.groupId === activeCatalogGroupId)
    .slice(0, 15);
  const isRendering = renderStatus === "loading";
  const stageImage = renderedImageDataUrl ?? uploadedImageDataUrl;
  const hasBeforeAfter = Boolean(uploadedImageDataUrl && renderedImageDataUrl);
  const [comparisonPosition, setComparisonPosition] = useState(62);
  const [applyMessage, setApplyMessage] = useState("");
  const patchConfiguration = (patch: Partial<BlindConfiguration>) => onChange({ ...configuration, ...patch });
  const applyCurrentConfigurationToAll = () => {
    onApplyToAll();
    setApplyMessage("Configuratie toegepast op alle ramen met bekende afmetingen.");
  };

  return (
    <section className="configurator-shell">
      <div className="config-preview">
        <StepIndicator current="Configuratie" />
        <div className="preview-stage embedded-preview">
          {hasBeforeAfter ? (
            <div
              className="real-render-stage before-after-stage"
              style={{ ["--compare-position" as string]: `${comparisonPosition}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="compare-image before" src={uploadedImageDataUrl!} alt="Originele raamfoto voor vergelijking" />
              <div className="compare-after">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="compare-image after" src={renderedImageDataUrl!} alt="AI visualisatie na configuratie" />
              </div>
              <i className="compare-divider" aria-hidden="true" />
              <span>Voor / na vergelijking</span>
            </div>
          ) : stageImage ? (
            <div className="real-render-stage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stageImage} alt={renderedImageDataUrl ? "Gegenereerde raamdecoratie visualisatie" : "Originele raamfoto"} />
              <span>{renderedImageDataUrl ? "AI render" : "Originele foto"}</span>
            </div>
          ) : (
            <VisualizationCanvas color={selectedColor?.hex ?? "#C59B62"} label={selectedProduct.name} />
          )}
        </div>
        <div className="preview-meta">
          <span>{selectedWindow.roomName}</span>
          <strong>{selectedWindow.name}</strong>
          <span>{selectedWindow.measurement ? `${selectedWindow.measurement.widthMm} x ${selectedWindow.measurement.heightMm} mm` : "Maat ontbreekt"}</span>
        </div>
        <div className="preview-toolbar embedded-toolbar">
          <span className="eyebrow">Visualisatie-preview</span>
          <h2>Controleer je keuze op dezelfde raamfoto.</h2>
          <p>Render de gekozen raamdecoratie realistisch en vergelijk direct voor en na, zonder de configurator te verlaten.</p>
          <button className="primary-button wide" disabled={isRendering || !uploadedImageDataUrl} onClick={onRender}>
            {isRendering ? "Visualisatie wordt gemaakt..." : renderedImageDataUrl ? "Visualisatie opnieuw maken" : "Realistische visualisatie maken"}
            <Sparkles size={18} />
          </button>
          {renderStatus === "error" && <div className="pipeline-notice error">{renderError}</div>}
          {renderStatus === "success" && <div className="pipeline-notice success">Visualisatie is klaar.</div>}
          {!uploadedImageDataUrl && <div className="pipeline-notice muted">Upload eerst een raamfoto bij Invoer.</div>}
          <div className="before-after">
            <span>Voor</span>
            <input
              type="range"
              min="0"
              max="100"
              value={comparisonPosition}
              disabled={!hasBeforeAfter}
              aria-label="Voor na slider"
              onChange={(event) => setComparisonPosition(Number(event.target.value))}
            />
            <span>Na</span>
          </div>
          <div className="summary-list">
            <span>Materiaal</span><strong>{selectedMaterial}</strong>
            <span>Belichting</span><strong>{selectedLighting}</strong>
            <span>Bediening</span><strong>{configuration.controlSide === "left" ? "Links" : "Rechts"}</strong>
          </div>
          {applyMessage && <div className="pipeline-notice success">{applyMessage}</div>}
          <button className="secondary-button wide" onClick={applyCurrentConfigurationToAll}>Toepassen op alle ramen</button>
          <button className="primary-button wide" onClick={onCheckout}>Naar winkelwagen<ShoppingBag size={18} /></button>
        </div>
      </div>
      <aside className="configuration-panel">
        <h1>Raamdecoratie configureren</h1>
        <SelectorGroup label="Webshop catalogus">
          <div className="catalog-chip-grid">
            {catalogGroups.map((group) => (
              <button
                key={group.id}
                className={activeCatalogGroupId === group.id ? "selector active" : "selector"}
                onClick={() => {
                  const nextProduct = catalogProducts.find((product) => product.groupId === group.id);
                  if (!nextProduct) {
                    return;
                  }
                  patchConfiguration({ catalogProductId: nextProduct.id });
                }}
              >
                {group.name}
              </button>
            ))}
          </div>
        </SelectorGroup>
        <SelectorGroup label="Productkeuze">
          <div className="catalog-product-grid">
            {visibleCatalogProducts.map((product) => (
              <button
                key={product.id}
                className={configuration.catalogProductId === product.id ? "catalog-product active" : "catalog-product"}
                onClick={() => patchConfiguration({ catalogProductId: product.id })}
              >
                {product.image.status === "ready" && product.image.url ? (
                  <Image src={product.image.url} alt={product.image.alt} width={320} height={240} />
                ) : (
                  <span style={{ backgroundColor: product.colorHex }} />
                )}
                <strong>{product.name}</strong>
                <small>{formatPrice(product.basePriceCents)} + m2 prijs</small>
              </button>
            ))}
          </div>
        </SelectorGroup>
        <div className="pipeline-notice muted">
          Webshopkeuze: {activeCatalogProduct.name}. De technische render gebruikt nu nog de jaloezie-instellingen hieronder totdat alle productvisualisaties zijn uitgebreid.
        </div>
        <SelectorGroup label="Producttype">
          {productTypes.map((product) => (
            <button
              key={product.id}
              className={configuration.productTypeId === product.id ? "selector active" : "selector"}
              onClick={() =>
                patchConfiguration({
                  productTypeId: product.id,
                  materialId: materials.find((material) => material.productTypeId === product.id)!.id,
                })
              }
            >
              {product.name}
            </button>
          ))}
        </SelectorGroup>
        <SelectorGroup label="Materiaal">
          {availableMaterials.map((material) => (
            <button
              key={material.id}
              className={configuration.materialId === material.id ? "selector active" : "selector"}
              onClick={() =>
                patchConfiguration({
                  materialId: material.id,
                  colorOptionId: colorOptions.find((color) => color.materialId === material.id)!.id,
                })
              }
            >
              {material.name}
            </button>
          ))}
        </SelectorGroup>
        <SelectorGroup label="Kleur">
          {availableColors.map((color) => (
            <button
              key={color.id}
              className={configuration.colorOptionId === color.id ? "swatch active" : "swatch"}
              onClick={() => patchConfiguration({ colorOptionId: color.id })}
              aria-label={color.name}
              title={color.name}
            >
              <span style={{ backgroundColor: color.hex }} />
            </button>
          ))}
        </SelectorGroup>
        <SelectorGroup label="Lamelbreedte">
          {slatWidths
            .filter((slat) => slat.productTypeIds.includes(configuration.productTypeId))
            .map((slat) => (
              <button
                key={slat.id}
                className={configuration.slatWidthId === slat.id ? "selector active" : "selector"}
                onClick={() => patchConfiguration({ slatWidthId: slat.id })}
              >
                {slat.label}
              </button>
            ))}
        </SelectorGroup>
        <div className="two-col-controls">
          <label>
            Bediening
            <select value={configuration.controlSide} onChange={(event) => patchConfiguration({ controlSide: event.target.value as BlindConfiguration["controlSide"] })}>
              <option value="left">Links</option>
              <option value="right">Rechts</option>
            </select>
          </label>
          <label>
            Montage
            <select value={configuration.mountingMethod} onChange={(event) => patchConfiguration({ mountingMethod: event.target.value as BlindConfiguration["mountingMethod"] })}>
              <option value="inside-recess">In de dag</option>
              <option value="outside-recess">Op de dag</option>
            </select>
          </label>
        </div>
        <SelectorGroup label="Ladderoptie">
          {ladderOptions.map((option) => (
            <button
              key={option.id}
              className={configuration.ladderOptionId === option.id ? "selector active" : "selector"}
              onClick={() => patchConfiguration({ ladderOptionId: option.id, ladderKind: option.kind })}
            >
              {option.name}
            </button>
          ))}
        </SelectorGroup>
        <label className="range-control">
          Lichtdoorlaatbaarheid
          <input
            type="range"
            min="0"
            max="100"
            value={configuration.lightTransmission}
            onChange={(event) => patchConfiguration({ lightTransmission: Number(event.target.value) })}
          />
        </label>
        <SelectorGroup label="Belichting">
          {lightingModes.map((mode) => (
            <button
              key={mode.id}
              className={configuration.lightingModeId === mode.id ? "selector active" : "selector"}
              onClick={() => patchConfiguration({ lightingModeId: mode.id })}
            >
              {mode.name}
            </button>
          ))}
        </SelectorGroup>
      </aside>
    </section>
  );
}

function SelectorGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="selector-group">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function VisualizationCanvas({ color, label }: { color: string; label: string }) {
  return (
    <div className="visualization-canvas" style={{ ["--blind-color" as string]: color }}>
      <div className="canvas-toolbar"><span>Configuratie-preview</span><span>Live formaat</span></div>
      <div className="render-window">
        <div className="render-glass" />
        <div className="render-blinds">{Array.from({ length: 13 }).map((_, index) => <span key={index} />)}</div>
      </div>
      <span className="canvas-label">{label}</span>
    </div>
  );
}

function AccountView({
  allWindows,
  cartItems,
  cartTotal,
  draftOrder,
  orderReference,
  sampleRequests,
  onContinueConfig,
  onOrderLater,
  onSampleRequest,
}: {
  allWindows: Array<WindowOpening & { roomName: string }>;
  cartItems: CheckoutCartItem[];
  cartTotal: number;
  draftOrder: PreparedDraftOrder | null;
  orderReference: string;
  sampleRequests: SampleRequest[];
  onContinueConfig: () => void;
  onOrderLater: () => void;
  onSampleRequest: (item: CheckoutCartItem) => void;
}) {
  const completedWindows = allWindows.filter((window) => window.measurement && window.configuration).length;
  const reference = draftOrder?.reference ?? orderReference;

  return (
    <section className="flow-section checkout-grid">
      <div>
        <StepIndicator current="Account" />
        <div className="section-heading compact">
          <span className="eyebrow"><UserRound size={16} /> Mijn account</span>
          <h1>Je project blijft klaarstaan.</h1>
          <p>Bekijk opgeslagen ramen, configuraties, conceptbestelling en kleurstalen. Vanuit hier kun je later verder meten, aanpassen of bestellen.</p>
        </div>
        <div className="checkout-steps">
          <span><Home size={17} /> {mockProject.name}</span>
          <span><PanelTop size={17} /> {allWindows.length} ramen</span>
          <span><Check size={17} /> {completedWindows} compleet</span>
          <span><ShoppingBag size={17} /> {formatPrice(cartTotal)}</span>
        </div>
        <div className="account-list">
          {allWindows.map((window) => {
            const cartItem = cartItems.find((item) => item.windowId === window.id);
            return (
              <article className="account-window" key={window.id}>
                <div>
                  <strong>{window.name}</strong>
                  <span>{window.roomName} - {statusLabels[window.status]}</span>
                  <span>
                    {window.measurement
                      ? `${window.measurement.widthMm} x ${window.measurement.heightMm} mm`
                      : "Maat ontbreekt"}
                  </span>
                  {cartItem?.catalogProductName && <span>{cartItem.catalogProductName}</span>}
                </div>
                <div className="account-actions">
                  <button className="secondary-button" type="button" onClick={onContinueConfig}>
                    Aanpassen<Settings2 size={17} />
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!cartItem?.catalogProductId}
                    onClick={() => cartItem && onSampleRequest(cartItem)}
                  >
                    Staaltje<PackageCheck size={17} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <aside className="cart-summary">
        <h2>Later bestellen</h2>
        <div className="cart-total"><span>Projecttotaal</span><strong>{formatPrice(cartTotal)}</strong></div>
        <div className="cart-readiness">
          <span><Check size={15} /> Opgeslagen in deze browser</span>
          <span><Check size={15} /> {cartItems.length} bestelbare ramen</span>
          <span className={reference ? "" : "warning"}>
            {reference ? <Check size={15} /> : <CircleAlert size={15} />}
            {reference ? `Concept ${reference}` : "Nog geen conceptbestelling"}
          </span>
        </div>
        <button className="primary-button wide" type="button" onClick={onOrderLater}>
          Bestelling openen<ArrowRight size={18} />
        </button>
      </aside>
      <section className="admin-ready">
        <h2>Aangevraagde staaltjes</h2>
        <div>
          {sampleRequests.length ? (
            sampleRequests.map((request) => (
              <span key={request.id}>
                {request.catalogProductName}
                <strong>{request.roomName} - {request.windowName}</strong>
              </span>
            ))
          ) : (
            <span>Nog geen staaltjes<strong>Kies per raam een gevisualiseerde kleur</strong></span>
          )}
        </div>
      </section>
    </section>
  );
}

function CheckoutView({
  cartItems,
  cartTotal,
  checkoutDetails,
  draftOrder,
  orderReference,
  paymentMethod,
  onClearDraft,
  onCheckoutDetailsChange,
  onDraftOrderChange,
  onOrderReferenceChange,
  onPaymentMethodChange,
}: {
  cartItems: CheckoutCartItem[];
  cartTotal: number;
  checkoutDetails: CheckoutDetails;
  draftOrder: PreparedDraftOrder | null;
  orderReference: string;
  paymentMethod: "ideal" | "card";
  onClearDraft: () => void;
  onCheckoutDetailsChange: (value: CheckoutDetails) => void;
  onDraftOrderChange: (value: PreparedDraftOrder | null) => void;
  onOrderReferenceChange: (value: string) => void;
  onPaymentMethodChange: (value: "ideal" | "card") => void;
}) {
  const [checkoutError, setCheckoutError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSessionError, setPaymentSessionError] = useState("");
  const [paymentSessionUrl, setPaymentSessionUrl] = useState("");
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const missingMeasurements = cartItems.filter((item) => !item.measurement);
  const preparedReference = draftOrder?.reference ?? orderReference;
  const updateCheckoutField = (field: keyof CheckoutDetails, value: string) => {
    onCheckoutDetailsChange({ ...checkoutDetails, [field]: value });
    if (preparedReference) {
      onOrderReferenceChange("");
      onDraftOrderChange(null);
    }
  };
  const updatePaymentMethod = (value: "ideal" | "card") => {
    onPaymentMethodChange(value);
    if (preparedReference) {
      onOrderReferenceChange("");
      onDraftOrderChange(null);
    }
  };

  const downloadOrderSummary = () => {
    if (!draftOrder) {
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      order: draftOrder,
      customer: checkoutDetails,
      cart: {
        totalCents: cartTotal,
        currency: "EUR",
        items: cartItems.map((item) => ({
          id: item.id,
          roomName: item.roomName,
          windowName: item.windowName,
          priceCents: item.price,
          catalogProductId: item.catalogProductId,
          catalogProductName: item.catalogProductName,
          catalogColorName: item.catalogColorName,
          catalogColorHex: item.catalogColorHex,
          areaSquareMeters: item.areaSquareMeters,
          measurement: item.measurement,
          configuration: item.configuration,
        })),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draftOrder.reference}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCheckoutSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCheckoutError("");

    const normalizedDetails: CheckoutDetails = {
      name: checkoutDetails.name.trim(),
      email: checkoutDetails.email.trim(),
      postalCode: checkoutDetails.postalCode.trim().toUpperCase(),
      houseNumber: checkoutDetails.houseNumber.trim(),
      address: checkoutDetails.address.trim(),
    };
    const requiredFields: Array<keyof CheckoutDetails> = ["name", "email", "postalCode", "houseNumber"];
    const missingField = requiredFields.find((field) => !normalizedDetails[field]);

    if (missingField) {
      setCheckoutError("Vul naam, e-mail, postcode en huisnummer in om de bestelling voor te bereiden.");
      return;
    }

    if (missingMeasurements.length) {
      setCheckoutError("Controleer eerst alle raamafmetingen voordat je de betaling voorbereidt.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: normalizedDetails,
          paymentMethod,
          totalCents: cartTotal,
          items: cartItems.map((item) => ({
            id: item.id,
            roomName: item.roomName,
            windowName: item.windowName,
            price: item.price,
            catalogProductId: item.catalogProductId,
            catalogProductName: item.catalogProductName,
            catalogColorName: item.catalogColorName,
            catalogColorHex: item.catalogColorHex,
            areaSquareMeters: item.areaSquareMeters,
            measurement: item.measurement,
            configuration: item.configuration,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as DraftOrderResponse | null;

      if (!response.ok || !payload?.ok || !payload.order?.reference) {
        setCheckoutError(payload?.error ?? "Bestelling kon niet worden voorbereid. Probeer het opnieuw.");
        return;
      }

      onCheckoutDetailsChange(normalizedDetails);
      onDraftOrderChange(payload.order);
      onOrderReferenceChange(payload.order.reference);
      setPaymentSessionUrl("");
      setPaymentSessionError("");
    } catch {
      setCheckoutError("Bestelling kon niet worden voorbereid. Controleer de verbinding en probeer opnieuw.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const preparePaymentSession = async () => {
    if (!draftOrder) {
      setPaymentSessionError("Maak eerst een conceptbestelling aan voordat je de betaalpagina opent.");
      return;
    }

    setIsPreparingPayment(true);
    setPaymentSessionError("");

    try {
      const response = await fetch("/api/orders/payment-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: draftOrder.id,
          reference: draftOrder.reference,
          provider: draftOrder.paymentProvider,
          totalCents: draftOrder.totalCents,
        }),
      });
      const payload = (await response.json().catch(() => null)) as PaymentSessionResponse | null;

      if (!response.ok || !payload?.ok || !payload.session?.redirectUrl) {
        setPaymentSessionError(payload?.error ?? "Betaalsessie kon niet worden voorbereid.");
        return;
      }

      setPaymentSessionUrl(payload.session.redirectUrl);
      window.location.assign(payload.session.redirectUrl);
    } catch {
      setPaymentSessionError("Betaalsessie kon niet worden voorbereid. Controleer de verbinding en probeer opnieuw.");
    } finally {
      setIsPreparingPayment(false);
    }
  };

  return (
    <section className="flow-section checkout-grid">
      <div>
        <StepIndicator current="Checkout" />
        <div className="section-heading compact">
          <span className="eyebrow">Checkout-overzicht</span>
          <h1>Controleer alles voor betaling.</h1>
          <p>Alle eerder opgeslagen maten, configuraties en previews gaan automatisch mee naar de server-side betaalvoorbereiding.</p>
        </div>
        <div className="checkout-steps">
          {checkoutSteps.map(({ title, Icon }) => (
            <span key={title}><Icon size={17} />{title}</span>
          ))}
        </div>
        <form className="checkout-form" onSubmit={handleCheckoutSubmit}>
          <h2>Gegevens voor bestelling</h2>
          <div className="input-row">
            <label>Naam<input name="name" autoComplete="name" value={checkoutDetails.name} onChange={(event) => updateCheckoutField("name", event.target.value)} placeholder="Voor- en achternaam" /></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" value={checkoutDetails.email} onChange={(event) => updateCheckoutField("email", event.target.value)} placeholder="naam@voorbeeld.nl" /></label>
          </div>
          <div className="input-row">
            <label>Postcode<input name="postalCode" autoComplete="postal-code" value={checkoutDetails.postalCode} onChange={(event) => updateCheckoutField("postalCode", event.target.value)} placeholder="1234 AB" /></label>
            <label>Huisnummer<input name="houseNumber" autoComplete="address-line2" value={checkoutDetails.houseNumber} onChange={(event) => updateCheckoutField("houseNumber", event.target.value)} placeholder="12" /></label>
          </div>
          <label>Adresregel<input name="address" autoComplete="street-address" value={checkoutDetails.address} onChange={(event) => updateCheckoutField("address", event.target.value)} placeholder="Straatnaam en plaats" /></label>
          <div className="payment-methods" role="radiogroup" aria-label="Betaalmethode">
            <button
              className={paymentMethod === "ideal" ? "payment-method active" : "payment-method"}
              type="button"
              onClick={() => updatePaymentMethod("ideal")}
            >
              iDEAL
            </button>
            <button
              className={paymentMethod === "card" ? "payment-method active" : "payment-method"}
              type="button"
              onClick={() => updatePaymentMethod("card")}
            >
              Kaart
            </button>
          </div>
          <label className="terms-check">
            <input name="terms" type="checkbox" required />
            <span>Ik bevestig dat de raamafmetingen en configuratie gecontroleerd zijn.</span>
          </label>
          {checkoutError && <div className="pipeline-notice error">{checkoutError}</div>}
          {preparedReference && (
            <div className="pipeline-notice success">
              <strong>Bestelling voorbereid</strong>
              <span>Referentie {preparedReference}. {checkoutDetails.name} ontvangt de betaalinstructie via {checkoutDetails.email}. Betaalmethode: {paymentMethod === "ideal" ? "iDEAL" : "kaart"}.</span>
              {draftOrder && (
                <span>
                  Status: betaling klaarzetten. Provider: {draftOrder.paymentProvider === "mollie" ? "Mollie" : "Stripe"}.
                  Orderregels: {draftOrder.itemCount}. Totaal: {formatPrice(draftOrder.totalCents)}.
                </span>
              )}
            </div>
          )}
          {paymentSessionError && <div className="pipeline-notice error">{paymentSessionError}</div>}
          {paymentSessionUrl && <div className="pipeline-notice success">Betaalsessie klaar. Je wordt doorgestuurd.</div>}
          <div className="checkout-actions">
            <button className="secondary-button" type="button" onClick={onClearDraft}>Nieuwe configuratie</button>
            <button className="secondary-button" type="button" disabled={!draftOrder} onClick={downloadOrderSummary}>
              Order downloaden<Download size={18} />
            </button>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Order wordt voorbereid..." : "Betaling voorbereiden"}<CreditCard size={18} />
            </button>
          </div>
          <button className="primary-button wide" type="button" disabled={!draftOrder || isPreparingPayment} onClick={preparePaymentSession}>
            {isPreparingPayment ? "Betaalsessie openen..." : "Betaalpagina openen"}<ArrowRight size={18} />
          </button>
        </form>
      </div>
      <aside className="cart-summary">
        <h2>Winkelwagen</h2>
        {cartItems.map((item) => (
          <div className="cart-line" key={item.id}>
            <div>
              <strong>{item.windowName}</strong>
              <span>{item.roomName} - {item.measurement ? `${item.measurement.widthMm} x ${item.measurement.heightMm} mm` : "maat ontbreekt"}</span>
              {item.catalogProductName && (
                <span>
                  {item.catalogProductName}
                  {typeof item.areaSquareMeters === "number" ? ` - ${item.areaSquareMeters.toFixed(2)} m2` : ""}
                </span>
              )}
            </div>
            <strong>{formatPrice(item.price)}</strong>
          </div>
        ))}
        <div className="cart-total"><span>Totaal</span><strong>{formatPrice(cartTotal)}</strong></div>
        <div className="cart-readiness">
          <span><Check size={15} /> Configuratie gekoppeld</span>
          <span><Check size={15} /> Nederlandse live-guidance actief</span>
          <span className={missingMeasurements.length ? "warning" : ""}>
            {missingMeasurements.length ? <CircleAlert size={15} /> : <Check size={15} />}
            {missingMeasurements.length ? `${missingMeasurements.length} maat ontbreekt` : "Maten gereed"}
          </span>
        </div>
      </aside>
      <section className="admin-ready">
        <h2>Beschikbare functies</h2>
        <div>
          {builderBlocks.map((block) => {
            const entitlement = featureEntitlements.find((item) => item.builderBlockId === block.id);
            return <span key={block.id}>{block.name}<strong>{entitlement?.enabled ? "Actief" : "Niet actief"}</strong></span>;
          })}
        </div>
      </section>
    </section>
  );
}
