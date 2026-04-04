from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from backend.app.services.optimisation_service import build_current_vs_optimised_payload
from engine.network.cost_matrix import (
    compute_baseline_assignment,
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


def run_private_compare(
    demand_csv_path: str | Path,
    current_csv_path: str | Path,
    candidate_csv_path: str | Path,
    graph_nodes_csv_path: str | Path,
    graph_edges_csv_path: str | Path,
    p: int,
) -> dict:
    demand_df = _validate_demand_df(_read_csv(demand_csv_path, "Demand"))
    current_df = _validate_facility_df(_read_csv(current_csv_path, "Current facilities"), "Current facilities")
    candidate_df = _validate_facility_df(_read_csv(candidate_csv_path, "Candidate facilities"), "Candidate facilities")

    if p < 1:
        raise ValueError("p must be at least 1")

    if p != len(current_df):
        raise ValueError(
            "For fair current-vs-optimised comparison, p must equal the number of current facilities"
        )

    if p > len(candidate_df):
        raise ValueError("p cannot exceed the number of candidate facilities")

    loaded_graph = load_local_graph(
        nodes_csv_path=graph_nodes_csv_path,
        edges_csv_path=graph_edges_csv_path,
    )

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