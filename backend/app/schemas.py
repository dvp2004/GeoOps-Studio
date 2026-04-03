from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class AssignmentRow(BaseModel):
    demand_id: str
    candidate_id: str
    weighted_cost: float


class OptimisationComparisonResponse(BaseModel):
    p: int = Field(..., ge=1)
    baseline_total_weighted_cost: float
    optimised_total_weighted_cost: float
    improvement_pct: float
    selected_candidate_ids: List[str]
    baseline_assignments: List[AssignmentRow]
    optimised_assignments: List[AssignmentRow]