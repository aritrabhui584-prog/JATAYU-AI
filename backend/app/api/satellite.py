"""
Satellite Observation API Endpoints
Copernicus Sentinel-1 SAR, Sentinel-2 MSI, and NASA VIIRS telemetry.
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.config import METADATA_DIR
from app.services.viirs_service import viirs_service

router = APIRouter(prefix="/satellite", tags=["Satellite Remote Sensing"])

@router.get("/sentinel1")
def get_sentinel1_scenes():
    cache_file = METADATA_DIR / "sentinel1_scenes.json"
    if not cache_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Sentinel-1 scenes not yet queried. Trigger Sentinel-1 ingestion first."
        )
    with open(cache_file, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/sentinel2")
def get_sentinel2_scenes():
    cache_file = METADATA_DIR / "sentinel2_scenes.json"
    if not cache_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Sentinel-2 scenes not yet queried. Trigger Sentinel-2 ingestion first."
        )
    with open(cache_file, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/viirs")
def get_viirs_status():
    status = viirs_service.get_status()
    return status.model_dump()
