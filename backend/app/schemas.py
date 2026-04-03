from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


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


class CurrentVsOptimisedComparisonResponse(BaseModel):
    p: int = Field(..., ge=1)
    current_facility_count: int = Field(..., ge=1)
    candidate_pool_count: int = Field(..., ge=1)
    baseline_total_weighted_cost: float
    optimised_total_weighted_cost: float
    improvement_pct: float
    current_facility_ids: List[str]
    selected_candidate_ids: List[str]
    baseline_assignments: List[AssignmentRow]
    optimised_assignments: List[AssignmentRow]
    demand_points: List[DemandPoint]
    current_facilities: List[FacilityPoint]
    selected_facilities: List[FacilityPoint]
    baseline_assignment_lines: List[AssignmentLine]
    optimised_assignment_lines: List[AssignmentLine]