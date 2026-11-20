"""
JATAYU AI — Phase 1: Real Data Foundation
FastAPI Backend Application
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api import api_router
from app.engines.aoi_engine import aoi_engine
from app.engines.metadata_engine import metadata_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("jatayu.main")

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routes under /api
app.include_router(api_router)

@app.get("/")
def root():
    return {
        "project": "JATAYU AI",
        "phase": "Phase 1: Real Data Foundation",
        "status": "OPERATIONAL",
        "geographic_area": "Teesta river corridor, Sikkim and North Bengal, India",
        "api_docs": "/docs",
        "active_aoi": aoi_engine.get_active_aoi().name
    }

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "jatayu-backend"}
