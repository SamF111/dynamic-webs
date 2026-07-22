"""Pillow renderer for transparent, tintable Dynamic Webs patch assets."""

from __future__ import annotations

import math
import random
from collections.abc import Sequence

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from web_patch_geometry import (
    Point,
    chaikin,
    clamp,
    cubic_bezier,
    distance,
    distribute_points,
    jittered_polyline,
    lerp_point,
    nearest_neighbour_edges,
    normalise,
    quadratic_bezier,
)
from web_asset_config import AssetSpec


RGBA = tuple[int, int, int, int]


def render_patch(
    spec: AssetSpec,
    random_source: random.Random,
    *,
    size_px: int,
    supersample: int,
) -> Image.Image:
    """Render one transparent white/grayscale patch at the requested size."""

    safe_size = max(128, int(size_px))
    safe_supersample = max(1, min(8, int(supersample)))
    canvas_size = safe_size * safe_supersample

    crisp = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    under = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    renderer = _PatchRenderer(
        crisp=crisp,
        under=under,
        random_source=random_source,
        supersample=safe_supersample,
    )

    if spec.category == "loose-network":
        renderer.render_loose_network(spec.variant)
    elif spec.category == "support-arc":
        renderer.render_support_arc(spec.variant)
    elif spec.category == "dense-knot":
        renderer.render_dense_knot(spec.variant)
    elif spec.category == "fray":
        renderer.render_fray(spec.variant)
    elif spec.category == "faint-sheet":
        renderer.render_faint_sheet(spec.variant)
    else:
        raise ValueError(f"Unsupported patch category: {spec.category}")

    under = under.filter(ImageFilter.GaussianBlur(radius=0.45 * safe_supersample))
    combined = Image.alpha_composite(under, crisp)
    combined = _apply_soft_edge_fade(combined, safe_supersample)

    resampling = getattr(Image, "Resampling", Image)
    return combined.resize(
        (safe_size, safe_size),
        resample=resampling.LANCZOS,
    )


class _PatchRenderer:
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
        self.crisp_draw = ImageDraw.Draw(self.crisp, "RGBA")
        self.under_draw = ImageDraw.Draw(self.under, "RGBA")
        self.random = random_source
        self.supersample = supersample
        self.size = crisp.width

    def render_loose_network(self, variant: int) -> None:
        node_count = 17 + variant * 2
        nodes = distribute_points(
            self.random,
            count=node_count,
            margin=0.075,
            minimum_separation=0.095 - variant * 0.004,
        )
        edges = nearest_neighbour_edges(
            nodes,
            neighbours_per_point=2,
            maximum_distance=0.34 + variant * 0.012,
        )

        self.random.shuffle(edges)
        keep_fraction = 0.72 + variant * 0.035
        kept_edges = edges[: max(1, round(len(edges) * keep_fraction))]

        for first_index, second_index in kept_edges:
            first = nodes[first_index]
            second = nodes[second_index]
            points = jittered_polyline(
                self.random,
                first,
                second,
                intermediate_count=self.random.randint(1, 3),
                perpendicular_jitter=self.random.uniform(0.018, 0.055),
            )
            self.draw_fibre(
                points,
                width=self.random.uniform(0.70, 1.28),
                alpha=self.random.randint(72, 160),
                broken_chance=0.18,
            )

            if self.random.random() < 0.18:
                offset = self.random.uniform(0.004, 0.012)
                duplicate = [Point(point.x + offset, point.y - offset * 0.7) for point in points]
                self.draw_fibre(
                    duplicate,
                    width=self.random.uniform(0.45, 0.82),
                    alpha=self.random.randint(34, 82),
                    broken_chance=0.10,
                )

        for node in self.random.sample(nodes, k=min(len(nodes), 3 + variant // 2)):
            self.draw_knot(
                node,
                radius=self.random.uniform(0.008, 0.018),
                alpha=self.random.randint(62, 124),
            )

        for _ in range(2 + variant):
            start = self.random.choice(nodes)
            angle = self.random.uniform(0, math.tau)
            length = self.random.uniform(0.12, 0.28)
            end = Point(
                clamp(start.x + math.cos(angle) * length, 0.02, 0.98),
                clamp(start.y + math.sin(angle) * length, 0.02, 0.98),
            )
            self.draw_fibre(
                jittered_polyline(
                    self.random,
                    start,
                    end,
                    intermediate_count=2,
                    perpendicular_jitter=0.025,
                ),
                width=self.random.uniform(0.45, 0.78),
                alpha=self.random.randint(28, 72),
                broken_chance=0.25,
            )

    def render_support_arc(self, variant: int) -> None:
        orientation = (variant - 1) % 4
        start, end = _edge_anchor_pair(self.random, orientation)
        midpoint = lerp_point(start, end, 0.5)
        tangent = normalise(Point(end.x - start.x, end.y - start.y))
        perpendicular = Point(-tangent.y, tangent.x)
        bow = self.random.uniform(0.14, 0.29) * (-1 if variant in (2, 4) else 1)

        control = Point(
            midpoint.x + perpendicular.x * bow,
            midpoint.y + perpendicular.y * bow,
        )

        primary = quadratic_bezier(start, control, end, 48)
        self.draw_fibre(
            primary,
            width=self.random.uniform(1.05, 1.65),
            alpha=self.random.randint(126, 206),
            broken_chance=0.05,
        )

        parallel_count = 2 + variant % 2
        for index in range(parallel_count):
            offset = (index + 1) * self.random.uniform(0.018, 0.035)
            shifted = [
                Point(
                    point.x + perpendicular.x * offset,
                    point.y + perpendicular.y * offset,
                )
                for point in primary
            ]
            self.draw_fibre(
                shifted,
                width=self.random.uniform(0.54, 0.92),
                alpha=self.random.randint(52, 112),
                broken_chance=0.12,
            )

        tie_count = 4 + variant
        for index in range(tie_count):
            fraction = (index + 1) / (tie_count + 1)
            point = primary[min(len(primary) - 1, round(fraction * (len(primary) - 1)))]
            inward = Point(
                clamp(point.x - perpendicular.x * self.random.uniform(0.08, 0.22), 0.03, 0.97),
                clamp(point.y - perpendicular.y * self.random.uniform(0.08, 0.22), 0.03, 0.97),
            )
            self.draw_fibre(
                jittered_polyline(
                    self.random,
                    point,
                    inward,
                    intermediate_count=2,
                    perpendicular_jitter=0.022,
                ),
                width=self.random.uniform(0.45, 0.74),
                alpha=self.random.randint(35, 88),
                broken_chance=0.22,
            )

    def render_dense_knot(self, variant: int) -> None:
        centre = Point(
            self.random.uniform(0.40, 0.60),
            self.random.uniform(0.40, 0.60),
        )
        radial_count = 9 + variant * 2

        endpoints: list[Point] = []
        for index in range(radial_count):
            angle = math.tau * index / radial_count + self.random.uniform(-0.11, 0.11)
            radius = self.random.uniform(0.22, 0.44)
            endpoint = Point(
                clamp(centre.x + math.cos(angle) * radius, 0.04, 0.96),
                clamp(centre.y + math.sin(angle) * radius, 0.04, 0.96),
            )
            endpoints.append(endpoint)
            control = Point(
                lerp_point(centre, endpoint, 0.55).x + self.random.uniform(-0.055, 0.055),
                lerp_point(centre, endpoint, 0.55).y + self.random.uniform(-0.055, 0.055),
            )
            self.draw_fibre(
                quadratic_bezier(centre, control, endpoint, 28),
                width=self.random.uniform(0.65, 1.18),
                alpha=self.random.randint(76, 166),
                broken_chance=0.10,
            )

        ring_count = 3 + variant
        for ring_index in range(ring_count):
            radius_fraction = (ring_index + 1) / (ring_count + 1)
            ring_points: list[Point] = []
            for endpoint in endpoints:
                base = lerp_point(centre, endpoint, radius_fraction)
                ring_points.append(
                    Point(
                        base.x + self.random.uniform(-0.018, 0.018),
                        base.y + self.random.uniform(-0.018, 0.018),
                    )
                )
            ring_points.append(ring_points[0])
            smoothed = chaikin(ring_points, passes=2)
            self.draw_fibre(
                smoothed,
                width=self.random.uniform(0.45, 0.82),
                alpha=self.random.randint(42, 102),
                broken_chance=0.22 + ring_index * 0.035,
            )

        self.draw_knot(
            centre,
            radius=self.random.uniform(0.024, 0.040),
            alpha=self.random.randint(130, 210),
        )

        for _ in range(5 + variant):
            start = Point(
                centre.x + self.random.uniform(-0.08, 0.08),
                centre.y + self.random.uniform(-0.08, 0.08),
            )
            end = Point(
                centre.x + self.random.uniform(-0.10, 0.10),
                centre.y + self.random.uniform(-0.10, 0.10),
            )
            self.draw_fibre(
                jittered_polyline(
                    self.random,
                    start,
                    end,
                    intermediate_count=2,
                    perpendicular_jitter=0.028,
                ),
                width=self.random.uniform(0.42, 0.72),
                alpha=self.random.randint(42, 94),
                broken_chance=0.12,
            )

    def render_fray(self, variant: int) -> None:
        side = (variant - 1) % 4
        origin = _edge_origin(self.random, side)
        inward = {
            0: Point(1.0, 0.0),
            1: Point(0.0, 1.0),
            2: Point(-1.0, 0.0),
            3: Point(0.0, -1.0),
        }[side]
        perpendicular = Point(-inward.y, inward.x)
        strand_count = 10 + variant * 3

        for index in range(strand_count):
            spread = self.random.uniform(-0.18, 0.18)
            start = Point(
                origin.x + perpendicular.x * spread + self.random.uniform(-0.012, 0.012),
                origin.y + perpendicular.y * spread + self.random.uniform(-0.012, 0.012),
            )
            length = self.random.uniform(0.15, 0.46)
            end = Point(
                clamp(start.x + inward.x * length + perpendicular.x * self.random.uniform(-0.10, 0.10), 0.02, 0.98),
                clamp(start.y + inward.y * length + perpendicular.y * self.random.uniform(-0.10, 0.10), 0.02, 0.98),
            )
            control_a = lerp_point(start, end, 0.32)
            control_b = lerp_point(start, end, 0.70)
            control_a = Point(
                control_a.x + perpendicular.x * self.random.uniform(-0.06, 0.06),
                control_a.y + perpendicular.y * self.random.uniform(-0.06, 0.06),
            )
            control_b = Point(
                control_b.x + perpendicular.x * self.random.uniform(-0.08, 0.08),
                control_b.y + perpendicular.y * self.random.uniform(-0.08, 0.08),
            )
            self.draw_fibre(
                cubic_bezier(start, control_a, control_b, end, 30),
                width=self.random.uniform(0.38, 0.78),
                alpha=self.random.randint(34, 110),
                broken_chance=0.18 + index / max(1, strand_count) * 0.18,
            )

        self.draw_knot(
            origin,
            radius=self.random.uniform(0.010, 0.022),
            alpha=self.random.randint(58, 118),
        )

    def render_faint_sheet(self, variant: int) -> None:
        long_count = 8 + variant * 2
        for _ in range(long_count):
            start = Point(
                self.random.uniform(0.04, 0.18),
                self.random.uniform(0.08, 0.92),
            )
            end = Point(
                self.random.uniform(0.82, 0.96),
                clamp(start.y + self.random.uniform(-0.35, 0.35), 0.08, 0.92),
            )
            control_a = Point(
                self.random.uniform(0.24, 0.42),
                clamp(start.y + self.random.uniform(-0.22, 0.22), 0.04, 0.96),
            )
            control_b = Point(
                self.random.uniform(0.58, 0.76),
                clamp(end.y + self.random.uniform(-0.22, 0.22), 0.04, 0.96),
            )
            self.draw_fibre(
                cubic_bezier(start, control_a, control_b, end, 42),
                width=self.random.uniform(0.34, 0.68),
                alpha=self.random.randint(20, 58),
                broken_chance=0.30,
            )

        local_nodes = distribute_points(
            self.random,
            count=11 + variant * 2,
            margin=0.09,
            minimum_separation=0.105,
        )
        for first_index, second_index in nearest_neighbour_edges(
            local_nodes,
            neighbours_per_point=1,
            maximum_distance=0.31,
        ):
            if self.random.random() < 0.30:
                continue
            self.draw_fibre(
                jittered_polyline(
                    self.random,
                    local_nodes[first_index],
                    local_nodes[second_index],
                    intermediate_count=2,
                    perpendicular_jitter=0.035,
                ),
                width=self.random.uniform(0.30, 0.58),
                alpha=self.random.randint(16, 46),
                broken_chance=0.38,
            )

    def draw_fibre(
        self,
        points: Sequence[Point],
        *,
        width: float,
        alpha: int,
        broken_chance: float,
    ) -> None:
        if len(points) < 2:
            return

        segments = _split_polyline_for_gaps(
            self.random,
            list(points),
            gap_chance=clamp(broken_chance, 0.0, 0.75),
        )

        for segment in segments:
            pixel_points = [self.to_pixel(point) for point in segment]
            if len(pixel_points) < 2:
                continue

            core_width = max(1, round(width * self.supersample))
            under_width = max(core_width + 1, round(width * 2.3 * self.supersample))
            safe_alpha = max(1, min(255, int(alpha)))

            self.under_draw.line(
                pixel_points,
                fill=(255, 255, 255, max(1, round(safe_alpha * 0.18))),
                width=under_width,
                joint="curve",
            )
            self.crisp_draw.line(
                pixel_points,
                fill=(255, 255, 255, safe_alpha),
                width=core_width,
                joint="curve",
            )

    def draw_knot(self, point: Point, *, radius: float, alpha: int) -> None:
        centre_x, centre_y = self.to_pixel(point)
        outer = max(2, round(radius * self.size))
        inner = max(1, round(outer * 0.42))

        self.under_draw.ellipse(
            (
                centre_x - outer,
                centre_y - outer,
                centre_x + outer,
                centre_y + outer,
            ),
            fill=(255, 255, 255, max(1, round(alpha * 0.10))),
        )
        self.crisp_draw.ellipse(
            (
                centre_x - inner,
                centre_y - inner,
                centre_x + inner,
                centre_y + inner,
            ),
            fill=(255, 255, 255, max(1, min(255, alpha))),
        )

    def to_pixel(self, point: Point) -> tuple[int, int]:
        return (
            round(clamp(point.x, -0.05, 1.05) * (self.size - 1)),
            round(clamp(point.y, -0.05, 1.05) * (self.size - 1)),
        )


def _edge_anchor_pair(
    random_source: random.Random,
    orientation: int,
) -> tuple[Point, Point]:
    if orientation == 0:
        return (
            Point(0.02, random_source.uniform(0.16, 0.38)),
            Point(0.98, random_source.uniform(0.58, 0.84)),
        )
    if orientation == 1:
        return (
            Point(random_source.uniform(0.14, 0.38), 0.02),
            Point(random_source.uniform(0.60, 0.86), 0.98),
        )
    if orientation == 2:
        return (
            Point(0.98, random_source.uniform(0.14, 0.40)),
            Point(0.02, random_source.uniform(0.60, 0.86)),
        )
    return (
        Point(random_source.uniform(0.60, 0.86), 0.02),
        Point(random_source.uniform(0.14, 0.40), 0.98),
    )


def _edge_origin(random_source: random.Random, side: int) -> Point:
    if side == 0:
        return Point(0.015, random_source.uniform(0.28, 0.72))
    if side == 1:
        return Point(random_source.uniform(0.28, 0.72), 0.015)
    if side == 2:
        return Point(0.985, random_source.uniform(0.28, 0.72))
    return Point(random_source.uniform(0.28, 0.72), 0.985)


def _split_polyline_for_gaps(
    random_source: random.Random,
    points: list[Point],
    *,
    gap_chance: float,
) -> list[list[Point]]:
    if len(points) < 4 or random_source.random() >= gap_chance:
        return [points]

    gap_count = 1 if random_source.random() < 0.82 else 2
    blocked_indices: set[int] = set()
    for _ in range(gap_count):
        blocked_indices.add(random_source.randint(1, len(points) - 2))

    segments: list[list[Point]] = []
    current: list[Point] = []
    for index, point in enumerate(points):
        if index in blocked_indices:
            if len(current) >= 2:
                segments.append(current)
            current = []
            continue
        current.append(point)

    if len(current) >= 2:
        segments.append(current)

    return segments or [points]


def _apply_soft_edge_fade(image: Image.Image, supersample: int) -> Image.Image:
    """Fade all four borders using two compact 1D profiles.

    The previous implementation evaluated the same smoothstep expression for
    every supersampled pixel. The fade is separable: the rectangular edge
    distance is the minimum of one horizontal and one vertical distance.
    Building two 1D profiles and combining them with ImageChops.darker keeps
    the pixel result equivalent while making large atlas generation practical.
    """

    width, height = image.size
    fade_distance = max(8, round(min(width, height) * 0.075))

    horizontal = Image.new("L", (width, 1), 0)
    horizontal.putdata(
        [
            _smooth_edge_value(
                min(x, width - 1 - x),
                fade_distance,
            )
            for x in range(width)
        ]
    )
    horizontal = horizontal.resize((width, height))

    vertical = Image.new("L", (1, height), 0)
    vertical.putdata(
        [
            _smooth_edge_value(
                min(y, height - 1 - y),
                fade_distance,
            )
            for y in range(height)
        ]
    )
    vertical = vertical.resize((width, height))

    mask = ImageChops.darker(horizontal, vertical)
    alpha = ImageChops.multiply(image.getchannel("A"), mask)
    result = image.copy()
    result.putalpha(alpha)
    return result


def _smooth_edge_value(edge_distance: int, fade_distance: int) -> int:
    fraction = clamp(edge_distance / fade_distance, 0.0, 1.0)
    smooth = fraction * fraction * (3.0 - 2.0 * fraction)
    return round(255 * smooth)
