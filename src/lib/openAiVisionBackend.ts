import { AiBackendError } from "@/lib/aiBackend";

type AiPath = "/api/analyze" | "/api/live-guide" | "/api/render";

type OpenAiResponse = {
  output_text?: unknown;
  output?: Array<{
    type?: unknown;
    result?: unknown;
    content?: Array<{
      type?: unknown;
      text?: unknown;
    }>;
  }>;
  error?: {
    message?: unknown;
  };
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_VISION_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_RENDER_MODEL = "gpt-5.5";

function openAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function isOpenAiVisionConfigured() {
  return Boolean(openAiApiKey());
}

function openAiVisionModel() {
  return process.env.OPENAI_VISION_MODEL?.trim() || DEFAULT_OPENAI_VISION_MODEL;
}

function openAiRenderModel() {
  return process.env.OPENAI_RENDER_MODEL?.trim() || DEFAULT_OPENAI_RENDER_MODEL;
}

function extractOutputText(payload: OpenAiResponse) {
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

function extractGeneratedImage(payload: OpenAiResponse) {
  for (const output of payload.output ?? []) {
    if (output.type === "image_generation_call" && typeof output.result === "string") {
      return `data:image/png;base64,${output.result}`;
    }
  }
  return "";
}

function parseJsonObject(raw: string, fallbackMessage: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Return a deterministic error below.
  }
  throw new AiBackendError(`${fallbackMessage} OpenAI gaf geen geldig JSON terug.`, 502);
}

async function postOpenAiResponses(body: Record<string, unknown>, timeoutMs: number) {
  const apiKey = openAiApiKey();
  if (!apiKey) {
    throw new AiBackendError("OPENAI_API_KEY ontbreekt voor de serverless vision fallback.", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await response.json().catch(() => null)) as OpenAiResponse | null;
    if (!response.ok || !json) {
      const message = typeof json?.error?.message === "string" ? json.error.message : "OpenAI vision request is mislukt.";
      throw new AiBackendError(message, response.ok ? 502 : response.status);
    }
    return json;
  } catch (error) {
    if (error instanceof AiBackendError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiBackendError("OpenAI vision request duurde te lang.", 504);
    }
    throw new AiBackendError("OpenAI vision fallback is niet bereikbaar.", 503);
  } finally {
    clearTimeout(timer);
  }
}

function analyzePrompt() {
  return `
Analyseer deze interieurfoto voor Windofy raamdecoratie.
Retourneer strikt JSON zonder markdown.

Belangrijk:
- Tel fysieke raamopeningen apart. Vier losse verticale kozijnopeningen naast elkaar zijn detectedWindowCount=4.
- Verwar boven/onderpanelen niet met losse ramen.
- Geef onzekerheid expliciet; verzin geen millimetermaat.
- Adviseer generieke raamdecoratie-richtingen die later aan de catalogus gekoppeld worden.

JSON schema:
{
  "qualityFailed": false,
  "qualityFeedback": "",
  "style": "stijl",
  "roomMood": "korte sfeer",
  "lightingConditions": "lichtanalyse in 1 zin",
  "colour_palette": [
    {"hex_code": "#AABBCC", "color_family": "kleurfamilie", "design_role": "rol"}
  ],
  "windowCheck": {
    "recommendation": "in de dag of op de dag",
    "reasoning": "concrete reden",
    "windowType": "type raam",
    "detectedWindowCount": 1,
    "specialConsiderations": "grepen, vensterbank, diepte, obstakels"
  },
  "windowOpenings": [],
  "materialSuggestions": ["hout", "aluminium", "textiel"],
  "suggestions": [
    {"productType": "houten jaloezie", "material": "hout", "colorName": "warm naturel", "colorHex": "#B28A5A", "suitabilityScore": 0.82, "reasoning": "waarom passend"}
  ]
}
`.trim();
}

function liveGuidancePrompt(measurementStage: string, previousInstruction?: string) {
  return `
Je bent de Nederlandse live vision meetcoach van Windofy.
Inspecteer exact dit cameraframe en geef een korte spraakinstructie voor inmeten.

Meetfase: ${measurementStage || "positioning"}
Vorige instructie: ${previousInstruction || "-"}

Regels:
- Antwoord strikt als JSON zonder markdown.
- De instructie is natuurlijk Nederlands, maximaal 18 woorden.
- Gebruik alleen wat zichtbaar is.
- Claim nooit millimeter-accurate maten uit een enkel frame.
- Vraag om rechter kader, afstand, licht, scherpte of stilhouden wanneer nodig.

JSON schema:
{
  "instruction": "korte Nederlandse spraakinstructie",
  "language": "nl-NL",
  "measurementReady": false,
  "confidence": 0.0,
  "issue": "none | too_dark | too_blurry | window_cut_off | angled | too_far | too_close | reflection | no_window"
}
`.trim();
}

function renderPrompt(payload: Record<string, unknown>) {
  return `
Maak een realistische Windofy visualisatie op basis van de geuploade kamerfoto.
Plaats alleen raamdecoratie in het raamgebied en behoud kamer, muren, vloer, licht en perspectief.

Configuratie:
${JSON.stringify(payload, null, 2)}

Hard constraints:
- Geen tekst, logo's, watermerken of extra objecten.
- Respecteer gemeten raamverhouding en montage.
- Toon productconstructie correct: rails, lamellen/stof, koorden/bediening waar relevant.
- Kleur en materiaal moeten overeenkomen met de configuratie.
`.trim();
}

export async function callOpenAiVisionBackend<T>(
  path: AiPath,
  payload: Record<string, unknown>,
  timeoutMs = 120_000,
): Promise<T> {
  if (path === "/api/analyze") {
    const response = await postOpenAiResponses(
      {
        model: openAiVisionModel(),
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: analyzePrompt() },
              { type: "input_image", image_url: payload.imageDataUrl, detail: "auto" },
            ],
          },
        ],
      },
      timeoutMs,
    );
    return parseJsonObject(extractOutputText(response), "Analyse is mislukt.") as T;
  }

  if (path === "/api/live-guide") {
    const response = await postOpenAiResponses(
      {
        model: openAiVisionModel(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: liveGuidancePrompt(
                  typeof payload.measurementStage === "string" ? payload.measurementStage : "positioning",
                  typeof payload.previousInstruction === "string" ? payload.previousInstruction : undefined,
                ),
              },
              { type: "input_image", image_url: payload.imageDataUrl, detail: "auto" },
            ],
          },
        ],
      },
      timeoutMs,
    );
    return parseJsonObject(extractOutputText(response), "Live instructie is mislukt.") as T;
  }

  const response = await postOpenAiResponses(
    {
      model: openAiRenderModel(),
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: renderPrompt(payload) },
            { type: "input_image", image_url: payload.imageDataUrl, detail: "auto" },
          ],
        },
      ],
      tools: [{ type: "image_generation" }],
    },
    timeoutMs,
  );
  const imageDataUrl = extractGeneratedImage(response);
  if (!imageDataUrl) {
    throw new AiBackendError("OpenAI render gaf geen afbeelding terug.", 502);
  }
  return { imageDataUrl } as T;
}

export function getOpenAiVisionHealth() {
  return {
    ok: isOpenAiVisionConfigured(),
    provider: "openai-responses",
    configured: isOpenAiVisionConfigured(),
    visionModel: openAiVisionModel(),
    renderModel: openAiRenderModel(),
    liveGuidanceLanguage: "nl-NL",
  };
}
