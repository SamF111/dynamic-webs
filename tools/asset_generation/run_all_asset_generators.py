#!/usr/bin/env python3
"""Run every Dynamic Webs asset generator in tools/asset_generation/.

Place this file in:
    tools/asset_generation/run_all_asset_generators.py

Run it from anywhere with:
    python tools/asset_generation/run_all_asset_generators.py

By default, each discovered generate_*.py script receives:
    --clean --preview
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Discover and run every generate_*.py asset generator in this "
            "directory using the current Python interpreter."
        )
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Do not pass --clean to the individual generators.",
    )
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Do not pass --preview to the individual generators.",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Continue running later generators after one fails.",
    )
    return parser.parse_args()


def discover_generators(directory: Path) -> list[Path]:
    """Return all generate_*.py files in stable name order."""

    generators = sorted(
        path
        for path in directory.glob("generate_*.py")
        if path.is_file()
    )

    if not generators:
        raise FileNotFoundError(
            f"No generate_*.py files were found in {directory}"
        )

    return generators


def run_generator(
    generator: Path,
    *,
    clean: bool,
    preview: bool,
) -> int:
    command = [sys.executable, str(generator)]

    if clean:
        command.append("--clean")

    if preview:
        command.append("--preview")

    print()
    print("=" * 78)
    print(f"Running {generator.name}")
    print("Command:", " ".join(command))
    print("=" * 78)

    completed = subprocess.run(
        command,
        cwd=generator.parent,
        check=False,
    )

    return int(completed.returncode)


def main() -> int:
    arguments = parse_arguments()
    script_directory = Path(__file__).resolve().parent
    generators = discover_generators(script_directory)

    print(
        f"Discovered {len(generators)} generator"
        f"{'' if len(generators) == 1 else 's'}:"
    )

    for generator in generators:
        print(f"  - {generator.name}")

    failures: list[tuple[str, int]] = []

    for generator in generators:
        return_code = run_generator(
            generator,
            clean=not arguments.no_clean,
            preview=not arguments.no_preview,
        )

        if return_code == 0:
            print(f"Completed {generator.name}")
            continue

        failures.append((generator.name, return_code))
        print(
            f"FAILED: {generator.name} exited with code {return_code}",
            file=sys.stderr,
        )

        if not arguments.continue_on_error:
            break

    print()
    print("=" * 78)

    if failures:
        print("Asset generation failed:", file=sys.stderr)
        for name, return_code in failures:
            print(
                f"  - {name}: exit code {return_code}",
                file=sys.stderr,
            )
        return 1

    print(f"All {len(generators)} asset generators completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
