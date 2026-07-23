"""Render asymmetric distributed-sheet wall-span WebP assets."""

from __future__ import annotations

import math
import random
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from web_span_asset_config import (
    CROSS_LINK_ALPHA_RANGE,
    CROSS_LINK_WIDTH_RANGE_PX,
    DIAGONAL_ALPHA_RANGE,
    DIAGONAL_WIDTH_RANGE_PX,
    LOOSE_THREAD_ALPHA_RANGE,
    LOOSE_THREAD_WIDTH_RANGE_PX,
    RAIL_ALPHA_RANGE,
    RAIL_WIDTH_RANGE_PX,
    WALL_MARGIN,
    WALL_SUPPORT_ALPHA_RANGE,
    WALL_SUPPORT_WIDTH_RANGE_PX,
    SpanAssetSpec,
)
from web_asset_visibility import (
    SOFTENING_BLUR_RADIUS_PX,
    resolve_fibre_style,
)


def render_span_asset(
    spec: SpanAssetSpec,
    random_source: random.Random,
    *,
    size_px: int,
    supersample: int,
) -> Image.Image:
    scale = size_px * supersample
    under = Image.new("L", (scale, scale), 0)
    core = Image.new("L", (scale, scale), 0)
    under_draw = ImageDraw.Draw(under)
    core_draw = ImageDraw.Draw(core)

    top_y = WALL_MARGIN
    bottom_y = 1.0 - WALL_MARGIN
    structural_count = random_source.randint(5, 8)
    top_positions = _stratified_positions(random_source, structural_count, 0.09, 0.91)
    bottom_positions = _stratified_positions(random_source, structural_count, 0.09, 0.91)
    random_source.shuffle(bottom_positions)
    bottom_positions.sort()

    rails: list[list[tuple[float, float]]] = []
    for index, top_x in enumerate(top_positions):
        bottom_index = min(
            structural_count - 1,
            max(0, index + random_source.choice((-1, 0, 0, 0, 1))),
        )
        bottom_x = bottom_positions[bottom_index]
        control_x = (top_x + bottom_x) / 2.0 + random_source.uniform(-0.07, 0.07)
        control_y = random_source.uniform(0.38, 0.62)
        rail = _quadratic_points(
            (top_x, top_y),
            (control_x, control_y),
            (bottom_x, bottom_y),
            steps=18,
        )
        rails.append(rail)
        _draw_fibre(
            under_draw,
            core_draw,
            rail,
            scale,
            width_px=random_source.uniform(*RAIL_WIDTH_RANGE_PX),
            alpha=random_source.randint(*RAIL_ALPHA_RANGE),
        )

    # Irregular cross-links connect neighbouring rails at staggered depths.
    cross_levels = _stratified_positions(random_source, random_source.randint(5, 8), 0.15, 0.85)
    for level_index, y_fraction in enumerate(cross_levels):
        start = random_source.randint(0, 1)
        for rail_index in range(start, len(rails) - 1):
            if random_source.random() < 0.18:
                continue
            left = _point_at_y(rails[rail_index], y_fraction)
            right = _point_at_y(rails[rail_index + 1], y_fraction + random_source.uniform(-0.025, 0.025))
            midpoint = (
                (left[0] + right[0]) / 2.0 + random_source.uniform(-0.025, 0.025),
                (left[1] + right[1]) / 2.0 + random_source.uniform(-0.018, 0.018),
            )
            points = _quadratic_points(left, midpoint, right, steps=8)
            _draw_fibre(
                under_draw,
                core_draw,
                points,
                scale,
                width_px=random_source.uniform(*CROSS_LINK_WIDTH_RANGE_PX),
                alpha=random_source.randint(*CROSS_LINK_ALPHA_RANGE),
            )

    # A few long diagonal braces prevent a repetitive ladder appearance.
    for _ in range(random_source.randint(2, 4)):
        first_index = random_source.randrange(0, max(1, len(rails) - 2))
        second_index = random_source.randrange(first_index + 2, len(rails))
        first_y = random_source.uniform(0.18, 0.48)
        second_y = random_source.uniform(0.52, 0.82)
        first = _point_at_y(rails[first_index], first_y)
        second = _point_at_y(rails[second_index], second_y)
        control = (
            (first[0] + second[0]) / 2.0 + random_source.uniform(-0.05, 0.05),
            (first[1] + second[1]) / 2.0 + random_source.uniform(-0.04, 0.04),
        )
        _draw_fibre(
            under_draw,
            core_draw,
            _quadratic_points(first, control, second, steps=12),
            scale,
            width_px=random_source.uniform(*DIAGONAL_WIDTH_RANGE_PX),
            alpha=random_source.randint(*DIAGONAL_ALPHA_RANGE),
        )

    # Wall-running support fibres and sparse loose tails.
    for y_value in (top_y, bottom_y):
        support = [
            (0.06, y_value + random_source.uniform(-0.006, 0.006)),
            (0.32, y_value + random_source.uniform(-0.012, 0.012)),
            (0.68, y_value + random_source.uniform(-0.012, 0.012)),
            (0.94, y_value + random_source.uniform(-0.006, 0.006)),
        ]
        _draw_fibre(
            under_draw,
            core_draw,
            support,
            scale,
            width_px=random_source.uniform(*WALL_SUPPORT_WIDTH_RANGE_PX),
            alpha=random_source.randint(*WALL_SUPPORT_ALPHA_RANGE),
        )

    for _ in range(random_source.randint(2, 5)):
        rail = random_source.choice(rails)
        start_y = random_source.uniform(0.2, 0.8)
        start = _point_at_y(rail, start_y)
        end = (
            min(0.96, max(0.04, start[0] + random_source.uniform(-0.16, 0.16))),
            min(0.96, max(0.04, start[1] + random_source.uniform(-0.11, 0.11))),
        )
        control = (
            (start[0] + end[0]) / 2.0 + random_source.uniform(-0.035, 0.035),
            (start[1] + end[1]) / 2.0 + random_source.uniform(-0.035, 0.035),
        )
        _draw_fibre(
            under_draw,
            core_draw,
            _quadratic_points(start, control, end, steps=8),
            scale,
            width_px=random_source.uniform(*LOOSE_THREAD_WIDTH_RANGE_PX),
            alpha=random_source.randint(*LOOSE_THREAD_ALPHA_RANGE),
        )

    under = under.filter(
        ImageFilter.GaussianBlur(radius=SOFTENING_BLUR_RADIUS_PX * supersample)
    )
    alpha = ImageChops.lighter(under, core)
    rgba = Image.new("RGBA", (scale, scale), (255, 255, 255, 0))
    rgba.putalpha(alpha)
    return rgba.resize((size_px, size_px), Image.Resampling.LANCZOS)


def _draw_fibre(
    under_draw: ImageDraw.ImageDraw,
    core_draw: ImageDraw.ImageDraw,
    points: Iterable[tuple[float, float]],
    scale: int,
    *,
    width_px: float,
    alpha: int,
) -> None:
    pixels = [(round(x * scale), round(y * scale)) for x, y in points]
    style = resolve_fibre_style(
        width_px=width_px,
        alpha=alpha,
        canvas_size_px=scale,
    )
    under_draw.line(
        pixels,
        fill=style.under_alpha,
        width=style.under_width,
        joint="curve",
    )
    core_draw.line(
        pixels,
        fill=style.core_alpha,
        width=style.core_width,
        joint="curve",
    )


def _stratified_positions(
    source: random.Random,
    count: int,
    minimum: float,
    maximum: float,
) -> list[float]:
    width = (maximum - minimum) / count
    return [
        minimum + width * index + width * source.uniform(0.18, 0.82)
        for index in range(count)
    ]


def _quadratic_points(
    start: tuple[float, float],
    control: tuple[float, float],
    end: tuple[float, float],
    *,
    steps: int,
) -> list[tuple[float, float]]:
    values: list[tuple[float, float]] = []
    for index in range(steps + 1):
        t = index / steps
        inverse = 1.0 - t
        values.append(
            (
                inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
                inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1],
            )
        )
    return values


def _point_at_y(points: list[tuple[float, float]], y_fraction: float) -> tuple[float, float]:
    target = min(1.0, max(0.0, y_fraction))
    return min(points, key=lambda point: abs(point[1] - target))
