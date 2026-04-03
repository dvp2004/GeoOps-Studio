from fastapi import APIRouter, File, Form, UploadFile

from backend.app.models.solve_models import BaselineSolveResponse
from backend.app.services.solve_baseline import solve_baseline
from backend.app.services.validation import read_and_validate_csv_df

router = APIRouter(prefix="/api", tags=["solve"])


@router.post("/solve-baseline", response_model=BaselineSolveResponse)
def solve_baseline_route(
    demand_file: UploadFile = File(...),
    candidate_file: UploadFile = File(...),
    graph_id: str = Form("dubai_micro"),
) -> BaselineSolveResponse:
    demand_df = read_and_validate_csv_df(demand_file, "demand")
    candidate_df = read_and_validate_csv_df(candidate_file, "candidate")

    return solve_baseline(
        demand_df=demand_df,
        candidate_df=candidate_df,
        graph_id=graph_id,
    )