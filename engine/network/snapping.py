from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree


@dataclass
class NodeSnapIndex:
    node_ids: np.ndarray
    node_coords_deg: np.ndarray
    tree: BallTree


def build_node_snap_index(
    nodes_df: pd.DataFrame,
    id_col: str = "id",
    lat_col: str = "lat",
    lng_col: str = "lng",
) -> NodeSnapIndex:
    required = {id_col, lat_col, lng_col}
    missing = required - set(nodes_df.columns)
    if missing:
        raise ValueError(f"Missing required node columns: {sorted(missing)}")

    clean = nodes_df[[id_col, lat_col, lng_col]].copy()
    clean[id_col] = clean[id_col].astype(str)
    clean[lat_col] = pd.to_numeric(clean[lat_col], errors="raise")
    clean[lng_col] = pd.to_numeric(clean[lng_col], errors="raise")

    coords_deg = clean[[lat_col, lng_col]].to_numpy(dtype=float)
    coords_rad = np.deg2rad(coords_deg)

    tree = BallTree(coords_rad, metric="haversine")

    return NodeSnapIndex(
        node_ids=clean[id_col].to_numpy(),
        node_coords_deg=coords_deg,
        tree=tree,
    )


def snap_points_to_nodes(
    points_df: pd.DataFrame,
    snap_index: NodeSnapIndex,
    lat_col: str = "lat",
    lng_col: str = "lng",
    k: int = 1,
) -> pd.DataFrame:
    required = {lat_col, lng_col}
    missing = required - set(points_df.columns)
    if missing:
        raise ValueError(f"Missing required point columns: {sorted(missing)}")

    if k < 1:
        raise ValueError("k must be at least 1.")

    points = points_df.copy()
    coords_deg = points[[lat_col, lng_col]].apply(pd.to_numeric, errors="raise").to_numpy(dtype=float)
    coords_rad = np.deg2rad(coords_deg)

    distances_rad, indices = snap_index.tree.query(coords_rad, k=k)

    snapped_node_ids = snap_index.node_ids[indices[:, 0]]
    great_circle_km = distances_rad[:, 0] * 6371.0088

    result = points.copy()
    result["snapped_node_id"] = snapped_node_ids.astype(str)
    result["snap_distance_km"] = great_circle_km

    return result