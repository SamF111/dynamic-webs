"""Pillow renderer for transparent, tintable Dynamic Webs corner assets."""

from __future__ import annotations

import math
import random
from collections.abc import Sequence

from PIL import Image, ImageDraw, ImageFilter

from web_corner_asset_config import (
    CAPTURE_WIDTH_MULTIPLIER,
    LOOSE_THREAD_WIDTH_MULTIPLIER,
    SECONDARY_SUPPORT_WIDTH_MULTIPLIER,
    STRUCTURAL_WIDTH_MULTIPLIER,
    WALL_SUPPORT_WIDTH_MULTIPLIER,
    CornerAssetSpec,
    SOURCE_ANCHOR_RADIUS,
    SOURCE_PIVOT,
)
from web_asset_visibility import (
    SOFTENING_BLUR_RADIUS_PX,
    resolve_fibre_style,
)
from web_patch_geometry import (
    Point,
    clamp,
    distance,
    jittered_polyline,
    lerp_point,
    nearest_neighbour_edges,
    quadratic_bezier,
)


RGBA = tuple[int, int, int, int]


def render_corner_asset(
    spec: CornerAssetSpec,
    random_source: random.Random,
    *,
    size_px: int,
    supersample: int,
) -> Image.Image:
    """Render one irregular transparent-white corner sheet web."""

    safe_size = max(128, int(size_px))
    safe_supersample = max(1, min(8, int(supersample)))
    canvas_size = safe_size * safe_supersample

    crisp = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    under = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    renderer = _CornerRenderer(
        crisp=crisp,
        under=under,
        random_source=random_source,
        supersample=safe_supersample,
    )
    renderer.render(spec)

    softened = under.filter(
        ImageFilter.GaussianBlur(radius=SOFTENING_BLUR_RADIUS_PX * safe_supersample)
    )
    combined = Image.alpha_composite(softened, crisp)
    combined = _apply_outer_fade(combined, safe_supersample)

    resampling = getattr(Image, "Resampling", Image)
    return combined.resize(
        (safe_size, safe_size),
        resample=resampling.LANCZOS,
    )


class _CornerRenderer:
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

    def render(self, spec: CornerAssetSpec) -> None:
        """Build a tangled corner sheet with no compulsory off-corner hub."""

        pivot = Point(*SOURCE_PIVOT)
        angle = math.radians(spec.canonical_angle_deg)
        first_direction = Point(1.0, 0.0)
        second_direction = Point(math.cos(angle), math.sin(angle))
        first_outer = _add_scaled(pivot, first_direction, SOURCE_ANCHOR_RADIUS)
        second_outer = _add_scaled(pivot, second_direction, SOURCE_ANCHOR_RADIUS)

        self._draw_wall_support(pivot, first_outer, spec.variant)
        self._draw_wall_support(pivot, second_outer, spec.variant + 1)

        first_wall_nodes = self._create_wall_nodes(
            pivot,
            first_direction,
            count=4 + spec.variant % 2,
        )
        second_wall_nodes = self._create_wall_nodes(
            pivot,
            second_direction,
            count=4 + (spec.variant + 1) % 2,
        )
        interior_nodes = self._create_interior_nodes(
            pivot=pivot,
            angle=angle,
            spec=spec,
            existing=[*first_wall_nodes, *second_wall_nodes],
        )

        self._draw_cross_corner_scaffolds(
            first_wall_nodes,
            second_wall_nodes,
            spec,
        )
        self._draw_irregular_mesh(
            first_wall_nodes,
            second_wall_nodes,
            interior_nodes,
            spec,
        )
        self._draw_corner_tethers(
            pivot,
            first_wall_nodes,
            second_wall_nodes,
            interior_nodes,
            spec,
        )
        self._draw_loose_threads(
            first_wall_nodes,
            second_wall_nodes,
            interior_nodes,
            spec.variant,
        )

    def _create_wall_nodes(
        self,
        pivot: Point,
        direction: Point,
        *,
        count: int,
    ) -> list[Point]:
        values: list[float] = []
        for index in range(count):
            base = 0.15 + 0.78 * index / max(1, count - 1)
            values.append(clamp(base + self.random.uniform(-0.045, 0.045), 0.11, 0.97))
        values.sort()
        return [
            _add_scaled(pivot, direction, SOURCE_ANCHOR_RADIUS * value)
            for value in values
        ]

    def _create_interior_nodes(
        self,
        *,
        pivot: Point,
        angle: float,
        spec: CornerAssetSpec,
        existing: Sequence[Point],
    ) -> list[Point]:
        angle_degrees = math.degrees(angle)
        target_count = 7 + min(8, round(angle_degrees / 24)) + spec.variant % 3
        minimum_separation = 0.036 if angle_degrees < 20 else 0.048
        nodes: list[Point] = []
        attempts = 0

        while len(nodes) < target_count and attempts < target_count * 90:
            attempts += 1
            # A triangular distribution favours mid-angle placement without
            # forcing any node onto the angle bisector.
            theta_fraction = (
                self.random.uniform(0.07, 0.93)
                + self.random.uniform(0.07, 0.93)
            ) / 2
            radial_fraction = self.random.uniform(0.16, 0.96)
            radial_fraction *= self.random.uniform(0.88, 1.05)
            radial_fraction = clamp(radial_fraction, 0.13, 0.98)
            direction_angle = angle * theta_fraction
            direction = Point(math.cos(direction_angle), math.sin(direction_angle))
            candidate = _add_scaled(
                pivot,
                direction,
                SOURCE_ANCHOR_RADIUS * radial_fraction,
            )

            if all(
                distance(candidate, point) >= minimum_separation
                for point in [*existing, *nodes]
            ):
                nodes.append(candidate)

        return nodes

    def _draw_wall_support(self, start: Point, end: Point, variant: int) -> None:
        control = lerp_point(start, end, 0.52)
        tangent = _normalise(Point(end.x - start.x, end.y - start.y))
        perpendicular = Point(-tangent.y, tangent.x)
        control = Point(
            control.x + perpendicular.x * self.random.uniform(-0.008, 0.012),
            control.y + perpendicular.y * self.random.uniform(-0.008, 0.012),
        )
        points = quadratic_bezier(start, control, end, 42)
        self.draw_fibre(
            points,
            width=self.random.uniform(1.0, 1.4) * WALL_SUPPORT_WIDTH_MULTIPLIER,
            alpha=self.random.randint(205, 248),
            broken_chance=0.02,
        )
        if variant % 2 == 0:
            duplicate = [
                Point(point.x + perpendicular.x * 0.006, point.y + perpendicular.y * 0.006)
                for point in points
            ]
            self.draw_fibre(
                duplicate,
                width=self.random.uniform(0.45, 0.68) * SECONDARY_SUPPORT_WIDTH_MULTIPLIER,
                alpha=self.random.randint(80, 125),
                broken_chance=0.10,
            )

    def _draw_cross_corner_scaffolds(
        self,
        first_wall_nodes: Sequence[Point],
        second_wall_nodes: Sequence[Point],
        spec: CornerAssetSpec,
    ) -> None:
        pair_count = min(len(first_wall_nodes), len(second_wall_nodes))
        for index in range(pair_count):
            first_index = index
            second_index = clamp(
                index + ((spec.variant + index) % 3 - 1),
                0,
                len(second_wall_nodes) - 1,
            )
            start = first_wall_nodes[first_index]
            end = second_wall_nodes[int(second_index)]
            midpoint = lerp_point(start, end, 0.5)
            tangent = _normalise(Point(end.x - start.x, end.y - start.y))
            perpendicular = Point(-tangent.y, tangent.x)
            # Sag slightly outwards from the corner and vary the amount per
            # scaffold so the lines never read as concentric capture rings.
            sag = self.random.uniform(0.008, 0.035) * (0.65 + index / max(1, pair_count - 1))
            control = Point(
                midpoint.x + perpendicular.x * self.random.uniform(-sag, sag),
                midpoint.y + perpendicular.y * self.random.uniform(-sag, sag),
            )
            self.draw_fibre(
                quadratic_bezier(start, control, end, 36),
                width=self.random.uniform(0.62, 0.95) * STRUCTURAL_WIDTH_MULTIPLIER,
                alpha=self.random.randint(145, 215),
                broken_chance=0.05 + index * 0.025,
            )

    def _draw_irregular_mesh(
        self,
        first_wall_nodes: Sequence[Point],
        second_wall_nodes: Sequence[Point],
        interior_nodes: Sequence[Point],
        spec: CornerAssetSpec,
    ) -> None:
        points = [*first_wall_nodes, *second_wall_nodes, *interior_nodes]
        if len(points) < 4:
            return

        edges = nearest_neighbour_edges(
            points,
            neighbours_per_point=3 + spec.variant % 2,
            maximum_distance=0.24,
        )
        # Longest local edges are visually useful scaffolds, but an unlimited
        # nearest-neighbour graph becomes opaque. Keep a deterministic shuffled
        # subset while ensuring every interior node still participates through
        # its nearest edges.
        weighted_edges = [
            (distance(points[first], points[second]), first, second)
            for first, second in edges
        ]
        weighted_edges.sort(key=lambda entry: (entry[0], entry[1], entry[2]))
        maximum_edges = min(len(weighted_edges), 24 + spec.variant * 2)
        selected = weighted_edges[:maximum_edges]

        for edge_index, (edge_length, first_index, second_index) in enumerate(selected):
            start = points[first_index]
            end = points[second_index]
            path = jittered_polyline(
                self.random,
                start,
                end,
                intermediate_count=2 + (edge_index + spec.variant) % 2,
                perpendicular_jitter=min(0.018, max(0.005, edge_length * 0.08)),
                along_jitter=min(0.025, edge_length * 0.06),
            )
            long_edge = edge_length >= 0.15
            self.draw_fibre(
                path,
                width=self.random.uniform(0.46, 0.74)
                * (STRUCTURAL_WIDTH_MULTIPLIER if long_edge else CAPTURE_WIDTH_MULTIPLIER),
                alpha=self.random.randint(100, 170) if long_edge else self.random.randint(75, 145),
                broken_chance=0.10 if long_edge else 0.17,
            )

    def _draw_corner_tethers(
        self,
        pivot: Point,
        first_wall_nodes: Sequence[Point],
        second_wall_nodes: Sequence[Point],
        interior_nodes: Sequence[Point],
        spec: CornerAssetSpec,
    ) -> None:
        inner_candidates = sorted(
            [*first_wall_nodes[:2], *second_wall_nodes[:2], *interior_nodes],
            key=lambda point: distance(pivot, point),
        )[:5]
        if not inner_candidates:
            return

        self.random.shuffle(inner_candidates)
        tether_count = 1 + (1 if spec.variant in (2, 5) and len(inner_candidates) > 1 else 0)
        for target in inner_candidates[:tether_count]:
            start = lerp_point(pivot, target, self.random.uniform(0.02, 0.07))
            path = jittered_polyline(
                self.random,
                start,
                target,
                intermediate_count=2,
                perpendicular_jitter=0.009,
                along_jitter=0.008,
            )
            self.draw_fibre(
                path,
                width=self.random.uniform(0.5, 0.76) * STRUCTURAL_WIDTH_MULTIPLIER,
                alpha=self.random.randint(95, 155),
                broken_chance=0.09,
            )

    def _draw_loose_threads(
        self,
        first_wall_nodes: Sequence[Point],
        second_wall_nodes: Sequence[Point],
        interior_nodes: Sequence[Point],
        variant: int,
    ) -> None:
        candidates = [
            *first_wall_nodes[-2:],
            *second_wall_nodes[-2:],
            *sorted(
                interior_nodes,
                key=lambda point: distance(Point(*SOURCE_PIVOT), point),
                reverse=True,
            )[:4],
        ]
        if not candidates:
            return

        for _ in range(1 + variant % 3):
            start = self.random.choice(candidates)
            radial_angle = math.atan2(start.y - SOURCE_PIVOT[1], start.x - SOURCE_PIVOT[0])
            drift_angle = radial_angle + self.random.uniform(-0.75, 0.75)
            end = Point(
                clamp(start.x + math.cos(drift_angle) * self.random.uniform(0.07, 0.17), 0.03, 0.97),
                clamp(start.y + math.sin(drift_angle) * self.random.uniform(0.07, 0.17), 0.03, 0.97),
            )
            control = Point(
                (start.x + end.x) / 2 + self.random.uniform(-0.025, 0.025),
                (start.y + end.y) / 2 + self.random.uniform(-0.025, 0.025),
            )
            self.draw_fibre(
                quadratic_bezier(start, control, end, 28),
                width=self.random.uniform(0.38, 0.66) * LOOSE_THREAD_WIDTH_MULTIPLIER,
                alpha=self.random.randint(55, 105),
                broken_chance=0.22,
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

        segments = _split_segments(self.random, pixel_points, broken_chance)
        for segment in segments:
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
            round(point.x * self.size),
            round(point.y * self.size),
        )


def _split_segments(
    random_source: random.Random,
    points: Sequence[tuple[int, int]],
    broken_chance: float,
) -> list[list[tuple[int, int]]]:
    if broken_chance <= 0 or len(points) < 8 or random_source.random() >= broken_chance:
        return [list(points)]
    gap_start = random_source.randint(2, len(points) - 5)
    gap_length = random_source.randint(1, min(3, len(points) - gap_start - 2))
    return [list(points[:gap_start]), list(points[gap_start + gap_length :])]


def _normalise(vector: Point) -> Point:
    length = math.hypot(vector.x, vector.y)
    if length <= 1e-9:
        return Point(0.0, 0.0)
    return Point(vector.x / length, vector.y / length)


def _add_scaled(point: Point, direction: Point, length: float) -> Point:
    return Point(point.x + direction.x * length, point.y + direction.y * length)


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
