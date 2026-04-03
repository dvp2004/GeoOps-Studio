from __future__ import annotations

import pandas as pd

from backend.app.schemas import OptimisationComparisonResponse
from backend.app.services.optimisation_service import build_comparison_payload
from engine.network.cost_matrix import (
    compute_baseline_assignment,
    compute_weighted_cost_matrix,
)
from engine.network.graph_loader import load_demo_graph
from engine.network.snapping import build_node_snap_index, snap_points_to_nodes


def solve_compare(
    demand_df: pd.DataFrame,
    candidate_df: pd.DataFrame,
    p: int,
    graph_id: str = "dubai_micro",
) -> OptimisationComparisonResponse:
    if p < 1:
        raise ValueError("p must be at least 1")

    if p > len(candidate_df):
        raise ValueError("p cannot exceed the number of candidate rows")

    loaded_graph = load_demo_graph(graph_id)
    snap_index = build_node_snap_index(loaded_graph.nodes_df)

    snapped_demand = snap_points_to_nodes(
        demand_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)

    snapped_candidates = snap_points_to_nodes(
        candidate_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)

    cost_matrix = compute_weighted_cost_matrix(
        graph=loaded_graph.graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_candidates["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )

    baseline_assignments, _, baseline_total_cost = compute_baseline_assignment(cost_matrix)

    payload = build_comparison_payload(
        demand_df=snapped_demand,
        candidate_df=snapped_candidates,
        baseline_assignments=[int(x) for x in baseline_assignments],
        baseline_total_weighted_cost=float(baseline_total_cost),
        cost_matrix=cost_matrix,
        p=p,
    )

    return OptimisationComparisonResponse(**payload)