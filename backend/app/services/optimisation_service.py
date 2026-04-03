from __future__ import annotations

from typing import Any, Dict, List, Sequence

import pandas as pd

from engine.optimisation.p_median import solve_p_median


def build_assignment_rows(
    demand_df: pd.DataFrame,
    facility_df: pd.DataFrame,
    assignments: List[int],
    cost_matrix,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for i, assigned_j in enumerate(assignments):
        rows.append(
            {
                "demand_id": str(demand_df.iloc[i]["id"]),
                "candidate_id": str(facility_df.iloc[assigned_j]["id"]),
                "weighted_cost": float(cost_matrix[i, assigned_j]),
            }
        )

    return rows


def build_demand_points(demand_df: pd.DataFrame) -> List[Dict[str, Any]]:
    points: List[Dict[str, Any]] = []

    for _, row in demand_df.reset_index(drop=True).iterrows():
        points.append(
            {
                "id": str(row["id"]),
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "weight": float(row["weight"]),
            }
        )

    return points


def build_facility_points(
    facility_df: pd.DataFrame,
    indices: Sequence[int] | None = None,
) -> List[Dict[str, Any]]:
    if indices is None:
        indices = range(len(facility_df))

    points: List[Dict[str, Any]] = []

    for idx in indices:
        row = facility_df.iloc[int(idx)]
        points.append(
            {
                "id": str(row["id"]),
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
            }
        )

    return points


def build_assignment_lines(
    demand_df: pd.DataFrame,
    facility_df: pd.DataFrame,
    assignments: List[int],
    cost_matrix,
) -> List[Dict[str, Any]]:
    lines: List[Dict[str, Any]] = []

    for i, assigned_j in enumerate(assignments):
        demand_row = demand_df.iloc[i]
        facility_row = facility_df.iloc[int(assigned_j)]

        lines.append(
            {
                "demand_id": str(demand_row["id"]),
                "facility_id": str(facility_row["id"]),
                "from_lat": float(demand_row["lat"]),
                "from_lng": float(demand_row["lng"]),
                "to_lat": float(facility_row["lat"]),
                "to_lng": float(facility_row["lng"]),
                "weighted_cost": float(cost_matrix[i, assigned_j]),
            }
        )

    return lines


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
        facility_df=candidate_df,
        assignments=solution.assignments,
        cost_matrix=cost_matrix,
    )

    baseline_assignment_rows = build_assignment_rows(
        demand_df=demand_df,
        facility_df=candidate_df,
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


def build_current_vs_optimised_payload(
    demand_df: pd.DataFrame,
    current_df: pd.DataFrame,
    baseline_assignments: List[int],
    baseline_total_weighted_cost: float,
    baseline_cost_matrix,
    candidate_df: pd.DataFrame,
    candidate_cost_matrix,
    p: int,
) -> Dict[str, Any]:
    current_facility_count = len(current_df)

    if p != current_facility_count:
        raise ValueError(
            "For a fair current-vs-optimised comparison, p must equal the number of current facilities."
        )

    solution = solve_p_median(cost_matrix=candidate_cost_matrix, p=p)

    baseline_assignment_rows = build_assignment_rows(
        demand_df=demand_df,
        facility_df=current_df,
        assignments=baseline_assignments,
        cost_matrix=baseline_cost_matrix,
    )

    optimised_assignment_rows = build_assignment_rows(
        demand_df=demand_df,
        facility_df=candidate_df,
        assignments=solution.assignments,
        cost_matrix=candidate_cost_matrix,
    )

    selected_candidate_ids = [
        str(candidate_df.iloc[j]["id"]) for j in solution.selected_candidate_indices
    ]

    current_facility_ids = [str(current_df.iloc[j]["id"]) for j in range(len(current_df))]

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
        "current_facility_count": int(current_facility_count),
        "candidate_pool_count": int(len(candidate_df)),
        "baseline_total_weighted_cost": float(baseline_total_weighted_cost),
        "optimised_total_weighted_cost": float(solution.total_weighted_cost),
        "improvement_pct": float(improvement_pct),
        "current_facility_ids": current_facility_ids,
        "selected_candidate_ids": selected_candidate_ids,
        "baseline_assignments": baseline_assignment_rows,
        "optimised_assignments": optimised_assignment_rows,
        "demand_points": build_demand_points(demand_df),
        "current_facilities": build_facility_points(current_df),
        "selected_facilities": build_facility_points(
            candidate_df,
            solution.selected_candidate_indices,
        ),
        "baseline_assignment_lines": build_assignment_lines(
            demand_df=demand_df,
            facility_df=current_df,
            assignments=baseline_assignments,
            cost_matrix=baseline_cost_matrix,
        ),
        "optimised_assignment_lines": build_assignment_lines(
            demand_df=demand_df,
            facility_df=candidate_df,
            assignments=solution.assignments,
            cost_matrix=candidate_cost_matrix,
        ),
    }