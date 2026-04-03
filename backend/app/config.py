from __future__ import annotations

import os


def get_cors_origins() -> list[str]:
    raw_value = os.getenv(
        "BACKEND_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )

    origins: list[str] = []

    for item in raw_value.split(","):
        cleaned = item.strip().rstrip("/")
        if cleaned:
            origins.append(cleaned)

    return origins