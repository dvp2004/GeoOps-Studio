from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.app.schemas import CurrentVsOptimisedComparisonResponse
from backend.app.services.demo_runner import run_demo_current_vs_optimised

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get(
    "/current-vs-optimised",
    response_model=CurrentVsOptimisedComparisonResponse,
)
def demo_current_vs_optimised_route() -> CurrentVsOptimisedComparisonResponse:
    try:
        return run_demo_current_vs_optimised()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc