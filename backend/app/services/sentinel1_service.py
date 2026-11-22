"""
Copernicus Sentinel-1 SAR Ingestion Service
Queries STAC API (Earth Search / Element84 / Planetary Computer) for real Sentinel-1 C-SAR GRD scenes.
Zero fabricated observations: inspects true satellite acquisitions only.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.config import METADATA_DIR, REQUEST_TIMEOUT, USER_AGENT
from app.engines.metadata_engine import metadata_engine
from app.models.aoi import BoundingBox
from app.models.ingestion import DataAttribution, IngestionState, ServiceStatus
from app.models.satellite import SentinelScene
from app.services.base import BaseDataService

logger = logging.getLogger(__name__)

STAC_ENDPOINTS = [
    "https://earth-search.aws.element84.com/v1/search",
    "https://planetarycomputer.microsoft.com/api/stac/v1/search",
]

class Sentinel1Service(BaseDataService):
    def __init__(self):
        super().__init__(
            service_id="sentinel1",
            service_name="Copernicus Sentinel-1 SAR Service",
            category="Synthetic Aperture Radar (SAR)"
        )
        self.cache_file = METADATA_DIR / "sentinel1_scenes.json"

    def get_attribution(self) -> DataAttribution:
        return DataAttribution(
            service_id="sentinel1",
            service_name="Copernicus Sentinel-1",
            provider="European Space Agency (ESA) / Copernicus Programme",
            citation="Contains modified Copernicus Sentinel data [2023-2026] / processed via STAC Earth Search",
            license="Copernicus Open Access / Creative Commons CC-BY-SA 3.0 IGO",
            license_url="https://sentinels.copernicus.eu/web/sentinel/terms-conditions",
            documentation_url="https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-1",
            terms_of_use="Free, full, and open access for public, scientific, and commercial purposes with credit to Copernicus"
        )

    def get_status(self) -> ServiceStatus:
        saved_state = metadata_engine.get_service_state(self.service_id)
        if saved_state:
            state = IngestionState(saved_state["state"])
            return ServiceStatus(
                service_id=self.service_id,
                service_name=self.service_name,
                category=self.category,
                state=state,
                is_available=bool(saved_state["is_available"]),
                feature_count=saved_state.get("feature_count", 0),
                last_fetched_at=saved_state.get("last_fetched_at"),
                last_error=saved_state.get("last_error"),
                attribution=self.get_attribution(),
                metadata=saved_state.get("metadata", {}),
                api_endpoint="https://earth-search.aws.element84.com/v1/search",
                requires_auth=False
            )
        return ServiceStatus(
            service_id=self.service_id,
            service_name=self.service_name,
            category=self.category,
            state=IngestionState.IDLE,
            is_available=False,
            feature_count=0,
            attribution=self.get_attribution(),
            api_endpoint="https://earth-search.aws.element84.com/v1/search",
            requires_auth=False
        )

    def clear_cache(self) -> bool:
        if self.cache_file.exists():
            self.cache_file.unlink()
        metadata_engine.update_service_state(
            self.service_id, IngestionState.IDLE, is_available=False, feature_count=0
        )
        return True

    async def fetch_data(self, bbox: BoundingBox) -> Dict[str, Any]:
        """
        Queries STAC for real Sentinel-1 GRD acquisitions over the AOI bbox.
        """
        import time
        job_id = f"s1_{int(time.time())}_{int(bbox.min_lat*100)}"
        metadata_engine.start_ingestion_job(job_id, self.service_id, "active_aoi")

        payload = {
            "bbox": [bbox.min_lon, bbox.min_lat, bbox.max_lon, bbox.max_lat],
            "collections": ["sentinel-1-grd"],
            "limit": 10,
        }

        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json"
        }

        last_error = None
        data = None

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            for endpoint in STAC_ENDPOINTS:
                try:
                    logger.info(f"Querying Sentinel-1 STAC: {endpoint}")
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        break
                    else:
                        last_error = f"HTTP {resp.status_code} from {endpoint}"
                except Exception as e:
                    last_error = f"STAC query failed ({endpoint}): {str(e)}"

        if data is None or "features" not in data:
            metadata_engine.finish_ingestion_job(job_id, IngestionState.ERROR, error_message=last_error)
            metadata_engine.update_service_state(
                self.service_id, IngestionState.ERROR, is_available=False, last_error=last_error
            )
            return {
                "success": False,
                "error": f"Failed to retrieve real Sentinel-1 scenes: {last_error}. No fake scenes generated.",
                "state": IngestionState.ERROR.value
            }

        features = data.get("features", [])
        scenes = []
        for feat in features:
            props = feat.get("properties", {})
            assets = feat.get("assets", {})
            geom = feat.get("geometry", {})
            
            # Extract real thumbnail / preview if available
            thumb = None
            if "thumbnail" in assets:
                thumb = assets["thumbnail"].get("href")
            elif "rendered_preview" in assets:
                thumb = assets["rendered_preview"].get("href")

            # Extract polarizations
            pol = props.get("sar:polarizations") or props.get("polarizations") or ["VV", "VH"]

            scene = SentinelScene(
                id=feat.get("id"),
                constellation="Sentinel-1",
                platform=props.get("platform", "Sentinel-1A"),
                instrument=props.get("instruments", ["C-SAR"])[0] if isinstance(props.get("instruments"), list) else "C-SAR",
                acquisition_date=props.get("datetime") or props.get("start_datetime") or "Unknown",
                orbit_direction=props.get("sat:orbit_state", "DESCENDING").upper(),
                relative_orbit=props.get("sat:relative_orbit"),
                polarization=pol if isinstance(pol, list) else [pol],
                bounds=feat.get("bbox") or [bbox.min_lat, bbox.min_lon, bbox.max_lat, bbox.max_lon],
                footprint_geojson=geom,
                thumbnail_url=thumb,
                stac_item_url=feat.get("links", [{}])[0].get("href"),
                source_catalog="AWS Earth Search / Element84"
            )
            scenes.append(scene.model_dump())

        with open(self.cache_file, "w", encoding="utf-8") as f:
            json.dump({"scenes": scenes, "total": len(scenes)}, f, indent=2)

        metadata_engine.finish_ingestion_job(job_id, IngestionState.AVAILABLE, items_count=len(scenes))
        metadata_engine.update_service_state(
            self.service_id, IngestionState.AVAILABLE, is_available=True,
            feature_count=len(scenes),
            metadata={
                "scene_count": len(scenes),
                "latest_acquisition": scenes[0]["acquisition_date"] if scenes else None,
                "satellite_mode": "Interferometric Wide Swath (IW)",
            }
        )

        return {
            "success": True,
            "scenes": scenes,
            "scene_count": len(scenes),
            "state": IngestionState.AVAILABLE.value
        }

    def ingest_authentic_sar_pairs(self, aoi_bounds: Tuple[float, float, float, float] = (88.25, 26.50, 88.85, 27.75)) -> List[Path]:
        """
        Downloads and clips authentic pre-event and post-event Sentinel-1 IW VV GeoTIFFs
        from Microsoft Planetary Computer STAC for the Teesta Basin corridor.
        """
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
        from ingest_sar_live import TARGET_SCENES, fetch_and_clip_sar_scene
        results = []
        for s in TARGET_SCENES:
            p = fetch_and_clip_sar_scene(s)
            results.append(p)
        return results

sentinel1_service = Sentinel1Service()
