import pandas as pd

from backend.app.models.solve_models import BaselineAssignmentRow, BaselineSolveResponse
from engine.network.cost_matrix import compute_baseline_assignment, compute_weighted_cost_matrix
from engine.network.graph_loader import load_demo_graph
from engine.network.snapping import build_node_snap_index, snap_points_to_nodes


def solve_baseline(
    demand_df: pd.DataFrame,
    candidate_df: pd.DataFrame,
    graph_id: str = "dubai_micro",
) -> BaselineSolveResponse:
    loaded_graph = load_demo_graph(graph_id)
    snap_index = build_node_snap_index(loaded_graph.nodes_df)

    snapped_demand = snap_points_to_nodes(demand_df, snap_index)
    snapped_candidates = snap_points_to_nodes(candidate_df, snap_index)

    cost_matrix = compute_weighted_cost_matrix(
        graph=loaded_graph.graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_candidates["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )

    assignment_idx, best_costs, total_cost = compute_baseline_assignment(cost_matrix)

    rows: list[BaselineAssignmentRow] = []
    for i, demand_row in snapped_demand.reset_index(drop=True).iterrows():
        candidate_row = snapped_candidates.iloc[int(assignment_idx[i])]

        rows.append(
            BaselineAssignmentRow(
                demand_id=str(demand_row["id"]),
                demand_weight=float(demand_row["weight"]),
                snapped_demand_node_id=str(demand_row["snapped_node_id"]),
                assigned_candidate_id=str(candidate_row["id"]),
                assigned_candidate_node_id=str(candidate_row["snapped_node_id"]),
                weighted_cost_km=float(best_costs[i]),
            )
        )

    return BaselineSolveResponse(
        graph_id=graph_id,
        demand_count=len(snapped_demand),
        candidate_count=len(snapped_candidates),
        total_weighted_cost_km=float(total_cost),
        assignment_rows=rows,
    )