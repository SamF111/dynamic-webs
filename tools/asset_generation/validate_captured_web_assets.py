#!/usr/bin/env python3
"""Validate locally generated captured-web effect assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

from web_asset_visibility import AUTHORED_FIBRE_STANDARD_ID, visibility_thresholds
from web_captured_asset_config import (
    CAPTURED_ASSET_SPECS,
    DEFAULT_MASTER_SEED,
    GENERATOR_VERSION,
)


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    default_manifest = (
        repository_root / "assets" / "web-captured" / "generated" / "manifest.json"
    )
    parser = argparse.ArgumentParser(description="Validate captured-web assets.")
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
        raise ValueError("Captured assets must be regenerated with the current generator.")
    if generator.get("masterSeed") != DEFAULT_MASTER_SEED:
        raise ValueError("Captured assets use an unexpected master seed.")
    if generator.get("authoredFibreStandard") != AUTHORED_FIBRE_STANDARD_ID:
        raise ValueError("Captured assets use an unexpected fibre standard.")
    if generator.get("topology") != "local-entanglement-overlay":
        raise ValueError("Captured asset topology is invalid.")

    assets = manifest.get("assets")
    if not isinstance(assets, list) or len(assets) != len(CAPTURED_ASSET_SPECS):
        raise ValueError(
            f"Manifest must contain exactly {len(CAPTURED_ASSET_SPECS)} assets."
        )

    expected_ids = {spec.asset_id for spec in CAPTURED_ASSET_SPECS}
    actual_ids = {str(record.get("id", "")).strip() for record in assets}
    if actual_ids != expected_ids:
        raise ValueError("Manifest asset IDs do not match the authored catalog.")

    hashes: set[str] = set()
    minimum_mean, minimum_64, minimum_128 = visibility_thresholds(0.72)

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
            histogram = alpha.histogram()
            total = alpha.width * alpha.height
            mean_alpha = sum(value * count for value, count in enumerate(histogram)) / total
            coverage_64 = sum(histogram[65:]) / total
            coverage_128 = sum(histogram[129:]) / total
            if mean_alpha < minimum_mean:
                raise ValueError(f'Asset "{asset_id}" is too faint.')
            if coverage_64 < minimum_64 or coverage_128 < minimum_128:
                raise ValueError(f'Asset "{asset_id}" has insufficient visible fibre coverage.')
            assert_soft_border(alpha, asset_id)

        source = record.get("source")
        pivot = source.get("pivot") if isinstance(source, dict) else None
        radius = source.get("radius") if isinstance(source, dict) else None
        if not isinstance(pivot, dict) or not all(
            isinstance(pivot.get(axis), (int, float)) for axis in ("x", "y")
        ):
            raise ValueError(f'Asset "{asset_id}" has invalid pivot metadata.')
        if not isinstance(radius, (int, float)) or radius <= 0:
            raise ValueError(f'Asset "{asset_id}" has invalid radius metadata.')

    print(
        f"Validated {len(assets)} deterministic captured-web assets from "
        f"{manifest_path}."
    )
    return 0


def assert_soft_border(alpha: Image.Image, asset_id: str) -> None:
    width, height = alpha.size
    values = []
    values.extend(_flatten(alpha.crop((0, 0, width, 1))))
    values.extend(_flatten(alpha.crop((0, height - 1, width, height))))
    values.extend(_flatten(alpha.crop((0, 0, 1, height))))
    values.extend(_flatten(alpha.crop((width - 1, 0, width, height))))
    if max(values, default=0) > 16:
        raise ValueError(f'Asset "{asset_id}" has a hard opaque border.')


def _flatten(image: Image.Image) -> list[int]:
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
