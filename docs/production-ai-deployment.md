# Production AI Deployment

Windofy production needs two services:

- Vercel hosts the Next.js web app.
- A Docker host such as Render hosts the Python AI service.

The web app must receive:

```text
AI_SERVICE_URL=https://<public-ai-service-host>
```

Optional serverless fallback in Vercel:

```text
OPENAI_API_KEY=<server-side OpenAI key>
OPENAI_VISION_MODEL=gpt-5.5
OPENAI_RENDER_MODEL=gpt-5.5
```

When `OPENAI_API_KEY` is present, the Next.js API routes can fall back to the OpenAI Responses API for photo analysis, Dutch live measuring guidance, and render preview generation if the Python AI service is not configured or fails. `/api/health` reports `activeAiBackend` as `python-ai-service`, `openai-responses`, or `none`.

## AI Service Readiness

`GET /health` now returns `503` until all critical runtime dependencies are present:

- `ANTHROPIC_API_KEY`
- `RENDER_KEY_PRIMARY`
- SAM2 checkpoint at `SAM2_CHECKPOINT_PATH`

Supabase Storage remains optional for AI output uploads, but should be configured for production renders:

```text
SUPABASE_URL
SUPABASE_KEY
SUPABASE_BUCKET=uploads
```

## Render Blueprint

`render.yaml` defines a Docker web service named `windofy-ai`.

Required secret env vars in Render:

```text
ANTHROPIC_API_KEY
RENDER_KEY_PRIMARY
SUPABASE_URL
SUPABASE_KEY
```

Optional:

```text
RENDER_KEY_FALLBACK
RENDER_HTTP_FALLBACK_KEY
RENDER_HTTP_FALLBACK_ENDPOINT
```

The blueprint mounts `/app/models` as a persistent disk and downloads the SAM2 checkpoint on first boot using:

```text
SAM2_CHECKPOINT_URL=https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt
SAM2_CHECKPOINT_PATH=/app/models/sam2.1_hiera_large.pt
```

After Render reports `/health` as ready, set Vercel production env:

```powershell
"https://<render-service>.onrender.com" | vercel env add AI_SERVICE_URL production
vercel deploy --prod --yes
```
