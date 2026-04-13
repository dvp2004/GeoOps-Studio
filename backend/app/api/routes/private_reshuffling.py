from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ...services.reshuffling_bundle_loader import (
    OPTIONAL_FIGURE_FILES,
    build_bundle_summary,
    expected_upload_filenames,
    list_local_bundles,
    load_vendor_explorer_rows,
    local_bundle_dir,
    optional_figure_filenames,
    optional_model_filenames,
    save_uploaded_bundle,
    uploaded_bundle_dir,
    validate_bundle_dir,
)

router = APIRouter(prefix="/private/reshuffling", tags=["private-reshuffling"])


@router.get("/bundles/{bundle_name}/vendors")
def load_local_bundle_vendors(bundle_name: str) -> dict:
    try:
        bundle_dir = local_bundle_dir(bundle_name)
        validate_bundle_dir(bundle_dir)

        return {
            "bundle_name": bundle_name,
            "source": "local",
            "vendors": load_vendor_explorer_rows(bundle_dir),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Vendor explorer load failed for local bundle '{bundle_name}': {repr(exc)}",
        ) from exc


@router.get("/uploads/{bundle_name}/vendors")
def load_uploaded_bundle_vendors(bundle_name: str) -> dict:
    try:
        bundle_dir = uploaded_bundle_dir(bundle_name)
        validate_bundle_dir(bundle_dir)

        return {
            "bundle_name": bundle_name,
            "source": "upload",
            "vendors": load_vendor_explorer_rows(bundle_dir),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Vendor explorer load failed for uploaded bundle '{bundle_name}': {repr(exc)}",
        ) from exc

@router.get("/required-files")
def get_required_files() -> dict:
    return {
        "recommended_local_bundle": "private_bundles/reshuffling_k80",
        "upload_required_files": expected_upload_filenames(),
        "optional_model_files_for_local_dev": optional_model_filenames(),
        "optional_figure_files": optional_figure_filenames(),
    }


@router.get("/bundles")
def get_local_bundles() -> dict:
    return {"bundles": list_local_bundles()}


@router.get("/bundles/{bundle_name}")
def load_local_bundle(bundle_name: str) -> dict:
    bundle_dir = local_bundle_dir(bundle_name)
    return build_bundle_summary(bundle_name=bundle_name, bundle_dir=bundle_dir, source="local")


@router.get("/bundles/{bundle_name}/figures/{figure_name}")
def get_local_figure(bundle_name: str, figure_name: str):
    if figure_name not in OPTIONAL_FIGURE_FILES:
        raise HTTPException(status_code=404, detail="Unknown figure name.")

    bundle_dir = local_bundle_dir(bundle_name)
    validate_bundle_dir(bundle_dir)

    figure_path = bundle_dir / "final_figures_reshuffling" / figure_name
    if not figure_path.exists():
        raise HTTPException(status_code=404, detail="Figure not found in bundle.")

    return FileResponse(figure_path)


@router.post("/upload")
def upload_bundle(
    files: list[UploadFile] = File(...),
    bundle_name: str | None = Form(default=None),
) -> dict:
    saved_name, bundle_dir = save_uploaded_bundle(files=files, bundle_name=bundle_name)
    return build_bundle_summary(bundle_name=saved_name, bundle_dir=bundle_dir, source="upload")


@router.get("/uploads/{bundle_name}/figures/{figure_name}")
def get_uploaded_figure(bundle_name: str, figure_name: str):
    if figure_name not in OPTIONAL_FIGURE_FILES:
        raise HTTPException(status_code=404, detail="Unknown figure name.")

    bundle_dir = uploaded_bundle_dir(bundle_name)
    validate_bundle_dir(bundle_dir)

    figure_path = bundle_dir / "final_figures_reshuffling" / figure_name
    if not figure_path.exists():
        raise HTTPException(status_code=404, detail="Figure not found in uploaded bundle.")

    return FileResponse(figure_path)