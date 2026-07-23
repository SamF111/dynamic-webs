#!/usr/bin/env python3
"""Generate deterministic transparent-white Dynamic Webs span assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from datetime import datetime, timezone
from pathlib import Path

from web_span_asset_config import (
    DEFAULT_MASTER_SEED,
    DEFAULT_SIZE_PX,
    DEFAULT_SUPERSAMPLE,
    GENERATOR_VERSION,
    SOURCE_FIRST_WALL_END,
    SOURCE_FIRST_WALL_START,
    SOURCE_SECOND_WALL_END,
    SOURCE_SECOND_WALL_START,
    SPAN_ASSET_SPECS,
)
from web_span_asset_renderer import render_span_asset
from web_asset_visibility import AUTHORED_FIBRE_STANDARD_ID


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(
        description="Generate deterministic four-anchor wall-span WebP assets."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=repository_root / "assets" / "web-span" / "generated",
    )
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE_PX)
    parser.add_argument("--supersample", type=int, default=DEFAULT_SUPERSAMPLE)
    parser.add_argument("--seed", default=DEFAULT_MASTER_SEED)
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--preview", action="store_true")
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    size_px = validate_size(arguments.size)
    supersample = validate_supersample(arguments.supersample)
    output = arguments.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    if arguments.clean:
        for pattern in ("*.webp", "*.png", "*.json"):
            for path in output.glob(pattern):
                if path.name != ".gitkeep":
                    path.unlink()

    records = []
    source_quad = {
        "firstWallStart": _point_record(SOURCE_FIRST_WALL_START),
        "firstWallEnd": _point_record(SOURCE_FIRST_WALL_END),
        "secondWallStart": _point_record(SOURCE_SECOND_WALL_START),
        "secondWallEnd": _point_record(SOURCE_SECOND_WALL_END),
    }

    for spec in SPAN_ASSET_SPECS:
        seed_text = f"{arguments.seed}:{spec.asset_id}"
        source = random.Random(
            int(hashlib.sha256(seed_text.encode("utf-8")).hexdigest(), 16)
        )
        image = render_span_asset(
            spec,
            source,
            size_px=size_px,
            supersample=supersample,
        )
        filename = f"{spec.asset_id}.webp"
        path = output / filename
        image.save(
            path,
            format="WEBP",
            lossless=True,
            quality=100,
            method=4,
            exact=True,
        )
        records.append(
            {
                "id": spec.asset_id,
                "variant": spec.variant,
                "file": filename,
                "modulePath": (
                    f"modules/dynamic-webs/assets/web-span/generated/{filename}"
                ),
                "width": image.width,
                "height": image.height,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "weight": spec.weight,
                "recommendedAlpha": [
                    spec.recommended_alpha_min,
                    spec.recommended_alpha_max,
                ],
                "tintable": True,
                "warpMode": "piecewise-affine-quad",
                "source": source_quad,
            }
        )
        print(f"Generated {path}")

    manifest = {
        "schemaVersion": 2,
        "generator": {
            "name": "Dynamic Webs distributed span-sheet asset generator",
            "version": GENERATOR_VERSION,
            "masterSeed": arguments.seed,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "deterministicContent": True,
            "authoredFibreStandard": AUTHORED_FIBRE_STANDARD_ID,
            "topology": "distributed-span-sheet",
        },
        "rendering": {
            "format": "webp",
            "colourMode": "transparent-white",
            "sizePx": size_px,
            "supersample": supersample,
            "warpMode": "piecewise-affine-quad",
        },
        "assets": records,
    }
    manifest_path = output / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {manifest_path}")

    if arguments.preview:
        from build_span_web_preview import build_preview

        preview_path = output / "preview-sheet.webp"
        build_preview(manifest_path, preview_path)
        print(f"Wrote {preview_path}")
    return 0


def validate_size(value: int) -> int:
    number = int(value)
    if number < 128 or number > 2048:
        raise ValueError("--size must be between 128 and 2048 pixels.")
    return number


def validate_supersample(value: int) -> int:
    number = int(value)
    if number < 1 or number > 8:
        raise ValueError("--supersample must be between 1 and 8.")
    return number


def _point_record(point: tuple[float, float]) -> dict[str, float]:
    return {"x": point[0], "y": point[1]}


if __name__ == "__main__":
    raise SystemExit(main())
