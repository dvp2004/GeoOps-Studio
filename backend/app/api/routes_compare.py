from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.app.schemas import CurrentVsOptimisedComparisonResponse
from backend.app.services.generic_response_normaliser import (
    normalise_generic_compare_payload,
)
from backend.app.services.solve_current_vs_p_median import solve_current_vs_p_median
from backend.app.services.validation import read_and_validate_csv_df

router = APIRouter(prefix="/api", tags=["comparison"])


@router.post(
    "/compare-current-vs-p-median",
    response_model=CurrentVsOptimisedComparisonResponse,
)
def compare_current_vs_p_median_route(
    demand_file: UploadFile = File(...),
    current_file: UploadFile = File(...),
    candidate_file: UploadFile = File(...),
    p: int = Form(...),
    graph_id: str = Form("dubai_micro"),
) -> CurrentVsOptimisedComparisonResponse:
    demand_df = read_and_validate_csv_df(demand_file, "demand")
    current_df = read_and_validate_csv_df(current_file, "candidate")
    candidate_df = read_and_validate_csv_df(candidate_file, "candidate")

    try:
        raw_payload = solve_current_vs_p_median(
            demand_df=demand_df,
            current_df=current_df,
            candidate_df=candidate_df,
            p=p,
            graph_id=graph_id,
        )
        return normalise_generic_compare_payload(raw_payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc