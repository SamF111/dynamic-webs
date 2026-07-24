#!/usr/bin/env python3
"""Build a labelled checkerboard preview for captured-web assets."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


def build_preview(manifest_path: Path, output_path: Path) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest["assets"]
    cell = 236
    image_size = 204
    label_height = 28
    columns = 4
    rows = math.ceil(len(assets) / columns)
    sheet = Image.new(
        "RGBA",
        (columns * cell, rows * (image_size + label_height)),
        (28, 28, 32, 255),
    )
    draw = ImageDraw.Draw(sheet)

    for index, record in enumerate(assets):
        column = index % columns
        row = index // columns
        cell_x = column * cell
        cell_y = row * (image_size + label_height)
        _draw_checkerboard(draw, cell_x, cell_y, image_size, image_size)
        with Image.open(manifest_path.parent / record["file"]) as source:
            image = source.convert("RGBA")
            image.thumbnail((image_size - 10, image_size - 10))
            sheet.alpha_composite(
                image,
                (
                    cell_x + (image_size - image.width) // 2,
                    cell_y + (image_size - image.height) // 2,
                ),
            )
        draw.text(
            (cell_x + 6, cell_y + image_size + 5),
            record["id"],
            fill=(235, 235, 235, 255),
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, format="WEBP", lossless=True, quality=100, exact=True)


def _draw_checkerboard(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    width: int,
    height: int,
) -> None:
    square = 16
    colours = ((54, 54, 60, 255), (76, 76, 84, 255))
    for row in range(math.ceil(height / square)):
        for column in range(math.ceil(width / square)):
            draw.rectangle(
                (
                    x + column * square,
                    y + row * square,
                    min(x + width - 1, x + (column + 1) * square - 1),
                    min(y + height - 1, y + (row + 1) * square - 1),
                ),
                fill=colours[(row + column) % 2],
            )


def main() -> int:
    repository_root = Path(__file__).resolve().parents[2]
    default_manifest = (
        repository_root / "assets" / "web-captured" / "generated" / "manifest.json"
    )
    parser = argparse.ArgumentParser(description="Build a captured-web preview sheet.")
    parser.add_argument("--manifest", type=Path, default=default_manifest)
    parser.add_argument("--output", type=Path, default=None)
    arguments = parser.parse_args()
    manifest = arguments.manifest.resolve()
    output = (
        arguments.output.resolve()
        if arguments.output
        else manifest.parent / "preview-sheet.webp"
    )
    build_preview(manifest, output)
    print(f"Wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
