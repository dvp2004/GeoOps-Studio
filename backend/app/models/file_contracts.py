from typing import Any, Literal

from pydantic import BaseModel


class FileSummary(BaseModel):
    file_kind: Literal["demand", "candidate"]
    filename: str
    row_count: int
    columns: list[str]
    preview_rows: list[dict[str, Any]]


class ValidationResponse(BaseModel):
    demand: FileSummary
    candidate: FileSummary