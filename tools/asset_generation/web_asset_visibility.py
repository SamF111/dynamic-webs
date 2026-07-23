"""Shared authored-fibre visibility standard for Dynamic Webs assets.

The refined wall-span library is the minimum accepted source visibility for
all generated web families. Renderers may author stronger or wider fibres, but
must not emit a crisp fibre below these source-space limits.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final


AUTHORED_FIBRE_STANDARD_ID: Final[str] = "span-visibility-v1"
REFERENCE_ASSET_SIZE_PX: Final[int] = 512

# The weakest accepted refined-span fibre is the baseline for every family.
MINIMUM_CORE_WIDTH_PX: Final[float] = 1.9
MINIMUM_CORE_ALPHA: Final[int] = 80

# Shared source under-fibre treatment. Runtime thickness remains separate.
UNDER_FIBRE_WIDTH_ADDITION_PX: Final[float] = 2.0
UNDER_FIBRE_ALPHA_FRACTION: Final[float] = 0.38
SOFTENING_BLUR_RADIUS_PX: Final[float] = 0.5

# Whole-canvas visibility floors established by the refined span library.
# Sparse or acute topologies may apply an explicit documented occupancy factor,
# but must still use the same per-fibre width and alpha floor above.
BASE_MINIMUM_MEAN_ALPHA: Final[float] = 2.7
BASE_MINIMUM_ALPHA_64_COVERAGE: Final[float] = 0.015
BASE_MINIMUM_ALPHA_128_COVERAGE: Final[float] = 0.010


@dataclass(frozen=True, slots=True)
class FibreStyle:
    """Resolved supersampled line style for one generated fibre."""

    core_width: int
    under_width: int
    core_alpha: int
    under_alpha: int


def resolve_fibre_style(
    *,
    width_px: float,
    alpha: int,
    canvas_size_px: int,
) -> FibreStyle:
    """Apply the shared source-space visibility floor.

    ``width_px`` is authored at the 512 px reference size. Scaling from the
    complete supersampled canvas keeps the same apparent source thickness when
    a developer requests another output size or supersampling factor.
    """

    safe_canvas_size = max(1, int(canvas_size_px))
    safe_width = max(MINIMUM_CORE_WIDTH_PX, float(width_px))
    safe_alpha = max(MINIMUM_CORE_ALPHA, min(255, int(alpha)))
    source_scale = safe_canvas_size / REFERENCE_ASSET_SIZE_PX

    core_width = max(1, round(safe_width * source_scale))
    under_width = max(
        core_width + 1,
        round((safe_width + UNDER_FIBRE_WIDTH_ADDITION_PX) * source_scale),
    )

    return FibreStyle(
        core_width=core_width,
        under_width=under_width,
        core_alpha=safe_alpha,
        under_alpha=max(1, round(safe_alpha * UNDER_FIBRE_ALPHA_FRACTION)),
    )


def visibility_thresholds(
    factor: float = 1.0,
) -> tuple[float, float, float]:
    """Return whole-canvas alpha thresholds for one topology occupancy factor."""

    safe_factor = max(0.05, min(1.0, float(factor)))
    return (
        BASE_MINIMUM_MEAN_ALPHA * safe_factor,
        BASE_MINIMUM_ALPHA_64_COVERAGE * safe_factor,
        BASE_MINIMUM_ALPHA_128_COVERAGE * safe_factor,
    )
