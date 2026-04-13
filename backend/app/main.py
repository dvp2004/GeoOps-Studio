from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes_compare import router as compare_router
from .api.routes_demo import router as demo_router
from .api.routes_health import router as health_router
from .api.routes_optimise import router as optimise_router
from .api.routes_solve import router as solve_router
from .api.routes_upload import router as upload_router
from .api.routes.private_reshuffling import router as private_reshuffling_router
from .config import get_cors_origins

app = FastAPI(
    title="GeoOps Studio API",
    version="0.1.0",
    description="Backend API for GeoOps Studio",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(upload_router)
app.include_router(solve_router)
app.include_router(optimise_router)
app.include_router(compare_router)
app.include_router(demo_router)
app.include_router(private_reshuffling_router, prefix="/api")

@app.get("/")
def root() -> dict[str, str]:
    return {"message": "GeoOps Studio backend is running"}