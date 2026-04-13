from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np
from ortools.linear_solver import pywraplp


@dataclass
class PMedianSolution:
    selected_candidate_indices: List[int]
    assignments: List[int]
    total_weighted_cost: float


def solve_p_median(cost_matrix: np.ndarray, p: int) -> PMedianSolution:
    """
    Solve the p-median problem on a weighted cost matrix.

    cost_matrix shape: (n_demand, n_candidates)
    Each entry cost_matrix[i, j] is the weighted assignment cost of assigning
    demand row i to candidate row j.

    Important:
    - Non-finite entries (inf / nan) are treated as unreachable assignment pairs.
    - Candidate columns with no finite assignments are dropped before solving.
    - Assignment variables are created only for finite demand-candidate pairs.
    """
    if not isinstance(cost_matrix, np.ndarray):
        raise ValueError("cost_matrix must be a numpy array")

    if cost_matrix.ndim != 2:
        raise ValueError("cost_matrix must be 2-dimensional")

    n_demand, n_candidates = cost_matrix.shape

    if n_demand == 0:
        raise ValueError("cost_matrix must contain at least one demand row")

    if n_candidates == 0:
        raise ValueError("cost_matrix must contain at least one candidate column")

    if not isinstance(p, int):
        raise ValueError("p must be an integer")

    if p < 1:
        raise ValueError("p must be at least 1")

    if p > n_candidates:
        raise ValueError("p cannot exceed the number of candidates")

    finite_mask = np.isfinite(cost_matrix)

    row_finite_counts = finite_mask.sum(axis=1)
    bad_rows = np.where(row_finite_counts == 0)[0]
    if len(bad_rows) > 0:
        raise ValueError(
            f"{len(bad_rows)} demand row(s) have no reachable candidate in the cost matrix: "
            f"{bad_rows.tolist()}"
        )

    col_finite_counts = finite_mask.sum(axis=0)
    usable_original_candidate_indices = np.where(col_finite_counts > 0)[0]

    if len(usable_original_candidate_indices) == 0:
        raise ValueError("No usable candidate columns remain after removing unreachable candidates.")

    if p > len(usable_original_candidate_indices):
        raise ValueError(
            f"p={p} exceeds the number of usable candidate columns "
            f"({len(usable_original_candidate_indices)})."
        )

    reduced_cost_matrix = cost_matrix[:, usable_original_candidate_indices]
    reduced_finite_mask = np.isfinite(reduced_cost_matrix)

    n_demand_reduced, n_candidates_reduced = reduced_cost_matrix.shape

    solver = pywraplp.Solver.CreateSolver("CBC")
    if solver is None:
        raise RuntimeError("Failed to initialise OR-Tools CBC solver")

    x: dict[tuple[int, int], pywraplp.Variable] = {}
    y: dict[int, pywraplp.Variable] = {}

    for j in range(n_candidates_reduced):
        y[j] = solver.BoolVar(f"y_{j}")

    for i in range(n_demand_reduced):
        feasible_js = np.where(reduced_finite_mask[i])[0].tolist()

        if not feasible_js:
            raise ValueError(f"Demand row {i} has no finite candidate after reduction.")

        for j in feasible_js:
            x[(i, j)] = solver.BoolVar(f"x_{i}_{j}")

        solver.Add(sum(x[(i, j)] for j in feasible_js) == 1)

    for (i, j), x_var in x.items():
        solver.Add(x_var <= y[j])

    solver.Add(sum(y[j] for j in range(n_candidates_reduced)) == p)

    objective = solver.Objective()
    for (i, j), x_var in x.items():
        objective.SetCoefficient(x_var, float(reduced_cost_matrix[i, j]))
    objective.SetMinimization()

    status = solver.Solve()

    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        raise RuntimeError("p-median solver did not return a feasible solution")

    assignments: List[int] = []
    for i in range(n_demand_reduced):
        feasible_js = np.where(reduced_finite_mask[i])[0].tolist()

        assigned_reduced_j = None
        for j in feasible_js:
            if x[(i, j)].solution_value() > 0.5:
                assigned_reduced_j = j
                break

        if assigned_reduced_j is None:
            raise RuntimeError(f"No assignment chosen for demand row {i}")

        assigned_original_j = int(usable_original_candidate_indices[assigned_reduced_j])
        assignments.append(assigned_original_j)

    selected_candidate_indices = [
        int(usable_original_candidate_indices[j])
        for j in range(n_candidates_reduced)
        if y[j].solution_value() > 0.5
    ]

    total_weighted_cost = float(
        sum(cost_matrix[i, assignments[i]] for i in range(n_demand_reduced))
    )

    return PMedianSolution(
        selected_candidate_indices=selected_candidate_indices,
        assignments=assignments,
        total_weighted_cost=total_weighted_cost,
    )