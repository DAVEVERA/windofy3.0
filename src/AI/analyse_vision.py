"""
Generic vision analysis pipeline.

The module keeps the existing public entrypoint, run_analysis_pipeline(), but
removes product-source-driven and business-specific analysis. It produces generic
window, style, color, lighting, mounting, and product-fit data that can be
mapped to any standalone product database later.
"""

from __future__ import annotations

import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from src.AI import prompts
from src.AI.sam2_segment import detect_window_bounds
from src.AI.utils import strip_data_url

logger = logging.getLogger(__name__)

_PROMPT_SEP = "â”€" * 60


def _get_client():
    """Lazily import the configured remote vision SDK."""
    try:
        import anthropic
    except Exception as exc:  # pragma: no cover - environment/import error
        raise ImportError("The configured vision SDK is required for remote analysis calls") from exc

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY environment variable is not set.")
    return anthropic.Anthropic(api_key=api_key)


def _call_vision_model(
    client,
    system_prompt: str,
    image_b64: str,
    image_mime: str,
    user_message: str,
    model: Optional[str] = None,
) -> str:
    """Send one provider-neutral vision request and return raw text."""
    models_to_try = [model] if model else [prompts.ANALYSIS_MODEL, prompts.FALLBACK_MODEL]

    if _PROMPT_SEP in system_prompt:
        idx = system_prompt.index(_PROMPT_SEP)
        system_content: Any = [
            {
                "type": "text",
                "text": system_prompt[:idx].rstrip(),
                "cache_control": {"type": "ephemeral"},
            },
            {
                "type": "text",
                "text": system_prompt[idx:],
            },
        ]
    else:
        system_content = system_prompt

    for selected_model in models_to_try:
        try:
            if selected_model != models_to_try[0]:
                logger.warning("Analysis model overloaded; using fallback model.")

            response = client.messages.create(
                model=selected_model,
                max_tokens=4096,
                system=system_content,
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
                raise ValueError("Empty response received from analysis model.")

            return response.content[0].text.strip()
        except Exception:
            if selected_model == models_to_try[-1]:
                raise
            continue

    raise RuntimeError("All analysis models failed.")


def _parse_json(raw: str, phase: int = 0) -> Dict[str, Any]:
    """Strip markdown fences and parse JSON. Raises with phase context."""
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as exc:
        phase_label = f"phase {phase}" if phase else "unknown phase"
        raise ValueError(
            f"JSON parse error in {phase_label}: {exc}\n"
            f"Raw response (first 400 chars): {raw[:400]}"
        ) from exc


def _phase_2_quality(client, image_b64: str, image_mime: str) -> Dict[str, Any]:
    system = prompts.get_phase_prompt(2)
    user = (
        "Voer de kwaliteitscheck uit op deze afbeelding. "
        "Zichtbare raambekleding is geen reden om af te keuren; markeer alleen "
        "existing_treatment_detected=true. Keur alleen af bij extreme onscherpte, "
        "totale duisternis, verkeerd formaat, aanstootgevende inhoud of extreme rotatie. "
        "Geef geldig JSON: "
        '{"passed": true, "feedback": "", "existing_treatment_detected": false}'
    )
    raw = _call_vision_model(client, system, image_b64, image_mime, user, model=prompts.FALLBACK_MODEL)
    result = _parse_json(raw, phase=2)
    return {
        "passed": bool(result.get("passed", False)),
        "feedback": result.get("feedback", ""),
        "existing_treatment_detected": bool(result.get("existing_treatment_detected", False)),
    }


def _phase_3_style(client, image_b64: str, image_mime: str) -> Dict[str, Any]:
    system = prompts.get_phase_prompt(3)
    user = (
        "Analyseer de interieurstijl van deze ruimte. Geef geldig JSON: "
        '{"style": "een generiek stijllabel", "styleSummary": "maximaal 2 zinnen", '
        '"roomMood": "een korte sfeeromschrijving"}'
    )
    raw = _call_vision_model(client, system, image_b64, image_mime, user)
    return _parse_json(raw, phase=3)


def _phase_4_colors(client, image_b64: str, image_mime: str) -> Dict[str, Any]:
    system = prompts.get_phase_prompt(4)
    user = (
        "Extraheer precies 5 zichtbare kleuren uit de ruimte. Gebruik generieke "
        "kleurfamilies en ontwerpcontext, geen vaste-productlijst-, merk- of leveranciernamen. "
        "Geef geldig JSON: "
        '{"colour_palette": ['
        '{"hex_code": "#XXXXXX", "extracted_source": "...", '
        '"color_family": "...", "design_role": "..."}'
        "]}"
    )
    raw = _call_vision_model(client, system, image_b64, image_mime, user)
    return _parse_json(raw, phase=4)


def _phase_5_window(client, image_b64: str, image_mime: str) -> Dict[str, Any]:
    system = prompts.get_phase_prompt(5)
    user = (
        "Voer een forensische raamanalyse uit. Tel fysieke raamopeningen apart: "
        "als er vier losse verticale kozijnopeningen naast elkaar staan, is detectedWindowCount=4, "
        "ook als elke opening een boven- en onderpaneel heeft. Geef geldig JSON: "
        '{"windowType": "...", "detectedWindowCount": 4, "recessDepth": 10, '
        '"handlePresent": false, "handleSide": "...", "ventPresent": false, '
        '"openingMechanism": "...", "openingDirection": "...", "isOperable": true, '
        '"frameType": "...", "glazingType": "...", "stackHeightClearance": 0, '
        '"sillPresent": true, "cornerProximity": false, "collisionRisks": "...", '
        '"exceptions": "max 1 concrete zin of lege string"}'
    )
    raw = _call_vision_model(client, system, image_b64, image_mime, user)
    return _parse_json(raw, phase=5)


def _phase_6_mounting(window_data: Dict[str, Any]) -> Dict[str, Any]:
    """Determine generic mounting strategy from window data."""
    recess_depth = float(window_data.get("recessDepth", 0))
    handle_present = bool(window_data.get("handlePresent", False))
    vent_present = bool(window_data.get("ventPresent", False))
    window_type = str(window_data.get("windowType", "")).lower()
    opening_dir = str(window_data.get("openingDirection", "")).lower()
    stack_clearance = float(window_data.get("stackHeightClearance", 999))
    corner_proximity = bool(window_data.get("cornerProximity", False))
    obstacle = handle_present or vent_present

    if recess_depth < 5:
        return {
            "recommendation": "op de dag",
            "rule": "DEPTH_THRESHOLD",
            "reasoning": f"Recess diepte {recess_depth}cm < 5cm: buitenbevestiging aanbevolen.",
        }

    if obstacle:
        if recess_depth <= 15:
            return {
                "recommendation": "in de dag",
                "rule": "OBSTACLE_FRONT_EDGE",
                "reasoning": "Obstakel aanwezig; montage op voorste rand van het dagvlak.",
            }
        return {
            "recommendation": "op de dag",
            "rule": "OBSTACLE_OUTSIDE",
            "reasoning": "Obstakel aanwezig en recess te diep; buitenbevestiging aanbevolen.",
        }

    is_tilt_turn = "tilt" in window_type or "draai" in window_type or "inward" in opening_dir
    if is_tilt_turn and stack_clearance < 20:
        return {
            "recommendation": "op de dag",
            "rule": "KINEMATIC_CLEARANCE",
            "reasoning": "Kiep- of draaibeweging vereist extra stapelruimte.",
        }

    if corner_proximity:
        return {
            "recommendation": "op de dag",
            "rule": "LATERAL_CLEARANCE",
            "reasoning": "Onvoldoende zijdelingse ruimte; controleer hoekbotsing.",
            "error": True,
        }

    return {
        "recommendation": "in de dag",
        "rule": "DEFAULT_INSIDE",
        "reasoning": "Geen kritieke obstakels gedetecteerd; binnenbevestiging is waarschijnlijk geschikt.",
    }


def _phase_7_lighting(client, image_b64: str, image_mime: str) -> Dict[str, Any]:
    system = prompts.get_phase_prompt(7)
    user = (
        "Analyseer de lichtomstandigheden in deze ruimte. Geef geldig JSON: "
        '{"lightDirection": "...", "lightIntensity": "...", "lightSoftness": "...", '
        '"lightTemperature": "...", "naturalContribution": 80, "artificialContribution": 20, '
        '"glassReflection": "...", "shadowBehavior": "...", '
        '"recommendedMaterial": "hout, aluminium, textiel of hybride", '
        '"lightingConditions": "samenvatting in een zin"}'
    )
    raw = _call_vision_model(client, system, image_b64, image_mime, user)
    return _parse_json(raw, phase=7)


def _phase_8_recommendations(client, image_b64: str, image_mime: str, context: Dict[str, Any]) -> Dict[str, Any]:
    system = prompts.get_phase_prompt(8)
    style_ctx = context.get("style", "")
    mood_ctx = context.get("roomMood", "")
    palette_ctx = json.dumps(context.get("colour_palette", []), ensure_ascii=False)
    material_rec = context.get("recommendedMaterial", "")
    mounting_rec = context.get("mountingRecommendation", "")

    user = (
        f"Interieurstijl: {style_ctx}\n"
        f"Sfeer: {mood_ctx}\n"
        f"Kleurenpalet: {palette_ctx}\n"
        f"Aanbevolen materiaal op basis van licht: {material_rec}\n"
        f"Montageadvies: {mounting_rec}\n\n"
        "Geef 4 generieke product-fit aanbevelingen. Gebruik geen vaste productlijst, "
        "merk, leverancier, business of beschikbaarheidsclaim. De aanbevelingen "
        "moeten later aan elke zelfstandige productdatabase gekoppeld kunnen worden. "
        "Geef geldig JSON: "
        '{"materialSuggestions": ["Hout", "Aluminium"], "suggestions": ['
        '{"productType": "...", "material": "...", "colorName": "generieke kleurnaam", '
        '"colorHex": "#XXXXXX", "slatWidth": "...", "mountingPreference": "...", '
        '"suitabilityScore": 10, "reasoning": "..."}'
        "]}"
    )
    raw = _call_vision_model(client, system, image_b64, image_mime, user)
    return _parse_json(raw, phase=8)


def run_analysis_pipeline(image_data_url: str) -> Dict[str, Any]:
    """Execute the standalone generic vision analysis pipeline."""
    client = _get_client()

    try:
        image_mime, image_b64 = strip_data_url(image_data_url)
    except ValueError as exc:
        return {"qualityFailed": True, "qualityFeedback": str(exc)}

    quality = _phase_2_quality(client, image_b64, image_mime)
    if not quality["passed"]:
        return {
            "qualityFailed": True,
            "qualityFeedback": quality["feedback"],
        }

    with ThreadPoolExecutor(max_workers=5) as executor:
        f3 = executor.submit(_phase_3_style, client, image_b64, image_mime)
        f4 = executor.submit(_phase_4_colors, client, image_b64, image_mime)
        f5 = executor.submit(_phase_5_window, client, image_b64, image_mime)
        f7 = executor.submit(_phase_7_lighting, client, image_b64, image_mime)
        fsam = executor.submit(detect_window_bounds, image_data_url)
        style = f3.result()
        colors = f4.result()
        window = f5.result()
        lighting = f7.result()
        sam = fsam.result()

    mounting = _phase_6_mounting(window)

    context = {
        "style": style.get("style", ""),
        "roomMood": style.get("roomMood", ""),
        "colour_palette": colors.get("colour_palette", []),
        "recommendedMaterial": lighting.get("recommendedMaterial", ""),
        "mountingRecommendation": mounting.get("recommendation", ""),
    }
    recommendations = _phase_8_recommendations(client, image_b64, image_mime, context)

    window_check = {
        "obstacles": window.get("handlePresent", False) or window.get("ventPresent", False),
        "windowType": window.get("windowType", "-"),
        "detectedWindowCount": window.get("detectedWindowCount", 1),
        "recommendation": mounting.get("recommendation", "in de dag"),
        "reasoning": mounting.get("reasoning", ""),
        "specialConsiderations": window.get("exceptions", ""),
    }

    window_bounds = None
    window_mask_b64 = None
    window_openings = []
    window_image_size = None
    detected_count = int(window.get("detectedWindowCount", 1) or 1)
    if sam.get("success"):
        window_bounds = sam["bounds"]
        window_bounds["confidence"] = sam.get("confidence", 0.0)
        window_mask_b64 = sam.get("mask_b64")
        window_openings = sam.get("openings") or []
        window_image_size = sam.get("image_size")
        detected_count = max(detected_count, int(sam.get("detected_count") or len(window_openings) or 1))
    else:
        logger.warning("Window segmentation failed: %s", sam.get("error", "unknown"))

    window_check["detectedWindowCount"] = detected_count

    return {
        "qualityFailed": False,
        "style": style.get("style", ""),
        "styleSummary": style.get("styleSummary", ""),
        "roomMood": style.get("roomMood", ""),
        "lightingConditions": lighting.get("lightingConditions", ""),
        "colour_palette": colors.get("colour_palette", []),
        "windowCheck": window_check,
        "windowBounds": window_bounds,
        "windowOpenings": window_openings,
        "imageSize": window_image_size,
        "windowMask": window_mask_b64,
        "materialSuggestions": recommendations.get("materialSuggestions", []),
        "suggestions": recommendations.get("suggestions", []),
    }


