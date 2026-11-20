"""
AOI API Endpoints
"""

from fastapi import APIRouter, HTTPException
from typing import List
from app.engines.aoi_engine import aoi_engine
from app.models.aoi import AOIConfig, AOIPreset, BoundingBox

router = APIRouter(prefix="/aoi", tags=["Area of Interest"])

@router.get("/active", response_model=AOIConfig)
def get_active_aoi():
    return aoi_engine.get_active_aoi()

@router.get("/presets", response_model=List[AOIPreset])
def get_presets():
    return aoi_engine.get_presets()

@router.post("/select-preset/{preset_id}", response_model=AOIConfig)
def select_preset(preset_id: str):
    try:
        return aoi_engine.set_preset_aoi(preset_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/custom", response_model=AOIConfig)
def set_custom_aoi(bbox: BoundingBox, name: str = "Custom Teesta Area"):
    return aoi_engine.set_active_aoi(aoi_id="custom", name=name, bbox=bbox)

@router.get("/geojson")
def get_aoi_geojson():
    return aoi_engine.get_aoi_geojson()
