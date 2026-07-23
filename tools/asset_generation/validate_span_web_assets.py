#!/usr/bin/env python3
"""Validate generated Dynamic Webs wall-span WebP assets."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

from web_span_asset_config import (
    DEFAULT_MASTER_SEED,
    GENERATOR_VERSION,
    SOURCE_FIRST_WALL_END,
    SOURCE_FIRST_WALL_START,
    SOURCE_SECOND_WALL_END,
    SOURCE_SECOND_WALL_START,
    SPAN_ASSET_SPECS,
)
from web_asset_visibility import (
    AUTHORED_FIBRE_STANDARD_ID,
    visibility_thresholds,
)


def main() -> int:
    repository_root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(
        description="Validate deterministic four-anchor span-web assets."
    )
    parser.add_argument(
        "directory",
        type=Path,
        nargs="?",
        default=repository_root / "assets" / "web-span" / "generated",
    )
    arguments = parser.parse_args()
    directory = arguments.directory.resolve()
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if manifest.get("schemaVersion") != 2:
        raise ValueError("Span manifest schemaVersion must be 2.")

    generator = manifest.get("generator", {})
    if generator.get("version") != GENERATOR_VERSION:
        raise ValueError(f"Span manifest generator version must be {GENERATOR_VERSION}.")
    if generator.get("masterSeed") != DEFAULT_MASTER_SEED:
        raise ValueError(f"Span manifest master seed must be {DEFAULT_MASTER_SEED}.")
    if generator.get("authoredFibreStandard") != AUTHORED_FIBRE_STANDARD_ID:
        raise ValueError(
            f"Span manifest authored fibre standard must be "
            f"{AUTHORED_FIBRE_STANDARD_ID}."
        )
    if generator.get("topology") != "distributed-span-sheet":
        raise ValueError("Span manifest must use distributed-span-sheet topology.")
    if manifest.get("rendering", {}).get("warpMode") != "piecewise-affine-quad":
        raise ValueError("Span manifest must use piecewise-affine-quad rendering.")

    expected_ids = [spec.asset_id for spec in SPAN_ASSET_SPECS]
    records = manifest.get("assets", [])
    if [record.get("id") for record in records] != expected_ids:
        raise ValueError("Span manifest asset IDs do not match the authored catalogue.")

    expected_source = {
        "firstWallStart": _point_record(SOURCE_FIRST_WALL_START),
        "firstWallEnd": _point_record(SOURCE_FIRST_WALL_END),
        "secondWallStart": _point_record(SOURCE_SECOND_WALL_START),
        "secondWallEnd": _point_record(SOURCE_SECOND_WALL_END),
    }
    hashes: set[str] = set()
    minimum_mean_alpha, minimum_coverage_64, minimum_coverage_128 = (
        visibility_thresholds()
    )

    for record in records:
        asset_id = str(record["id"])
        path = directory / str(record["file"])
        if path.suffix.lower() != ".webp" or not path.is_file():
            raise FileNotFoundError(path)

        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != record.get("sha256"):
            raise ValueError(f"SHA-256 mismatch for {asset_id}.")
        if digest in hashes:
            raise ValueError(f"Duplicate rendered asset detected for {asset_id}.")
        hashes.add(digest)

        with Image.open(path) as source_image:
            if str(source_image.format).upper() != "WEBP":
                raise ValueError(f"Asset {asset_id} is not WebP.")
            image = source_image.convert("RGBA")
            if image.size != (record.get("width"), record.get("height")):
                raise ValueError(f"Dimension mismatch for {asset_id}.")
            alpha = image.getchannel("A")
            values = _flatten_pixels(alpha)
            mean_alpha = sum(values) / len(values)
            coverage_64 = sum(value > 64 for value in values) / len(values)
            coverage_128 = sum(value > 128 for value in values) / len(values)
            if mean_alpha < minimum_mean_alpha:
                raise ValueError(
                    f"Asset {asset_id} is too faint: mean alpha {mean_alpha:.3f}."
                )
            if coverage_64 < minimum_coverage_64:
                raise ValueError(f"Asset {asset_id} lacks visible fibre coverage.")
            if coverage_128 < minimum_coverage_128:
                raise ValueError(f"Asset {asset_id} lacks strong fibre coverage.")
            if min(values) != 0 or max(values) == 0:
                raise ValueError(
                    f"Asset {asset_id} must contain transparent and visible pixels."
                )
            assert_soft_border(alpha, asset_id)

        if record.get("warpMode") != "piecewise-affine-quad":
            raise ValueError(f"Asset {asset_id} has an unexpected warp mode.")
        if record.get("source") != expected_source:
            raise ValueError(f"Asset {asset_id} has an unexpected source quadrilateral.")

    print(f"Validated {len(records)} deterministic span-web assets from {manifest_path}.")
    return 0


def assert_soft_border(alpha: Image.Image, asset_id: str) -> None:
    width, height = alpha.size
    values: list[int] = []
    values.extend(_flatten_pixels(alpha.crop((0, 0, width, 1))))
    values.extend(_flatten_pixels(alpha.crop((0, height - 1, width, height))))
    values.extend(_flatten_pixels(alpha.crop((0, 0, 1, height))))
    values.extend(_flatten_pixels(alpha.crop((width - 1, 0, width, height))))
    if max(values, default=0) > 16:
        raise ValueError(f"Asset {asset_id} has a hard opaque border.")


def _flatten_pixels(image: Image.Image) -> list[int]:
    flattened = getattr(image, "get_flattened_data", None)
    if callable(flattened):
        return list(flattened())
    return list(image.getdata())


def _point_record(point: tuple[float, float]) -> dict[str, float]:
    return {"x": point[0], "y": point[1]}


if __name__ == "__main__":
    raise SystemExit(main())
