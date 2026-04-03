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

    candidate_cost_matrix = compute_weighted_cost_matrix(
        graph=loaded_graph.graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_candidates["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )

    payload = build_current_vs_optimised_payload(
        demand_df=snapped_demand,
        current_df=snapped_current,
        baseline_assignments=[int(x) for x in baseline_assignments],
        baseline_total_weighted_cost=float(baseline_total_cost),
        baseline_cost_matrix=baseline_cost_matrix,
        candidate_df=snapped_candidates,
        candidate_cost_matrix=candidate_cost_matrix,
        p=p,
    )

    return CurrentVsOptimisedComparisonResponse(**payload)