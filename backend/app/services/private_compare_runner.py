from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path

import pandas as pd

from backend.app.services.optimisation_service import build_current_vs_optimised_payload
from engine.network.cost_matrix import (
    compute_baseline_assignment,
    compute_nearest_candidate_assignment,
    compute_weighted_cost_matrix,
)
from engine.network.local_graph_loader import load_local_graph
from engine.network.snapping import build_node_snap_index, snap_points_to_nodes


def _read_csv(csv_path: str | Path, label: str) -> pd.DataFrame:
    path = Path(csv_path)

    if not path.exists():
        raise FileNotFoundError(f"{label} CSV not found: {path}")

    if path.suffix.lower() != ".csv":
        raise ValueError(f"{label} file must be a CSV: {path}")

    return pd.read_csv(path)


def _validate_demand_df(demand_df: pd.DataFrame) -> pd.DataFrame:
    required_columns = {"id", "lat", "lng", "weight"}
    missing = required_columns - set(demand_df.columns)
    if missing:
        raise ValueError(f"Demand CSV is missing required columns: {sorted(missing)}")

    df = demand_df.copy()

    if df[list(required_columns)].isnull().any().any():
        raise ValueError("Demand CSV contains missing values in required columns")

    df["id"] = df["id"].astype(str)

    if df["id"].duplicated().any():
        duplicate_ids = df.loc[df["id"].duplicated(), "id"].tolist()
        raise ValueError(f"Demand CSV contains duplicate ids: {duplicate_ids[:10]}")

    df["lat"] = pd.to_numeric(df["lat"], errors="raise")
    df["lng"] = pd.to_numeric(df["lng"], errors="raise")
    df["weight"] = pd.to_numeric(df["weight"], errors="raise")

    if ((df["lat"] < -90) | (df["lat"] > 90)).any():
        raise ValueError("Demand CSV contains latitude values outside [-90, 90]")

    if ((df["lng"] < -180) | (df["lng"] > 180)).any():
        raise ValueError("Demand CSV contains longitude values outside [-180, 180]")

    if (df["weight"] <= 0).any():
        raise ValueError("Demand CSV contains non-positive weights")

    return df[["id", "lat", "lng", "weight"]].reset_index(drop=True)


def _validate_facility_df(facility_df: pd.DataFrame, label: str) -> pd.DataFrame:
    required_columns = {"id", "lat", "lng"}
    missing = required_columns - set(facility_df.columns)
    if missing:
        raise ValueError(f"{label} CSV is missing required columns: {sorted(missing)}")

    df = facility_df.copy()

    if df[list(required_columns)].isnull().any().any():
        raise ValueError(f"{label} CSV contains missing values in required columns")

    df["id"] = df["id"].astype(str)

    if df["id"].duplicated().any():
        duplicate_ids = df.loc[df["id"].duplicated(), "id"].tolist()
        raise ValueError(f"{label} CSV contains duplicate ids: {duplicate_ids[:10]}")

    df["lat"] = pd.to_numeric(df["lat"], errors="raise")
    df["lng"] = pd.to_numeric(df["lng"], errors="raise")

    if ((df["lat"] < -90) | (df["lat"] > 90)).any():
        raise ValueError(f"{label} CSV contains latitude values outside [-90, 90]")

    if ((df["lng"] < -180) | (df["lng"] > 180)).any():
        raise ValueError(f"{label} CSV contains longitude values outside [-180, 180]")

    return df[["id", "lat", "lng"]].reset_index(drop=True)


def _same_facility_sites(current_df: pd.DataFrame, candidate_df: pd.DataFrame) -> bool:
    cols = ["id", "lat", "lng"]
    a = current_df[cols].copy().sort_values("id").reset_index(drop=True)
    b = candidate_df[cols].copy().sort_values("id").reset_index(drop=True)
    return a.equals(b)


def _normalise_cache_key(path: str | Path) -> str:
    return str(Path(path).resolve())


@lru_cache(maxsize=4)
def _load_local_graph_cached(nodes_csv_path: str, edges_csv_path: str):
    return load_local_graph(
        nodes_csv_path=nodes_csv_path,
        edges_csv_path=edges_csv_path,
    )


@lru_cache(maxsize=4)
def _build_snap_index_cached(nodes_csv_path: str, edges_csv_path: str):
    loaded_graph = _load_local_graph_cached(nodes_csv_path, edges_csv_path)
    return build_node_snap_index(loaded_graph.nodes_df)


def _build_assignment_rows_and_lines_from_costs(
    snapped_demand: pd.DataFrame,
    snapped_facilities: pd.DataFrame,
    assignment_indices: list[int],
    weighted_costs,
) -> tuple[list[dict], list[dict]]:
    assignment_rows: list[dict] = []
    assignment_lines: list[dict] = []

    for demand_idx, facility_idx in enumerate(assignment_indices):
        demand_row = snapped_demand.iloc[demand_idx]
        facility_row = snapped_facilities.iloc[facility_idx]
        weighted_cost = float(weighted_costs[demand_idx])

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


def _build_sanity_short_circuit_payload(
    snapped_demand: pd.DataFrame,
    snapped_current: pd.DataFrame,
    baseline_assignment_indices: list[int],
    baseline_best_costs,
    baseline_total_cost: float,
    p: int,
) -> dict:
    baseline_rows, baseline_lines = _build_assignment_rows_and_lines_from_costs(
        snapped_demand=snapped_demand,
        snapped_facilities=snapped_current,
        assignment_indices=baseline_assignment_indices,
        weighted_costs=baseline_best_costs,
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

    return payload


def run_private_compare(
    demand_csv_path: str | Path,
    current_csv_path: str | Path,
    candidate_csv_path: str | Path,
    graph_nodes_csv_path: str | Path,
    graph_edges_csv_path: str | Path,
    p: int,
) -> dict:
    demand_df = _validate_demand_df(_read_csv(demand_csv_path, "Demand"))
    current_df = _validate_facility_df(
        _read_csv(current_csv_path, "Current facilities"),
        "Current facilities",
    )
    candidate_df = _validate_facility_df(
        _read_csv(candidate_csv_path, "Candidate facilities"),
        "Candidate facilities",
    )

    t0 = time.time()
    print(
        f"[private-run] start | demand={len(demand_df)} current={len(current_df)} candidate={len(candidate_df)} p={p}",
        flush=True,
    )

    if p < 1:
        raise ValueError("p must be at least 1")

    if p != len(current_df):
        raise ValueError(
            "For fair current-vs-optimised comparison, p must equal the number of current facilities"
        )

    if p > len(candidate_df):
        raise ValueError("p cannot exceed the number of candidate facilities")

    same_site_sets = _same_facility_sites(current_df, candidate_df)

    nodes_key = _normalise_cache_key(graph_nodes_csv_path)
    edges_key = _normalise_cache_key(graph_edges_csv_path)

    print("[private-run] loading local graph", flush=True)
    loaded_graph = _load_local_graph_cached(nodes_key, edges_key)
    print(f"[private-run] local graph loaded in {time.time() - t0:.2f}s", flush=True)

    print("[private-run] building snap index", flush=True)
    snap_index = _build_snap_index_cached(nodes_key, edges_key)
    print(f"[private-run] snap index ready in {time.time() - t0:.2f}s", flush=True)

    print("[private-run] snapping demand", flush=True)
    snapped_demand = snap_points_to_nodes(
        demand_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)
    print(f"[private-run] snapped demand in {time.time() - t0:.2f}s", flush=True)

    print("[private-run] snapping current facilities", flush=True)
    snapped_current = snap_points_to_nodes(
        current_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)
    print(f"[private-run] snapped current in {time.time() - t0:.2f}s", flush=True)

    if same_site_sets:
        print("[private-run] candidate snapping skipped (same site set as current)", flush=True)

        print("[private-run] computing direct baseline nearest-facility assignment", flush=True)
        baseline_assignments, baseline_best_costs, baseline_total_cost = compute_nearest_candidate_assignment(
            graph=loaded_graph.graph,
            origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
            candidate_node_ids=snapped_current["snapped_node_id"].tolist(),
            origin_weights=snapped_demand["weight"].tolist(),
        )
        baseline_assignment_indices = [int(x) for x in baseline_assignments]
        print(f"[private-run] direct baseline ready in {time.time() - t0:.2f}s", flush=True)

        print("[private-run] sanity short-circuit triggered", flush=True)
        payload = _build_sanity_short_circuit_payload(
            snapped_demand=snapped_demand,
            snapped_current=snapped_current,
            baseline_assignment_indices=baseline_assignment_indices,
            baseline_best_costs=baseline_best_costs,
            baseline_total_cost=float(baseline_total_cost),
            p=p,
        )
        print(f"[private-run] completed in {time.time() - t0:.2f}s", flush=True)
        return payload

    print("[private-run] snapping candidate facilities", flush=True)
    snapped_candidates = snap_points_to_nodes(
        candidate_df.reset_index(drop=True),
        snap_index,
    ).reset_index(drop=True)
    print(f"[private-run] snapped candidates in {time.time() - t0:.2f}s", flush=True)

    print("[private-run] building baseline cost matrix", flush=True)
    baseline_cost_matrix = compute_weighted_cost_matrix(
        graph=loaded_graph.graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_current["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )
    print(f"[private-run] baseline cost matrix ready in {time.time() - t0:.2f}s", flush=True)

    print("[private-run] computing baseline assignment", flush=True)
    baseline_assignments, _, baseline_total_cost = compute_baseline_assignment(
        baseline_cost_matrix
    )
    baseline_assignment_indices = [int(x) for x in baseline_assignments]
    print(f"[private-run] baseline assignment ready in {time.time() - t0:.2f}s", flush=True)

    print("[private-run] building candidate cost matrix", flush=True)
    candidate_cost_matrix = compute_weighted_cost_matrix(
        graph=loaded_graph.graph,
        origin_node_ids=snapped_demand["snapped_node_id"].tolist(),
        candidate_node_ids=snapped_candidates["snapped_node_id"].tolist(),
        origin_weights=snapped_demand["weight"].tolist(),
    )
    print(f"[private-run] candidate cost matrix ready in {time.time() - t0:.2f}s", flush=True)

    print("[private-run] building final payload", flush=True)
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

    print(f"[private-run] completed in {time.time() - t0:.2f}s", flush=True)
    return payload


def write_private_compare_outputs(result: dict, output_dir: str | Path) -> Path:
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    comparison_json_path = out_dir / "comparison.json"
    baseline_csv_path = out_dir / "baseline_assignments.csv"
    optimised_csv_path = out_dir / "optimised_assignments.csv"
    summary_csv_path = out_dir / "summary.csv"

    comparison_json_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    pd.DataFrame(result["baseline_assignments"]).to_csv(baseline_csv_path, index=False)
    pd.DataFrame(result["optimised_assignments"]).to_csv(optimised_csv_path, index=False)

    summary_row = {
        "p": result["p"],
        "current_facility_count": result["current_facility_count"],
        "candidate_pool_count": result["candidate_pool_count"],
        "baseline_total_weighted_cost": result["baseline_total_weighted_cost"],
        "optimised_total_weighted_cost": result["optimised_total_weighted_cost"],
        "improvement_pct": result["improvement_pct"],
        "current_facility_ids": ",".join(result["current_facility_ids"]),
        "selected_candidate_ids": ",".join(result["selected_candidate_ids"]),
    }
    pd.DataFrame([summary_row]).to_csv(summary_csv_path, index=False)

    return out_dir