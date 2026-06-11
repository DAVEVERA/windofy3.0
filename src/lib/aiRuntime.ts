import { AiBackendError, callAiService, isAiServiceConfigured } from "@/lib/aiBackend";
import { callOpenAiVisionBackend, isOpenAiVisionConfigured } from "@/lib/openAiVisionBackend";

type AiPath = "/api/analyze" | "/api/live-guide" | "/api/render";

export async function callVisionRuntime<T>(
  path: AiPath,
  payload: Record<string, unknown>,
  timeoutMs?: number,
): Promise<T> {
  let serviceError: unknown = null;

  if (isAiServiceConfigured() || process.env.NODE_ENV !== "production") {
    try {
      return await callAiService<T>(path, payload, timeoutMs);
    } catch (error) {
      serviceError = error;
    }
  }

  if (isOpenAiVisionConfigured()) {
    return callOpenAiVisionBackend<T>(path, payload, timeoutMs);
  }

  if (serviceError) {
    throw serviceError;
  }

  throw new AiBackendError("Geen AI backend geconfigureerd. Stel AI_SERVICE_URL of OPENAI_API_KEY in.", 503);
}
