"""
SRTM / Copernicus DEM Elevation Service
Queries Open-Meteo Global Elevation API (Copernicus 90m DEM) for real elevation profiles
and settlement elevations across the Teesta River basin.
Zero fabricated data: fetches true digital elevation values only.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

from app.config import METADATA_DIR, REQUEST_TIMEOUT, USER_AGENT
from app.engines.metadata_engine import metadata_engine
from app.models.aoi import BoundingBox
from app.models.ingestion import DataAttribution, IngestionState, ServiceStatus
from app.services.base import BaseDataService

logger = logging.getLogger(__name__)

OPEN_METEO_ELEVATION_API = "https://api.open-meteo.com/v1/elevation"

class SRTMService(BaseDataService):
    def __init__(self):
        super().__init__(
            service_id="srtm",
            service_name="SRTM / Copernicus Digital Elevation Service",
            category="Topography & DEM"
        )
        self.cache_file = METADATA_DIR / "elevation_profile.json"

    def get_attribution(self) -> DataAttribution:
        return DataAttribution(
            service_id="srtm",
            service_name="Copernicus DEM GLO-90 / NASA SRTM",
            provider="European Space Agency (ESA) & NASA JPL",
            citation="Copernicus DEM 90m global elevation model / Open-Meteo Elevation API",
            license="Copernicus Open Access / Public Domain",
            license_url="https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model",
            documentation_url="https://open-meteo.com/en/docs/elevation-api",
            terms_of_use="Free open-access digital elevation data"
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
                api_endpoint=OPEN_METEO_ELEVATION_API,
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
            api_endpoint=OPEN_METEO_ELEVATION_API,
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
        Fetches real elevation sampling grid along the Teesta valley corridor.
        Samples 10 latitude transects from South to North along the river longitude.
        """
        import time
        job_id = f"srtm_{int(time.time())}_{int(bbox.min_lat*100)}"
        metadata_engine.start_ingestion_job(job_id, self.service_id, "active_aoi")

        # Sample 10 points along the central corridor
        lats = []
        lons = []
        steps = 10
        center_lon = bbox.center()[1]
        for i in range(steps):
            lat = bbox.min_lat + (bbox.max_lat - bbox.min_lat) * (i / (steps - 1))
            lats.append(round(lat, 4))
            lons.append(round(center_lon, 4))

        lat_param = ",".join(str(l) for l in lats)
        lon_param = ",".join(str(l) for l in lons)

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.get(
                    OPEN_METEO_ELEVATION_API,
                    params={"latitude": lat_param, "longitude": lon_param},
                    headers={"User-Agent": USER_AGENT}
                )
                if resp.status_code != 200:
                    raise Exception(f"Elevation API returned HTTP {resp.status_code}")
                result = resp.json()

            elevations = result.get("elevation", [])
            profile = []
            for i in range(len(lats)):
                profile.append({
                    "latitude": lats[i],
                    "longitude": lons[i],
                    "elevation_m": elevations[i] if i < len(elevations) else None,
                    "section": f"Transect {i+1} ({'Plains' if lats[i] < 26.8 else 'Himalayan Gorge' if lats[i] < 27.3 else 'High Alpine'})"
                })

            import json
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump({"profile": profile, "bbox": bbox.model_dump()}, f, indent=2)

            min_ele = min([e for e in elevations if e is not None], default=0)
            max_ele = max([e for e in elevations if e is not None], default=0)

            metadata_engine.finish_ingestion_job(job_id, IngestionState.AVAILABLE, items_count=len(profile))
            metadata_engine.update_service_state(
                self.service_id, IngestionState.AVAILABLE, is_available=True,
                feature_count=len(profile),
                metadata={
                    "min_elevation_m": min_ele,
                    "max_elevation_m": max_ele,
                    "elevation_range_m": max_ele - min_ele,
                    "sample_points": len(profile)
                }
            )

            return {
                "success": True,
                "profile": profile,
                "min_elevation_m": min_ele,
                "max_elevation_m": max_ele,
                "state": IngestionState.AVAILABLE.value
            }

        except Exception as e:
            err = f"Real DEM elevation fetch failed: {str(e)}. No fabricated elevations substituted."
            metadata_engine.finish_ingestion_job(job_id, IngestionState.ERROR, error_message=err)
            metadata_engine.update_service_state(
                self.service_id, IngestionState.ERROR, is_available=False, last_error=err
            )
            return {
                "success": False,
                "error": err,
                "state": IngestionState.ERROR.value
            }

srtm_service = SRTMService()
