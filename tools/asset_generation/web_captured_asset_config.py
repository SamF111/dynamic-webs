"""Authored configuration for deterministic captured-web effect assets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


GENERATOR_VERSION: Final[str] = "1.0.0"
DEFAULT_MASTER_SEED: Final[str] = "dynamic-webs:web-captured-assets:v1"
DEFAULT_SIZE_PX: Final[int] = 512
DEFAULT_SUPERSAMPLE: Final[int] = 4
VARIANT_COUNT: Final[int] = 8
SOURCE_PIVOT: Final[tuple[float, float]] = (0.5, 0.5)
SOURCE_RADIUS: Final[float] = 0.44


@dataclass(frozen=True, slots=True)
class CapturedAssetSpec:
    """One deterministic local entanglement overlay."""

    asset_id: str
    variant: int
    recommended_alpha_min: float = 0.82
    recommended_alpha_max: float = 1.0
    weight: float = 1.0


CAPTURED_ASSET_SPECS: Final[tuple[CapturedAssetSpec, ...]] = tuple(
    CapturedAssetSpec(
        asset_id=f"captured-{variant:02d}",
        variant=variant,
    )
    for variant in range(1, VARIANT_COUNT + 1)
)
