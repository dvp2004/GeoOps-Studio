from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
import re
import shutil

import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile

REPO_ROOT = Path(__file__).resolve().parents[3]
PRIVATE_BUNDLES_ROOT = REPO_ROOT / "private_bundles"
UPLOAD_BUNDLES_ROOT = PRIVATE_BUNDLES_ROOT / "_uploads"

# Required to render the private reshuffling benchmark UI.
REQUIRED_SUMMARY_FILES: dict[str, str] = {
    "assignment_access_topk80_analysis.parquet": "model/assignment_access_topk80_analysis.parquet",
    "final_headline_table_k80.csv": "final_tables_reshuffling/final_headline_table_k80.csv",
    "final_k_sensitivity_table.csv": "final_tables_reshuffling/final_k_sensitivity_table.csv",
    "final_fairness_table_k80.csv": "final_tables_reshuffling/final_fairness_table_k80.csv",
    "final_top_cuisines_k80.csv": "final_tables_reshuffling/final_top_cuisines_k80.csv",
    "final_top_winners_k80.csv": "final_tables_reshuffling/final_top_winners_k80.csv",
    "final_top_losers_k80.csv": "final_tables_reshuffling/final_top_losers_k80.csv",
    "final_section_conclusion_k80.txt": "final_tables_reshuffling/final_section_conclusion_k80.txt",
}

# Nice to have locally, not required for the first UI.
OPTIONAL_MODEL_FILES: dict[str, str] = {
    "vendor_main_model.parquet": "model/vendor_main_model.parquet",
    "site_master_exact_main.parquet": "model/site_master_exact_main.parquet",
    "vendor_to_site_exact_main.parquet": "model/vendor_to_site_exact_main.parquet",
    "vendor_current_site_main.parquet": "model/vendor_current_site_main.parquet",
    "access_node_capacity_main.parquet": "model/access_node_capacity_main.parquet",
    "vendor_access_cost_matrix_main_sym.npy": "model/vendor_access_cost_matrix_main_sym.npy",
    "vendor_access_cost_vendor_ids.parquet": "model/vendor_access_cost_vendor_ids.parquet",
    "vendor_access_cost_access_ids.parquet": "model/vendor_access_cost_access_ids.parquet",
    "baseline_current_vendor_costs_main_sym.parquet": "model/baseline_current_vendor_costs_main_sym.parquet",
}

OPTIONAL_FIGURE_FILES: list[str] = [
    "fig_k_sensitivity_improvement_pct.png",
    "fig_k_sensitivity_fairness_tail.png",
    "fig_k80_vendor_improvement_pct_distribution.png",
    "fig_k80_vendor_improvement_km_distribution.png",
    "fig_k80_top_cuisines_total_improvement_pct.png",
    "fig_k80_moved_vs_stayed_median_pct.png",
]


def _to_native(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _to_native(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_native(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if pd.isna(value):
        return None
    return value


def _safe_bundle_name(raw: str | None) -> str:
    if not raw:
        raw = f"upload_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", raw).strip("_")
    return cleaned or f"upload_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"


def _ensure_roots() -> None:
    PRIVATE_BUNDLES_ROOT.mkdir(parents=True, exist_ok=True)
    UPLOAD_BUNDLES_ROOT.mkdir(parents=True, exist_ok=True)


def local_bundle_dir(bundle_name: str) -> Path:
    return PRIVATE_BUNDLES_ROOT / bundle_name


def uploaded_bundle_dir(bundle_name: str) -> Path:
    return UPLOAD_BUNDLES_ROOT / bundle_name


def list_local_bundles() -> list[str]:
    _ensure_roots()
    bundles: list[str] = []
    for path in PRIVATE_BUNDLES_ROOT.iterdir():
        if not path.is_dir():
            continue
        if path.name.startswith("_"):
            continue
        bundles.append(path.name)
    return sorted(bundles)


def expected_upload_filenames() -> list[str]:
    # Only the summary package is required for the first private mode UI.
    return sorted(REQUIRED_SUMMARY_FILES.keys())


def optional_model_filenames() -> list[str]:
    return sorted(OPTIONAL_MODEL_FILES.keys())


def optional_figure_filenames() -> list[str]:
    return sorted(OPTIONAL_FIGURE_FILES)


def _missing_required(bundle_dir: Path) -> list[str]:
    missing: list[str] = []
    for _, rel in REQUIRED_SUMMARY_FILES.items():
        if not (bundle_dir / rel).exists():
            missing.append(rel)
    return missing


def validate_bundle_dir(bundle_dir: Path) -> None:
    if not bundle_dir.exists():
        raise HTTPException(status_code=404, detail=f"Bundle folder not found: {bundle_dir.name}")

    missing = _missing_required(bundle_dir)
    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Bundle is missing required reshuffling summary files.",
                "missing_files": missing,
            },
        )


def _read_csv_one_row(path: Path) -> dict[str, Any]:
    df = pd.read_csv(path)
    if df.empty:
        raise HTTPException(status_code=400, detail=f"CSV is empty: {path.name}")
    return _to_native(df.iloc[0].to_dict())


def _read_csv_many(path: Path, limit: int | None = None) -> list[dict[str, Any]]:
    df = pd.read_csv(path)
    if limit is not None:
        df = df.head(limit)
    return _to_native(df.to_dict(orient="records"))


def _read_analysis_rows(path: Path, ascending: bool, limit: int = 20) -> list[dict[str, Any]]:
    df = pd.read_parquet(path)
    df = df.sort_values("improvement_km", ascending=ascending).head(limit)
    return _to_native(df.to_dict(orient="records"))


def _figure_entries(bundle_name: str, source: str, bundle_dir: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    fig_dir = bundle_dir / "final_figures_reshuffling"

    for figure_name in OPTIONAL_FIGURE_FILES:
        figure_path = fig_dir / figure_name
        if not figure_path.exists():
            continue

        if source == "local":
            url = f"/api/private/reshuffling/bundles/{bundle_name}/figures/{figure_name}"
        else:
            url = f"/api/private/reshuffling/uploads/{bundle_name}/figures/{figure_name}"

        entries.append({"name": figure_name, "url": url})

    return entries


def build_bundle_summary(bundle_name: str, bundle_dir: Path, source: str) -> dict[str, Any]:
    validate_bundle_dir(bundle_dir)

    headline = _read_csv_one_row(bundle_dir / "final_tables_reshuffling" / "final_headline_table_k80.csv")
    sensitivity = _read_csv_many(bundle_dir / "final_tables_reshuffling" / "final_k_sensitivity_table.csv")
    fairness = _read_csv_one_row(bundle_dir / "final_tables_reshuffling" / "final_fairness_table_k80.csv")
    top_cuisines = _read_csv_many(bundle_dir / "final_tables_reshuffling" / "final_top_cuisines_k80.csv", limit=20)

    winners_csv = bundle_dir / "final_tables_reshuffling" / "final_top_winners_k80.csv"
    losers_csv = bundle_dir / "final_tables_reshuffling" / "final_top_losers_k80.csv"
    analysis_parquet = bundle_dir / "model" / "assignment_access_topk80_analysis.parquet"

    if winners_csv.exists():
        top_winners = _read_csv_many(winners_csv, limit=20)
    else:
        top_winners = _read_analysis_rows(analysis_parquet, ascending=False, limit=20)

    if losers_csv.exists():
        top_losers = _read_csv_many(losers_csv, limit=20)
    else:
        top_losers = _read_analysis_rows(analysis_parquet, ascending=True, limit=20)

    conclusion_text = (bundle_dir / "final_tables_reshuffling" / "final_section_conclusion_k80.txt").read_text(
        encoding="utf-8"
    )

    available_model_files = [
        rel for rel in OPTIONAL_MODEL_FILES.values() if (bundle_dir / rel).exists()
    ]

    return {
        "bundle_name": bundle_name,
        "source": source,
        "required_upload_files": expected_upload_filenames(),
        "available_model_files": available_model_files,
        "headline": headline,
        "fairness": fairness,
        "sensitivity": sensitivity,
        "top_cuisines": top_cuisines,
        "top_winners": top_winners,
        "top_losers": top_losers,
        "conclusion_text": conclusion_text,
        "figures": _figure_entries(bundle_name=bundle_name, source=source, bundle_dir=bundle_dir),
    }


MAP_REQUIRED_MODEL_FILES: tuple[str, ...] = (
    "model/assignment_access_topk80_analysis.parquet",
    "model/vendor_main_model.parquet",
    "model/access_node_capacity_main.parquet",
)

def _first_existing(bundle_dir: Path, candidates: tuple[str, ...]) -> Path | None:
    for rel in candidates:
        path = bundle_dir / rel
        if path.exists():
            return path
    return None


def _normalise_id_series(series: pd.Series) -> pd.Series:
    def _fmt(value: object) -> object:
        if pd.isna(value):
            return None
        if isinstance(value, (int, np.integer)):
            return str(int(value))
        if isinstance(value, (float, np.floating)):
            if np.isfinite(value) and float(value).is_integer():
                return str(int(value))
            if np.isfinite(value):
                return str(value)
            return None
        return str(value)

    return series.map(_fmt)


def _json_safe_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    cleaned = df.copy()
    cleaned = cleaned.replace([np.inf, -np.inf], np.nan)
    cleaned = cleaned.where(pd.notnull(cleaned), None)
    return _to_native(cleaned.to_dict(orient="records"))


def load_vendor_explorer_rows(bundle_dir: Path) -> list[dict[str, Any]]:
    analysis_path = _first_existing(
        bundle_dir,
        (
            "model/assignment_access_topk80_analysis.parquet",
            "assignment_access_topk80_analysis.parquet",
        ),
    )
    vendor_model_path = _first_existing(
        bundle_dir,
        (
            "model/vendor_main_model.parquet",
            "vendor_main_model.parquet",
        ),
    )
    access_capacity_path = _first_existing(
        bundle_dir,
        (
            "model/access_node_capacity_main.parquet",
            "access_node_capacity_main.parquet",
        ),
    )

    missing: list[str] = []
    if analysis_path is None:
        missing.append("model/assignment_access_topk80_analysis.parquet")
    if vendor_model_path is None:
        missing.append("model/vendor_main_model.parquet")
    if access_capacity_path is None:
        missing.append("model/access_node_capacity_main.parquet")

    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Bundle is missing files required for vendor explorer / map view.",
                "missing_files": missing,
            },
        )

    analysis = pd.read_parquet(analysis_path).copy()
    vendor_model = pd.read_parquet(vendor_model_path).copy()
    access_capacity = pd.read_parquet(access_capacity_path).copy()

    analysis["vendor_id"] = _normalise_id_series(analysis["vendor_id"])
    vendor_model["vendor_id"] = _normalise_id_series(vendor_model["vendor_id"])

    if "current_access_node_id" in analysis.columns:
        analysis["current_access_node_id"] = _normalise_id_series(analysis["current_access_node_id"])

    if "assigned_access_node_id" in analysis.columns:
        analysis["assigned_access_node_id"] = _normalise_id_series(analysis["assigned_access_node_id"])

    access_lookup = (
        access_capacity.rename(
            columns={
                "site_snap_node_id": "access_node_id",
                "site_snap_lat": "access_lat",
                "site_snap_lng": "access_lng",
            }
        )[
            [
                "access_node_id",
                "access_lat",
                "access_lng",
                "access_capacity",
                "sites_at_access_node",
            ]
        ]
        .drop_duplicates(subset=["access_node_id"])
        .copy()
    )
    access_lookup["access_node_id"] = _normalise_id_series(access_lookup["access_node_id"])

    current_access_lookup = access_lookup.rename(
        columns={
            "access_node_id": "current_access_node_id",
            "access_lat": "current_access_lat",
            "access_lng": "current_access_lng",
            "access_capacity": "current_access_capacity",
            "sites_at_access_node": "current_sites_at_access_node",
        }
    )

    assigned_access_lookup = access_lookup.rename(
        columns={
            "access_node_id": "assigned_access_node_id",
            "access_lat": "assigned_access_lat",
            "access_lng": "assigned_access_lng",
            "access_capacity": "assigned_access_capacity",
            "sites_at_access_node": "assigned_sites_at_access_node",
        }
    )

    vendor_geo = vendor_model[
        [
            "vendor_id",
            "vendor_lat",
            "vendor_lng",
            "vendor_snap_node_id",
            "vendor_snap_dist_m",
        ]
    ].copy()

    if "vendor_snap_node_id" in vendor_geo.columns:
        vendor_geo["vendor_snap_node_id"] = _normalise_id_series(vendor_geo["vendor_snap_node_id"])

    df = analysis.merge(vendor_geo, on="vendor_id", how="left")
    df = df.merge(current_access_lookup, on="current_access_node_id", how="left")
    df = df.merge(assigned_access_lookup, on="assigned_access_node_id", how="left")

    if "moved_access_node" not in df.columns:
        df["moved_access_node"] = df["current_access_node_id"] != df["assigned_access_node_id"]

    keep_cols = [
        "vendor_id",
        "vendor_name",
        "main_cuisine",
        "Is_kitchen",
        "vendor_orders_n",
        "customer_orders_on_nodes",
        "current_access_node_id",
        "assigned_access_node_id",
        "baseline_current_cost_km",
        "assigned_cost_km",
        "improvement_km",
        "improvement_pct_vs_current",
        "avg_km_per_order_improvement",
        "moved_access_node",
        "vendor_lat",
        "vendor_lng",
        "vendor_snap_node_id",
        "vendor_snap_dist_m",
        "current_access_lat",
        "current_access_lng",
        "assigned_access_lat",
        "assigned_access_lng",
        "current_access_capacity",
        "assigned_access_capacity",
        "current_sites_at_access_node",
        "assigned_sites_at_access_node",
    ]

    existing_keep_cols = [col for col in keep_cols if col in df.columns]
    df = df[existing_keep_cols].copy()

    df = df.sort_values(
        by=["improvement_km", "vendor_orders_n"],
        ascending=[False, False],
    ).reset_index(drop=True)

    return _json_safe_records(df)


def save_uploaded_bundle(files: Iterable[UploadFile], bundle_name: str | None) -> tuple[str, Path]:
    _ensure_roots()

    safe_name = _safe_bundle_name(bundle_name)
    bundle_dir = uploaded_bundle_dir(safe_name)

    if bundle_dir.exists():
        shutil.rmtree(bundle_dir)
    bundle_dir.mkdir(parents=True, exist_ok=True)

    files = list(files)
    by_basename: dict[str, UploadFile] = {}

    for file in files:
        if not file.filename:
            continue
        by_basename[Path(file.filename).name] = file

    missing = [base for base in REQUIRED_SUMMARY_FILES if base not in by_basename]
    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Upload is missing required reshuffling files.",
                "missing_filenames": sorted(missing),
            },
        )

    file_map: dict[str, str] = {}
    file_map.update(REQUIRED_SUMMARY_FILES)
    file_map.update(OPTIONAL_MODEL_FILES)
    file_map.update({name: f"final_figures_reshuffling/{name}" for name in OPTIONAL_FIGURE_FILES})

    for basename, rel_dest in file_map.items():
        upload = by_basename.get(basename)
        if upload is None:
            continue

        dest = bundle_dir / rel_dest
        dest.parent.mkdir(parents=True, exist_ok=True)

        with dest.open("wb") as out:
            shutil.copyfileobj(upload.file, out)

    return safe_name, bundle_dir