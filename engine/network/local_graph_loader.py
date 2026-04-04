from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import networkx as nx
import pandas as pd


@dataclass
class LoadedLocalGraph:
    graph: nx.Graph
    nodes_df: pd.DataFrame
    edges_df: pd.DataFrame


def _read_csv(path: str | Path) -> pd.DataFrame:
    csv_path = Path(path)

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    if csv_path.suffix.lower() != ".csv":
        raise ValueError(f"Expected a CSV file: {csv_path}")

    return pd.read_csv(csv_path)


def _normalise_nodes_df(nodes_df: pd.DataFrame) -> pd.DataFrame:
    required_columns = {"id", "lat", "lng"}
    missing = required_columns - set(nodes_df.columns)
    if missing:
        raise ValueError(
            f"Graph nodes CSV is missing required columns: {sorted(missing)}"
        )

    df = nodes_df.copy()

    if df[list(required_columns)].isnull().any().any():
        raise ValueError("Graph nodes CSV contains missing values in required columns")

    df["id"] = df["id"].astype(str)

    if df["id"].duplicated().any():
        duplicate_ids = df.loc[df["id"].duplicated(), "id"].tolist()
        raise ValueError(f"Graph nodes CSV contains duplicate node ids: {duplicate_ids[:10]}")

    df["lat"] = pd.to_numeric(df["lat"], errors="raise")
    df["lng"] = pd.to_numeric(df["lng"], errors="raise")

    if ((df["lat"] < -90) | (df["lat"] > 90)).any():
        raise ValueError("Graph nodes CSV contains latitude values outside [-90, 90]")

    if ((df["lng"] < -180) | (df["lng"] > 180)).any():
        raise ValueError("Graph nodes CSV contains longitude values outside [-180, 180]")

    return df[["id", "lat", "lng"]].reset_index(drop=True)


def _normalise_edges_df(edges_df: pd.DataFrame, valid_node_ids: set[str]) -> pd.DataFrame:
    required_base = {"source", "target"}
    missing_base = required_base - set(edges_df.columns)
    if missing_base:
        raise ValueError(
            f"Graph edges CSV is missing required columns: {sorted(missing_base)}"
        )

    length_column = None
    for candidate in ("length_km", "length", "weight"):
        if candidate in edges_df.columns:
            length_column = candidate
            break

    if length_column is None:
        raise ValueError(
            "Graph edges CSV must contain one of these columns: length_km, length, weight"
        )

    df = edges_df.copy()

    if df[["source", "target", length_column]].isnull().any().any():
        raise ValueError("Graph edges CSV contains missing values in required columns")

    df["source"] = df["source"].astype(str)
    df["target"] = df["target"].astype(str)
    df["length_km"] = pd.to_numeric(df[length_column], errors="raise")

    if (df["length_km"] <= 0).any():
        raise ValueError("Graph edges CSV contains non-positive edge lengths")

    unknown_sources = sorted(set(df["source"]) - valid_node_ids)
    unknown_targets = sorted(set(df["target"]) - valid_node_ids)

    if unknown_sources:
        raise ValueError(
            f"Graph edges CSV contains source node ids not present in nodes CSV: {unknown_sources[:10]}"
        )

    if unknown_targets:
        raise ValueError(
            f"Graph edges CSV contains target node ids not present in nodes CSV: {unknown_targets[:10]}"
        )

    return df[["source", "target", "length_km"]].reset_index(drop=True)


def load_local_graph(nodes_csv_path: str | Path, edges_csv_path: str | Path) -> LoadedLocalGraph:
    nodes_df = _normalise_nodes_df(_read_csv(nodes_csv_path))
    edges_df = _normalise_edges_df(_read_csv(edges_csv_path), set(nodes_df["id"].tolist()))

    graph = nx.Graph()

    for row in nodes_df.itertuples(index=False):
        graph.add_node(
            row.id,
            lat=float(row.lat),
            lng=float(row.lng),
        )

    for row in edges_df.itertuples(index=False):
        distance = float(row.length_km)
        graph.add_edge(
            row.source,
            row.target,
            length_km=distance,
            length=distance,
            weight=distance,
        )

    if graph.number_of_nodes() == 0:
        raise ValueError("Loaded graph contains no nodes")

    if graph.number_of_edges() == 0:
        raise ValueError("Loaded graph contains no edges")

    return LoadedLocalGraph(
        graph=graph,
        nodes_df=nodes_df,
        edges_df=edges_df,
    )