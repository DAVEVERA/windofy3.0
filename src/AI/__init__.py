"""Generic AI vision and visualization pipeline package."""

from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
except Exception:
    pass

__all__ = [
    "analyse_vision",
    "clean_window",
    "prompts",
    "render_blind",
    "render_engine",
    "render_image",
    "sam2_segment",
    "utils",
    "warp_blind",
]
