"""
Copernicus Sentinel-2 MSI Optical Ingestion Service
Queries STAC API for real Sentinel-2 Level-2A surface reflectance granules.
Zero fabricated observations: inspects true multi-spectral imagery scenes only.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
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

class Sentinel2Service(BaseDataService):
    def __init__(self):
        super().__init__(
            service_id="sentinel2",
            service_name="Copernicus Sentinel-2 MSI Service",
            category="Multi-Spectral Optical Imagery"
        )
        self.cache_file = METADATA_DIR / "sentinel2_scenes.json"

    def get_attribution(self) -> DataAttribution:
        return DataAttribution(
            service_id="sentinel2",
            service_name="Copernicus Sentinel-2",
            provider="European Space Agency (ESA) / Copernicus Programme",
            citation="Contains modified Copernicus Sentinel data [2023-2026] / processed via STAC Earth Search",
            license="Copernicus Open Access / Creative Commons CC-BY-SA 3.0 IGO",
            license_url="https://sentinels.copernicus.eu/web/sentinel/terms-conditions",
            documentation_url="https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2",
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
        Queries STAC for real Sentinel-2 L2A granules with cloud coverage over the AOI bbox.
        """
        import time
        job_id = f"s2_{int(time.time())}_{int(bbox.min_lat*100)}"
        metadata_engine.start_ingestion_job(job_id, self.service_id, "active_aoi")

        payload = {
            "bbox": [bbox.min_lon, bbox.min_lat, bbox.max_lon, bbox.max_lat],
            "collections": ["sentinel-2-l2a"],
            "limit": 10,
            "query": {
                "eo:cloud_cover": {"lt": 50}
            }
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
                    logger.info(f"Querying Sentinel-2 STAC: {endpoint}")
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
                "error": f"Failed to retrieve real Sentinel-2 scenes: {last_error}. No fake scenes generated.",
                "state": IngestionState.ERROR.value
            }

        features = data.get("features", [])
        scenes = []
        for feat in features:
            props = feat.get("properties", {})
            assets = feat.get("assets", {})
            geom = feat.get("geometry", {})

            thumb = None
            if "thumbnail" in assets:
                thumb = assets["thumbnail"].get("href")
            elif "rendered_preview" in assets:
                thumb = assets["rendered_preview"].get("href")
            elif "visual" in assets:
                thumb = assets["visual"].get("href")

            cloud_cover = props.get("eo:cloud_cover")

            scene = SentinelScene(
                id=feat.get("id"),
                constellation="Sentinel-2",
                platform=props.get("platform", "Sentinel-2A"),
                instrument="MSI",
                acquisition_date=props.get("datetime") or "Unknown",
                cloud_coverage_percent=round(cloud_cover, 1) if cloud_cover is not None else None,
                tile_id=props.get("grid:code") or props.get("s2:mgrs_tile"),
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
                "cloud_cover_min": min([s["cloud_coverage_percent"] for s in scenes if s["cloud_coverage_percent"] is not None], default=None)
            }
        )

        return {
            "success": True,
            "scenes": scenes,
            "scene_count": len(scenes),
            "state": IngestionState.AVAILABLE.value
        }

sentinel2_service = Sentinel2Service()
