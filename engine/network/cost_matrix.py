from collections.abc import Sequence

import networkx as nx
import numpy as np


def compute_weighted_cost_matrix(
    graph: nx.Graph,
    origin_node_ids: Sequence[str],
    candidate_node_ids: Sequence[str],
    origin_weights: Sequence[float],
    weight_attr: str = "length",
    convert_metres_to_km: bool = True,
) -> np.ndarray:
    if len(origin_node_ids) != len(origin_weights):
        raise ValueError("origin_node_ids and origin_weights must have the same length.")

    n_origins = len(origin_node_ids)
    n_candidates = len(candidate_node_ids)

    cost_matrix = np.full((n_origins, n_candidates), np.inf, dtype=float)

    candidate_node_ids = [str(node_id) for node_id in candidate_node_ids]
    origin_node_ids = [str(node_id) for node_id in origin_node_ids]

    for i, (origin_node_id, origin_weight) in enumerate(zip(origin_node_ids, origin_weights, strict=False)):
        distances = nx.single_source_dijkstra_path_length(
            graph,
            source=origin_node_id,
            weight=weight_attr,
        )

        for j, candidate_node_id in enumerate(candidate_node_ids):
            if candidate_node_id not in distances:
                continue

            distance_value = float(distances[candidate_node_id])
            if convert_metres_to_km:
                distance_value /= 1000.0

            cost_matrix[i, j] = distance_value * float(origin_weight)

    return cost_matrix


def compute_baseline_assignment(cost_matrix: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    if cost_matrix.ndim != 2:
        raise ValueError("cost_matrix must be a 2D array.")

    best_candidate_idx = np.argmin(cost_matrix, axis=1)
    best_costs = cost_matrix[np.arange(cost_matrix.shape[0]), best_candidate_idx]

    if np.isinf(best_costs).any():
        raise ValueError("At least one origin has no reachable candidate.")

    total_cost = float(best_costs.sum())
    return best_candidate_idx, best_costs, total_cost