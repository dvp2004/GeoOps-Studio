from __future__ import annotations

import pandas as pd
from backend.app.schemas import CurrentVsOptimisedComparisonResponse
from backend.app.services.optimisation_service import build_current_vs_optimised_payload
from engine.network.cost_matrix import (
    compute_baseline_assignment,
    compute_weighted_cost_matrix,
)
from engine.network.graph_loader import load_demo_graph
from engine.network.snapping import build_node_snap_index, snap_points_to_nodes


def _same_facility_sites(current_df: pd.DataFrame, candidate_df: pd.DataFrame) -> bool:
    cols = ["id", "lat", "lng"]
    a = current_df[cols].copy().sort_values("id").reset_index(drop=True)
    b = candidate_df[cols].copy().sort_values("id").reset_index(drop=True)
    return a.equals(b)


def _build_assignment_rows_and_lines(
    snapped_demand: pd.DataFrame,
    snapped_facilities: pd.DataFrame,
    assignment_indices: list[int],
    weighted_cost_matrix,
) -> tuple[list[dict], list[dict]]:
    assignment_rows: list[dict] = []
    assignment_lines: list[dict] = []

    for demand_idx, facility_idx in enumerate(assignment_indices):
        demand_row = snapped_demand.iloc[demand_idx]
        facility_row = snapped_facilities.iloc[facility_idx]
        weighted_cost = float(weighted_cost_matrix[demand_idx, facility_idx])

        assignment_rows.append(
            {
                "demand_id": str(demand_row["id"]),
                "candidate_id": str(facility_row["id"]),
                "weighted_cost": weighted_cost,
            }
        )

        assignment_lines.append(
            {
                "demand_id": str(demand_row["id"]),
                "facility_id": str(facility_row["id"]),
                "from_lat": float(demand_row["lat"]),
                "from_lng": float(demand_row["lng"]),
                "to_lat": float(facility_row["lat"]),
                "to_lng": float(facility_row["lng"]),
                "weighted_cost": weighted_cost,
            }
        )

    return assignment_rows, assignment_lines


def solve_current_vs_p_median(
    demand_df: pd.DataFrame,
    current_df: pd.DataFrame,
    candidate_df: pd.DataFrame,
    p: int,
    graph_id: str = "dubai_micro",
) -> CurrentVsOptimisedComparisonResponse:
    if len(current_df) == 0:
        raise ValueError("Current facilities file must contain at least one row.")

    if len(candidate_df) == 0:
        raise ValueError("Candidate facilities file must contain at least one row.")

    if p < 1:
        raise ValueError("p must be at least 1.")

    if p != len(current_df):
        raise ValueError(
            "For fair current-vs-optimised comparison, p must equal the number of current facilities."
        )

    if p > len(candidate_df):
        raise ValueError("p cannot exceed the number of candidate facilities.")

    loaded_graph = load_demo_graph(graph_id)
    snap_index = build_node_snap_index(loaded_graph.nodes_df)

    snapped_demand = snap_points_to_nodes(
        demand_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)

    snapped_current = snap_points_to_nodes(
        current_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)

    snapped_candidates = snap_points_to_nodes(
        candidate_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)

    baseline_cost_matrix = compute_weighted_cost_matrix(
        graph=loaded_graph.graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_current["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )

    baseline_assignments, _, baseline_total_cost = compute_baseline_assignment(
        baseline_cost_matrix
    )
    baseline_assignment_indices = [int(x) for x in baseline_assignments]

    # Short-circuit the sanity package:
    # if the candidate pool is exactly the current site set and p == current count,
    # the optimised answer must be identical to baseline.
    if _same_facility_sites(current_df, candidate_df):
        return _build_sanity_short_circuit_response(
            snapped_demand=snapped_demand,
            snapped_current=snapped_current,
            baseline_assignment_indices=baseline_assignment_indices,
            baseline_total_cost=float(baseline_total_cost),
            baseline_cost_matrix=baseline_cost_matrix,
            p=p,
        )

    unique_current_nodes = snapped_current["snapped_node_id"].astype(str).nunique()
    if p > unique_current_nodes:
        raise ValueError(
            f"p={p} exceeds the number of unique snapped current facility nodes ({unique_current_nodes}). "
            "The current facilities collapse to too few distinct graph nodes after snapping."
        )

    unique_candidate_nodes = snapped_candidates["snapped_node_id"].astype(str).nunique()
    if p > unique_candidate_nodes:
        raise ValueError(
            f"p={p} exceeds the number of unique snapped candidate nodes ({unique_candidate_nodes}). "
            "The candidate pool collapses to too few distinct graph nodes after snapping."
        )

    candidate_cost_matrix = compute_weighted_cost_matrix(
        graph=loaded_graph.graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_candidates["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )

    payload = build_current_vs_optimised_payload(
            demand_df=snapped_demand,
            current_df=snapped_current,
            baseline_assignments=baseline_assignment_indices,
            baseline_total_weighted_cost=float(baseline_total_cost),
            baseline_cost_matrix=baseline_cost_matrix,
            candidate_df=snapped_candidates,
            candidate_cost_matrix=candidate_cost_matrix,
            p=p,
        )

    return CurrentVsOptimisedComparisonResponse(**payload)


def _build_sanity_short_circuit_response(
    snapped_demand: pd.DataFrame,
    snapped_current: pd.DataFrame,
    baseline_assignment_indices: list[int],
    baseline_total_cost: float,
    baseline_cost_matrix,
    p: int,
) -> CurrentVsOptimisedComparisonResponse:
    baseline_rows, baseline_lines = _build_assignment_rows_and_lines(
        snapped_demand=snapped_demand,
        snapped_facilities=snapped_current,
        assignment_indices=baseline_assignment_indices,
        weighted_cost_matrix=baseline_cost_matrix,
    )

    payload = {
        "p": int(p),
        "current_facility_count": int(len(snapped_current)),
        "candidate_pool_count": int(len(snapped_current)),
        "baseline_total_weighted_cost": float(baseline_total_cost),
        "optimised_total_weighted_cost": float(baseline_total_cost),
        "improvement_pct": 0.0,
        "current_facility_ids": [str(x) for x in snapped_current["id"].tolist()],
        "selected_candidate_ids": [str(x) for x in snapped_current["id"].tolist()],
        "baseline_assignments": baseline_rows,
        "optimised_assignments": baseline_rows,
        "demand_points": [
            {
                "id": str(row["id"]),
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
                "weight": float(row["weight"]),
            }
            for _, row in snapped_demand.iterrows()
        ],
        "current_facilities": [
            {
                "id": str(row["id"]),
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
            }
            for _, row in snapped_current.iterrows()
        ],
        "selected_facilities": [
            {
                "id": str(row["id"]),
                "lat": float(row["lat"]),
                "lng": float(row["lng"]),
            }
            for _, row in snapped_current.iterrows()
        ],
        "baseline_assignment_lines": baseline_lines,
        "optimised_assignment_lines": baseline_lines,
    }

    return CurrentVsOptimisedComparisonResponse(**payload)


