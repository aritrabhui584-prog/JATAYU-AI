"""
NASA VIIRS Black Marble VNP46A2 Night-Light Intelligence API Endpoints
Phase 5: BRDF-Corrected Radiance, Quality Masking, Multi-Temporal Baseline,
Spatial Clustering, 500m Resolution Scientific Attribution, and GeoTIFF/GeoJSON Export.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import GEOJSON_DIR, GEOTIFF_DIR, RENDERS_DIR
from app.engines.nightlight_engine import nightlight_engine
from app.models.nightlight import (
    NightlightAnalysisParams,
    NightlightAnalysisResult,
    VIIRSObservationMetadata,
)

router = APIRouter(prefix="/nightlight", tags=["Night-Light Intelligence (NASA VIIRS)"])

@router.post("/analyze", response_model=NightlightAnalysisResult)
def analyze_nightlight(params: Optional[NightlightAnalysisParams] = None):
    """
    Executes NASA VIIRS Black Marble VNP46A2 night-light analysis.
    - Extracts calibrated BRDF nighttime radiance
    - Enforces Mandatory_Quality_Flag cloud and stray light screening
    - Computes multi-temporal pre-event baseline (median composite)
    - Compares with post-event daily observation
    - Calculates percentage and absolute brightness reductions
    - Identifies statistically significant spatial disruption clusters
    - Returns full pixel metrics, clusters, and 500m resolution attribution notice
    """
    try:
        if params is None:
            params = NightlightAnalysisParams()
        return nightlight_engine.run_nightlight_analysis(params)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Night-light analysis failed: {str(e)}")

@router.get("/latest", response_model=NightlightAnalysisResult)
def get_latest_nightlight_analysis():
    """Returns the latest night-light analysis result, or generates one if none exists"""
    latest = nightlight_engine.get_latest_result()
    if latest:
        return latest
    try:
        return nightlight_engine.run_nightlight_analysis()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed generating baseline nightlight analysis: {str(e)}")

@router.get("/observations", response_model=List[VIIRSObservationMetadata])
def list_viirs_observations():
    """Lists all available NASA Black Marble VNP46A2 HDF5 observations with valid/cloud pixel telemetry"""
    try:
        return nightlight_engine.list_available_observations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed listing VIIRS observations: {str(e)}")

@router.get("/render")
def get_nightlight_render_overlay(id: Optional[str] = Query(None)):
    """Streams the georeferenced RGBA map overlay PNG for the night-light analysis"""
    if id:
        target = RENDERS_DIR / f"{id}.png"
    else:
        latest = nightlight_engine.get_latest_result()
        target = RENDERS_DIR / f"{latest.id}.png" if latest else None

    if not target or not target.exists():
        # Fallback to search latest viirs_*.png
        files = sorted(RENDERS_DIR.glob("viirs_*.png"), key=lambda p: p.stat().st_mtime, reverse=True)
        if files:
            target = files[0]
        else:
            raise HTTPException(status_code=404, detail="No nightlight render overlay found. Run an analysis first.")

    return FileResponse(path=target, media_type="image/png")

@router.get("/export/geotiff")
def export_nightlight_geotiff(id: Optional[str] = Query(None)):
    """Downloads the classified 500m resolution night-light GeoTIFF"""
    if id:
        target = GEOTIFF_DIR / f"{id}.tif"
    else:
        latest = nightlight_engine.get_latest_result()
        target = GEOTIFF_DIR / f"{latest.id}.tif" if latest else None

    if not target or not target.exists():
        files = sorted(GEOTIFF_DIR.glob("viirs_*.tif"), key=lambda p: p.stat().st_mtime, reverse=True)
        if files:
            target = files[0]
        else:
            raise HTTPException(status_code=404, detail="No nightlight GeoTIFF found. Run an analysis first.")

    return FileResponse(path=target, media_type="image/tiff", filename=target.name)

@router.get("/export/geojson")
def export_nightlight_geojson(id: Optional[str] = Query(None)):
    """Downloads significant spatial light reduction clusters as GeoJSON polygons"""
    if id:
        target = GEOJSON_DIR / f"{id}.geojson"
    else:
        latest = nightlight_engine.get_latest_result()
        target = GEOJSON_DIR / f"{latest.id}.geojson" if latest else None

    if not target or not target.exists():
        files = sorted(GEOJSON_DIR.glob("viirs_*.geojson"), key=lambda p: p.stat().st_mtime, reverse=True)
        if files:
            target = files[0]
        else:
            raise HTTPException(status_code=404, detail="No nightlight GeoJSON found. Run an analysis first.")

    return FileResponse(path=target, media_type="application/geo+json", filename=target.name)
