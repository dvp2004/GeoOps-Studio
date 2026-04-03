from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd

from engine.optimisation.p_median import solve_p_median


def build_assignment_rows(
    demand_df: pd.DataFrame,
    candidate_df: pd.DataFrame,
    assignments: List[int],
    cost_matrix,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for i, assigned_j in enumerate(assignments):
        rows.append(
            {
                "demand_id": str(demand_df.iloc[i]["id"]),
                "candidate_id": str(candidate_df.iloc[assigned_j]["id"]),
                "weighted_cost": float(cost_matrix[i, assigned_j]),
            }
        )

    return rows


def build_comparison_payload(
    demand_df: pd.DataFrame,
    candidate_df: pd.DataFrame,
    baseline_assignments: List[int],
    baseline_total_weighted_cost: float,
    cost_matrix,
    p: int,
) -> Dict[str, Any]:
    solution = solve_p_median(cost_matrix=cost_matrix, p=p)

    optimised_assignment_rows = build_assignment_rows(
        demand_df=demand_df,
        candidate_df=candidate_df,
        assignments=solution.assignments,
        cost_matrix=cost_matrix,
    )

    baseline_assignment_rows = build_assignment_rows(
        demand_df=demand_df,
        candidate_df=candidate_df,
        assignments=baseline_assignments,
        cost_matrix=cost_matrix,
    )

    selected_candidate_ids = [
        str(candidate_df.iloc[j]["id"]) for j in solution.selected_candidate_indices
    ]

    improvement_pct = (
        (
            (baseline_total_weighted_cost - solution.total_weighted_cost)
            / baseline_total_weighted_cost
        )
        * 100.0
        if baseline_total_weighted_cost > 0
        else 0.0
    )

    return {
        "p": p,
        "baseline_total_weighted_cost": float(baseline_total_weighted_cost),
        "optimised_total_weighted_cost": float(solution.total_weighted_cost),
        "improvement_pct": float(improvement_pct),
        "selected_candidate_ids": selected_candidate_ids,
        "baseline_assignments": baseline_assignment_rows,
        "optimised_assignments": optimised_assignment_rows,
    }