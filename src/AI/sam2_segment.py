"""
Window detection and segmentation.

Detects the window region in a room photo and returns both bounds and a
binary mask. The mask tells downstream render/compositing stages which pixels belong to the window region.
"""

import os
import sys
import base64
import io
from collections import deque
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.AI.utils import strip_data_url


_PREDICTOR = None


def sam2_checkpoint_path() -> Path:
    configured = os.getenv("SAM2_CHECKPOINT_PATH", "").strip()
    if configured:
        return Path(configured).expanduser()
    return ROOT / "models" / "sam2.1_hiera_large.pt"


def get_sam2_predictor():
    """Lazy-load SAM2 predictor. Cached after first call."""
    global _PREDICTOR
    if _PREDICTOR is not None:
        return _PREDICTOR

    try:
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
    except ImportError as exc:
        raise RuntimeError(f"SAM2 not installed: {exc}")

    checkpoint = sam2_checkpoint_path()
    if not checkpoint.exists():
        raise FileNotFoundError(
            f"SAM2.1 checkpoint missing at {checkpoint}. "
            f"Download from https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt"
        )

    config = "configs/sam2.1/sam2.1_hiera_l.yaml"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = build_sam2(config, str(checkpoint), device=device)
    _PREDICTOR = SAM2ImagePredictor(model)
    return _PREDICTOR


def detect_window_bounds(image_b64: str) -> dict:
    """
    Detect the window region in a room photo.

    Strategy: prompt SAM2 with a small grid of foreground points across the
    upper-middle band of the image (where windows typically live), then
    pick the largest contiguous mask. This handles multi-panel windows
    (side panels + door, transom + main pane) better than a single point.

    Returns:
        {
          "success": bool,
          "bounds": {"x": int, "y": int, "w": int, "h": int},
          "confidence": float,
          "mask_b64": "data:image/png;base64,...",  # binary mask
          "overlay_b64": "data:image/png;base64,..." # original + red rect outline
        }
    or {"success": False, "error": "..."}
    """
    try:
        mime, raw_b64 = strip_data_url(image_b64)
        img_bytes = base64.b64decode(raw_b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_w, img_h = img.size
        np_img = np.array(img)
        cv_openings = _detect_window_openings(img)

        try:
            predictor = get_sam2_predictor()
        except Exception as exc:
            return _fallback_window_bounds(img, f"{type(exc).__name__}: {exc}", cv_openings)

        predictor.set_image(np_img)

        # Strategy: tight cluster of positive seeds on the upper-middle (where
        # windows live in interior photos) + explicit negative seeds at image
        # corners and edge midpoints (almost always wall/floor/ceiling, never
        # window). The negatives push SAM2 away from picking the entire alcove.
        pos_xs = [int(img_w * f) for f in (0.35, 0.50, 0.65)]
        pos_ys = [int(img_h * f) for f in (0.35, 0.45)]
        pos = [(x, y) for y in pos_ys for x in pos_xs]

        m = 0.04  # 4% margin from image edge for negatives
        neg = [
            (int(img_w * m),         int(img_h * m)),          # TL
            (int(img_w * (1 - m)),   int(img_h * m)),          # TR
            (int(img_w * m),         int(img_h * (1 - m))),    # BL
            (int(img_w * (1 - m)),   int(img_h * (1 - m))),    # BR
            (int(img_w * m),         int(img_h * 0.50)),       # mid-left
            (int(img_w * (1 - m)),   int(img_h * 0.50)),       # mid-right
            (int(img_w * 0.50),      int(img_h * (1 - m))),    # bottom-mid (floor)
        ]

        points = np.array(pos + neg, dtype=np.float32)
        labels = np.array([1] * len(pos) + [0] * len(neg), dtype=np.int32)

        masks, scores, _ = predictor.predict(
            point_coords=points,
            point_labels=labels,
            multimask_output=True,
        )

        if masks is None or len(masks) == 0:
            return {"success": False, "error": "SAM2 returned no masks"}

        # Pick mask with highest SAM2 confidence score, filtered to plausible
        # window-area range (5% < area < 65% of image â€” rules out tiny artifacts
        # AND whole-alcove blobs that the negatives didn't fully suppress).
        candidates = []
        total = float(img_w * img_h)
        for i, (m_arr, s) in enumerate(zip(masks, scores)):
            frac = m_arr.sum() / total
            if 0.05 <= frac <= 0.65:
                candidates.append((float(s), i, m_arr))
        if not candidates:
            # Fall back: just take highest score
            best_idx = int(np.argmax(scores))
        else:
            candidates.sort(key=lambda c: -c[0])
            best_idx = candidates[0][1]

        mask = masks[best_idx].astype(np.uint8)
        score = float(scores[best_idx])

        if mask.sum() == 0:
            return {"success": False, "error": "Selected mask is empty"}

        # Bounding box from mask
        ys_nz, xs_nz = np.where(mask > 0)
        x_min, x_max = int(xs_nz.min()), int(xs_nz.max())
        y_min, y_max = int(ys_nz.min()), int(ys_nz.max())

        bounds = {
            "x": x_min,
            "y": y_min,
            "w": x_max - x_min,
            "h": y_max - y_min,
        }

        # Sanity check â€” reject pathological masks
        area_frac = mask.sum() / float(img_w * img_h)
        if area_frac < 0.02 or area_frac > 0.85:
            return {
                "success": False,
                "error": f"Mask area fraction {area_frac:.2f} outside plausible range",
            }

        # Build overlay image: original + red rectangle outline
        overlay = img.copy()
        draw = ImageDraw.Draw(overlay)
        draw.rectangle(
            [x_min, y_min, x_max, y_max],
            outline=(255, 0, 0),
            width=max(4, img_w // 200),
        )
        for box in cv_openings:
            draw.rectangle(
                [box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]],
                outline=(244, 125, 39),
                width=max(3, img_w // 260),
            )

        openings = cv_openings or [bounds]
        output_mask = mask * 255
        if len(cv_openings) > 1:
            opening_mask = np.zeros((img_h, img_w), dtype=np.uint8)
            for box in cv_openings:
                opening_mask[box["y"]:box["y"] + box["h"] + 1, box["x"]:box["x"] + box["w"] + 1] = 255
            output_mask = opening_mask

        return {
            "success":     True,
            "bounds":      bounds,
            "openings":    openings,
            "detected_count": len(openings),
            "image_size":  {"w": img_w, "h": img_h},
            "confidence":  score,
            "mask_b64":    _png_b64(output_mask),
            "overlay_b64": _pil_b64(overlay),
        }

    except Exception as e:
        try:
            mime, raw_b64 = strip_data_url(image_b64)
            img = Image.open(io.BytesIO(base64.b64decode(raw_b64))).convert("RGB")
            return _fallback_window_bounds(img, f"{type(e).__name__}: {e}", _detect_window_openings(img))
        except Exception:
            return {"success": False, "error": f"{type(e).__name__}: {e}"}


def _fallback_window_bounds(img: Image.Image, reason: str = "", openings: Optional[list[dict]] = None) -> dict:
    """
    Lightweight deterministic window detector used when SAM2 is unavailable.

    It looks for bright, cool-toned rectangular regions common in window glass.
    If that fails, it returns a conservative central prior so downstream stages
    still receive an editable region instead of crashing.
    """
    w, h = img.size
    openings = openings or _detect_window_openings(img)
    confidence = 0.35

    if openings:
        x_min = min(item["x"] for item in openings)
        y_min = min(item["y"] for item in openings)
        x_max = max(item["x"] + item["w"] for item in openings)
        y_max = max(item["y"] + item["h"] for item in openings)
        confidence = 0.74 if len(openings) > 1 else 0.62
    else:
        x_min, x_max = int(w * 0.25), int(w * 0.75)
        y_min, y_max = int(h * 0.12), int(h * 0.72)

    fallback_mask = np.zeros((h, w), dtype=np.uint8)
    if openings:
        for box in openings:
            fallback_mask[box["y"]:box["y"] + box["h"] + 1, box["x"]:box["x"] + box["w"] + 1] = 255
    else:
        fallback_mask[y_min:y_max + 1, x_min:x_max + 1] = 255

    overlay = img.copy()
    draw = ImageDraw.Draw(overlay)
    for box in openings or [{"x": x_min, "y": y_min, "w": x_max - x_min, "h": y_max - y_min}]:
        draw.rectangle(
            [box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]],
            outline=(244, 125, 39),
            width=max(3, w // 220),
        )

    return {
        "success": True,
        "bounds": {"x": x_min, "y": y_min, "w": x_max - x_min, "h": y_max - y_min},
        "openings": openings or [{"x": x_min, "y": y_min, "w": x_max - x_min, "h": y_max - y_min}],
        "detected_count": len(openings) if openings else 1,
        "image_size": {"w": w, "h": h},
        "confidence": confidence,
        "mask_b64": _png_b64(fallback_mask),
        "overlay_b64": _pil_b64(overlay),
        "fallback": True,
        "fallback_reason": reason,
    }


def _detect_window_openings(img: Image.Image) -> list[dict]:
    """
    Detect separate window openings with deterministic CV.

    The detector looks for bright glass/outdoor regions, extracts connected
    components, then merges vertically stacked panes with strong x-overlap.
    This prevents a row of separate windows from collapsing into one box.
    """
    original_w, original_h = img.size
    work_img = img
    max_side = max(original_w, original_h)
    scale = 1.0
    if max_side > 1400:
        scale = 1400 / max_side
        work_img = img.resize((int(original_w * scale), int(original_h * scale)), Image.Resampling.LANCZOS)

    np_img = np.array(work_img.convert("RGB"), dtype=np.float32)
    h, w = np_img.shape[:2]
    r = np_img[..., 0]
    g = np_img[..., 1]
    b = np_img[..., 2]
    mx = np.maximum.reduce([r, g, b])
    mn = np.minimum.reduce([r, g, b])
    brightness = (r + g + b) / (3.0 * 255.0)
    saturation = (mx - mn) / 255.0
    green_view = (g > r * 1.12) & (g > b * 0.90)
    cool_view = b > r * 0.95
    outdoor_green = (brightness > 0.34) & (saturation > 0.08) & green_view
    bright_cool_glass = (brightness > 0.48) & (saturation > 0.06) & cool_view

    mask = outdoor_green | bright_cool_glass
    band = np.zeros_like(mask, dtype=bool)
    band[int(h * 0.08): int(h * 0.88), int(w * 0.05): int(w * 0.95)] = True
    mask &= band

    min_area = max(80, int(w * h * 0.0025))
    boxes = []
    for box in _connected_component_boxes(mask):
        bw = box["x2"] - box["x1"] + 1
        bh = box["y2"] - box["y1"] + 1
        if box["area"] < min_area:
            continue
        if bw < w * 0.025 or bh < h * 0.05:
            continue
        if bw > w * 0.45:
            continue
        boxes.append(box)

    if not boxes:
        return []

    openings = []
    for box in _merge_stacked_panes(boxes, w, h):
        x1 = max(0, int(box["x1"] - w * 0.018))
        y1 = max(0, int(box["y1"] - h * 0.035))
        x2 = min(w - 1, int(box["x2"] + w * 0.018))
        y2 = min(h - 1, int(box["y2"] + h * 0.035))
        bw = x2 - x1
        bh = y2 - y1
        if bw >= w * 0.04 and bh >= h * 0.14:
            inv = 1.0 / scale
            openings.append({
                "x": int(x1 * inv),
                "y": int(y1 * inv),
                "w": int(bw * inv),
                "h": int(bh * inv),
            })

    openings.sort(key=lambda item: item["x"])
    return openings[:12]


def _connected_component_boxes(mask: np.ndarray) -> list[dict]:
    h, w = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    boxes = []

    for y in range(h):
        for x in range(w):
            if visited[y, x] or not mask[y, x]:
                continue

            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y, x] = True
            x1 = x2 = x
            y1 = y2 = y
            area = 0

            while queue:
                cx, cy = queue.popleft()
                area += 1
                x1 = min(x1, cx)
                x2 = max(x2, cx)
                y1 = min(y1, cy)
                y2 = max(y2, cy)

                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if nx < 0 or ny < 0 or nx >= w or ny >= h:
                            continue
                        if visited[ny, nx] or not mask[ny, nx]:
                            continue
                        visited[ny, nx] = True
                        queue.append((nx, ny))

            boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "area": area})

    return boxes


def _merge_stacked_panes(boxes: list[dict], img_w: int, img_h: int) -> list[dict]:
    groups: list[dict] = []

    for box in sorted(boxes, key=lambda item: (item["x1"], item["y1"])):
        placed = False
        for group in groups:
            overlap = min(group["x2"], box["x2"]) - max(group["x1"], box["x1"])
            narrow = max(1, min(group["x2"] - group["x1"], box["x2"] - box["x1"]))
            vertical_gap = max(0, max(group["y1"], box["y1"]) - min(group["y2"], box["y2"]))
            if overlap / narrow > 0.42 and vertical_gap < img_h * 0.22:
                group["x1"] = min(group["x1"], box["x1"])
                group["y1"] = min(group["y1"], box["y1"])
                group["x2"] = max(group["x2"], box["x2"])
                group["y2"] = max(group["y2"], box["y2"])
                group["area"] += box["area"]
                placed = True
                break

        if not placed:
            groups.append(dict(box))

    cleaned = []
    for group in groups:
        bw = group["x2"] - group["x1"] + 1
        bh = group["y2"] - group["y1"] + 1
        if bw > img_w * 0.5 or bh < img_h * 0.12:
            continue
        cleaned.append(group)

    return cleaned


def _png_b64(mask_arr: np.ndarray) -> str:
    """Encode a 2-D uint8 array as base64 PNG data URL."""
    img = Image.fromarray(mask_arr.astype(np.uint8), mode="L")
    return _pil_b64(img)


def _pil_b64(img: Image.Image) -> str:
    """Encode a PIL image as base64 PNG data URL."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

