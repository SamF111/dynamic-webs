#!/usr/bin/env python3
"""Build a labelled preview sheet for locally generated corner-web assets."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


def build_preview(manifest_path: Path, output_path: Path) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest["assets"]
    cell = 192
    label_height = 24
    columns = 6
    rows = math.ceil(len(assets) / columns)
    sheet = Image.new("RGBA", (columns * cell, rows * (cell + label_height)), (28, 28, 32, 255))
    draw = ImageDraw.Draw(sheet)

    for index, record in enumerate(assets):
        column = index % columns
        row = index // columns
        x = column * cell
        y = row * (cell + label_height)
        with Image.open(manifest_path.parent / record["file"]) as source:
            image = source.convert("RGBA")
            image.thumbnail((cell - 12, cell - 12))
            sheet.alpha_composite(image, (x + (cell - image.width) // 2, y + (cell - image.height) // 2))
        draw.text((x + 6, y + cell + 4), record["id"], fill=(235, 235, 235, 255))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, format="WEBP", lossless=True, quality=100, exact=True)


def main() -> int:
    repository_root = Path(__file__).resolve().parents[2]
    default_manifest = repository_root / "assets" / "web-corner" / "generated" / "manifest.json"
    parser = argparse.ArgumentParser(description="Build a corner-web preview sheet.")
    parser.add_argument("--manifest", type=Path, default=default_manifest)
    parser.add_argument("--output", type=Path, default=None)
    arguments = parser.parse_args()
    manifest = arguments.manifest.resolve()
    output = arguments.output.resolve() if arguments.output else manifest.parent / "preview-sheet.webp"
    build_preview(manifest, output)
    print(f"Wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
