from __future__ import annotations

from pathlib import Path

import pandas as pd

from backend.app.schemas import CurrentVsOptimisedComparisonResponse
from backend.app.services.solve_current_vs_p_median import solve_current_vs_p_median


REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DEMO_DIR = REPO_ROOT / "data_demo"


def _read_demo_csv(filename: str) -> pd.DataFrame:
    path = DATA_DEMO_DIR / filename

    if not path.exists():
        raise FileNotFoundError(f"Demo file not found: {path}")

    return pd.read_csv(path)


def run_demo_current_vs_optimised() -> CurrentVsOptimisedComparisonResponse:
    demand_df = _read_demo_csv("demand_example.csv")
    current_df = _read_demo_csv("current_example_2sites_showcase.csv")
    candidate_df = _read_demo_csv("candidate_example_showcase.csv")

    return solve_current_vs_p_median(
        demand_df=demand_df,
        current_df=current_df,
        candidate_df=candidate_df,
        p=2,
        graph_id="dubai_micro",
    )