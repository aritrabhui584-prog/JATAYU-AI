"""
GIS Spatial and Network Analysis API Endpoints
NetworkX topological road analytics, settlement isolation scoring, and DEM profiles.
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List
from app.config import GEOJSON_DIR, METADATA_DIR
from app.engines.gis_engine import gis_engine

router = APIRouter(prefix="/gis", tags=["GIS & Topology"])

@router.get("/network-stats")
def get_road_network_stats():
    """Builds NetworkX graph and returns road topological metrics"""
    roads_file = GEOJSON_DIR / "osm_roads.geojson"
    if not roads_file.exists():
        raise HTTPException(
            status_code=404,
            detail="OSM roads data not yet ingested. Trigger OSM ingestion first."
        )

    with open(roads_file, "r", encoding="utf-8") as f:
        roads_fc = json.load(f)

    _, stats = gis_engine.build_road_network(roads_fc)
    return stats

@router.get("/settlement-isolation")
def get_settlement_isolation():
    """Calculates isolation metrics and nearest road distance for all settlements in the active AOI"""
    settlements_file = GEOJSON_DIR / "osm_settlements.geojson"
    roads_file = GEOJSON_DIR / "osm_roads.geojson"
    waterways_file = GEOJSON_DIR / "osm_waterways.geojson"

    if not settlements_file.exists() or not roads_file.exists():
        raise HTTPException(
            status_code=404,
            detail="OSM settlements or roads not yet ingested. Trigger OSM ingestion first."
        )

    with open(settlements_file, "r", encoding="utf-8") as f:
        settlements_fc = json.load(f)
    with open(roads_file, "r", encoding="utf-8") as f:
        roads_fc = json.load(f)

    waterways_fc = None
    if waterways_file.exists():
        with open(waterways_file, "r", encoding="utf-8") as f:
            waterways_fc = json.load(f)

    isolation_results = gis_engine.calculate_settlement_isolation(
        settlements_geojson=settlements_fc,
        roads_geojson=roads_fc,
        waterways_geojson=waterways_fc
    )
    return {
        "settlements_count": len(isolation_results),
        "critical_isolation_count": sum(1 for s in isolation_results if s["isolation_level"] == "CRITICAL"),
        "high_isolation_count": sum(1 for s in isolation_results if s["isolation_level"] == "HIGH"),
        "moderate_isolation_count": sum(1 for s in isolation_results if s["isolation_level"] == "MODERATE"),
        "low_isolation_count": sum(1 for s in isolation_results if s["isolation_level"] == "LOW"),
        "settlements": isolation_results,
    }

@router.get("/elevation-profile")
def get_elevation_profile():
    """Returns the SRTM/Copernicus DEM elevation transect across the Teesta valley"""
    ele_file = METADATA_DIR / "elevation_profile.json"
    if not ele_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Elevation profile not yet ingested. Trigger SRTM ingestion first."
        )
    with open(ele_file, "r", encoding="utf-8") as f:
        return json.load(f)
