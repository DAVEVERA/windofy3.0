import type {
  BlindConfiguration,
  Measurement,
  Order,
  Project,
  VisualizationPreview,
  WindowPhoto,
} from "@/domain/types";

export interface LiveVisionMeasurementRequest {
  projectId: string;
  roomId: string;
  windowId: string;
  imageFrame?: Blob;
}

export interface LiveVisionMeasurementResult {
  measurement: Measurement;
  warnings: string[];
  detectionConfidence: number;
}

export interface AiMeasurementService {
  detectWindow(request: LiveVisionMeasurementRequest): Promise<LiveVisionMeasurementResult>;
  validateMeasurement(measurement: Measurement, photo?: WindowPhoto): Promise<string[]>;
}

export interface RenderRequest {
  windowId: string;
  photo: WindowPhoto;
  measurement: Measurement;
  configuration: BlindConfiguration;
}

export interface RenderEngine {
  createPreview(request: RenderRequest): Promise<VisualizationPreview>;
  estimateMask(photo: WindowPhoto): Promise<{ confidence: number; maskUrl?: string }>;
}

export interface ProjectRepository {
  getProject(projectId: string): Promise<Project>;
  saveProject(project: Project): Promise<Project>;
}

export interface CheckoutProvider {
  createDraftOrder(project: Project): Promise<Order>;
  createPaymentSession(orderId: string, provider: "mollie" | "stripe"): Promise<{ redirectUrl: string }>;
}

export const localAiServiceRoadmap = {
  imageProcessing: ["OpenCV", "PyTorch", "TensorRT-ready inference"],
  llmRuntime: ["Ollama-ready", "vLLM-ready"],
  deploymentTarget: "Local GPU workstation or NVIDIA DGX Spark",
  privacyPolicy: "Prefer local inference for live camera frames and room photos.",
};
