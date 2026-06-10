"""
Provider-neutral prompts and model settings for the vision analysis pipeline.

The prompts describe generic interior, window, lighting, and product-fit
analysis. They intentionally avoid backend product source, brand-specific language,
and business-specific product names.
"""

import os


def _env(name: str, default: str = "") -> str:
    """Return an env var only when it contains a non-empty value."""
    return os.getenv(name, "").strip() or default


ANALYSIS_MODEL = _env("VISION_ANALYSIS_MODEL", _env("ANALYSIS_MODEL", "claude-opus-4-1-20250805"))
FALLBACK_MODEL = _env("VISION_FALLBACK_MODEL", _env("FALLBACK_MODEL", "claude-sonnet-4-5-20250929"))
LIVE_GUIDANCE_LANGUAGE = _env("LIVE_GUIDANCE_LANGUAGE", "nl-NL")

_PROMPT_SEP = "â”€" * 60

_BASE_PROMPT = f"""
You are a provider-neutral computer vision and interior visualization analyst.

Analyze the supplied room/window image for a standalone window-treatment
configuration pipeline. Return strict JSON only. Do not recommend backend,
business, product source, or brand-specific products.

Rules:
- Preserve measured geometry and visible scene evidence over aesthetic guesses.
- Be explicit about uncertainty.
- Do not invent product availability, prices, reviews, or product entries.
- Keep recommendations generic and technically useful.
{_PROMPT_SEP}
""".strip()

_PHASE_PROMPTS: dict[int, str] = {
    2: """
Phase 2: image quality gate.
Decide whether the image is usable for window analysis and visualization.
Existing curtains, shutters, blinds, or other window treatments are allowed;
they should be flagged but should not fail quality by themselves.
""",
    3: """
Phase 3: interior style analysis.
Extract the dominant style, mood, material language, and design cues that matter
for a generic window-treatment recommendation.
""",
    4: """
Phase 4: color analysis.
Extract visible room colors from the photo. Use generic color families and
design roles, not product-source color names.
""",
    5: """
Phase 5: forensic window architecture analysis.
Identify window type, count, recess depth, frame type, sill, handles, vents,
opening direction, collision risks, and mounting constraints.
""",
    7: """
Phase 7: lighting analysis.
Analyze light direction, intensity, softness, temperature, reflections, shadows,
and how these influence material suitability and realistic rendering.
""",
    8: """
Phase 8: generic product-fit recommendations.
Recommend generic material/color/configuration directions based on the previous
analysis. Do not reference product source, brands, backends, businesses, or
availability. Keep recommendations usable by any standalone product database.
""",
}


def get_phase_prompt(phase: int) -> str:
    """Return the provider-neutral system prompt for a pipeline phase."""
    try:
        phase_prompt = _PHASE_PROMPTS[phase]
    except KeyError as exc:
        raise ValueError(f"Unknown analysis phase: {phase}") from exc
    return f"{_BASE_PROMPT}\n\n{phase_prompt.strip()}"


