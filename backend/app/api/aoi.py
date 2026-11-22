"""
AOI API Endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.engines.aoi_engine import aoi_engine
from app.models.aoi import AOIConfig, AOIPreset, BoundingBox
from app.services.scout_service import scout_service, ScoutRegionRequest

router = APIRouter(prefix="/aoi", tags=["Area of Interest"])

@router.get("/active", response_model=AOIConfig)
def get_active_aoi():
    return aoi_engine.get_active_aoi()

@router.get("/presets", response_model=List[AOIPreset])
def get_presets():
    return aoi_engine.get_presets()

@router.post("/select-preset/{preset_id}", response_model=AOIConfig)
async def select_preset(preset_id: str, auto_ingest: bool = Query(True)):
    try:
        config = aoi_engine.set_preset_aoi(preset_id)
        if auto_ingest:
            # Dynamically ingest / activate OSM vector data for this AOI
            try:
                from app.services.osm_service import osm_service
                await osm_service.fetch_data(config.bbox)
            except Exception as e:
                pass
            # Dynamically fetch live GloFAS & weather
            try:
                from app.services.meteo_service import meteo_service
                await meteo_service.fetch_data(config.bbox)
                meteo_service.fetch_glofas_early_warning(config.bbox, force_refresh=True)
            except Exception as e:
                pass
            # Live Copernicus Sentinel & NASA VIIRS Ingestion
            try:
                from app.services.copernicus_service import copernicus_service
                from app.engines.nightlight_engine import nightlight_engine
                c_bbox = [config.bbox.min_lon, config.bbox.min_lat, config.bbox.max_lon, config.bbox.max_lat]
                copernicus_service.clip_live_sentinel1(c_bbox)
                copernicus_service.clip_live_sentinel2(c_bbox)
                nightlight_engine.download_latest_viirs_granules(config.bbox, max_granules=1)
            except Exception as e:
                pass
        return config
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/custom", response_model=AOIConfig)
async def set_custom_aoi(bbox: BoundingBox, name: str = "Custom Area of Interest", auto_ingest: bool = Query(True)):
    config = aoi_engine.set_active_aoi(aoi_id="custom", name=name, bbox=bbox)
    if auto_ingest:
        try:
            from app.services.osm_service import osm_service
            await osm_service.fetch_data(config.bbox)
        except Exception:
            pass
        try:
            from app.services.meteo_service import meteo_service
            await meteo_service.fetch_data(config.bbox)
            meteo_service.fetch_glofas_early_warning(config.bbox, force_refresh=True)
        except Exception:
            pass
        # Live Copernicus Sentinel & NASA VIIRS Ingestion
        try:
            from app.services.copernicus_service import copernicus_service
            from app.engines.nightlight_engine import nightlight_engine
            c_bbox = [config.bbox.min_lon, config.bbox.min_lat, config.bbox.max_lon, config.bbox.max_lat]
            copernicus_service.clip_live_sentinel1(c_bbox)
            copernicus_service.clip_live_sentinel2(c_bbox)
            nightlight_engine.download_latest_viirs_granules(config.bbox, max_granules=1)
        except Exception:
            pass
    return config

@router.get("/geojson")
def get_aoi_geojson():
    return aoi_engine.get_aoi_geojson()

@router.post("/scout")
async def scout_region(req: ScoutRegionRequest):
    """
    All-India Dynamic Basin Scouting Endpoint.
    Queries live Open-Meteo GloFAS river discharge, ECMWF weather telemetry,
    and returns genuine hydrological diagnostics for any clicked or scouted coordinate in India.
    """
    try:
        return await scout_service.scout_basin(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Basin scout query failed: {str(e)}")

@router.get("/surveillance-dates")
def get_surveillance_dates(anchor_date: Optional[str] = Query(None)):
    """
    Returns verified dates for 4-Grid temporal satellite surveillance (1Y ago, 1W ago, 1D ago, Live).
    """
    try:
        return scout_service.get_surveillance_dates(anchor_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Surveillance dates calculation failed: {str(e)}")
