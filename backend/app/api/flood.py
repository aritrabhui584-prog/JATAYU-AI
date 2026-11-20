"""
JATAYU AI - Real Flood & Terrain Analysis API
Endpoints for multi-criteria SAR/DEM flood analysis, terrain hypsometry & slope hazard,
hypothetical water level scenario simulations, and GeoTIFF/GeoJSON exports.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import GEOJSON_DIR, GEOTIFF_DIR, RENDERS_DIR
from app.engines.aoi_engine import aoi_engine
from app.engines.flood_engine import flood_engine
from app.engines.metadata_engine import metadata_engine
from app.engines.terrain_engine import terrain_engine
from app.models.flood import (
    FloodAnalysisParams,
    FloodAnalysisResult,
    ScenarioAnalysisParams,
    TerrainAnalysisResult,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flood", tags=["Flood & Terrain Engine"])

@router.post("/analyze", response_model=FloodAnalysisResult)
def analyze_flood(params: FloodAnalysisParams):
    """
    Executes real GIS multi-criteria flood classification:
    - Sentinel-1 SAR calibrated backscatter & optional pre-event change detection
    - DEM elevation & slope thresholding
    - Radar mountain shadow exclusion
    - Permanent riverbed masking
    - Intersections with real OSM roads and settlements
    """
    try:
        result = flood_engine.run_flood_analysis(params)
        return result
    except Exception as e:
        logger.error(f"Flood analysis execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Flood analysis failed: {str(e)}")

@router.get("/latest", response_model=FloodAnalysisResult)
def get_latest_flood_analysis():
    """
    Retrieves the most recent flood analysis result, or generates an initial one if empty.
    """
    if flood_engine.latest_result:
        return flood_engine.latest_result

    # Default to first registered Sentinel-1 scene or seed scene
    scenes = metadata_engine.list_scene_records(mission="Sentinel-1", limit=2)
    post_id = scenes[0].id if scenes else "S1D_IW_GRDH_1SDV_20261118T000248_00A8BE"
    pre_id = scenes[1].id if len(scenes) > 1 else None

    params = FloodAnalysisParams(
        post_event_scene_id=post_id,
        pre_event_scene_id=pre_id,
        backscatter_threshold_db=-16.0,
        change_threshold_db=-3.0,
        slope_max_degrees=8.0,
        elevation_max_m=1200.0,
        min_patch_pixels=5
    )
    result = flood_engine.run_flood_analysis(params)
    return result

@router.post("/scenario", response_model=FloodAnalysisResult)
def run_water_level_scenario(params: ScenarioAnalysisParams):
    """
    Runs hypothetical water level scenario simulation (stage rise Delta h above baseline).
    
    SCIENTIFIC MANDATE:
    Classified as MODELLED_SCENARIO. Simulates low-lying elevation stage capacity.
    Not a 2D dynamic hydrodynamic wave propagation forecast.
    """
    try:
        result = flood_engine.run_scenario_analysis(params)
        return result
    except Exception as e:
        logger.error(f"Scenario analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scenario analysis failed: {str(e)}")

@router.get("/terrain", response_model=TerrainAnalysisResult)
def get_terrain_analysis():
    """
    Retrieves DEM terrain metrics: elevation range, hypsometric histogram,
    mean slope in degrees, and slope hazard distribution (% flat, % moderate, % steep).
    """
    active_aoi = aoi_engine.get_active_aoi()
    aoi_bbox = (active_aoi.bbox.min_lon, active_aoi.bbox.min_lat, active_aoi.bbox.max_lon, active_aoi.bbox.max_lat)
    dem_tif = terrain_engine.create_or_load_teesta_dem(bbox=aoi_bbox)
    result = terrain_engine.analyze_terrain(dem_tif)
    return result

@router.get("/render")
def render_flood_overlay(
    type: str = "flood_extent",
    id: Optional[str] = None
):
    """
    Streams georeferenced RGBA PNG overlays for Leaflet ImageOverlay.
    Types: flood_extent, terrain_elevation, terrain_slope, terrain_hillshade.
    """
    if type == "terrain_elevation":
        png_path = RENDERS_DIR / "dem_elevation_relief.png"
    elif type == "terrain_slope":
        png_path = RENDERS_DIR / "dem_slope_hazard.png"
    elif type == "terrain_hillshade":
        png_path = RENDERS_DIR / "dem_hillshade.png"
    else:
        # Flood extent overlay
        if id:
            png_path = RENDERS_DIR / f"{id}.png"
        elif flood_engine.latest_result:
            png_path = RENDERS_DIR / f"{flood_engine.latest_result.id}.png"
        else:
            # Trigger latest
            res = get_latest_flood_analysis()
            png_path = RENDERS_DIR / f"{res.id}.png"

    if not png_path.exists():
        # Trigger terrain analysis to generate renders if terrain type
        if "terrain" in type:
            get_terrain_analysis()
        else:
            get_latest_flood_analysis()

    if not png_path.exists():
        raise HTTPException(status_code=404, detail=f"Render file not found for type: {type}")

    return FileResponse(
        path=str(png_path),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"}
    )

@router.get("/export/geotiff")
def export_flood_geotiff(id: Optional[str] = None):
    """
    Exports and downloads the classified flood extent GeoTIFF.
    """
    target_id = id or (flood_engine.latest_result.id if flood_engine.latest_result else None)
    if not target_id:
        res = get_latest_flood_analysis()
        target_id = res.id

    geotiff_path = GEOTIFF_DIR / f"{target_id}.tif"
    if not geotiff_path.exists():
        raise HTTPException(status_code=404, detail="Flood extent GeoTIFF not found")

    return FileResponse(
        path=str(geotiff_path),
        media_type="image/tiff",
        filename=f"{target_id}.tif",
        headers={"Content-Disposition": f"attachment; filename={target_id}.tif"}
    )

@router.get("/export/geojson")
def export_flood_geojson(id: Optional[str] = None):
    """
    Exports and downloads the vectorized flood extent polygons as GeoJSON FeatureCollection.
    """
    target_id = id or (flood_engine.latest_result.id if flood_engine.latest_result else None)
    if not target_id:
        res = get_latest_flood_analysis()
        target_id = res.id

    geojson_path = GEOJSON_DIR / f"{target_id}.geojson"
    if not geojson_path.exists():
        raise HTTPException(status_code=404, detail="Flood extent GeoJSON not found")

    return FileResponse(
        path=str(geojson_path),
        media_type="application/geo+json",
        filename=f"{target_id}.geojson",
        headers={"Content-Disposition": f"attachment; filename={target_id}.geojson"}
    )

@router.get("/intersections")
def get_flood_intersections():
    """
    Returns detailed spatial intersection records for inundated settlements and severed roads.
    """
    if not flood_engine.latest_result:
        get_latest_flood_analysis()

    res = flood_engine.latest_result
    return {
        "analysis_id": res.id,
        "extent_type": res.extent_type.value,
        "inundated_settlements_count": len(res.inundated_settlements),
        "inundated_settlements": [s.model_dump() for s in res.inundated_settlements],
        "submerged_roads_count": len(res.submerged_roads),
        "submerged_roads_total_km": res.submerged_roads_length_km,
        "severed_arteries_count": res.severed_arteries_count,
        "submerged_roads": [r.model_dump() for r in res.submerged_roads]
    }
