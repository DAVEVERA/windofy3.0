"""HTTP service for the production AI pipeline.

Run locally:
    python -m src.AI.service

The Next.js app proxies to this service through AI_SERVICE_URL.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.AI.analyse_vision import run_analysis_pipeline
from src.AI.live_guidance import run_live_guidance
from src.AI.prompts import LIVE_GUIDANCE_LANGUAGE
from src.AI.render_image import generate_decor
from src.AI.sam2_segment import sam2_checkpoint_path


class AnalyzeRequest(BaseModel):
    imageDataUrl: str = Field(min_length=32)


class LiveGuideRequest(BaseModel):
    imageDataUrl: str = Field(min_length=32)
    previousInstruction: Optional[str] = None
    measurementStage: str = "positioning"


class RenderRequest(BaseModel):
    imageDataUrl: str = Field(min_length=32)
    config: dict[str, Any]
    state: str = "Geheel uitgerold"
    mounting: Optional[str] = None
    extraOptions: dict[str, Any] = Field(default_factory=dict)


app = FastAPI(title="Windofy AI Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("AI_CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=502,
        detail={
            "error": str(exc),
            "errorType": type(exc).__name__,
        },
    )


@app.get("/health")
def health(response: Response) -> dict[str, Any]:
    checkpoint = sam2_checkpoint_path()
    dependencies = {
        "anthropicKey": bool(os.getenv("ANTHROPIC_API_KEY")),
        "renderKeyPrimary": bool(os.getenv("RENDER_KEY_PRIMARY")),
        "sam2Checkpoint": checkpoint.exists(),
        "supabaseStorage": {
            "configured": bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY")),
            "bucket": os.getenv("SUPABASE_BUCKET", "uploads"),
        },
    }
    ok = dependencies["anthropicKey"] and dependencies["renderKeyPrimary"] and dependencies["sam2Checkpoint"]
    if not ok:
        response.status_code = 503

    return {
        "ok": ok,
        "service": "windofy-ai",
        "analysisModel": os.getenv("VISION_ANALYSIS_MODEL", ""),
        "liveGuidanceLanguage": LIVE_GUIDANCE_LANGUAGE,
        "renderPrimaryModel": os.getenv("RENDER_MODEL_PRIMARY", ""),
        "renderFallbackModel": os.getenv("RENDER_MODEL_FALLBACK", ""),
        "dependencies": dependencies,
    }


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    try:
        return {"ok": True, "data": run_analysis_pipeline(request.imageDataUrl)}
    except Exception as exc:
        raise _error(exc) from exc


@app.post("/api/live-guide")
def live_guide(request: LiveGuideRequest) -> dict[str, Any]:
    try:
        return {
            "ok": True,
            "data": run_live_guidance(
                request.imageDataUrl,
                previous_instruction=request.previousInstruction,
                measurement_stage=request.measurementStage,
            ),
        }
    except Exception as exc:
        raise _error(exc) from exc


@app.post("/api/render")
def render(request: RenderRequest) -> dict[str, Any]:
    try:
        image_data_url = generate_decor(
            request.imageDataUrl,
            request.config,
            state=request.state,
            mounting=request.mounting,
            extra_options=request.extraOptions,
        )
        return {"ok": True, "data": {"imageDataUrl": image_data_url}}
    except Exception as exc:
        raise _error(exc) from exc


def main() -> None:
    import uvicorn

    host = os.getenv("AI_HOST", "127.0.0.1")
    port = int(os.getenv("AI_PORT", os.getenv("PORT", "5000")))
    uvicorn.run("src.AI.service:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
