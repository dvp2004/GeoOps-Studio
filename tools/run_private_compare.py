from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.services.private_compare_runner import (  # noqa: E402
    run_private_compare,
    write_private_compare_outputs,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a private current-vs-optimised comparison on local CSVs and a local graph bundle."
    )

    parser.add_argument("--demand-csv", required=True, help="Path to demand CSV")
    parser.add_argument("--current-csv", required=True, help="Path to current facilities CSV")
    parser.add_argument("--candidate-csv", required=True, help="Path to candidate facilities CSV")
    parser.add_argument("--graph-nodes-csv", required=True, help="Path to graph nodes CSV")
    parser.add_argument("--graph-edges-csv", required=True, help="Path to graph edges CSV")
    parser.add_argument("--p", required=True, type=int, help="Facility count for fair comparison")
    parser.add_argument(
        "--output-dir",
        default="private_eval_outputs/run_01",
        help="Directory to write JSON and CSV outputs",
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    result = run_private_compare(
        demand_csv_path=args.demand_csv,
        current_csv_path=args.current_csv,
        candidate_csv_path=args.candidate_csv,
        graph_nodes_csv_path=args.graph_nodes_csv,
        graph_edges_csv_path=args.graph_edges_csv,
        p=args.p,
    )

    output_dir = write_private_compare_outputs(result, args.output_dir)

    print("")
    print("Private comparison completed successfully.")
    print(f"Repo root: {REPO_ROOT}")
    print(f"Output directory: {Path(output_dir).resolve()}")
    print(f"Baseline weighted cost: {result['baseline_total_weighted_cost']:.6f}")
    print(f"Optimised weighted cost: {result['optimised_total_weighted_cost']:.6f}")
    print(f"Improvement %: {result['improvement_pct']:.6f}")
    print(f"Current facility ids: {', '.join(result['current_facility_ids'])}")
    print(f"Selected candidate ids: {', '.join(result['selected_candidate_ids'])}")
    print("")


if __name__ == "__main__":
    main()