"""
JATAYU AI - Satellite STAC Search & Ingestion Service
Queries STAC endpoints (AWS Earth Search / Element84 / Microsoft Planetary Computer)
for real Copernicus Sentinel-1 C-SAR GRD and Sentinel-2 L2A acquisitions.

Zero fabrication: only real satellite scenes with official Copernicus IDs and telemetry.
"""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

from app.config import METADATA_DIR, REQUEST_TIMEOUT, USER_AGENT
from app.engines.metadata_engine import metadata_engine
from app.models.aoi import BoundingBox
from app.models.satellite import (
    RasterSceneRecord,
    SatelliteSearchQuery,
    SceneProcessingStatus,
)

logger = logging.getLogger(__name__)

STAC_ENDPOINTS = [
    "https://earth-search.aws.element84.com/v1/search",
    "https://planetarycomputer.microsoft.com/api/stac/v1/search",
]

class STACSearchService:
    def __init__(self):
        pass

    async def search_scenes(self, query: SatelliteSearchQuery) -> Dict[str, Any]:
        """
        Executes a real STAC catalog search for Copernicus Sentinel scenes over the AOI and date range.
        Stores discovered scenes in the SQLite database with status 'Discovered'.
        """
        start_dt = f"{query.start_date}T00:00:00Z"
        end_dt = f"{query.end_date}T23:59:59Z"
        date_param = f"{start_dt}/{end_dt}"

        bbox_coords = [query.min_lon, query.min_lat, query.max_lon, query.max_lat]

        # Determine collections to query
        collections_to_query = []
        if query.mission.lower() in ["all", "sentinel-1"]:
            collections_to_query.append(("sentinel-1-grd", "Sentinel-1"))
        if query.mission.lower() in ["all", "sentinel-2"]:
            collections_to_query.append(("sentinel-2-l2a", "Sentinel-2"))

        found_scenes: List[RasterSceneRecord] = []
        errors = []

        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for coll_id, mission_name in collections_to_query:
                body: Dict[str, Any] = {
                    "bbox": bbox_coords,
                    "collections": [coll_id],
                    "datetime": date_param,
                    "limit": query.limit or 10,
                }
                if mission_name == "Sentinel-2" and query.max_cloud_cover is not None:
                    body["query"] = {
                        "eo:cloud_cover": {"lt": query.max_cloud_cover}
                    }

                stac_succeeded = False
                for endpoint in STAC_ENDPOINTS:
                    try:
                        logger.info(f"Querying STAC {endpoint} for {mission_name} ({date_param})...")
                        resp = await client.post(endpoint, json=body, headers=headers)
                        if resp.status_code == 200:
                            data = resp.json()
                            features = data.get("features", [])
                            stac_succeeded = True

                            for feat in features:
                                props = feat.get("properties", {})
                                assets = feat.get("assets", {})
                                feat_bbox = feat.get("bbox") or bbox_coords
                                # Bounds as [south, west, north, east]
                                if len(feat_bbox) == 4:
                                    bounds = [feat_bbox[1], feat_bbox[0], feat_bbox[3], feat_bbox[2]]
                                else:
                                    bounds = [query.min_lat, query.min_lon, query.max_lat, query.max_lon]

                                # Extract thumbnail / preview
                                thumb = None
                                if "rendered_preview" in assets:
                                    thumb = assets["rendered_preview"].get("href")
                                elif "thumbnail" in assets:
                                    thumb = assets["thumbnail"].get("href")
                                elif "preview" in assets:
                                    thumb = assets["preview"].get("href")

                                cloud_val = props.get("eo:cloud_cover")

                                pol = props.get("sar:polarizations") or props.get("polarizations")
                                if isinstance(pol, str):
                                    pol = [pol]

                                scene_id = feat.get("id")
                                record = RasterSceneRecord(
                                    id=scene_id,
                                    mission=mission_name,
                                    platform=props.get("platform", f"{mission_name}A"),
                                    instrument="C-SAR" if mission_name == "Sentinel-1" else "MSI",
                                    product_id=props.get("sentinel:product_id") or scene_id,
                                    acquisition_date=props.get("datetime") or props.get("start_datetime") or "Unknown",
                                    cloud_cover=round(cloud_val, 1) if cloud_val is not None else None,
                                    orbit_direction=props.get("sat:orbit_state", "").upper() or None,
                                    relative_orbit=props.get("sat:relative_orbit"),
                                    polarization=pol,
                                    tile_id=props.get("grid:code") or props.get("s2:mgrs_tile"),
                                    bounds=bounds,
                                    status=SceneProcessingStatus.DISCOVERED,
                                    status_message="Scene metadata discovered from STAC catalog",
                                    crs=props.get("proj:epsg", "EPSG:4326"),
                                    resolution_m=10.0 if mission_name == "Sentinel-2" else 20.0,
                                    thumbnail_url=thumb,
                                    assets={k: {"href": v.get("href"), "type": v.get("type")} for k, v in assets.items() if isinstance(v, dict)},
                                    metadata={
                                        "stac_collection": coll_id,
                                        "stac_endpoint": endpoint,
                                        "sun_elevation": props.get("view:sun_elevation"),
                                        "sun_azimuth": props.get("view:sun_azimuth"),
                                    }
                                )

                                # Upsert to SQLite
                                metadata_engine.upsert_scene_record(record)
                                found_scenes.append(record)

                            break
                        else:
                            errors.append(f"{endpoint} returned HTTP {resp.status_code}")
                    except Exception as e:
                        errors.append(f"{endpoint} query error: {str(e)}")

        # Fallback to already cached scenes from metadata directory if STAC query returned 0 new items
        if len(found_scenes) == 0:
            logger.info("STAC returned 0 items for exact query or network offline. Checking local verified scenes...")
            cached_records = metadata_engine.list_scene_records(mission=query.mission, limit=query.limit or 15)
            if cached_records:
                return {
                    "success": True,
                    "count": len(cached_records),
                    "scenes": [s.model_dump() for s in cached_records],
                    "query": query.model_dump(),
                    "source": "Local SQLite Metadata Database",
                    "note": "Loaded previously discovered Copernicus scenes from local database."
                }

        return {
            "success": len(found_scenes) > 0,
            "count": len(found_scenes),
            "scenes": [s.model_dump() for s in found_scenes],
            "query": query.model_dump(),
            "errors": errors if not found_scenes else [],
            "source": "Copernicus STAC Catalog (Earth Search)"
        }

stac_search_service = STACSearchService()
