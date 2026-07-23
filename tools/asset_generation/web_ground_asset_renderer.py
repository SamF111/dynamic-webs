"""Pillow renderer for transparent, tintable Dynamic Webs ground assets."""

from __future__ import annotations

import math
import random
from collections.abc import Sequence

from PIL import Image, ImageDraw, ImageFilter

from web_asset_visibility import (
    SOFTENING_BLUR_RADIUS_PX,
    resolve_fibre_style,
)
from web_ground_asset_config import (
    CAPTURE_WIDTH_MULTIPLIER,
    DECORATIVE_WIDTH_MULTIPLIER,
    STRUCTURAL_WIDTH_MULTIPLIER,
    GroundAssetSpec,
    SOURCE_PIVOT,
    SOURCE_RADIUS,
)
from web_patch_geometry import (
    Point,
    clamp,
    jittered_polyline,
    lerp_point,
)


RGBA = tuple[int, int, int, int]


def render_ground_asset(
    spec: GroundAssetSpec,
    random_source: random.Random,
    *,
    size_px: int,
    supersample: int,
) -> Image.Image:
    """Render one irregular radial sheet intended for affine Scene fitting."""

    safe_size = max(128, int(size_px))
    safe_supersample = max(1, min(8, int(supersample)))
    canvas_size = safe_size * safe_supersample

    crisp = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    under = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    renderer = _GroundRenderer(
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


class _GroundRenderer:
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

    def render(self, spec: GroundAssetSpec) -> None:
        pivot = Point(*SOURCE_PIVOT)
        hub = Point(
            pivot.x + self.random.uniform(-0.018, 0.018),
            pivot.y + self.random.uniform(-0.018, 0.018),
        )

        spoke_count = 10 + spec.variant % 5 + self.random.randint(0, 2)
        rotation = self.random.uniform(0.0, math.tau)
        perimeter: list[Point] = []

        for index in range(spoke_count):
            angle = (
                rotation
                + index / spoke_count * math.tau
                + self.random.uniform(-0.055, 0.055)
            )
            radius = SOURCE_RADIUS * self.random.uniform(0.82, 1.08)
            # A slightly asymmetric source silhouette gives the affine-fitted
            # web an organic footprint without requiring a texture warp mesh.
            radius *= 1.0 + 0.045 * math.sin(angle * 2.0 + spec.variant)
            endpoint = Point(
                pivot.x + math.cos(angle) * radius,
                pivot.y + math.sin(angle) * radius,
            )
            perimeter.append(endpoint)

            spoke = jittered_polyline(
                self.random,
                hub,
                endpoint,
                intermediate_count=3 + (index + spec.variant) % 3,
                perpendicular_jitter=self.random.uniform(0.006, 0.013),
                along_jitter=0.012,
            )
            self.draw_fibre(
                spoke,
                width=self.random.uniform(1.95, 2.35) * STRUCTURAL_WIDTH_MULTIPLIER,
                alpha=self.random.randint(184, 238),
                broken_chance=0.02,
            )

        ring_count = 5 + spec.variant % 3
        previous_ring: list[Point] | None = None

        for ring_index in range(1, ring_count + 1):
            fraction = ring_index / ring_count
            ring: list[Point] = []

            for spoke_index, endpoint in enumerate(perimeter):
                base = lerp_point(hub, endpoint, fraction)
                angle = math.atan2(endpoint.y - hub.y, endpoint.x - hub.x)
                tangent = Point(-math.sin(angle), math.cos(angle))
                radial = Point(math.cos(angle), math.sin(angle))
                jitter_scale = 0.008 + 0.004 * fraction
                ring.append(
                    Point(
                        base.x
                        + tangent.x * self.random.uniform(-jitter_scale, jitter_scale)
                        + radial.x * self.random.uniform(-0.004, 0.004),
                        base.y
                        + tangent.y * self.random.uniform(-jitter_scale, jitter_scale)
                        + radial.y * self.random.uniform(-0.004, 0.004),
                    )
                )

            gap_count = 0
            if ring_index >= 2 and self.random.random() < 0.62:
                gap_count = 1 + int(self.random.random() < 0.24)
            gaps = {
                self.random.randrange(spoke_count)
                for _ in range(gap_count)
            }

            for index, start in enumerate(ring):
                if index in gaps:
                    continue
                end = ring[(index + 1) % len(ring)]
                arc = jittered_polyline(
                    self.random,
                    start,
                    end,
                    intermediate_count=2 + (index + ring_index) % 2,
                    perpendicular_jitter=self.random.uniform(0.003, 0.008),
                    along_jitter=0.006,
                )
                self.draw_fibre(
                    arc,
                    width=self.random.uniform(1.9, 2.2) * CAPTURE_WIDTH_MULTIPLIER,
                    alpha=self.random.randint(118, 184),
                    broken_chance=0.05 + fraction * 0.04,
                )

            if previous_ring is not None and ring_index > 2:
                self._draw_secondary_links(previous_ring, ring, ring_index)

            previous_ring = ring

        self._draw_loose_ends(perimeter, pivot, spec.variant)
        self._draw_central_tangle(hub, perimeter, spec.variant)

    def _draw_secondary_links(
        self,
        inner: Sequence[Point],
        outer: Sequence[Point],
        ring_index: int,
    ) -> None:
        count = 1 + (ring_index + len(outer)) % 3
        for _ in range(count):
            index = self.random.randrange(len(outer))
            offset = self.random.choice((-1, 1, 2))
            start = inner[index]
            end = outer[(index + offset) % len(outer)]
            self.draw_fibre(
                jittered_polyline(
                    self.random,
                    start,
                    end,
                    intermediate_count=2,
                    perpendicular_jitter=0.006,
                    along_jitter=0.006,
                ),
                width=self.random.uniform(1.9, 2.1) * DECORATIVE_WIDTH_MULTIPLIER,
                alpha=self.random.randint(82, 132),
                broken_chance=0.12,
            )

    def _draw_loose_ends(
        self,
        perimeter: Sequence[Point],
        pivot: Point,
        variant: int,
    ) -> None:
        loose_count = 1 + variant % 3
        selected = self.random.sample(
            list(range(len(perimeter))),
            k=min(loose_count, len(perimeter)),
        )
        for index in selected:
            start = perimeter[index]
            dx = start.x - pivot.x
            dy = start.y - pivot.y
            length = math.hypot(dx, dy) or 1.0
            extension = self.random.uniform(0.035, 0.085)
            end = Point(
                start.x + dx / length * extension,
                start.y + dy / length * extension,
            )
            self.draw_fibre(
                jittered_polyline(
                    self.random,
                    start,
                    end,
                    intermediate_count=2,
                    perpendicular_jitter=0.009,
                    along_jitter=0.005,
                ),
                width=self.random.uniform(1.9, 2.05) * DECORATIVE_WIDTH_MULTIPLIER,
                alpha=self.random.randint(76, 122),
                broken_chance=0.08,
            )

    def _draw_central_tangle(
        self,
        hub: Point,
        perimeter: Sequence[Point],
        variant: int,
    ) -> None:
        # A few offset near-hub links stop the asset reading as a mathematically
        # perfect wheel while retaining the recognisable ground-web structure.
        count = 2 + variant % 3
        for index in range(count):
            first = perimeter[(index * 3 + variant) % len(perimeter)]
            second = perimeter[(index * 3 + variant + 2) % len(perimeter)]
            start = lerp_point(hub, first, self.random.uniform(0.10, 0.22))
            end = lerp_point(hub, second, self.random.uniform(0.12, 0.26))
            self.draw_fibre(
                jittered_polyline(
                    self.random,
                    start,
                    end,
                    intermediate_count=2,
                    perpendicular_jitter=0.005,
                    along_jitter=0.004,
                ),
                width=self.random.uniform(1.9, 2.15) * CAPTURE_WIDTH_MULTIPLIER,
                alpha=self.random.randint(106, 166),
                broken_chance=0.05,
            )

    def draw_fibre(
        self,
        points: Sequence[Point],
        *,
        width: float,
        alpha: int,
        broken_chance: float,
    ) -> None:
        pixel_points = [self._to_pixel(point) for point in points]
        if len(pixel_points) < 2:
            return

        for segment in _split_segments(self.random, pixel_points, broken_chance):
            if len(segment) < 2:
                continue
            style = resolve_fibre_style(
                width_px=width,
                alpha=alpha,
                canvas_size_px=self.size,
            )
            self.under_draw.line(
                segment,
                fill=(255, 255, 255, style.under_alpha),
                width=style.under_width,
                joint="curve",
            )
            self.crisp_draw.line(
                segment,
                fill=(255, 255, 255, style.core_alpha),
                width=style.core_width,
                joint="curve",
            )

    def _to_pixel(self, point: Point) -> tuple[int, int]:
        return (
            round(clamp(point.x, 0.0, 1.0) * self.size),
            round(clamp(point.y, 0.0, 1.0) * self.size),
        )


def _split_segments(
    random_source: random.Random,
    points: Sequence[tuple[int, int]],
    broken_chance: float,
) -> list[list[tuple[int, int]]]:
    if (
        broken_chance <= 0
        or len(points) < 8
        or random_source.random() >= broken_chance
    ):
        return [list(points)]

    gap_start = random_source.randint(2, len(points) - 5)
    gap_length = random_source.randint(1, min(3, len(points) - gap_start - 2))
    return [
        list(points[:gap_start]),
        list(points[gap_start + gap_length :]),
    ]


def _apply_outer_fade(image: Image.Image, supersample: int) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = alpha.size
    fade_width = max(4, round(8 * supersample))
    mask = Image.new("L", (width, height), 255)
    draw = ImageDraw.Draw(mask)
    for inset in range(fade_width):
        value = round(255 * inset / max(1, fade_width - 1))
        draw.rectangle(
            (inset, inset, width - 1 - inset, height - 1 - inset),
            outline=value,
        )
    image.putalpha(Image.composite(alpha, Image.new("L", alpha.size, 0), mask))
    return image
