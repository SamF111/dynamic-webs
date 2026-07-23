#!/usr/bin/env python3
"""Generate deterministic angle-family Dynamic Webs corner WebP assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from web_corner_asset_config import (
    CORNER_ASSET_SPECS,
    DEFAULT_MASTER_SEED,
    DEFAULT_SIZE_PX,
    DEFAULT_SUPERSAMPLE,
    GENERATOR_VERSION,
    SOURCE_ANCHOR_RADIUS,
    SOURCE_PIVOT,
)
from web_corner_asset_renderer import render_corner_asset
from web_patch_geometry import create_asset_random
from web_asset_visibility import AUTHORED_FIBRE_STANDARD_ID


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    default_output = repository_root / "assets" / "web-corner" / "generated"
    parser = argparse.ArgumentParser(
        description="Generate deterministic transparent-white corner-web assets."
    )
    parser.add_argument("--output", type=Path, default=default_output)
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE_PX)
    parser.add_argument("--supersample", type=int, default=DEFAULT_SUPERSAMPLE)
    parser.add_argument("--seed", default=DEFAULT_MASTER_SEED)
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--preview", action="store_true")
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    output_directory = arguments.output.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)

    if arguments.clean:
        for pattern in ("*.webp", "*.png", "*.json"):
            for path in output_directory.glob(pattern):
                if path.name != ".gitkeep":
                    path.unlink()

    size_px = validate_size(arguments.size)
    supersample = validate_supersample(arguments.supersample)
    records = []

    for spec in CORNER_ASSET_SPECS:
        random_source = create_asset_random(arguments.seed, spec.asset_id)
        image = render_corner_asset(
            spec,
            random_source,
            size_px=size_px,
            supersample=supersample,
        )
        filename = f"{spec.asset_id}.webp"
        path = output_directory / filename
        image.save(
            path,
            format="WEBP",
            lossless=True,
            quality=100,
            method=4,
            exact=True,
        )

        angle = spec.canonical_angle_deg
        radians = angle * 3.141592653589793 / 180.0
        source_pivot = {"x": SOURCE_PIVOT[0], "y": SOURCE_PIVOT[1]}
        first_anchor = {
            "x": SOURCE_PIVOT[0] + SOURCE_ANCHOR_RADIUS,
            "y": SOURCE_PIVOT[1],
        }
        second_anchor = {
            "x": SOURCE_PIVOT[0] + math.cos(radians) * SOURCE_ANCHOR_RADIUS,
            "y": SOURCE_PIVOT[1] + math.sin(radians) * SOURCE_ANCHOR_RADIUS,
        }

        records.append(
            {
                "id": spec.asset_id,
                "canonicalAngleDeg": angle,
                "supportedAngleRangeDeg": [
                    spec.supported_angle_min_deg,
                    spec.supported_angle_max_deg,
                ],
                "variant": spec.variant,
                "file": filename,
                "modulePath": f"modules/dynamic-webs/assets/web-corner/generated/{filename}",
                "width": image.width,
                "height": image.height,
                "sha256": sha256_file(path),
                "weight": spec.weight,
                "recommendedAlpha": [
                    spec.recommended_alpha_min,
                    spec.recommended_alpha_max,
                ],
                "tintable": True,
                "source": {
                    "pivot": source_pivot,
                    "firstAnchor": first_anchor,
                    "secondAnchor": second_anchor,
                },
            }
        )
        print(f"Generated {path}")

    manifest = {
        "schemaVersion": 1,
        "generator": {
            "name": "Dynamic Webs procedural corner-web asset generator",
            "version": GENERATOR_VERSION,
            "masterSeed": arguments.seed,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "deterministicContent": True,
            "authoredFibreStandard": AUTHORED_FIBRE_STANDARD_ID,
            "topology": "distributed-sheet",
        },
        "rendering": {
            "format": "webp",
            "colourMode": "transparent-white",
            "sizePx": size_px,
            "supersample": supersample,
        },
        "assets": records,
    }

    manifest_path = output_directory / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {manifest_path}")

    if arguments.preview:
        from build_corner_web_preview import build_preview

        preview_path = output_directory / "preview-sheet.webp"
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
