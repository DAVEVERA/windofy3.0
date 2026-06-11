"""Production smoke checks for the Windofy dual-service runtime.

Default mode checks service readiness only.
Use --web-only when the Python AI service is intentionally not deployed and the
web app should report its own active AI backend.
Use --live-ai to call the paid/remote analysis endpoint.
Use --render together with --live-ai to call the image render endpoint.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import urllib.error
import urllib.request
from typing import Any

from PIL import Image, ImageDraw


def _post_json(url: str, payload: dict[str, Any], timeout: int = 700) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _get_json(url: str, timeout: int = 30) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _synthetic_window_data_url() -> str:
    image = Image.new("RGB", (320, 240), (238, 232, 220))
    draw = ImageDraw.Draw(image)
    draw.rectangle((95, 35, 225, 175), fill=(188, 216, 231), outline=(40, 70, 80), width=5)
    draw.line((160, 35, 160, 175), fill=(40, 70, 80), width=3)
    draw.rectangle((0, 176, 320, 240), fill=(202, 194, 180))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--web-url", default="http://localhost:3000")
    parser.add_argument("--ai-url", default="http://127.0.0.1:5000")
    parser.add_argument("--web-only", action="store_true", help="Skip direct Python AI health and validate web health only.")
    parser.add_argument("--live-ai", action="store_true", help="Call live paid/remote analysis models.")
    parser.add_argument("--render", action="store_true", help="Also call live image rendering. Requires --live-ai.")
    args = parser.parse_args()

    result: dict[str, Any] = {
        "webHealth": None,
        "aiHealth": None,
        "analyze": None,
        "render": None,
    }

    try:
        result["webHealth"] = _get_json(f"{args.web_url.rstrip('/')}/api/health")
        if not args.web_only:
            result["aiHealth"] = _get_json(f"{args.ai_url.rstrip('/')}/health")

        if args.live_ai:
            image_data_url = _synthetic_window_data_url()
            analyze = _post_json(f"{args.web_url.rstrip('/')}/api/ai/analyze", {"imageDataUrl": image_data_url})
            data = analyze.get("data") or {}
            result["analyze"] = {
                "ok": analyze.get("ok") is True,
                "qualityFailed": data.get("qualityFailed"),
                "hasStyle": bool(data.get("style")),
                "hasWindowBounds": bool(data.get("windowBounds")),
                "hasWindowMask": bool(data.get("windowMask")),
                "suggestionsCount": len(data.get("suggestions") or []),
            }

            if args.render:
                render = _post_json(
                    f"{args.web_url.rstrip('/')}/api/ai/render",
                    {
                        "imageDataUrl": image_data_url,
                        "config": {
                            "productType": "Aluminium Jaloezieen",
                            "material": "mat aluminium",
                            "colorName": "warm wit",
                            "colorHex": "#f4f0e8",
                        },
                        "state": "Geheel uitgerold",
                        "mounting": "in de dag",
                        "extraOptions": {"lighting": "Bewolkt", "ladderTape": False, "slatWidth": "50 mm"},
                    },
                )
                image_out = ((render.get("data") or {}).get("imageDataUrl") or "")
                result["render"] = {
                    "ok": render.get("ok") is True,
                    "isImage": image_out.startswith("data:image/"),
                    "length": len(image_out),
                }

        print(json.dumps(result, indent=2, ensure_ascii=False))
        failed = not result["webHealth"].get("ok")
        if result["aiHealth"] is not None:
            failed = failed or not result["aiHealth"].get("ok")
        if result["analyze"] is not None:
            failed = failed or not result["analyze"].get("ok")
        if result["render"] is not None:
            failed = failed or not result["render"].get("ok") or not result["render"].get("isImage")
        return 1 if failed else 0
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        print(json.dumps({"ok": False, "status": exc.code, "body": body[:500]}, indent=2))
        return 1
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc), "errorType": type(exc).__name__}, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
