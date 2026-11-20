"""
Road Network Isolation and Emergency Accessibility API Endpoints
Phase 4: NetworkX Graph Routing, Detour Recalculation, and Relief Reachability
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import GEOJSON_DIR
from app.engines.isolation_engine import isolation_engine
from app.models.isolation import (
    EmergencyFacility,
    RoadExposureParams,
    RoadIsolationAnalysisResult,
)

router = APIRouter(prefix="/isolation", tags=["Road Isolation & Accessibility"])

@router.post("/analyze", response_model=RoadIsolationAnalysisResult)
def analyze_road_isolation(params: Optional[RoadExposureParams] = None):
    """
    Executes real graph-theoretic road accessibility analysis under flood exposure.
    - Recalculates damaged graph connectivity
    - Identifies closed road breaches based on configurable vehicle depth & slope hazard rules
    - Preserves elevated bridge deck clearance
    - Discovers shortest alternative detour routes
    - Returns isolated settlements, accessible villages, and nearest reachable relief centers
    """
    try:
        if params is None:
            params = RoadExposureParams()
        return isolation_engine.run_accessibility_analysis(params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Road accessibility analysis failed: {str(e)}")

@router.get("/latest", response_model=RoadIsolationAnalysisResult)
def get_latest_isolation_analysis():
    """Returns the latest calculated road isolation analysis, or computes one if none exists"""
    latest = isolation_engine.get_latest_result()
    if latest:
        return latest
    try:
        return isolation_engine.run_accessibility_analysis()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed generating baseline isolation analysis: {str(e)}")

@router.get("/facilities", response_model=List[EmergencyFacility])
def get_emergency_facilities():
    """Returns all verified emergency hospitals, health centers, and disaster relief bases in the AOI"""
    try:
        return isolation_engine.load_emergency_facilities()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed loading emergency facilities: {str(e)}")

@router.get("/export/geojson")
def export_isolation_geojson(analysis_id: Optional[str] = Query(None)):
    """Exports road breaches, isolated settlements, and alternative detour paths as GeoJSON"""
    if analysis_id:
        target = GEOJSON_DIR / f"{analysis_id}.geojson"
    else:
        latest = isolation_engine.get_latest_result()
        target = GEOJSON_DIR / f"{latest.id}.geojson" if latest else None

    if not target or not target.exists():
        # Fallback to search latest isolation_*.geojson
        files = sorted(GEOJSON_DIR.glob("isolation_*.geojson"), key=lambda p: p.stat().st_mtime, reverse=True)
        if files:
            target = files[0]
        else:
            raise HTTPException(status_code=404, detail="No isolation analysis GeoJSON found. Run an analysis first.")

    return FileResponse(
        path=target,
        media_type="application/geo+json",
        filename=target.name
    )
