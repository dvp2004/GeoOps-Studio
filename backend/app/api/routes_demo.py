from __future__ import annotations

from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Response

from backend.app.services.generic_response_normaliser import (
    normalise_generic_compare_payload,
)
from backend.app.services.solve_current_vs_p_median import solve_current_vs_p_median

router = APIRouter(prefix="/api/demo", tags=["demo"])


def _sample_dir() -> Path:
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / "frontend" / "public" / "samples"


@router.get("/current-vs-optimised")
def current_vs_optimised_demo_route(response: Response) -> dict:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    try:
        sample_dir = _sample_dir()

        demand_df = pd.read_csv(sample_dir / "sample_demand.csv")
        current_df = pd.read_csv(sample_dir / "sample_current_facilities.csv")
        candidate_df = pd.read_csv(sample_dir / "sample_candidate_facilities.csv")

        p = len(current_df)

        raw_payload = solve_current_vs_p_median(
            demand_df=demand_df,
            current_df=current_df,
            candidate_df=candidate_df,
            p=p,
            graph_id="dubai_micro",
        )

        return normalise_generic_compare_payload(raw_payload)

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Built-in demo sample CSV files were not found under "
                "frontend/public/samples."
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc