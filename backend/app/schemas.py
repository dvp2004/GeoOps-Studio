from __future__ import annotations
from typing import List
from pydantic import BaseModel, Field, ConfigDict


class AssignmentRow(BaseModel):
    demand_id: str
    candidate_id: str
    weighted_cost: float


class DemandPoint(BaseModel):
    id: str
    lat: float
    lng: float
    weight: float


class FacilityPoint(BaseModel):
    id: str
    lat: float
    lng: float


class AssignmentLine(BaseModel):
    demand_id: str
    facility_id: str
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
    weighted_cost: float


class OptimisationComparisonResponse(BaseModel):
    p: int = Field(..., ge=1)
    baseline_total_weighted_cost: float
    optimised_total_weighted_cost: float
    improvement_pct: float
    selected_candidate_ids: List[str]
    baseline_assignments: List[AssignmentRow]
    optimised_assignments: List[AssignmentRow]


class GenericCompareSummary(BaseModel):
    current_total_cost: float | None = None
    optimised_total_cost: float | None = None
    absolute_improvement: float | None = None
    improvement_pct: float | None = None
    p: int | None = None


class GenericOptimisedFacility(BaseModel):
    id: str
    label: str
    lat: float
    lng: float


class CurrentVsOptimisedComparisonResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    summary: GenericCompareSummary | None = None
    optimised_facilities: list[GenericOptimisedFacility] = []