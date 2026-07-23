#!/usr/bin/env python3
"""Generate deterministic transparent web-carpet patch assets and a manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from web_asset_config import (
    ASSET_SPECS,
    DEFAULT_MASTER_SEED,
    DEFAULT_SIZE_PX,
    DEFAULT_SUPERSAMPLE,
    GENERATOR_VERSION,
)
from web_patch_geometry import create_asset_random
from web_patch_renderer import render_patch
from web_asset_visibility import AUTHORED_FIBRE_STANDARD_ID


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    default_output = repository_root / "assets" / "web-carpet" / "generated"

    parser = argparse.ArgumentParser(
        description=(
            "Generate original, deterministic, tintable WebP patch assets for "
            "Dynamic Webs web-carpet composition."
        )
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=default_output,
        help=f"Output directory. Default: {default_output}",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=DEFAULT_SIZE_PX,
        help=f"Square output size in pixels. Default: {DEFAULT_SIZE_PX}",
    )
    parser.add_argument(
        "--supersample",
        type=int,
        default=DEFAULT_SUPERSAMPLE,
        help=f"Internal antialiasing multiplier. Default: {DEFAULT_SUPERSAMPLE}",
    )
    parser.add_argument(
        "--seed",
        default=DEFAULT_MASTER_SEED,
        help="Master deterministic seed.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove existing generated WebP, PNG and JSON outputs before generating.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Create preview-sheet.webp after generating.",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    output_directory = arguments.output.resolve()
    output_directory.mkdir(parents=True, exist_ok=True)

    if arguments.clean:
        clean_generated_outputs(output_directory)

    size_px = validate_size(arguments.size)
    supersample = validate_supersample(arguments.supersample)
    asset_records = []

    for spec in ASSET_SPECS:
        random_source = create_asset_random(arguments.seed, spec.asset_id)
        image = render_patch(
            spec,
            random_source,
            size_px=size_px,
            supersample=supersample,
        )

        filename = f"{spec.asset_id}.webp"
        file_path = output_directory / filename
        image.save(
            file_path,
            format="WEBP",
            lossless=True,
            quality=100,
            method=4,
            exact=True,
        )

        asset_records.append(
            {
                "id": spec.asset_id,
                "category": spec.category,
                "variant": spec.variant,
                "file": filename,
                "modulePath": (
                    f"modules/dynamic-webs/assets/web-carpet/generated/{filename}"
                ),
                "width": image.width,
                "height": image.height,
                "sha256": sha256_file(file_path),
                "weight": spec.weight,
                "recommendedScale": [
                    spec.recommended_scale_min,
                    spec.recommended_scale_max,
                ],
                "recommendedAlpha": [
                    spec.recommended_alpha_min,
                    spec.recommended_alpha_max,
                ],
                "allowRotation": True,
                "allowFlipX": True,
                "allowFlipY": True,
                "tintable": True,
            }
        )
        print(f"Generated {file_path}")

    manifest = {
        "schemaVersion": 1,
        "generator": {
            "name": "Dynamic Webs procedural web-patch generator",
            "version": GENERATOR_VERSION,
            "masterSeed": arguments.seed,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "deterministicContent": True,
            "authoredFibreStandard": AUTHORED_FIBRE_STANDARD_ID,
        },
        "rendering": {
            "format": "webp",
            "colourMode": "transparent-white",
            "sizePx": size_px,
            "supersample": supersample,
        },
        "assets": asset_records,
    }

    manifest_path = output_directory / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {manifest_path}")

    if arguments.preview:
        from build_web_patch_preview import build_preview

        preview_path = output_directory / "preview-sheet.webp"
        build_preview(manifest_path, preview_path)
        print(f"Wrote {preview_path}")

    return 0


def clean_generated_outputs(output_directory: Path) -> None:
    for pattern in ("*.webp", "*.png", "*.json"):
        for path in output_directory.glob(pattern):
            if path.name == ".gitkeep":
                continue
            path.unlink()


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
