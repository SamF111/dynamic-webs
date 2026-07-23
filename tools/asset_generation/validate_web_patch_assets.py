#!/usr/bin/env python3
"""Validate generated lossless WebP patch files and their authored manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

from web_asset_config import (
    ASSET_SPECS,
    DEFAULT_MASTER_SEED,
    GENERATOR_VERSION,
)
from web_asset_visibility import (
    AUTHORED_FIBRE_STANDARD_ID,
    BASE_MINIMUM_ALPHA_128_COVERAGE,
    BASE_MINIMUM_ALPHA_64_COVERAGE,
    BASE_MINIMUM_MEAN_ALPHA,
)


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    default_manifest = (
        repository_root
        / "assets"
        / "web-carpet"
        / "generated"
        / "manifest.json"
    )

    parser = argparse.ArgumentParser(description="Validate generated web patches.")
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
            "regenerate the carpet assets."
        )
    if generator.get("masterSeed") != DEFAULT_MASTER_SEED:
        raise ValueError(
            f'Manifest master seed must be "{DEFAULT_MASTER_SEED}"; '
            "regenerate the carpet assets."
        )
    if generator.get("authoredFibreStandard") != AUTHORED_FIBRE_STANDARD_ID:
        raise ValueError(
            f'Manifest authored fibre standard must be '
            f'"{AUTHORED_FIBRE_STANDARD_ID}"; regenerate the carpet assets.'
        )

    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        raise ValueError("Manifest must contain a non-empty assets array.")

    expected_ids = [spec.asset_id for spec in ASSET_SPECS]
    if [record.get("id") for record in assets] != expected_ids:
        raise ValueError("Manifest asset IDs do not match the authored carpet catalogue.")

    identifiers: set[str] = set()
    hashes: set[str] = set()

    for record in assets:
        asset_id = require_text(record.get("id"), "asset id")
        if asset_id in identifiers:
            raise ValueError(f'Duplicate asset ID "{asset_id}".')
        identifiers.add(asset_id)

        file_name = require_text(record.get("file"), f"file for {asset_id}")
        if Path(file_name).suffix.lower() != ".webp":
            raise ValueError(f'Asset "{asset_id}" must use a .webp file.')
        path = manifest_path.parent / file_name
        if not path.is_file():
            raise FileNotFoundError(path)

        digest = sha256_file(path)
        if digest != record.get("sha256"):
            raise ValueError(f'SHA-256 mismatch for "{asset_id}".')
        if digest in hashes:
            raise ValueError(f'Duplicate pixel file detected for "{asset_id}".')
        hashes.add(digest)

        with Image.open(path) as image:
            if str(image.format).upper() != "WEBP":
                raise ValueError(f'Asset "{asset_id}" is not encoded as WebP.')
            rgba = image.convert("RGBA")
            if rgba.size != (int(record["width"]), int(record["height"])):
                raise ValueError(f'Dimension mismatch for "{asset_id}".')
            alpha = rgba.getchannel("A")
            extrema = alpha.getextrema()
            if extrema is None or extrema[1] <= 0:
                raise ValueError(f'Asset "{asset_id}" has no visible alpha.')
            if extrema[0] != 0:
                raise ValueError(f'Asset "{asset_id}" is not transparent.')
            assert_border_is_soft(alpha, asset_id)
            assert_visible_fibre_density(
                alpha,
                asset_id,
                category=require_text(record.get("category"), f"category for {asset_id}"),
            )

    print(
        f"Validated {len(assets)} deterministic web-patch assets "
        f"from {manifest_path}."
    )
    return 0


CARPET_VISIBILITY_FACTORS = {
    # (mean-alpha factor, alpha>64 coverage factor, alpha>128 factor)
    "loose-network": (0.72, 1.00, 0.20),
    "support-arc": (0.62, 0.75, 0.07),
    "dense-knot": (1.00, 1.00, 0.25),
    "fray": (0.42, 0.50, 0.00),
    "faint-sheet": (0.85, 0.80, 0.00),
}


def assert_visible_fibre_density(
    alpha: Image.Image,
    asset_id: str,
    *,
    category: str,
) -> None:
    factors = CARPET_VISIBILITY_FACTORS.get(category)
    if factors is None:
        raise ValueError(f'Asset "{asset_id}" has unsupported category "{category}".')

    values = list(pixel_values(alpha))
    if not values:
        raise ValueError(f'Asset "{asset_id}" has invalid dimensions.')

    mean_factor, visible_factor, strong_factor = factors
    required_mean = BASE_MINIMUM_MEAN_ALPHA * mean_factor
    required_64 = BASE_MINIMUM_ALPHA_64_COVERAGE * visible_factor
    required_128 = BASE_MINIMUM_ALPHA_128_COVERAGE * strong_factor
    mean_alpha = sum(values) / len(values)
    coverage_64 = sum(value > 64 for value in values) / len(values)
    coverage_128 = sum(value > 128 for value in values) / len(values)

    if mean_alpha < required_mean:
        raise ValueError(
            f'Asset "{asset_id}" is too faint: mean alpha {mean_alpha:.3f} '
            f'is below {required_mean:.3f}.'
        )
    if coverage_64 < required_64:
        raise ValueError(
            f'Asset "{asset_id}" lacks visible fibre coverage: '
            f'{coverage_64:.4%} is below {required_64:.4%}.'
        )
    if coverage_128 < required_128:
        raise ValueError(
            f'Asset "{asset_id}" lacks strong fibre coverage: '
            f'{coverage_128:.4%} is below {required_128:.4%}.'
        )


def assert_border_is_soft(alpha: Image.Image, asset_id: str) -> None:
    width, height = alpha.size
    border_values = []
    border_values.extend(pixel_values(alpha.crop((0, 0, width, 1))))
    border_values.extend(pixel_values(alpha.crop((0, height - 1, width, height))))
    border_values.extend(pixel_values(alpha.crop((0, 0, 1, height))))
    border_values.extend(pixel_values(alpha.crop((width - 1, 0, width, height))))

    if max(border_values, default=0) > 16:
        raise ValueError(
            f'Asset "{asset_id}" has a hard non-transparent outer border.'
        )


def pixel_values(image: Image.Image):
    getter = getattr(image, "get_flattened_data", None)
    if callable(getter):
        return getter()
    return image.getdata()


def require_text(value: object, label: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"Missing {label}.")
    return text


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
