#!/usr/bin/env python3
"""Build a dark-background contact sheet for generated span assets."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


def build_preview(manifest_path: Path, output_path: Path) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest["assets"]
    tile = 280
    columns = 4
    rows = (len(assets) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tile, rows * tile), (20, 24, 31, 255))
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(assets):
        image = Image.open(manifest_path.parent / record["file"]).convert("RGBA")
        image.thumbnail((tile - 24, tile - 42), Image.Resampling.LANCZOS)
        x = (index % columns) * tile + (tile - image.width) // 2
        y = (index // columns) * tile + 12
        sheet.alpha_composite(image, (x, y))
        draw.text(((index % columns) * tile + 10, (index // columns + 1) * tile - 24), record["id"], fill=(230, 235, 242, 255))
    sheet.save(output_path, format="WEBP", lossless=True, quality=100)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2] / "assets" / "web-span" / "generated"
    build_preview(root / "manifest.json", root / "preview-sheet.webp")
