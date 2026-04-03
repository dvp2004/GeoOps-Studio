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

    solver = pywraplp.Solver.CreateSolver("CBC")
    if solver is None:
        raise RuntimeError("Failed to initialise OR-Tools CBC solver")

    x = {}
    y = {}

    for i in range(n_demand):
        for j in range(n_candidates):
            x[(i, j)] = solver.BoolVar(f"x_{i}_{j}")

    for j in range(n_candidates):
        y[j] = solver.BoolVar(f"y_{j}")

    for i in range(n_demand):
        solver.Add(sum(x[(i, j)] for j in range(n_candidates)) == 1)

    for i in range(n_demand):
        for j in range(n_candidates):
            solver.Add(x[(i, j)] <= y[j])

    solver.Add(sum(y[j] for j in range(n_candidates)) == p)

    objective = solver.Objective()
    for i in range(n_demand):
        for j in range(n_candidates):
            objective.SetCoefficient(x[(i, j)], float(cost_matrix[i, j]))
    objective.SetMinimization()

    status = solver.Solve()

    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        raise RuntimeError("p-median solver did not return a feasible solution")

    assignments: List[int] = []
    for i in range(n_demand):
        assigned_j = None
        for j in range(n_candidates):
            if x[(i, j)].solution_value() > 0.5:
                assigned_j = j
                break
        if assigned_j is None:
            raise RuntimeError(f"No assignment chosen for demand row {i}")
        assignments.append(assigned_j)

    selected_candidate_indices = [
        j for j in range(n_candidates) if y[j].solution_value() > 0.5
    ]

    total_weighted_cost = float(
        sum(cost_matrix[i, assignments[i]] for i in range(n_demand))
    )

    return PMedianSolution(
        selected_candidate_indices=selected_candidate_indices,
        assignments=assignments,
        total_weighted_cost=total_weighted_cost,
    )