#!/usr/bin/env python3
"""Validate locally generated Dynamic Webs ground-web assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

from web_asset_visibility import (
    AUTHORED_FIBRE_STANDARD_ID,
    visibility_thresholds,
)
from web_ground_asset_config import (
    DEFAULT_MASTER_SEED,
    GENERATOR_VERSION,
    GROUND_ASSET_SPECS,
)


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    default_manifest = (
        repository_root / "assets" / "web-ground" / "generated" / "manifest.json"
    )
    parser = argparse.ArgumentParser(description="Validate generated ground-web assets.")
    parser.add_argument("--manifest", type=Path, default=default_manifest)
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    manifest_path = arguments.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if manifest.get("schemaVersion") != 1:
        raise ValueError("Unsupported or missing manifest schemaVersion.")

    generator = manifest.get("generator")
    if not isinstance(generator, dict):
        raise ValueError("Manifest requires generator metadata.")
    if generator.get("version") != GENERATOR_VERSION:
        raise ValueError(
            f'Manifest generator version must be "{GENERATOR_VERSION}"; '
            "regenerate the ground assets."
        )
    if generator.get("masterSeed") != DEFAULT_MASTER_SEED:
        raise ValueError(
            f'Manifest master seed must be "{DEFAULT_MASTER_SEED}"; '
            "regenerate the ground assets."
        )
    if generator.get("authoredFibreStandard") != AUTHORED_FIBRE_STANDARD_ID:
        raise ValueError(
            f'Manifest authored fibre standard must be '
            f'"{AUTHORED_FIBRE_STANDARD_ID}"; regenerate the ground assets.'
        )
    if generator.get("topology") != "irregular-radial-sheet":
        raise ValueError(
            'Manifest must identify the ground asset topology as '
            '"irregular-radial-sheet".'
        )

    assets = manifest.get("assets")
    if not isinstance(assets, list) or len(assets) != len(GROUND_ASSET_SPECS):
        raise ValueError(
            f"Manifest must contain exactly {len(GROUND_ASSET_SPECS)} assets."
        )

    expected_ids = {spec.asset_id for spec in GROUND_ASSET_SPECS}
    actual_ids = {str(record.get("id", "")).strip() for record in assets}
    if actual_ids != expected_ids:
        raise ValueError("Manifest asset IDs do not match the authored ground catalog.")

    hashes: set[str] = set()
    for record in assets:
        asset_id = str(record["id"])
        path = manifest_path.parent / str(record["file"])
        if path.suffix.lower() != ".webp" or not path.is_file():
            raise FileNotFoundError(path)

        digest = sha256_file(path)
        if digest != record.get("sha256"):
            raise ValueError(f'SHA-256 mismatch for "{asset_id}".')
        if digest in hashes:
            raise ValueError(f'Duplicate rendered asset detected for "{asset_id}".')
        hashes.add(digest)

        with Image.open(path) as image:
            if str(image.format).upper() != "WEBP":
                raise ValueError(f'Asset "{asset_id}" is not WebP.')
            rgba = image.convert("RGBA")
            alpha = rgba.getchannel("A")
            extrema = alpha.getextrema()
            if extrema is None or extrema[1] <= 0 or extrema[0] != 0:
                raise ValueError(
                    f'Asset "{asset_id}" must contain transparent and visible pixels.'
                )
            assert_soft_border(alpha, asset_id)
            assert_visible_fibre_density(alpha, asset_id)

        source = record.get("source")
        for name in ("pivot", "firstAnchor", "secondAnchor"):
            point = source.get(name) if isinstance(source, dict) else None
            if not isinstance(point, dict) or not all(
                isinstance(point.get(axis), (int, float)) for axis in ("x", "y")
            ):
                raise ValueError(
                    f'Asset "{asset_id}" has invalid source anchor metadata.'
                )

    print(
        f"Validated {len(assets)} deterministic ground-web assets from "
        f"{manifest_path}."
    )
    return 0


def assert_visible_fibre_density(alpha: Image.Image, asset_id: str) -> None:
    histogram = alpha.histogram()
    total_pixels = alpha.width * alpha.height
    if total_pixels <= 0:
        raise ValueError(f'Asset "{asset_id}" has invalid dimensions.')

    # The radial sheet occupies a circular footprint inside the square source
    # canvas, so aggregate whole-canvas thresholds use an explicit occupancy
    # factor while retaining the shared per-fibre width and alpha floor.
    required_mean_alpha, required_alpha_64, required_alpha_128 = (
        visibility_thresholds(0.78)
    )

    mean_alpha = (
        sum(value * count for value, count in enumerate(histogram)) / total_pixels
    )
    alpha_64_coverage = sum(histogram[65:]) / total_pixels
    alpha_128_coverage = sum(histogram[129:]) / total_pixels

    if mean_alpha < required_mean_alpha:
        raise ValueError(
            f'Asset "{asset_id}" is too faint: mean alpha {mean_alpha:.3f} '
            f"is below {required_mean_alpha:.3f}."
        )
    if alpha_64_coverage < required_alpha_64:
        raise ValueError(
            f'Asset "{asset_id}" is too faint: alpha>64 coverage '
            f"{alpha_64_coverage:.4%} is below {required_alpha_64:.4%}."
        )
    if alpha_128_coverage < required_alpha_128:
        raise ValueError(
            f'Asset "{asset_id}" is too faint: alpha>128 coverage '
            f"{alpha_128_coverage:.4%} is below {required_alpha_128:.4%}."
        )


def assert_soft_border(alpha: Image.Image, asset_id: str) -> None:
    width, height = alpha.size
    values = []
    values.extend(_flatten_pixels(alpha.crop((0, 0, width, 1))))
    values.extend(_flatten_pixels(alpha.crop((0, height - 1, width, height))))
    values.extend(_flatten_pixels(alpha.crop((0, 0, 1, height))))
    values.extend(_flatten_pixels(alpha.crop((width - 1, 0, width, height))))
    if max(values, default=0) > 16:
        raise ValueError(f'Asset "{asset_id}" has a hard opaque border.')


def _flatten_pixels(image: Image.Image) -> list[int]:
    flattened = getattr(image, "get_flattened_data", None)
    if callable(flattened):
        return list(flattened())
    return list(image.getdata())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
