"""Authored configuration for deterministic Dynamic Webs span assets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


GENERATOR_VERSION: Final[str] = "1.3.0"
DEFAULT_MASTER_SEED: Final[str] = "dynamic-webs:web-span-assets:v2"
DEFAULT_SIZE_PX: Final[int] = 512
DEFAULT_SUPERSAMPLE: Final[int] = 4
VARIANT_COUNT: Final[int] = 8

# Four authored wall-support anchors. Runtime maps this rectangle onto the
# generated passage quadrilateral using two textured triangles, so converging,
# diverging and moderately skewed cave walls do not need to be parallel.
SOURCE_FIRST_WALL_START: Final[tuple[float, float]] = (0.06, 0.08)
SOURCE_FIRST_WALL_END: Final[tuple[float, float]] = (0.94, 0.08)
SOURCE_SECOND_WALL_START: Final[tuple[float, float]] = (0.06, 0.92)
SOURCE_SECOND_WALL_END: Final[tuple[float, float]] = (0.94, 0.92)
WALL_MARGIN: Final[float] = 0.08

# Span assets are commonly reduced from a 512 px source to roughly one grid
# square in Foundry. These source-space widths deliberately exceed the earlier
# 1.1 values so the crisp fibres remain readable after mesh warping and
# down-scaling. The runtime thickness underlay then widens them without being
# responsible for basic visibility.
RAIL_WIDTH_RANGE_PX: Final[tuple[float, float]] = (3.6, 5.0)
CROSS_LINK_WIDTH_RANGE_PX: Final[tuple[float, float]] = (2.6, 3.8)
DIAGONAL_WIDTH_RANGE_PX: Final[tuple[float, float]] = (2.8, 4.0)
WALL_SUPPORT_WIDTH_RANGE_PX: Final[tuple[float, float]] = (3.4, 4.8)
LOOSE_THREAD_WIDTH_RANGE_PX: Final[tuple[float, float]] = (1.9, 2.8)

RAIL_ALPHA_RANGE: Final[tuple[int, int]] = (190, 235)
CROSS_LINK_ALPHA_RANGE: Final[tuple[int, int]] = (145, 210)
DIAGONAL_ALPHA_RANGE: Final[tuple[int, int]] = (150, 220)
WALL_SUPPORT_ALPHA_RANGE: Final[tuple[int, int]] = (190, 235)
LOOSE_THREAD_ALPHA_RANGE: Final[tuple[int, int]] = (80, 130)


@dataclass(frozen=True, slots=True)
class SpanAssetSpec:
    """One deterministic distributed span-sheet variant."""

    asset_id: str
    variant: int
    recommended_alpha_min: float = 1.0
    recommended_alpha_max: float = 1.0
    weight: float = 1.0


SPAN_ASSET_SPECS: Final[tuple[SpanAssetSpec, ...]] = tuple(
    SpanAssetSpec(asset_id=f"span-{variant:02d}", variant=variant)
    for variant in range(1, VARIANT_COUNT + 1)
)
