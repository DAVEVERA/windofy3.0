"""
Unified generic visualization engine with automatic failover.

Routes rendering to a primary and optional fallback backend. Prompts and public errors stay provider-neutral and standalone.
"""

from __future__ import annotations

import os
import io
import re
import base64
import json
import logging
import time
import urllib.request
import urllib.error
from typing import Optional

from PIL import Image

log = logging.getLogger(__name__)

_PRIMARY = "PRIMARY"
_FALLBACK = "FALLBACK"
_HTTP_FALLBACK = "HTTP_FALLBACK"
_DEFAULT_PRIMARY_MODEL = "gemini-3-pro-image-preview"
_DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash-image"


# â”€â”€ DESCRIPTOR MAPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

STATE_MAP = {
    "Tot de helft": (
        "lowered exactly halfway. The bottom 50% of the window is clear glass "
        "allowing direct sunlight to hit the floor/sill. The top 50% is covered "
        "by the blind, casting slat shadows."
    ),
    "Geheel uitgerold": (
        "fully lowered, covering the entire window height from top to bottom. "
        "The light entering the room is filtered through the slats, creating a "
        "soft striped shadow pattern on the floor/interior."
    ),
}

MOUNTING_MAP = {
    "in de dag": """
        **MOUNTING TYPE: INSIDE MOUNT (In de dag)**
        1. **GEOMETRY**: The blind fits STRICTLY BETWEEN the window reveals (jambs).
        2. **WALL PRESERVATION**: The wall surface, architraves, and trim AROUND the window must remain COMPLETELY VISIBLE.
        3. **DEPTH**: The blind is recessed into the wall.
        4. **SHADOWS**: Shadows fall onto the glass or the side reveals of the niche, NOT on the outer wall.
        """,
    "op de dag": """
        **MOUNTING TYPE: OUTSIDE MOUNT (Op de dag)**
        1. **GEOMETRY**: The blind is mounted ON THE FACE of the wall, overlapping the window opening.
        2. **OVERLAP**: The blind must extend 10cm beyond the window opening on Left, Right, and Top.
        3. **OBSCURING**: The blind MUST physically cover the window frame/architraves.
        4. **3D LAYERING**: The blind sits PROUD (forward) from the wall with a hard drop shadow.
        5. **NO RECOLORING**: Do not change the color of the wall or the frame underneath.
        """,
    "op de glaslat": """
        **MOUNTING TYPE: ON THE SASH (Op de glaslat)**
        1. **PLACEMENT**: Mounted directly onto the window sash (the moving part).
        2. **FIT**: Very tight fit against the glass. The handle remains visible and accessible.
        """,
    "Gebogen gordijnrail voor erker":         "on a curved curtain rail",
    "Speciaal dakraam product":               "in a special skylight blind system",
    "Twee aparte rolgordijnen voor hoekraam": "as two separate blinds for the corner window",
}

LIGHTING_MAP = {
    "Ochtend (Koel)": (
        "MORNING LIGHT. Low angle sunlight from the East. Color Temp: 5500K (Cool/Fresh). "
        "Shadows: Long, crisp shadows projected deep into the room. Atmosphere: Crisp, energetic."
    ),
    "Middag (Helder)": (
        "MID-DAY SUN. High angle overhead sunlight. Color Temp: 6000K (Neutral White). "
        "Shadows: Short, sharp, high-contrast shadows on the window sill and floor. "
        "Atmosphere: Bright, clear, revealing."
    ),
    "Zonsondergang (Warm)": (
        "GOLDEN HOUR. Very low angle sunlight from the West. Color Temp: 3500K (Warm/Orange/Gold). "
        "Shadows: Extremely long, dramatic, stretching across the floor. "
        "Reflections: Warm metallic glow on slats. Atmosphere: Cozy, romantic."
    ),
    "Avond (Sfeervol)": (
        "EVENING/NIGHT. No direct sunlight. Light Source: Artificial interior lamps "
        "(Warm White 2700K). Shadows: Soft, multi-directional from room lights. "
        "Atmosphere: Intimate, dark outside."
    ),
    "Bewolkt (Diffuus)": (
        "OVERCAST/CLOUDY. Diffuse, soft white light (6500K). No hard direct sunlight. "
        "Shadows: Very soft, ambient occlusion only. Atmosphere: Soft, even, calm."
    ),
}

PRODUCT_MAP = {
    "Houten JaloezieÃ«n": (
        "Premium Wooden Horizontal Venetian Blinds. "
        "Material physics: Matte or Satin finish, visible wood grain texture, "
        "absorbs light, warm reflections."
    ),
    "Aluminium JaloezieÃ«n": (
        "Sleek Aluminum Horizontal Venetian Blinds. "
        "Material physics: Smooth metallic finish, slight specular highlights, "
        "reflects light, cool/sharp reflections."
    ),
}


# â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_DATA_URL_RE = re.compile(r"^data:(image/\w+);base64,(.*)$", re.DOTALL)


def _split_data_url(image_b64: str) -> tuple[str, bytes]:
    m = _DATA_URL_RE.match(image_b64)
    if m:
        return m.group(1), base64.b64decode(m.group(2))
    return "image/jpeg", base64.b64decode(image_b64)


def _optimize_image(image_b64: str, max_side: int = 1536, quality: int = 85) -> tuple[bytes, str]:
    _, raw = _split_data_url(image_b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    if w > max_side or h > max_side:
        if w > h:
            img = img.resize((max_side, round(h * max_side / w)), Image.LANCZOS)
        else:
            img = img.resize((round(w * max_side / h), max_side), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue(), "image/jpeg"


def _build_prompt(config: dict, state: str, mounting: Optional[str], extra_options: dict) -> str:
    english_state    = STATE_MAP.get(state, state)
    english_mounting = MOUNTING_MAP.get(mounting or "in de dag", MOUNTING_MAP["in de dag"])
    english_product  = PRODUCT_MAP.get(config.get("productType", ""), "Horizontal Venetian Blinds")
    english_lighting = LIGHTING_MAP.get(
        extra_options.get("lighting", "Middag (Helder)"),
        LIGHTING_MAP["Middag (Helder)"],
    )
    tape_desc = (
        "with wide decorative fabric ladder tapes (vertical fabric strips)"
        if extra_options.get("ladderTape")
        else "with minimalist string cords (no wide fabric tapes)"
    )
    slat_desc = (
        f"with {extra_options['slatWidth']} wide horizontal slats"
        if extra_options.get("slatWidth")
        else "with horizontal slats"
    )
    return f"""
      **TASK**: Create an Ultra-Photorealistic Window Treatment Visualization.

      **CRITICAL CONSTRAINT: ARCHITECTURAL PRESERVATION**
      - **DO NOT** change the color of the existing window frames, walls, floor, or furniture.
      - **DO NOT** repaint the room.
      - **ONLY** insert the new blind object.

      **STEP 1: VIRTUAL DEMOLITION (PRE-PROCESSING)**
      - Identify the window area accurately.
      - **REMOVE** any existing blinds, shades, or curtains inside the frame using inpainting logic.
      - Keep the original view outside the window visible through the open slats.

      **STEP 2: PRODUCT SPECIFICATION**
      - Product: {english_product}
      - Material Look: {config.get("material", "")}
      - Color: {config.get("colorName", "")} (Hex: {config.get("colorHex", "")})
      - Configuration: {slat_desc}, {tape_desc}
      - State: {english_state}

      **STEP 3: MOUNTING GEOMETRY (CRITICAL)**
      {english_mounting}

      **STEP 4: LIGHTING PHYSICS & ATMOSPHERE**
      - **CONDITION**: {english_lighting}
      - **RAYTRACING**: Render realistic slat shadows on the floor/furniture.
      - **REFLECTIONS**: If Aluminium, show subtle room reflections on the slats. If Wood, show texture.
      - **INTEGRATION**: The blind must match the room's perspective vanishing point perfectly.
    """.strip()


# â”€â”€ PRIMARY RENDER BACKEND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _extract_inline_image(response) -> str:
    """Extract the first inline image from a Google GenAI response."""
    if getattr(response, "prompt_feedback", None):
        block = getattr(response.prompt_feedback, "block_reason", None)
        if block:
            raise RuntimeError("Visualisatie geblokkeerd door content policy.")

    candidates = getattr(response, "candidates", None) or []
    if not candidates or not getattr(candidates[0], "content", None):
        raise RuntimeError("Geen afbeelding in respons (geen candidates).")

    for part in candidates[0].content.parts or []:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data and inline.mime_type:
            data = inline.data
            if isinstance(data, (bytes, bytearray)):
                data = base64.b64encode(data).decode()
            return f"data:{inline.mime_type};base64,{data}"

    raise RuntimeError("Geen inline afbeelding in backend-respons.")


def _render_image_model(img_bytes: bytes, mime: str, prompt: str, model_id: str, api_key: str) -> str:
    """Render through a configured Gemini image model. Raises on any failure."""
    from google import genai
    from google.genai import types

    client     = genai.Client(api_key=api_key)
    image_part = types.Part(inline_data=types.Blob(data=img_bytes, mime_type=mime))

    response = client.models.generate_content(
        model=model_id,
        contents=[image_part, prompt],
        config=types.GenerateContentConfig(max_output_tokens=8192),
    )

    return _extract_inline_image(response)


def _render_PRIMARY(img_bytes: bytes, mime: str, prompt: str) -> str:
    """Primary Gemini Pro Image render path. Raises on any failure."""
    model_id = os.getenv("RENDER_MODEL_PRIMARY", "").strip() or _DEFAULT_PRIMARY_MODEL
    api_key = os.getenv("RENDER_KEY_PRIMARY")
    if not api_key:
        raise RuntimeError("Primaire render key niet geconfigureerd.")
    return _render_image_model(img_bytes, mime, prompt, model_id, api_key)


# â”€â”€ FALLBACK RENDER BACKEND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _render_FALLBACK(img_bytes: bytes, mime: str, prompt: str) -> str:
    """Fallback Gemini Flash Image render path. Raises on any failure."""
    model_id = os.getenv("RENDER_MODEL_FALLBACK", "").strip() or _DEFAULT_FALLBACK_MODEL
    api_key = os.getenv("RENDER_KEY_FALLBACK") or os.getenv("RENDER_KEY_PRIMARY")
    if not api_key:
        raise RuntimeError("Fallback render key niet geconfigureerd.")
    return _render_image_model(img_bytes, mime, prompt, model_id, api_key)


def _render_HTTP_FALLBACK(img_bytes: bytes, mime: str, prompt: str) -> str:
    """
    Optional third render path via configurable HTTP endpoint, no SDK dependency.
    Image-to-image: insert the configured window treatment into the room photo.
    """
    api_key = os.getenv("RENDER_HTTP_FALLBACK_KEY")
    if not api_key:
        raise RuntimeError("HTTP fallback render key niet geconfigureerd.")
    endpoint = os.getenv("RENDER_HTTP_FALLBACK_ENDPOINT")
    if not endpoint:
        raise RuntimeError("HTTP fallback render endpoint niet geconfigureerd.")

    b64str   = base64.b64encode(img_bytes).decode()
    data_url = f"data:{mime};base64,{b64str}"

    short_prompt = (
        "Photorealistic interior room photo. Add the configured window treatment at the window. "
        "Preserve all walls, floor, furniture, ceiling exactly as-is. "
        "Only modify the window area to insert the blind. "
        + prompt[:600]
    )

    payload = json.dumps({
        "prompt":         short_prompt,
        "image_url":      data_url,
        "guidance_scale": 3.5,
        "num_steps":      28,
        "output_format":  "jpeg",
    }).encode("utf-8")

    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Authorization": f"Key {api_key}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        log.error("[RENDER] %s HTTP %d: %s", _HTTP_FALLBACK, e.code, body[:300])
        raise RuntimeError(f"HTTP fallback {e.code}: {body[:200]}") from e
    except Exception as e:
        log.error("[RENDER] %s verbindingsfout: %s", _HTTP_FALLBACK, type(e).__name__)
        raise

    images = (result or {}).get("images") or []
    if not images:
        raise RuntimeError("Geen afbeelding ontvangen van fallback backend.")

    img_url = images[0].get("url", "")
    if img_url.startswith("data:"):
        return img_url

    with urllib.request.urlopen(img_url, timeout=60) as r:
        raw_data = r.read()
    return f"data:image/jpeg;base64,{base64.b64encode(raw_data).decode()}"


# â”€â”€ OVERLOAD DETECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _is_overload(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in (
        "503", "unavailable", "high demand", "overloaded", "capacity", "quota", "rate"
    ))


def _http_fallback_configured() -> bool:
    return bool(os.getenv("RENDER_HTTP_FALLBACK_KEY") and os.getenv("RENDER_HTTP_FALLBACK_ENDPOINT"))


# â”€â”€ PUBLIC ENTRYPOINT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def generate_decor(
    image_b64:     str,
    config:        dict,
    state:         str = "Geheel uitgerold",
    mounting:      Optional[str] = None,
    extra_options: Optional[dict] = None,
) -> str:
    """
    Unified render entrypoint.
    - Tries the primary backend up to 2 times.
    - On primary failure: automatically switches to Gemini Flash Image fallback.
    - All error messages are provider-neutral.
    - Only fully-closed blinds ("Geheel uitgerold") are allowed.
    """
    # Enforce: only fully-rolled-out blinds are visualised.
    state = "Geheel uitgerold"
    extra_options = extra_options or {}
    img_bytes, mime = _optimize_image(image_b64, max_side=1536, quality=85)
    prompt = _build_prompt(config, state, mounting, extra_options)

    # Primary backend: 2 attempts
    last_is_overload = False
    for attempt in range(2):
        try:
            result = _render_PRIMARY(img_bytes, mime, prompt)
            log.info("[RENDER] %s OK (poging %d)", _PRIMARY, attempt + 1)
            return result
        except Exception as exc:
            last_is_overload = _is_overload(exc)
            log.warning(
                "[RENDER] %s fout poging %d (overload=%s): %s",
                _PRIMARY, attempt + 1, last_is_overload, type(exc).__name__,
            )
            if attempt == 0:
                time.sleep(3)   # kort wachten voor retry
                continue
            # Tweede poging ook gefaald: continue to Gemini fallback.

    # Fallback backend
    log.warning("[RENDER] Overschakelen naar %s.", _FALLBACK)
    try:
        result = _render_FALLBACK(img_bytes, mime, prompt)
        log.info("[RENDER] %s OK.", _FALLBACK)
        return result
    except Exception as exc:
        log.error("[RENDER] %s mislukt: %s", _FALLBACK, type(exc).__name__)
        if _http_fallback_configured():
            log.warning("[RENDER] Overschakelen naar %s.", _HTTP_FALLBACK)
            try:
                result = _render_HTTP_FALLBACK(img_bytes, mime, prompt)
                log.info("[RENDER] %s OK.", _HTTP_FALLBACK)
                return result
            except Exception as http_exc:
                log.error("[RENDER] %s mislukt: %s", _HTTP_FALLBACK, type(http_exc).__name__)
        raise RuntimeError(
            "Visualisatie tijdelijk niet beschikbaar. Probeer het later opnieuw."
        ) from exc






