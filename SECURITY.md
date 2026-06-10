# Security notes

## Secrets

Keep all provider keys in local or deployment-managed environment variables.
Never commit `.env`, `.next/standalone/.env`, service logs, model checkpoints, or upload data.

If a key was pasted into chat, terminal output, screenshots, logs, or issue trackers, rotate it before production use.

Required production secrets:

```text
ANTHROPIC_API_KEY
RENDER_KEY_PRIMARY
SUPABASE_KEY
```

Public browser-safe values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## Runtime boundary

The web app should call only the AI service through `AI_SERVICE_URL`.
The browser should never receive provider API keys.

The AI service owns:

- Anthropic analysis calls
- SAM2 segmentation
- Gemini image rendering
- optional Supabase server-side upload

## Supabase boundary

Supabase is optional and currently used only from the Python AI service for server-side Storage uploads.

- Keep `SUPABASE_KEY` server-side only.
- Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only for future browser-safe client features.
- Prefer private buckets unless the uploaded image is intentionally public.
- If tables or storage policies are added later, enable RLS and grant only the roles that need access.

## Deployment checks

Before production:

```powershell
npm run lint
npm run build
npm run smoke
.\.venv\Scripts\python.exe scripts\smoke_production.py --live-ai --render
docker compose config --quiet
```
