from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_health import router as health_router

app = FastAPI(
    title="GeoOps Studio API",
    version="0.1.0",
    description="Backend API for GeoOps Studio",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "GeoOps Studio backend is running"}