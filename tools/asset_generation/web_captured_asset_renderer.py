"""Pillow renderer for transparent, tintable captured-web overlays."""

from __future__ import annotations

import math
import random
from collections.abc import Sequence

from PIL import Image, ImageDraw, ImageFilter

from web_asset_visibility import SOFTENING_BLUR_RADIUS_PX, resolve_fibre_style
from web_captured_asset_config import CapturedAssetSpec, SOURCE_PIVOT, SOURCE_RADIUS


Point = tuple[float, float]


def render_captured_asset(
    spec: CapturedAssetSpec,
    random_source: random.Random,
    *,
    size_px: int,
    supersample: int,
) -> Image.Image:
    """Render one irregular web cocoon intended to surround a captured entity."""

    safe_size = max(128, int(size_px))
    safe_supersample = max(1, min(8, int(supersample)))
    canvas_size = safe_size * safe_supersample

    crisp = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    under = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    renderer = _CapturedRenderer(
        crisp=crisp,
        under=under,
        random_source=random_source,
        supersample=safe_supersample,
    )
    renderer.render(spec)

    softened = under.filter(
        ImageFilter.GaussianBlur(
            radius=SOFTENING_BLUR_RADIUS_PX * safe_supersample
        )
    )
    combined = Image.alpha_composite(softened, crisp)
    combined = _apply_outer_fade(combined, safe_supersample)

    resampling = getattr(Image, "Resampling", Image)
    return combined.resize(
        (safe_size, safe_size),
        resample=resampling.LANCZOS,
    )


class _CapturedRenderer:
    def __init__(
        self,
        *,
        crisp: Image.Image,
        under: Image.Image,
        random_source: random.Random,
        supersample: int,
    ) -> None:
        self.crisp = crisp
        self.under = under
        self.crisp_draw = ImageDraw.Draw(crisp, "RGBA")
        self.under_draw = ImageDraw.Draw(under, "RGBA")
        self.random = random_source
        self.supersample = supersample
        self.size = crisp.width

    def render(self, spec: CapturedAssetSpec) -> None:
        centre = (
            SOURCE_PIVOT[0] + self.random.uniform(-0.012, 0.012),
            SOURCE_PIVOT[1] + self.random.uniform(-0.012, 0.012),
        )
        rotation = self.random.uniform(0.0, math.tau)
        ellipse_ratio = self.random.uniform(0.78, 1.12)

        self._draw_outer_capture_loops(
            centre,
            rotation,
            ellipse_ratio,
            spec.variant,
        )
        self._draw_radial_bindings(
            centre,
            rotation,
            ellipse_ratio,
            spec.variant,
        )
        self._draw_cocoon_lacing(
            centre,
            rotation,
            ellipse_ratio,
            spec.variant,
        )
        self._draw_loose_frays(
            centre,
            rotation,
            ellipse_ratio,
            spec.variant,
        )

    def _draw_outer_capture_loops(
        self,
        centre: Point,
        rotation: float,
        ellipse_ratio: float,
        variant: int,
    ) -> None:
        loop_count = 4 + variant % 3
        for loop_index in range(loop_count):
            fraction = (loop_index + 1) / loop_count
            radius = SOURCE_RADIUS * (0.35 + fraction * 0.62)
            point_count = 28 + (loop_index % 3) * 4
            phase = rotation + self.random.uniform(-0.25, 0.25)
            points: list[Point] = []

            for index in range(point_count + 1):
                angle = phase + index / point_count * math.tau
                noise = self.random.uniform(-0.018, 0.018) * (0.5 + fraction)
                local_radius = radius + noise
                x = math.cos(angle) * local_radius
                y = math.sin(angle) * local_radius * ellipse_ratio
                points.append(_rotate_translate(x, y, rotation * 0.23, centre))

            gap_start = self.random.randrange(3, max(4, point_count - 5))
            gap_length = 1 + int(self.random.random() < 0.45)
            segments = [
                points[:gap_start],
                points[gap_start + gap_length :],
            ]
            for segment in segments:
                if len(segment) >= 2:
                    self.draw_fibre(
                        segment,
                        width=self.random.uniform(1.9, 2.35),
                        alpha=self.random.randint(118, 206),
                    )

    def _draw_radial_bindings(
        self,
        centre: Point,
        rotation: float,
        ellipse_ratio: float,
        variant: int,
    ) -> None:
        count = 11 + variant % 5
        inner_radius = SOURCE_RADIUS * 0.13
        for index in range(count):
            angle = rotation + index / count * math.tau + self.random.uniform(-0.08, 0.08)
            start = _ellipse_point(
                centre,
                angle + self.random.uniform(-0.08, 0.08),
                inner_radius * self.random.uniform(0.65, 1.25),
                ellipse_ratio,
                rotation * 0.23,
            )
            end = _ellipse_point(
                centre,
                angle,
                SOURCE_RADIUS * self.random.uniform(0.77, 1.02),
                ellipse_ratio,
                rotation * 0.23,
            )
            points = _jittered_polyline(
                self.random,
                start,
                end,
                intermediate_count=3 + (index + variant) % 3,
                perpendicular_jitter=0.012,
            )
            self.draw_fibre(
                points,
                width=self.random.uniform(2.05, 2.5),
                alpha=self.random.randint(160, 235),
            )

    def _draw_cocoon_lacing(
        self,
        centre: Point,
        rotation: float,
        ellipse_ratio: float,
        variant: int,
    ) -> None:
        band_count = 7 + variant % 4
        for band_index in range(band_count):
            angle = rotation + self.random.uniform(-0.65, 0.65)
            offset = self.random.uniform(-0.19, 0.19) * SOURCE_RADIUS
            half_length = SOURCE_RADIUS * self.random.uniform(0.24, 0.62)
            tangent = (math.cos(angle), math.sin(angle))
            normal = (-tangent[1], tangent[0])
            start = (
                centre[0] + normal[0] * offset - tangent[0] * half_length,
                centre[1] + normal[1] * offset - tangent[1] * half_length * ellipse_ratio,
            )
            end = (
                centre[0] + normal[0] * offset + tangent[0] * half_length,
                centre[1] + normal[1] * offset + tangent[1] * half_length * ellipse_ratio,
            )
            points = _jittered_polyline(
                self.random,
                start,
                end,
                intermediate_count=4,
                perpendicular_jitter=0.015,
            )
            self.draw_fibre(
                points,
                width=self.random.uniform(1.9, 2.25),
                alpha=self.random.randint(112, 190),
            )

        # Small local knots make the overlay read as entanglement rather than a
        # complete ordinary radial web placed beneath the entity.
        knot_count = 2 + variant % 3
        for knot_index in range(knot_count):
            knot_centre = (
                centre[0] + self.random.uniform(-0.12, 0.12),
                centre[1] + self.random.uniform(-0.12, 0.12),
            )
            radius = self.random.uniform(0.035, 0.075)
            points = []
            for index in range(18):
                angle = index / 17 * math.tau * self.random.uniform(1.35, 1.8)
                spiral_radius = radius * (0.35 + index / 17 * 0.75)
                points.append(
                    (
                        knot_centre[0] + math.cos(angle) * spiral_radius,
                        knot_centre[1] + math.sin(angle) * spiral_radius,
                    )
                )
            self.draw_fibre(
                points,
                width=self.random.uniform(1.9, 2.2),
                alpha=self.random.randint(126, 205),
            )

    def _draw_loose_frays(
        self,
        centre: Point,
        rotation: float,
        ellipse_ratio: float,
        variant: int,
    ) -> None:
        count = 3 + variant % 4
        for index in range(count):
            angle = rotation + self.random.uniform(0.0, math.tau)
            start = _ellipse_point(
                centre,
                angle,
                SOURCE_RADIUS * self.random.uniform(0.76, 0.96),
                ellipse_ratio,
                rotation * 0.23,
            )
            end = _ellipse_point(
                centre,
                angle + self.random.uniform(-0.18, 0.18),
                SOURCE_RADIUS * self.random.uniform(1.0, 1.12),
                ellipse_ratio,
                rotation * 0.23,
            )
            self.draw_fibre(
                _jittered_polyline(
                    self.random,
                    start,
                    end,
                    intermediate_count=2,
                    perpendicular_jitter=0.018,
                ),
                width=self.random.uniform(1.9, 2.15),
                alpha=self.random.randint(82, 145),
            )

    def draw_fibre(
        self,
        points: Sequence[Point],
        *,
        width: float,
        alpha: int,
    ) -> None:
        if len(points) < 2:
            return
        style = resolve_fibre_style(
            width_px=width,
            alpha=alpha,
            canvas_size_px=self.size,
        )
        pixels = [self._to_pixel(point) for point in points]
        self.under_draw.line(
            pixels,
            fill=(255, 255, 255, style.under_alpha),
            width=style.under_width,
            joint="curve",
        )
        self.crisp_draw.line(
            pixels,
            fill=(255, 255, 255, style.core_alpha),
            width=style.core_width,
            joint="curve",
        )

    def _to_pixel(self, point: Point) -> tuple[int, int]:
        return (
            round(point[0] * self.size),
            round(point[1] * self.size),
        )


def _ellipse_point(
    centre: Point,
    angle: float,
    radius: float,
    ellipse_ratio: float,
    rotation: float,
) -> Point:
    return _rotate_translate(
        math.cos(angle) * radius,
        math.sin(angle) * radius * ellipse_ratio,
        rotation,
        centre,
    )


def _rotate_translate(
    x: float,
    y: float,
    rotation: float,
    centre: Point,
) -> Point:
    cosine = math.cos(rotation)
    sine = math.sin(rotation)
    return (
        centre[0] + x * cosine - y * sine,
        centre[1] + x * sine + y * cosine,
    )


def _jittered_polyline(
    random_source: random.Random,
    start: Point,
    end: Point,
    *,
    intermediate_count: int,
    perpendicular_jitter: float,
) -> list[Point]:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = math.hypot(dx, dy) or 1.0
    perpendicular = (-dy / length, dx / length)
    points = [start]
    for index in range(1, intermediate_count + 1):
        fraction = index / (intermediate_count + 1)
        jitter = random_source.uniform(-perpendicular_jitter, perpendicular_jitter)
        points.append(
            (
                start[0] + dx * fraction + perpendicular[0] * jitter,
                start[1] + dy * fraction + perpendicular[1] * jitter,
            )
        )
    points.append(end)
    return points


def _apply_outer_fade(image: Image.Image, supersample: int) -> Image.Image:
    alpha = image.getchannel("A")
    mask = Image.new("L", image.size, 255)
    draw = ImageDraw.Draw(mask)
    border = max(4, round(10 * supersample))
    for index in range(border):
        value = round(255 * index / border)
        draw.rectangle(
            (index, index, image.width - 1 - index, image.height - 1 - index),
            outline=value,
        )
    alpha = Image.composite(alpha, Image.new("L", image.size, 0), mask)
    output = image.copy()
    output.putalpha(alpha)
    return output
