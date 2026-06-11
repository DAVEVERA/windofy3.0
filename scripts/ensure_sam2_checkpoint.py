"""Ensure the SAM2 checkpoint exists before starting the AI service.

The checkpoint is intentionally not committed to git. Production containers can
set SAM2_CHECKPOINT_URL to download it into SAM2_CHECKPOINT_PATH on first boot.
"""

from __future__ import annotations

import os
import sys
import urllib.request
from pathlib import Path


DEFAULT_CHECKPOINT = Path("models/sam2.1_hiera_large.pt")


def checkpoint_path() -> Path:
    configured = os.getenv("SAM2_CHECKPOINT_PATH", "").strip()
    return Path(configured or DEFAULT_CHECKPOINT).expanduser()


def main() -> int:
    checkpoint = checkpoint_path()
    if checkpoint.exists():
        print(f"SAM2 checkpoint found at {checkpoint}")
        return 0

    url = os.getenv("SAM2_CHECKPOINT_URL", "").strip()
    if not url:
        print(
            f"SAM2 checkpoint missing at {checkpoint}; set SAM2_CHECKPOINT_URL "
            "or mount the checkpoint before starting the AI service.",
            file=sys.stderr,
        )
        return 0

    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = checkpoint.with_suffix(checkpoint.suffix + ".part")
    print(f"Downloading SAM2 checkpoint to {checkpoint}")
    urllib.request.urlretrieve(url, tmp_path)
    tmp_path.replace(checkpoint)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
