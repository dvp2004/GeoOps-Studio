from collections.abc import Sequence
import heapq

import networkx as nx
import numpy as np


def _normalise_node_ids(node_ids: Sequence[str]) -> list[str]:
    return [str(node_id) for node_id in node_ids]


def _edge_weight_from_data(edge_data, weight_attr: str, is_multigraph: bool) -> float:
    if is_multigraph:
        values = []
        for attrs in edge_data.values():
            if weight_attr not in attrs:
                raise ValueError(f"Edge is missing weight attribute '{weight_attr}'")
            values.append(float(attrs[weight_attr]))
        if not values:
            raise ValueError("Encountered multigraph edge with no parallel edge attributes")
        return min(values)

    if weight_attr not in edge_data:
        raise ValueError(f"Edge is missing weight attribute '{weight_attr}'")

    return float(edge_data[weight_attr])


def compute_weighted_cost_matrix(
    graph: nx.Graph,
    origin_node_ids: Sequence[str],
    candidate_node_ids: Sequence[str],
    origin_weights: Sequence[float],
    weight_attr: str = "length",
    convert_metres_to_km: bool = True,
    dtype=np.float32,
) -> np.ndarray:
    """
    Dense weighted cost matrix.

    Still expensive for large runs, but improved versus the old version:
    - float32 by default
    - candidate-id -> column lookup map
    """
    if len(origin_node_ids) != len(origin_weights):
        raise ValueError("origin_node_ids and origin_weights must have the same length.")

    origin_node_ids = _normalise_node_ids(origin_node_ids)
    candidate_node_ids = _normalise_node_ids(candidate_node_ids)

    n_origins = len(origin_node_ids)
    n_candidates = len(candidate_node_ids)

    cost_matrix = np.full((n_origins, n_candidates), np.inf, dtype=dtype)
    candidate_index = {candidate_node_id: j for j, candidate_node_id in enumerate(candidate_node_ids)}

    distance_scale = 1.0 / 1000.0 if convert_metres_to_km else 1.0

    for i, (origin_node_id, origin_weight) in enumerate(
        zip(origin_node_ids, origin_weights, strict=False)
    ):
        distances = nx.single_source_dijkstra_path_length(
            graph,
            source=origin_node_id,
            weight=weight_attr,
        )

        weight_value = float(origin_weight)

        for reached_node_id, distance_value in distances.items():
            j = candidate_index.get(str(reached_node_id))
            if j is None:
                continue

            scaled_distance = float(distance_value) * distance_scale
            cost_matrix[i, j] = scaled_distance * weight_value

    return cost_matrix


def compute_baseline_assignment(cost_matrix: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    if cost_matrix.ndim != 2:
        raise ValueError("cost_matrix must be a 2D array.")

    best_candidate_idx = np.argmin(cost_matrix, axis=1)
    best_costs = cost_matrix[np.arange(cost_matrix.shape[0]), best_candidate_idx]

    if np.isinf(best_costs).any():
        raise ValueError("At least one origin has no reachable candidate.")

    total_cost = float(best_costs.sum(dtype=np.float64))
    return best_candidate_idx, best_costs, total_cost


def compute_nearest_candidate_assignment(
    graph: nx.Graph,
    origin_node_ids: Sequence[str],
    candidate_node_ids: Sequence[str],
    origin_weights: Sequence[float],
    weight_attr: str = "length",
    convert_metres_to_km: bool = True,
    dtype=np.float32,
) -> tuple[np.ndarray, np.ndarray, float]:
    """
    Compute nearest-candidate assignment WITHOUT building a dense cost matrix.

    Uses one multi-source Dijkstra-style traversal over the reversed graph
    (for directed graphs) so that each origin gets:
    - nearest candidate index
    - weighted cost
    - total weighted cost

    This is the right path for the sanity case where current == candidate
    and p == number of current facilities.
    """
    if len(origin_node_ids) != len(origin_weights):
        raise ValueError("origin_node_ids and origin_weights must have the same length.")

    origin_node_ids = _normalise_node_ids(origin_node_ids)
    candidate_node_ids = _normalise_node_ids(candidate_node_ids)

    candidate_index = {candidate_node_id: j for j, candidate_node_id in enumerate(candidate_node_ids)}

    search_graph = graph.reverse(copy=False) if graph.is_directed() else graph
    is_multigraph = search_graph.is_multigraph()

    heap: list[tuple[float, str, str]] = []
    final_dist: dict[str, float] = {}
    final_source: dict[str, str] = {}

    for candidate_node_id in candidate_node_ids:
        if candidate_node_id not in search_graph:
            continue
        heapq.heappush(heap, (0.0, candidate_node_id, candidate_node_id))

    if not heap:
        raise ValueError("None of the candidate nodes exist in the graph.")

    while heap:
        dist_u, node_u, source_candidate = heapq.heappop(heap)

        if node_u in final_dist:
            continue

        final_dist[node_u] = dist_u
        final_source[node_u] = source_candidate

        for neighbour, edge_data in search_graph[node_u].items():
            if neighbour in final_dist:
                continue

            edge_weight = _edge_weight_from_data(
                edge_data=edge_data,
                weight_attr=weight_attr,
                is_multigraph=is_multigraph,
            )

            heapq.heappush(heap, (dist_u + edge_weight, str(neighbour), source_candidate))

    n_origins = len(origin_node_ids)
    best_candidate_idx = np.full(n_origins, -1, dtype=np.int32)
    best_costs = np.full(n_origins, np.inf, dtype=dtype)

    distance_scale = 1.0 / 1000.0 if convert_metres_to_km else 1.0

    for i, (origin_node_id, origin_weight) in enumerate(
        zip(origin_node_ids, origin_weights, strict=False)
    ):
        if origin_node_id not in final_dist:
            raise ValueError("At least one origin has no reachable candidate.")

        nearest_candidate_id = final_source[origin_node_id]
        if nearest_candidate_id not in candidate_index:
            raise ValueError("Nearest candidate id not found in candidate index.")

        weighted_cost = final_dist[origin_node_id] * distance_scale * float(origin_weight)

        best_candidate_idx[i] = candidate_index[nearest_candidate_id]
        best_costs[i] = weighted_cost

    total_cost = float(best_costs.sum(dtype=np.float64))
    return best_candidate_idx, best_costs, total_cost