"""
Hydrometeorological API Endpoints
Open-Meteo GloFAS river discharge and ECMWF weather telemetry for Teesta basin.
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.config import METADATA_DIR

router = APIRouter(prefix="/meteo", tags=["Hydrometeorology"])

@router.get("/observations")
def get_meteo_observations():
    cache_file = METADATA_DIR / "meteo_observations.json"
    if not cache_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Meteorological & river discharge telemetry not yet queried. Trigger Open-Meteo ingestion first."
        )
    with open(cache_file, "r", encoding="utf-8") as f:
        return json.load(f)
