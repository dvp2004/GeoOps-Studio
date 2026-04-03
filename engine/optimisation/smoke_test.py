import numpy as np

from engine.optimisation.p_median import solve_p_median


def main() -> None:
    cost_matrix = np.array(
        [
            [2.0, 8.0, 5.0],
            [3.0, 7.0, 6.0],
            [9.0, 1.0, 4.0],
            [8.0, 2.0, 3.0],
        ]
    )

    solution = solve_p_median(cost_matrix=cost_matrix, p=2)

    print("Selected candidate indices:", solution.selected_candidate_indices)
    print("Assignments:", solution.assignments)
    print("Total weighted cost:", solution.total_weighted_cost)


if __name__ == "__main__":
    main()