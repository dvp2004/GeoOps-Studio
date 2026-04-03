from fastapi import APIRouter, File, UploadFile

from backend.app.models.file_contracts import ValidationResponse
from backend.app.services.validation import validate_csv_file

router = APIRouter(prefix="/api", tags=["files"])


@router.post("/validate-files", response_model=ValidationResponse)
def validate_files(
    demand_file: UploadFile = File(...),
    candidate_file: UploadFile = File(...),
) -> ValidationResponse:
    demand_summary = validate_csv_file(demand_file, "demand")
    candidate_summary = validate_csv_file(candidate_file, "candidate")

    return ValidationResponse(
        demand=demand_summary,
        candidate=candidate_summary,
    )