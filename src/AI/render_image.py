"""
Primary image-to-image render adapter.

Builds generic visualization prompts and sends them to the configured render
backend. Prompt content is standalone and avoids business-specific or
brand-specific instructions.
"""

from __future__ import annotations

import base64
import io
import os
import re
import time
from typing import Optional

from google import genai
from google.genai import types
from PIL import Image


_DEFAULT_PRIMARY_MODEL = "gemini-3-pro-image-preview"
_DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash-image"

STATE_MAP = {
    "Tot de helft": (
        "lowered exactly halfway. The bottom 50% of the window remains clear "
        "glass. The top 50% is covered by the blind, casting realistic slat shadows."
    ),
    "Geheel uitgerold": (
        "fully lowered, covering the complete window height from headrail to sill. "
        "No open glass is visible below the bottom rail."
    ),
}

MOUNTING_MAP = {
    "in de dag": """
        **MOUNTING TYPE: INSIDE MOUNT**
        1. The blind fits strictly between the window reveals.
        2. Wall, trim, frame, and surrounding architecture remain visible.
        3. Shadows fall inside the niche, on glass, sill, or side reveals.
        """,
    "op de dag": """
        **MOUNTING TYPE: OUTSIDE MOUNT**
        1. The blind is mounted on the face of the wall and overlaps the opening.
        2. The blind extends beyond the window opening on left, right, and top.
        3. Covered frame areas are hidden by the blind, but exposed wall/frame color is unchanged.
        4. The blind sits forward from the wall and casts a plausible drop shadow.
        """,
    "op de glaslat": """
        **MOUNTING TYPE: SASH MOUNT**
        1. The blind is mounted directly onto the moving sash or glazing bead.
        2. The fit is tight against the glass and the handle remains accessible.
        """,
}

LIGHTING_MAP = {
    "Ochtend (Koel)": (
        "Morning light, low angle, cool/fresh color temperature, long crisp shadows."
    ),
    "Middag (Helder)": (
        "Midday light, bright neutral color temperature, shorter high-contrast shadows."
    ),
    "Zonsondergang (Warm)": (
        "Golden-hour light, warm low angle, longer shadows and warm highlights."
    ),
    "Avond (Sfeervol)": (
        "Evening or night interior light, warm artificial sources, soft multidirectional shadows."
    ),
    "Bewolkt (Diffuus)": (
        "Overcast diffuse daylight, soft ambient occlusion and no hard direct sunlight."
    ),
}

PRODUCT_MAP = {
    "Houten JaloezieÃ«n": (
        "Wooden horizontal venetian blinds with visible grain, matte or satin finish, "
        "warm reflection behavior, and realistic material thickness."
    ),
    "Houten JaloezieÃƒÂ«n": (
        "Wooden horizontal venetian blinds with visible grain, matte or satin finish, "
        "warm reflection behavior, and realistic material thickness."
    ),
    "Aluminium JaloezieÃ«n": (
        "Aluminum horizontal venetian blinds with smooth metallic finish, subtle "
        "specular highlights, and crisp edges."
    ),
    "Aluminium JaloezieÃƒÂ«n": (
        "Aluminum horizontal venetian blinds with smooth metallic finish, subtle "
        "specular highlights, and crisp edges."
    ),
}

_DATA_URL_RE = re.compile(r"^data:(image/\w+);base64,(.*)$", re.DOTALL)


def _split_data_url(image_b64: str) -> tuple[str, bytes]:
    """Return (mime_type, raw_bytes) from a data URL or assume JPEG if bare."""
    match = _DATA_URL_RE.match(image_b64)
    if match:
        return match.group(1), base64.b64decode(match.group(2))
    return "image/jpeg", base64.b64decode(image_b64)


def _optimize_image(image_b64: str, max_side: int = 1536, quality: int = 85) -> tuple[bytes, str]:
    """Decode, resize to max_side, and re-encode to JPEG."""
    _, raw = _split_data_url(image_b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")

    width, height = img.size
    if width > max_side or height > max_side:
        if width > height:
            img = img.resize((max_side, round(height * max_side / width)), Image.LANCZOS)
        else:
            img = img.resize((round(width * max_side / height), max_side), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue(), "image/jpeg"


def _build_prompt(config: dict, state: str, mounting: Optional[str], extra_options: dict) -> str:
    """Build a generic prompt for realistic window-treatment visualization."""
    english_state = STATE_MAP.get(state, state)
    english_mounting = MOUNTING_MAP.get(mounting or "in de dag", MOUNTING_MAP["in de dag"])
    english_product = PRODUCT_MAP.get(config.get("productType", ""), "Horizontal venetian blinds")
    english_lighting = LIGHTING_MAP.get(
        extra_options.get("lighting", "Middag (Helder)"),
        LIGHTING_MAP["Middag (Helder)"],
    )

    tape_desc = (
        "with wide decorative fabric ladder tapes"
        if extra_options.get("ladderTape")
        else "with minimalist string cords and no wide fabric tapes"
    )
    slat_desc = (
        f"with {extra_options['slatWidth']} wide horizontal slats"
        if extra_options.get("slatWidth")
        else "with horizontal slats"
    )

    return f"""
      **TASK**: Create an ultra-photorealistic window-treatment visualization.

      **CRITICAL GEOMETRY AND SCENE PRESERVATION**
      - Preserve the original room photo except for the intended window-treatment region.
      - Do not change walls, floor, ceiling, furniture, frame color, view direction, or camera perspective.
      - Insert only the new blind object and its physically plausible shadows/reflections.
      - Keep product geometry consistent with the selected state, mounting method, color, and material.

      **STEP 1: PRE-PROCESSING**
      - Identify the target window area accurately.
      - Remove existing window treatments in the target area before inserting the new blind.
      - Preserve visible glass, frame, sill, outside view, and room elements where not covered by the new blind.

      **STEP 2: PRODUCT SPECIFICATION**
      - Product: {english_product}
      - Material Look: {config.get("material", "")}
      - Color: {config.get("colorName", "")} (Hex: {config.get("colorHex", "")})
      - Configuration: {slat_desc}, {tape_desc}
      - State: {english_state}

      **STEP 3: MOUNTING GEOMETRY**
      {english_mounting}

      **STEP 4: LIGHTING AND COMPOSITING**
      - Condition: {english_lighting}
      - Match the room's vanishing point, scale, edge sharpness, color temperature, grain, and shadow softness.
      - For outside mount, cast a plausible shadow onto the wall behind the blind.
      - For inside mount, keep shadows inside the niche/sill/glass area.
      - If the material is aluminum, use subtle room reflections. If wood, use believable grain.

      **NEGATIVE CONSTRAINTS**
      - No product hallucinations outside the window area.
      - No changed wall color, frame color, flooring, furniture, or room layout.
      - No floating blind, warped slats, missing bottom rail, incorrect color, or inconsistent perspective.
    """.strip()


def generate_decor(
    image_b64: str,
    config: dict,
    state: str = "Tot de helft",
    mounting: Optional[str] = None,
    extra_options: Optional[dict] = None,
    retries: int = 2,
) -> str:
    """
    Send a room photo plus generic visualization prompt to the render backend.

    Returns a base64 data URL containing the rendered image.
    """
    extra_options = extra_options or {}
    img_bytes, mime = _optimize_image(image_b64, max_side=1536, quality=85)
    prompt = _build_prompt(config, state, mounting, extra_options)

    delay = 1.0
    primary_model = os.getenv("RENDER_MODEL_PRIMARY", "").strip() or _DEFAULT_PRIMARY_MODEL
    for attempt in range(retries + 1):
        try:
            return _render_with_gemini(img_bytes, mime, prompt, primary_model, "RENDER_KEY_PRIMARY")
        except Exception as exc:
            msg = str(exc)
            transient = ("500" in msg) or ("503" in msg) or ("UNAVAILABLE" in msg)
            if transient and attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            break

    fallback_model = os.getenv("RENDER_MODEL_FALLBACK", "").strip() or _DEFAULT_FALLBACK_MODEL
    try:
        return _render_with_gemini(
            img_bytes,
            mime,
            prompt,
            fallback_model,
            "RENDER_KEY_FALLBACK",
            fallback_key_env="RENDER_KEY_PRIMARY",
        )
    except Exception as exc:
        raise RuntimeError("Render pipeline failed after primary and fallback attempts.") from exc


def _render_with_gemini(
    img_bytes: bytes,
    mime: str,
    prompt: str,
    model: str,
    key_env: str,
    fallback_key_env: Optional[str] = None,
) -> str:
    """Send the visualization request to one Gemini image model."""
    api_key = os.getenv(key_env)
    if not api_key and fallback_key_env:
        api_key = os.getenv(fallback_key_env)
    if not api_key:
        raise RuntimeError("Render service key not configured.")

    client = genai.Client(api_key=api_key)
    image_part = types.Part(inline_data=types.Blob(data=img_bytes, mime_type=mime))
    response = client.models.generate_content(
        model=model,
        contents=[image_part, prompt],
        config=types.GenerateContentConfig(max_output_tokens=8192),
    )
    return _extract_image(response)


def _extract_image(response) -> str:
    """Pull the first inline image part out of a render response as a data URL."""
    if getattr(response, "prompt_feedback", None):
        block = getattr(response.prompt_feedback, "block_reason", None)
        if block:
            raise RuntimeError("Visualization blocked by content policy.")

    candidates = getattr(response, "candidates", None) or []
    if not candidates or not candidates[0].content:
        raise RuntimeError("No image generated.")

    for part in candidates[0].content.parts or []:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data and inline.mime_type:
            data = inline.data
            if isinstance(data, (bytes, bytearray)):
                data = base64.b64encode(data).decode()
            return f"data:{inline.mime_type};base64,{data}"

    raise RuntimeError("No inline image returned by render backend.")



