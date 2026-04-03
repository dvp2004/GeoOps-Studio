from pydantic import BaseModel


class BaselineAssignmentRow(BaseModel):
    demand_id: str
    demand_weight: float
    snapped_demand_node_id: str
    assigned_candidate_id: str
    assigned_candidate_node_id: str
    weighted_cost_km: float


class BaselineSolveResponse(BaseModel):
    graph_id: str
    demand_count: int
    candidate_count: int
    total_weighted_cost_km: float
    assignment_rows: list[BaselineAssignmentRow]