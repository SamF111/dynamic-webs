"""Small deterministic geometry helpers used by the asset renderer."""

from __future__ import annotations

import hashlib
import math
import random
from collections.abc import Iterable, Sequence
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float


def create_asset_random(master_seed: str, asset_id: str) -> random.Random:
    """Create a deterministic random stream isolated to one asset ID."""

    digest = hashlib.sha256(f"{master_seed}:{asset_id}".encode("utf-8")).digest()
    return random.Random(int.from_bytes(digest[:16], byteorder="big", signed=False))


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def lerp(first: float, second: float, fraction: float) -> float:
    return first + (second - first) * fraction


def lerp_point(first: Point, second: Point, fraction: float) -> Point:
    return Point(
        lerp(first.x, second.x, fraction),
        lerp(first.y, second.y, fraction),
    )


def distance(first: Point, second: Point) -> float:
    return math.hypot(second.x - first.x, second.y - first.y)


def normalise(vector: Point) -> Point:
    length = math.hypot(vector.x, vector.y)
    if length <= 1e-9:
        return Point(0.0, 0.0)
    return Point(vector.x / length, vector.y / length)


def quadratic_bezier(
    start: Point,
    control: Point,
    end: Point,
    samples: int,
) -> list[Point]:
    """Sample a quadratic Bézier curve including both endpoints."""

    sample_count = max(2, int(samples))
    points: list[Point] = []
    for index in range(sample_count):
        t = index / (sample_count - 1)
        inverse = 1.0 - t
        points.append(
            Point(
                inverse * inverse * start.x
                + 2.0 * inverse * t * control.x
                + t * t * end.x,
                inverse * inverse * start.y
                + 2.0 * inverse * t * control.y
                + t * t * end.y,
            )
        )
    return points


def cubic_bezier(
    start: Point,
    control_a: Point,
    control_b: Point,
    end: Point,
    samples: int,
) -> list[Point]:
    """Sample a cubic Bézier curve including both endpoints."""

    sample_count = max(2, int(samples))
    points: list[Point] = []
    for index in range(sample_count):
        t = index / (sample_count - 1)
        inverse = 1.0 - t
        points.append(
            Point(
                inverse**3 * start.x
                + 3.0 * inverse * inverse * t * control_a.x
                + 3.0 * inverse * t * t * control_b.x
                + t**3 * end.x,
                inverse**3 * start.y
                + 3.0 * inverse * inverse * t * control_a.y
                + 3.0 * inverse * t * t * control_b.y
                + t**3 * end.y,
            )
        )
    return points


def chaikin(points: Sequence[Point], passes: int = 2) -> list[Point]:
    """Smooth an open polyline without moving its endpoints."""

    current = list(points)
    if len(current) < 3:
        return current

    for _ in range(max(0, int(passes))):
        smoothed = [current[0]]
        for first, second in zip(current, current[1:]):
            smoothed.append(lerp_point(first, second, 0.25))
            smoothed.append(lerp_point(first, second, 0.75))
        smoothed.append(current[-1])
        current = smoothed
    return current


def jittered_polyline(
    random_source: random.Random,
    start: Point,
    end: Point,
    *,
    intermediate_count: int,
    perpendicular_jitter: float,
    along_jitter: float = 0.04,
) -> list[Point]:
    """Create one organic open polyline between two points."""

    vector = Point(end.x - start.x, end.y - start.y)
    tangent = normalise(vector)
    perpendicular = Point(-tangent.y, tangent.x)
    points = [start]

    for index in range(1, intermediate_count + 1):
        fraction = index / (intermediate_count + 1)
        base = lerp_point(start, end, fraction)
        along = random_source.uniform(-along_jitter, along_jitter)
        across = random_source.uniform(-perpendicular_jitter, perpendicular_jitter)
        points.append(
            Point(
                base.x + tangent.x * along + perpendicular.x * across,
                base.y + tangent.y * along + perpendicular.y * across,
            )
        )

    points.append(end)
    return chaikin(points, passes=2)


def distribute_points(
    random_source: random.Random,
    *,
    count: int,
    margin: float,
    minimum_separation: float,
    maximum_attempts: int = 800,
) -> list[Point]:
    """Create separated points in normalised 0..1 patch coordinates."""

    points: list[Point] = []
    attempts = 0

    while len(points) < count and attempts < maximum_attempts:
        attempts += 1
        candidate = Point(
            random_source.uniform(margin, 1.0 - margin),
            random_source.uniform(margin, 1.0 - margin),
        )
        if all(distance(candidate, existing) >= minimum_separation for existing in points):
            points.append(candidate)

    return points


def nearest_neighbour_edges(
    points: Sequence[Point],
    *,
    neighbours_per_point: int,
    maximum_distance: float,
) -> list[tuple[int, int]]:
    """Create a sparse undirected local graph without duplicate edges."""

    edges: set[tuple[int, int]] = set()
    for index, point in enumerate(points):
        neighbours = sorted(
            (
                (distance(point, other), other_index)
                for other_index, other in enumerate(points)
                if other_index != index
            ),
            key=lambda entry: (entry[0], entry[1]),
        )
        for edge_distance, other_index in neighbours[: max(1, neighbours_per_point)]:
            if edge_distance <= maximum_distance:
                edges.add(tuple(sorted((index, other_index))))
    return sorted(edges)


def polyline_length(points: Iterable[Point]) -> float:
    values = list(points)
    return sum(distance(first, second) for first, second in zip(values, values[1:]))
