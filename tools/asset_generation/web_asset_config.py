"""Authored configuration for deterministic Dynamic Webs patch generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


GENERATOR_VERSION: Final[str] = "1.2.0"
DEFAULT_MASTER_SEED: Final[str] = "dynamic-webs:web-carpet-patches:v1"
DEFAULT_SIZE_PX: Final[int] = 512
DEFAULT_SUPERSAMPLE: Final[int] = 4


@dataclass(frozen=True, slots=True)
class AssetSpec:
    """One deterministic patch asset to generate."""

    asset_id: str
    category: str
    variant: int
    recommended_scale_min: float
    recommended_scale_max: float
    recommended_alpha_min: float
    recommended_alpha_max: float
    weight: float = 1.0


ASSET_SPECS: Final[tuple[AssetSpec, ...]] = (
    # Existing v1.0.0 assets. Their IDs and authored parameters remain unchanged.
    AssetSpec("loose-network-01", "loose-network", 1, 0.65, 1.35, 0.48, 0.90, 1.0),
    AssetSpec("loose-network-02", "loose-network", 2, 0.60, 1.40, 0.42, 0.88, 1.0),
    AssetSpec("loose-network-03", "loose-network", 3, 0.70, 1.30, 0.52, 0.94, 0.9),
    AssetSpec("loose-network-04", "loose-network", 4, 0.58, 1.42, 0.40, 0.86, 0.8),
    AssetSpec("support-arc-01", "support-arc", 1, 0.75, 1.55, 0.55, 0.96, 0.9),
    AssetSpec("support-arc-02", "support-arc", 2, 0.70, 1.60, 0.50, 0.92, 0.9),
    AssetSpec("support-arc-03", "support-arc", 3, 0.80, 1.45, 0.58, 0.98, 0.8),
    AssetSpec("support-arc-04", "support-arc", 4, 0.70, 1.55, 0.52, 0.94, 0.8),
    AssetSpec("dense-knot-01", "dense-knot", 1, 0.55, 1.10, 0.52, 0.92, 0.8),
    AssetSpec("dense-knot-02", "dense-knot", 2, 0.50, 1.05, 0.48, 0.88, 0.7),
    AssetSpec("dense-knot-03", "dense-knot", 3, 0.58, 1.15, 0.55, 0.94, 0.7),
    AssetSpec("fray-01", "fray", 1, 0.55, 1.35, 0.35, 0.78, 0.8),
    AssetSpec("fray-02", "fray", 2, 0.50, 1.40, 0.32, 0.75, 0.8),
    AssetSpec("fray-03", "fray", 3, 0.60, 1.30, 0.38, 0.80, 0.7),
    AssetSpec("faint-sheet-01", "faint-sheet", 1, 0.85, 1.65, 0.20, 0.52, 0.55),
    AssetSpec("faint-sheet-02", "faint-sheet", 2, 0.80, 1.70, 0.18, 0.48, 0.50),

    # v1.1.0 expansion: more isolated deterministic variants in every family.
    AssetSpec("loose-network-05", "loose-network", 5, 0.62, 1.50, 0.44, 0.92, 1.0),
    AssetSpec("loose-network-06", "loose-network", 6, 0.72, 1.45, 0.50, 0.96, 0.95),
    AssetSpec("loose-network-07", "loose-network", 7, 0.55, 1.55, 0.38, 0.84, 0.90),
    AssetSpec("loose-network-08", "loose-network", 8, 0.68, 1.38, 0.46, 0.90, 0.90),
    AssetSpec("loose-network-09", "loose-network", 9, 0.60, 1.60, 0.36, 0.82, 0.85),
    AssetSpec("loose-network-10", "loose-network", 10, 0.74, 1.50, 0.52, 0.98, 0.85),
    AssetSpec("loose-network-11", "loose-network", 11, 0.52, 1.48, 0.40, 0.88, 0.80),
    AssetSpec("loose-network-12", "loose-network", 12, 0.66, 1.56, 0.45, 0.93, 0.80),

    AssetSpec("support-arc-05", "support-arc", 5, 0.72, 1.70, 0.54, 0.97, 0.90),
    AssetSpec("support-arc-06", "support-arc", 6, 0.68, 1.66, 0.48, 0.91, 0.85),
    AssetSpec("support-arc-07", "support-arc", 7, 0.82, 1.52, 0.60, 1.00, 0.85),
    AssetSpec("support-arc-08", "support-arc", 8, 0.66, 1.74, 0.46, 0.90, 0.80),
    AssetSpec("support-arc-09", "support-arc", 9, 0.76, 1.62, 0.56, 0.98, 0.80),
    AssetSpec("support-arc-10", "support-arc", 10, 0.70, 1.78, 0.50, 0.94, 0.75),

    AssetSpec("dense-knot-04", "dense-knot", 4, 0.52, 1.18, 0.50, 0.92, 0.75),
    AssetSpec("dense-knot-05", "dense-knot", 5, 0.48, 1.12, 0.46, 0.88, 0.75),
    AssetSpec("dense-knot-06", "dense-knot", 6, 0.60, 1.22, 0.56, 0.96, 0.70),
    AssetSpec("dense-knot-07", "dense-knot", 7, 0.46, 1.08, 0.44, 0.86, 0.70),
    AssetSpec("dense-knot-08", "dense-knot", 8, 0.56, 1.25, 0.54, 0.98, 0.65),
    AssetSpec("dense-knot-09", "dense-knot", 9, 0.50, 1.16, 0.48, 0.92, 0.65),
    AssetSpec("dense-knot-10", "dense-knot", 10, 0.62, 1.28, 0.58, 1.00, 0.60),

    AssetSpec("fray-04", "fray", 4, 0.52, 1.46, 0.34, 0.79, 0.75),
    AssetSpec("fray-05", "fray", 5, 0.58, 1.42, 0.36, 0.82, 0.75),
    AssetSpec("fray-06", "fray", 6, 0.48, 1.50, 0.30, 0.74, 0.70),
    AssetSpec("fray-07", "fray", 7, 0.64, 1.36, 0.40, 0.84, 0.70),
    AssetSpec("fray-08", "fray", 8, 0.50, 1.54, 0.32, 0.78, 0.65),
    AssetSpec("fray-09", "fray", 9, 0.60, 1.44, 0.38, 0.86, 0.65),
    AssetSpec("fray-10", "fray", 10, 0.46, 1.58, 0.28, 0.72, 0.60),

    AssetSpec("faint-sheet-03", "faint-sheet", 3, 0.88, 1.78, 0.20, 0.54, 0.50),
    AssetSpec("faint-sheet-04", "faint-sheet", 4, 0.76, 1.82, 0.16, 0.46, 0.48),
    AssetSpec("faint-sheet-05", "faint-sheet", 5, 0.92, 1.72, 0.22, 0.56, 0.46),
    AssetSpec("faint-sheet-06", "faint-sheet", 6, 0.72, 1.88, 0.14, 0.44, 0.44),
)
