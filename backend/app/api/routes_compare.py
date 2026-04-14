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

    # Note:
    # current_file intentionally uses the same validation schema as candidate_file.
    #
    # Reasoning:
    # both "current" and "candidate" CSVs are facility-point sets with the same
    # low-level structure: id + coordinates. Their difference is semantic, not structural:
    # - current_df = facilities currently open in the baseline layout
    # - candidate_df = facilities the optimiser may choose from
    #
    # We therefore reuse the same facility validation rules instead of duplicating
    # identical checks for two CSVs with the same shape.
    #
    # The real distinction is enforced later in the optimisation flow:
    # - current_df defines the baseline facility set
    # - candidate_df defines the optimisation pool
    # - fair comparison is handled by requiring p to match the current facility count

    current_df = read_and_validate_csv_df(current_file, "facility")
    candidate_df = read_and_validate_csv_df(candidate_file, "facility")

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