from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.app.schemas import OptimisationComparisonResponse
from backend.app.services.solve_compare import solve_compare
from backend.app.services.validation import read_and_validate_csv_df

router = APIRouter(prefix="/api", tags=["optimisation"])


@router.post("/solve-p-median", response_model=OptimisationComparisonResponse)
def solve_p_median_route(
    demand_file: UploadFile = File(...),
    candidate_file: UploadFile = File(...),
    p: int = Form(...),
    graph_id: str = Form("dubai_micro"),
) -> OptimisationComparisonResponse:
    demand_df = read_and_validate_csv_df(demand_file, "demand")
    candidate_df = read_and_validate_csv_df(candidate_file, "candidate")

    try:
        return solve_compare(
            demand_df=demand_df,
            candidate_df=candidate_df,
            p=p,
            graph_id=graph_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc