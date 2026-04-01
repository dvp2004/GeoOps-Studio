from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes_health import router as health_router
from .api.routes_upload import router as upload_router

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
app.include_router(upload_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "GeoOps Studio backend is running"}