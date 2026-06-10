# Windofy AI configurator

Windofy is a Next.js storefront/configurator with a separate Python AI service for:

- room/window/style analysis through Anthropic vision models,
- SAM2 window segmentation,
- realistic window-decoration rendering through Gemini image models.

## Local setup

1. Install Node dependencies:

```powershell
npm install
```

2. Create and prepare Python environment:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

3. Place the SAM2 checkpoint at:

```text
models/sam2.1_hiera_large.pt
```

4. Configure `.env` from `.env.example`. Required server-side keys:

```text
ANTHROPIC_API_KEY
RENDER_KEY_PRIMARY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_KEY
```

Do not commit `.env`.

## Run locally

Start the AI service:

```powershell
npm run dev:ai
```

In another terminal, start the web app:

```powershell
npm run dev:web
```

Open:

```text
http://localhost:3000
```

Health checks:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/health
Invoke-RestMethod http://localhost:3000/api/health
npm run smoke
```

## Model routing

Analysis:

```text
VISION_ANALYSIS_MODEL=claude-opus-4-1-20250805
VISION_FALLBACK_MODEL=claude-sonnet-4-5-20250929
LIVE_GUIDANCE_LANGUAGE=nl-NL
```

Rendering:

```text
RENDER_MODEL_PRIMARY=gemini-3-pro-image-preview
RENDER_MODEL_FALLBACK=gemini-2.5-flash-image
```

## Analysis output

The web app calls the AI service through `/api/ai/analyze`. The response includes:

- `windowBounds`: the overall detected window region.
- `windowOpenings`: separate physical window openings, left-to-right, for multi-window scenes.
- `imageSize`: source image dimensions used by the frontend to scale detection overlays.
- `windowMask`: binary PNG mask data URL for rendering/compositing.

Live measuring uses the browser camera through `getUserMedia`.

- `Analyseer live frame` captures a still frame from the live video feed and sends it to `/api/ai/analyze`, so the same server-side vision model and segmentation pipeline drive both uploaded photos and live camera measurements.
- `AI spraakcoach starten` captures live frames on an interval and sends them to `/api/ai/live-guide`. The server-side vision model is instructed to return one short Dutch (`nl-NL`) measuring instruction, and the browser speaks it through `speechSynthesis` with a Dutch voice when available.
- The live UI keeps the latest spoken instruction available for replay and shows the returned language, confidence, and status issue so the operator can see why the AI coach is asking for another camera position.
- The frontend sends the current live measuring stage (`positioning`, `stability-check`, or `measurement-confirmation`) with each guidance request, so the AI coach can move from framing instructions to final confirmation.

## Production shape

Run the Python AI service and Next.js app as two separate services.

- AI service: `python -m src.AI.service`
- Web app: `npm run build && npm run start:web`
- Web app talks to the AI service through `AI_SERVICE_URL`.
- Web readiness endpoint: `/api/health`
- AI readiness endpoint: `/health`
- Checkout uses `/api/orders/draft` for server-side order validation and `/api/orders/payment-session` for redirect-ready payment session preparation. Without provider credentials it redirects to `/betaling` as an internal handoff page.
- Optional Supabase Storage is server-side only. Configure `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_BUCKET`; never expose `SUPABASE_KEY` to the browser.
- Keep `models/`, `.venv/`, `.env`, and uploaded runtime data out of git.

Docker:

```powershell
docker compose up --build
```

The SAM2 checkpoint is mounted from `./models` into the AI container.

## Verification

```powershell
npm run lint
npm run build
.\.venv\Scripts\python.exe -m compileall -q src\AI
npm run smoke
.\.venv\Scripts\python.exe scripts\smoke_production.py --live-ai
```
