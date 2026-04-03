from dataclasses import dataclass
from pathlib import Path

import networkx as nx
import pandas as pd


@dataclass
class LoadedGraph:
    graph_id: str
    graph: nx.DiGraph
    nodes_df: pd.DataFrame
    edges_df: pd.DataFrame


def load_demo_graph(graph_id: str = "dubai_micro") -> LoadedGraph:
    base_dir = Path(__file__).resolve().parents[2] / "data_demo" / "graphs"
    nodes_path = base_dir / f"{graph_id}_nodes.csv"
    edges_path = base_dir / f"{graph_id}_edges.csv"

    if not nodes_path.exists():
        raise FileNotFoundError(f"Missing graph nodes file: {nodes_path}")
    if not edges_path.exists():
        raise FileNotFoundError(f"Missing graph edges file: {edges_path}")

    nodes_df = pd.read_csv(nodes_path)
    edges_df = pd.read_csv(edges_path)

    required_node_cols = {"id", "lat", "lng"}
    required_edge_cols = {"source", "target", "length"}

    if not required_node_cols.issubset(nodes_df.columns):
        raise ValueError(f"Nodes file must contain columns: {sorted(required_node_cols)}")
    if not required_edge_cols.issubset(edges_df.columns):
        raise ValueError(f"Edges file must contain columns: {sorted(required_edge_cols)}")

    graph = nx.DiGraph()

    for row in nodes_df.itertuples(index=False):
        graph.add_node(
            str(row.id),
            lat=float(row.lat),
            lng=float(row.lng),
            pos=(float(row.lng), float(row.lat)),
        )

    for row in edges_df.itertuples(index=False):
        source = str(row.source)
        target = str(row.target)
        length = float(row.length)

        graph.add_edge(source, target, length=length)
        graph.add_edge(target, source, length=length)

    return LoadedGraph(
        graph_id=graph_id,
        graph=graph,
        nodes_df=nodes_df,
        edges_df=edges_df,
    )