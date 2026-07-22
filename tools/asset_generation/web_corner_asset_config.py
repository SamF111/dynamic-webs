"""Authored angle families for deterministic Dynamic Webs corner assets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


GENERATOR_VERSION: Final[str] = "1.3.0"
DEFAULT_MASTER_SEED: Final[str] = "dynamic-webs:web-corner-assets:v3"
DEFAULT_SIZE_PX: Final[int] = 512
DEFAULT_SUPERSAMPLE: Final[int] = 4
VARIANTS_PER_ANGLE: Final[int] = 6
SOURCE_PIVOT: Final[tuple[float, float]] = (0.5, 0.5)
SOURCE_ANCHOR_RADIUS: Final[float] = 0.42

# Fibre widths are authored at the 512 px source size and are subsequently
# reduced by the runtime affine fit. The values preserve the visibility gains
# from generator 1.2 while allowing the distributed sheet network to remain
# lighter than the old radial hub-and-spoke construction.
WALL_SUPPORT_WIDTH_MULTIPLIER: Final[float] = 3.0
SECONDARY_SUPPORT_WIDTH_MULTIPLIER: Final[float] = 2.5
STRUCTURAL_WIDTH_MULTIPLIER: Final[float] = 2.75
CAPTURE_WIDTH_MULTIPLIER: Final[float] = 2.55
LOOSE_THREAD_WIDTH_MULTIPLIER: Final[float] = 2.35
UNDER_FIBRE_WIDTH_ADDITION_PX: Final[float] = 1.9
UNDER_FIBRE_ALPHA_FRACTION: Final[float] = 0.30
SOFTENING_BLUR_RADIUS_PX: Final[float] = 0.65

# Local validation guardrails. These are intentionally low enough for 5°
# assets while rejecting hairline rendering that becomes illegible after the
# runtime affine fit.
MINIMUM_MEAN_ALPHA: Final[float] = 1.7
MINIMUM_ALPHA_64_COVERAGE: Final[float] = 0.009
MINIMUM_ALPHA_128_COVERAGE: Final[float] = 0.007

# Acute corner assets occupy a much smaller fraction of the square source
# canvas than broad corner assets. Visibility validation therefore scales the
# whole-canvas density floors modestly below this reference angle, while
# preserving the full authored thresholds for ordinary and obtuse corners.
VISIBILITY_FULL_STRENGTH_ANGLE_DEG: Final[float] = 20.0
MINIMUM_NARROW_ANGLE_VISIBILITY_FACTOR: Final[float] = 0.8


@dataclass(frozen=True, slots=True)
class CornerAssetSpec:
    """One deterministic corner-web asset family member."""

    asset_id: str
    canonical_angle_deg: float
    supported_angle_min_deg: float
    supported_angle_max_deg: float
    variant: int
    recommended_alpha_min: float = 0.88
    recommended_alpha_max: float = 1.0
    weight: float = 1.0


ANGLE_FAMILIES: Final[tuple[tuple[float, float, float], ...]] = (
    (5.0, 3.0, 7.5),
    (10.0, 7.5, 12.5),
    (15.0, 12.5, 20.0),
    (25.0, 20.0, 30.0),
    (35.0, 30.0, 40.0),
    (45.0, 40.0, 52.5),
    (60.0, 52.5, 67.5),
    (75.0, 67.5, 82.5),
    (90.0, 82.5, 100.0),
    (110.0, 100.0, 122.5),
    (135.0, 122.5, 142.5),
    (150.0, 142.5, 160.0),
)


def _build_specs() -> tuple[CornerAssetSpec, ...]:
    specs: list[CornerAssetSpec] = []
    for canonical, minimum, maximum in ANGLE_FAMILIES:
        angle_id = f"{round(canonical):03d}"
        for variant in range(1, VARIANTS_PER_ANGLE + 1):
            specs.append(
                CornerAssetSpec(
                    asset_id=f"corner-{angle_id}-{variant:02d}",
                    canonical_angle_deg=canonical,
                    supported_angle_min_deg=minimum,
                    supported_angle_max_deg=maximum,
                    variant=variant,
                    weight=1.0,
                )
            )
    return tuple(specs)


CORNER_ASSET_SPECS: Final[tuple[CornerAssetSpec, ...]] = _build_specs()
