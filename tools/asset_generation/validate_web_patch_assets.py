#!/usr/bin/env python3
"""Validate generated lossless WebP patch files and their authored manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


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

    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        raise ValueError("Manifest must contain a non-empty assets array.")

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

    print(
        f"Validated {len(assets)} deterministic web-patch assets "
        f"from {manifest_path}."
    )
    return 0


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
