#!/usr/bin/env python3
"""Build a labelled checkerboard preview sheet for generated web patches."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def parse_arguments() -> argparse.Namespace:
    repository_root = Path(__file__).resolve().parents[2]
    default_directory = repository_root / "assets" / "web-carpet" / "generated"

    parser = argparse.ArgumentParser(description="Build a web-patch preview sheet.")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=default_directory / "manifest.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=default_directory / "preview-sheet.webp",
    )
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--cell-size", type=int, default=280)
    return parser.parse_args()


def build_preview(
    manifest_path: Path,
    output_path: Path,
    *,
    columns: int = 4,
    cell_size: int = 280,
) -> Path:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest.get("assets", [])
    if not assets:
        raise ValueError("Manifest contains no assets.")

    safe_columns = max(1, int(columns))
    safe_cell_size = max(160, int(cell_size))
    label_height = 34
    rows = math.ceil(len(assets) / safe_columns)

    sheet = Image.new(
        "RGB",
        (safe_columns * safe_cell_size, rows * (safe_cell_size + label_height)),
        (34, 34, 38),
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, record in enumerate(assets):
        column = index % safe_columns
        row = index // safe_columns
        left = column * safe_cell_size
        top = row * (safe_cell_size + label_height)

        checker = create_checkerboard(safe_cell_size, safe_cell_size)
        sheet.paste(checker, (left, top))

        patch_path = manifest_path.parent / record["file"]
        with Image.open(patch_path) as source:
            patch = source.convert("RGBA")
            resampling = getattr(Image, "Resampling", Image)
            patch.thumbnail(
                (safe_cell_size - 18, safe_cell_size - 18),
                resample=resampling.LANCZOS,
            )
            x = left + (safe_cell_size - patch.width) // 2
            y = top + (safe_cell_size - patch.height) // 2
            sheet.paste(patch, (x, y), patch)

        label = f'{record["id"]}  [{record["category"]}]'
        draw.rectangle(
            (
                left,
                top + safe_cell_size,
                left + safe_cell_size,
                top + safe_cell_size + label_height,
            ),
            fill=(22, 22, 25),
        )
        draw.text(
            (left + 8, top + safe_cell_size + 10),
            label,
            fill=(232, 232, 236),
            font=font,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(
        output_path,
        format="WEBP",
        lossless=True,
        quality=100,
        method=4,
    )
    return output_path


def create_checkerboard(width: int, height: int, square: int = 20) -> Image.Image:
    image = Image.new("RGB", (width, height), (52, 52, 58))
    draw = ImageDraw.Draw(image)
    colours = ((52, 52, 58), (70, 70, 78))

    for y in range(0, height, square):
        for x in range(0, width, square):
            colour = colours[((x // square) + (y // square)) % 2]
            draw.rectangle(
                (x, y, min(width, x + square), min(height, y + square)),
                fill=colour,
            )
    return image


def main() -> int:
    arguments = parse_arguments()
    build_preview(
        arguments.manifest.resolve(),
        arguments.output.resolve(),
        columns=arguments.columns,
        cell_size=arguments.cell_size,
    )
    print(f"Wrote {arguments.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
