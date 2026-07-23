"""Authored configuration for deterministic Dynamic Webs ground assets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


GENERATOR_VERSION: Final[str] = "1.0.0"
DEFAULT_MASTER_SEED: Final[str] = "dynamic-webs:web-ground-assets:v1"
DEFAULT_SIZE_PX: Final[int] = 512
DEFAULT_SUPERSAMPLE: Final[int] = 4
VARIANT_COUNT: Final[int] = 12
SOURCE_PIVOT: Final[tuple[float, float]] = (0.5, 0.5)
SOURCE_RADIUS: Final[float] = 0.42

STRUCTURAL_WIDTH_MULTIPLIER: Final[float] = 1.55
CAPTURE_WIDTH_MULTIPLIER: Final[float] = 1.25
DECORATIVE_WIDTH_MULTIPLIER: Final[float] = 1.05


@dataclass(frozen=True, slots=True)
class GroundAssetSpec:
    """One deterministic irregular radial ground-web variant."""

    asset_id: str
    variant: int
    recommended_alpha_min: float = 0.92
    recommended_alpha_max: float = 1.0
    weight: float = 1.0


GROUND_ASSET_SPECS: Final[tuple[GroundAssetSpec, ...]] = tuple(
    GroundAssetSpec(
        asset_id=f"ground-{variant:02d}",
        variant=variant,
    )
    for variant in range(1, VARIANT_COUNT + 1)
)
