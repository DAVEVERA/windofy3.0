"""Live vision guidance for camera-based window measuring."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

from src.AI import prompts
from src.AI.utils import strip_data_url

logger = logging.getLogger(__name__)


def _get_client():
    try:
        import anthropic
    except Exception as exc:  # pragma: no cover - environment/import error
        raise ImportError("The configured vision SDK is required for live guidance") from exc

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY environment variable is not set.")
    return anthropic.Anthropic(api_key=api_key)


def _parse_json(raw: str) -> Dict[str, Any]:
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Live guidance returned non-JSON response: %s", raw[:300])
        return {
            "instruction": raw[:180].strip() or "Richt de camera recht op het raam en houd hem stil.",
            "measurementReady": False,
            "confidence": 0.25,
            "issue": "non_json_response",
        }


def run_live_guidance(
    image_data_url: str,
    previous_instruction: Optional[str] = None,
    measurement_stage: str = "positioning",
) -> Dict[str, Any]:
    """Return one short spoken instruction based on the current camera frame."""
    image_mime, image_b64 = strip_data_url(image_data_url)
    client = _get_client()

    system_prompt = f"""
You are Windofy's live vision measuring coach for window decoration.

You inspect one live camera frame and return exactly one short Dutch spoken instruction
for the person measuring the window. Use only what is visible in the image.
The required language is {prompts.LIVE_GUIDANCE_LANGUAGE}; for Windofy this means natural Dutch for Dutch customers.

Goal:
- Help the user position the camera straight-on.
- Help the user include the full window frame, recess, sill, handles, and edges.
- Tell the user when the frame is stable and usable for AI measuring.

Rules:
- Return strict JSON only.
- instruction must be one sentence, max 18 Dutch words, suitable for text-to-speech.
- instruction must always be in Dutch for Dutch-speaking customers in the Netherlands.
- Never answer in English, German, French, or mixed-language text.
- Be concrete: e.g. move closer, move back, tilt phone left/right, more light, hold still.
- Do not claim millimeter-accurate dimensions from a single frame.
- If the frame is good, say the user can hold still and analyze/confirm.
- Do not mention internal model names.

JSON schema:
{{
  "instruction": "korte Nederlandse spraakinstructie",
  "language": "{prompts.LIVE_GUIDANCE_LANGUAGE}",
  "measurementReady": false,
  "confidence": 0.0,
  "issue": "none | too_dark | too_blurry | window_cut_off | angled | too_far | too_close | reflection | no_window"
}}
""".strip()

    user_message = (
        f"Meetfase: {measurement_stage or 'positioning'}.\n"
        f"Vorige instructie: {previous_instruction or '-'}.\n"
        "Geef nu de beste volgende gesproken instructie voor live inmeten."
    )

    models_to_try = [prompts.ANALYSIS_MODEL, prompts.FALLBACK_MODEL]
    last_error: Optional[Exception] = None

    for selected_model in models_to_try:
        try:
            response = client.messages.create(
                model=selected_model,
                max_tokens=420,
                system=system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": image_mime,
                                    "data": image_b64,
                                },
                            },
                            {"type": "text", "text": user_message},
                        ],
                    }
                ],
            )
            if not response.content:
                raise ValueError("Empty response received from live guidance model.")

            parsed = _parse_json(response.content[0].text)
            instruction = str(parsed.get("instruction", "")).strip()
            if not instruction:
                instruction = "Richt de camera recht op het raam en houd hem stil."

            return {
                "instruction": instruction[:220],
                "language": prompts.LIVE_GUIDANCE_LANGUAGE,
                "measurementReady": bool(parsed.get("measurementReady", False)),
                "confidence": max(0.0, min(1.0, float(parsed.get("confidence", 0.0) or 0.0))),
                "issue": str(parsed.get("issue", "none") or "none"),
                "model": selected_model,
            }
        except Exception as exc:
            last_error = exc
            if selected_model == models_to_try[-1]:
                raise

    raise RuntimeError(f"Live guidance failed: {last_error}")
