from io import StringIO
from typing import Literal

import pandas as pd
from fastapi import HTTPException, UploadFile

from backend.app.models.file_contracts import FileSummary

FileKind = Literal["demand", "candidate"]

REQUIRED_COLUMNS: dict[FileKind, list[str]] = {
    "demand": ["id", "lat", "lng", "weight"],
    "candidate": ["id", "lat", "lng"],
}


def _read_csv(upload_file: UploadFile) -> pd.DataFrame:
    filename = upload_file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail=f"{filename} must be a CSV file.")

    raw_bytes = upload_file.file.read()
    upload_file.file.seek(0)

    try:
        decoded = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{filename} is not valid UTF-8 CSV content.",
        ) from exc

    try:
        df = pd.read_csv(StringIO(decoded))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{filename} could not be parsed as CSV.",
        ) from exc

    if df.empty:
        raise HTTPException(status_code=400, detail=f"{filename} is empty.")

    df.columns = [str(col).strip() for col in df.columns]
    return df


def _coerce_and_validate_common(df: pd.DataFrame, file_kind: FileKind, filename: str) -> pd.DataFrame:
    required = REQUIRED_COLUMNS[file_kind]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{filename} is missing required columns: {', '.join(missing)}",
        )

    df = df[required].copy()

    if df.isnull().any().any():
        raise HTTPException(
            status_code=400,
            detail=f"{filename} contains missing values in required columns.",
        )

    df["id"] = df["id"].astype(str).str.strip()
    if (df["id"] == "").any():
        raise HTTPException(status_code=400, detail=f"{filename} contains blank id values.")

    if df["id"].duplicated().any():
        raise HTTPException(status_code=400, detail=f"{filename} contains duplicate id values.")

    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lng"] = pd.to_numeric(df["lng"], errors="coerce")

    if df["lat"].isna().any() or df["lng"].isna().any():
        raise HTTPException(
            status_code=400,
            detail=f"{filename} contains non-numeric coordinates.",
        )

    if not df["lat"].between(-90, 90).all():
        raise HTTPException(status_code=400, detail=f"{filename} contains invalid latitude values.")

    if not df["lng"].between(-180, 180).all():
        raise HTTPException(status_code=400, detail=f"{filename} contains invalid longitude values.")

    if file_kind == "demand":
        df["weight"] = pd.to_numeric(df["weight"], errors="coerce")
        if df["weight"].isna().any():
            raise HTTPException(
                status_code=400,
                detail=f"{filename} contains non-numeric demand weights.",
            )
        if (df["weight"] <= 0).any():
            raise HTTPException(
                status_code=400,
                detail=f"{filename} contains non-positive demand weights.",
            )

    return df


def read_and_validate_csv_df(upload_file: UploadFile, file_kind: FileKind) -> pd.DataFrame:
    filename = upload_file.filename or f"{file_kind}.csv"
    df = _read_csv(upload_file)
    return _coerce_and_validate_common(df, file_kind, filename)


def validate_csv_file(upload_file: UploadFile, file_kind: FileKind) -> FileSummary:
    filename = upload_file.filename or f"{file_kind}.csv"
    df = read_and_validate_csv_df(upload_file, file_kind)

    preview_rows = df.head(5).to_dict(orient="records")

    return FileSummary(
        file_kind=file_kind,
        filename=filename,
        row_count=len(df),
        columns=list(df.columns),
        preview_rows=preview_rows,
    )