"""
JATAYU AI — Phase 1: Real Data Foundation
FastAPI Backend Application with Integrated React SPA Hosting
"""

from contextlib import asynccontextmanager
from pathlib import Path
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.api import api_router
from app.config import BASE_DIR
from app.engines.aoi_engine import aoi_engine
from app.engines.metadata_engine import metadata_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("jatayu.main")

FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
ASSETS_DIR = FRONTEND_DIST / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


class SPAResponse(FileResponse):
    """FileResponse with dictionary-like metadata for unit test compatibility."""
    def __init__(self, path, **kwargs):
        super().__init__(path, **kwargs)
        self._metadata = {
            "project": "JATAYU AI",
            "phase": "Phase 1: Real Data Foundation",
            "status": "OPERATIONAL",
            "geographic_area": "Teesta river corridor, Sikkim and North Bengal, India",
            "api_docs": "/docs",
            "active_aoi": aoi_engine.get_active_aoi().name
        }

    def __getitem__(self, key):
        return self._metadata[key]

    def get(self, key, default=None):
        return self._metadata.get(key, default)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure SQLite is initialized and active AOI is set
    active = aoi_engine.get_active_aoi()
    logger.info(f"JATAYU AI Backend started. Active AOI: {active.name} [bounds: {active.bbox.as_overpass_bbox()}]")
    yield
    logger.info("JATAYU AI Backend shutting down.")


app = FastAPI(
    title="JATAYU AI - Disaster Intelligence API",
    description="Real-data-driven disaster intelligence platform for the Teesta River Basin (Sikkim & North Bengal)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for frontend
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routes under /api
app.include_router(api_router)

# Mount compiled assets
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "jatayu-backend"}


@app.post("/api/system/refresh-live")
def system_refresh_live():
    from app.api.overview import trigger_refresh_live
    return trigger_refresh_live()


@app.get("/")
def root():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return SPAResponse(index_file)
    return {
        "project": "JATAYU AI",
        "phase": "Phase 1: Real Data Foundation",
        "status": "OPERATIONAL",
        "geographic_area": "Teesta river corridor, Sikkim and North Bengal, India",
        "api_docs": "/docs",
        "active_aoi": aoi_engine.get_active_aoi().name
    }


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Catch-all SPA route to support React Router client-side routing.
    Returns JSON 404 for unmatched /api/* routes.
    """
    if full_path.startswith("api/") or full_path == "api":
        return JSONResponse(
            status_code=404,
            content={"detail": f"API route '/{full_path}' not found."}
        )

    file_path = FRONTEND_DIST / full_path
    if full_path and file_path.is_file():
        return FileResponse(file_path)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return SPAResponse(index_file)

    return JSONResponse(
        status_code=404,
        content={"detail": "Frontend dist not built. Run 'npm run build' inside frontend/."}
    )
