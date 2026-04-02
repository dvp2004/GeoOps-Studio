import networkx as nx
import pandas as pd

from engine.network.cost_matrix import compute_baseline_assignment, compute_weighted_cost_matrix
from engine.network.snapping import build_node_snap_index, snap_points_to_nodes


def main() -> None:
    nodes_df = pd.DataFrame(
        [
            {"id": "A", "lat": 25.2000, "lng": 55.2700},
            {"id": "B", "lat": 25.2010, "lng": 55.2710},
            {"id": "C", "lat": 25.2020, "lng": 55.2720},
        ]
    )

    demand_df = pd.DataFrame(
        [
            {"id": "D1", "lat": 25.2001, "lng": 55.2701, "weight": 10},
            {"id": "D2", "lat": 25.2019, "lng": 55.2719, "weight": 20},
        ]
    )

    candidate_df = pd.DataFrame(
        [
            {"id": "C1", "lat": 25.2002, "lng": 55.2702},
            {"id": "C2", "lat": 25.2018, "lng": 55.2718},
        ]
    )

    snap_index = build_node_snap_index(nodes_df)

    snapped_demand = snap_points_to_nodes(demand_df, snap_index)
    snapped_candidates = snap_points_to_nodes(candidate_df, snap_index)

    graph = nx.DiGraph()
    graph.add_edge("A", "B", length=200)
    graph.add_edge("B", "A", length=200)
    graph.add_edge("B", "C", length=200)
    graph.add_edge("C", "B", length=200)
    graph.add_edge("A", "C", length=450)
    graph.add_edge("C", "A", length=450)

    cost_matrix = compute_weighted_cost_matrix(
        graph=graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_candidates["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )

    assignment_idx, best_costs, total_cost = compute_baseline_assignment(cost_matrix)

    print("Snapped demand:")
    print(snapped_demand)
    print("\nSnapped candidates:")
    print(snapped_candidates)
    print("\nCost matrix:")
    print(cost_matrix)
    print("\nBest candidate index per demand:")
    print(assignment_idx)
    print("\nBest weighted costs:")
    print(best_costs)
    print("\nTotal weighted cost:")
    print(total_cost)


if __name__ == "__main__":
    main()