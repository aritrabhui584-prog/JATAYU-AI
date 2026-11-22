"""
Geospatial Layers API Endpoints
Returns real GeoJSON vector layers and layer metadata.
"""

import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from typing import List
from app.config import GEOJSON_DIR
from app.engines.aoi_engine import aoi_engine
from app.engines.metadata_engine import metadata_engine
from app.models.geojson import LayerMetadata

router = APIRouter(prefix="/layers", tags=["Geospatial Layers"])

@router.get("", response_model=List[LayerMetadata])
def list_layers():
    """Returns metadata for all available geospatial layers"""
    layers = metadata_engine.get_all_layer_metadata()
    # Add active AOI layer metadata dynamically
    aoi = aoi_engine.get_active_aoi()
    aoi_meta = {
        "layer_key": "aoi_corridor",
        "layer_name": f"AOI: {aoi.name}",
        "category": "aoi",
        "data_source": "Jatayu AOI Engine",
        "attribution": "JATAYU AI Project Bounding Box",
        "feature_count": 1,
        "geometry_type": "Polygon",
        "bounds": [aoi.bbox.min_lat, aoi.bbox.min_lon, aoi.bbox.max_lat, aoi.bbox.max_lon],
        "is_available": True,
        "status_message": f"Active area: {aoi.bbox.area_approx_sqkm():.1f} sq km"
    }
    
    result = [LayerMetadata(**aoi_meta)]
    for l in layers:
        result.append(LayerMetadata(**l))
    return result

@router.get("/{layer_key}")
def get_layer_geojson(layer_key: str):
    """Returns the GeoJSON FeatureCollection for the specified layer key"""
    if layer_key == "aoi_corridor":
        return {
            "type": "FeatureCollection",
            "features": [aoi_engine.get_aoi_geojson()]
        }

    file_map = {
        "osm_roads": GEOJSON_DIR / "osm_roads.geojson",
        "osm_settlements": GEOJSON_DIR / "osm_settlements.geojson",
        "osm_waterways": GEOJSON_DIR / "osm_waterways.geojson",
        "osm_facilities": GEOJSON_DIR / "osm_facilities.geojson",
        "osm_railways": GEOJSON_DIR / "osm_railways.geojson",
        "hlz_landing_zones": GEOJSON_DIR / "hlz_landing_zones.geojson",
    }

    if layer_key == "hlz_landing_zones":
        from app.engines.terrain_engine import terrain_engine
        return terrain_engine.detect_helicopter_landing_zones()

    target_file = file_map.get(layer_key)
    if not target_file:
        raise HTTPException(status_code=404, detail=f"Layer '{layer_key}' not found.")

    if not target_file.exists():
        raise HTTPException(
            status_code=404, 
            detail=f"Layer '{layer_key}' has not been ingested yet. Please trigger OSM ingestion in the Ingestion panel."
        )

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read layer GeoJSON: {str(e)}")
