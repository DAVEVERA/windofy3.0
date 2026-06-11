const DEFAULT_AI_SERVICE_URL = "http://127.0.0.1:5000";

export class AiBackendError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AiBackendError";
    this.status = status;
  }
}

export function isSupportedImageDataUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value);
}

export function assertImageDataUrl(value: unknown) {
  if (!isSupportedImageDataUrl(value)) {
    throw new AiBackendError("Upload een geldige PNG, JPG, JPEG of WEBP afbeelding.", 400);
  }
  if (value.length > 16 * 1024 * 1024) {
    throw new AiBackendError("Afbeelding is te groot. Gebruik maximaal ongeveer 12 MB.", 413);
  }
}

function aiServiceUrl(path: "/api/analyze" | "/api/live-guide" | "/api/render") {
  const base = process.env.AI_SERVICE_URL?.trim() || DEFAULT_AI_SERVICE_URL;
  return `${base.replace(/\/$/, "")}${path}`;
}

function aiServiceBaseUrl() {
  return (process.env.AI_SERVICE_URL?.trim() || DEFAULT_AI_SERVICE_URL).replace(/\/$/, "");
}

export function isAiServiceConfigured() {
  return Boolean(process.env.AI_SERVICE_URL?.trim());
}

function normalizeRemoteError(payload: unknown) {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (detail && typeof detail === "object" && "error" in detail) {
      const error = (detail as { error?: unknown }).error;
      if (typeof error === "string") {
        return error;
      }
    }
  }
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") {
      return error;
    }
  }
  return "AI service is mislukt.";
}

export async function callAiService<T>(
  path: "/api/analyze" | "/api/live-guide" | "/api/render",
  payload: Record<string, unknown>,
  timeoutMs = 600_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(aiServiceUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      throw new AiBackendError(normalizeRemoteError(json), response.ok ? 502 : response.status);
    }

    return json.data as T;
  } catch (error) {
    if (error instanceof AiBackendError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiBackendError("AI verwerking duurde te lang. Probeer een kleinere foto.", 504);
    }
    throw new AiBackendError("AI service is niet bereikbaar. Start de AI service en probeer opnieuw.", 503);
  } finally {
    clearTimeout(timer);
  }
}

export async function getAiServiceHealth(timeoutMs = 5_000) {
  if (!isAiServiceConfigured() && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      status: 503,
      configured: false,
      data: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${aiServiceBaseUrl()}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    const json = await response.json().catch(() => null);
    return {
      ok: response.ok && Boolean(json?.ok),
      status: response.status,
      data: json,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      data: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function errorResponse(error: unknown) {
  const status = error instanceof AiBackendError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Onbekende serverfout.";
  return Response.json({ ok: false, error: message }, { status });
}
