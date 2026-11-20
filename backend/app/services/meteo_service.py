"""
Open-Meteo Flood & Weather Ingestion Service
Queries Copernicus GloFAS (Global Flood Awareness System) river discharge
and ECMWF weather forecasts for actual stations along the Teesta River corridor.
Zero fabricated observations: fetches real live hydrometeorological telemetry.
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
from app.services.base import BaseDataService

logger = logging.getLogger(__name__)

OPEN_METEO_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# Key hydrological monitoring coordinates along the Teesta River
TEESTA_GAUGE_COORDINATES = [
    {"name": "Teesta - Upper Basin (Chungthang/Mangan)", "lat": 27.51, "lon": 88.53},
    {"name": "Teesta - Middle Valley (Singtam/Rangpo)", "lat": 27.20, "lon": 88.51},
    {"name": "Teesta - Foothills (Coronation Bridge, Sevoke)", "lat": 26.88, "lon": 88.47},
    {"name": "Teesta - Lower Floodplains (Jalpaiguri)", "lat": 26.52, "lon": 88.72},
]

class MeteoService(BaseDataService):
    def __init__(self):
        super().__init__(
            service_id="meteo",
            service_name="Open-Meteo Flood & Weather Service",
            category="Hydrometeorological & River Discharge Telemetry"
        )
        self.cache_file = METADATA_DIR / "meteo_observations.json"

    def get_attribution(self) -> DataAttribution:
        return DataAttribution(
            service_id="meteo",
            service_name="Open-Meteo & Copernicus GloFAS",
            provider="Open-Meteo GmbH & ECMWF (European Centre for Medium-Range Weather Forecasts)",
            citation="Copernicus Emergency Management Service GloFAS & ECMWF IFS numerical weather models via Open-Meteo API",
            license="Creative Commons Attribution 4.0 International (CC BY 4.0)",
            license_url="https://creativecommons.org/licenses/by/4.0/",
            documentation_url="https://open-meteo.com/en/docs/flood-api",
            terms_of_use="Free open-access weather and river flood discharge data with attribution"
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
                api_endpoint="https://flood-api.open-meteo.com/v1/flood",
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
            api_endpoint="https://flood-api.open-meteo.com/v1/flood",
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
        Fetches real GloFAS river discharge and real weather forecast for Teesta stations.
        """
        import time
        job_id = f"meteo_{int(time.time())}_{int(bbox.min_lat*100)}"
        metadata_engine.start_ingestion_job(job_id, self.service_id, "active_aoi")

        # Filter monitoring stations that fall within the AOI or near it
        stations = [
            s for s in TEESTA_GAUGE_COORDINATES
            if (bbox.min_lat - 0.2 <= s["lat"] <= bbox.max_lat + 0.2 and
                bbox.min_lon - 0.2 <= s["lon"] <= bbox.max_lon + 0.2)
        ]
        if not stations:
            # Fall back to center coordinate
            center_lat, center_lon = bbox.center()
            stations = [{"name": "Teesta Central AOI Gauge", "lat": round(center_lat, 2), "lon": round(center_lon, 2)}]

        gauges_data = []
        weather_data = []

        headers = {"User-Agent": USER_AGENT}

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                for st in stations:
                    # 1. Fetch GloFAS river discharge
                    flood_resp = await client.get(
                        OPEN_METEO_FLOOD_URL,
                        params={
                            "latitude": st["lat"],
                            "longitude": st["lon"],
                            "daily": "river_discharge,river_discharge_mean,river_discharge_max",
                            "forecast_days": 7,
                        },
                        headers=headers
                    )
                    discharge_series = []
                    if flood_resp.status_code == 200:
                        fd = flood_resp.json()
                        daily = fd.get("daily", {})
                        dates = daily.get("time", [])
                        discharges = daily.get("river_discharge", [])
                        means = daily.get("river_discharge_mean", [])
                        for d_idx in range(len(dates)):
                            discharge_series.append({
                                "date": dates[d_idx],
                                "discharge_m3s": discharges[d_idx] if d_idx < len(discharges) else None,
                                "mean_m3s": means[d_idx] if d_idx < len(means) else None,
                            })

                    gauges_data.append({
                        "station_name": st["name"],
                        "latitude": st["lat"],
                        "longitude": st["lon"],
                        "discharge_series": discharge_series,
                        "current_discharge_m3s": discharge_series[0]["discharge_m3s"] if discharge_series else None,
                        "river": "Teesta",
                    })

                    # 2. Fetch ECMWF weather
                    wx_resp = await client.get(
                        OPEN_METEO_WEATHER_URL,
                        params={
                            "latitude": st["lat"],
                            "longitude": st["lon"],
                            "current": "temperature_2m,relative_humidity_2m,precipitation,surface_pressure,wind_speed_10m",
                            "daily": "precipitation_sum,precipitation_probability_max",
                            "forecast_days": 7,
                        },
                        headers=headers
                    )
                    if wx_resp.status_code == 200:
                        wd = wx_resp.json()
                        cur = wd.get("current", {})
                        weather_data.append({
                            "station_name": st["name"],
                            "latitude": st["lat"],
                            "longitude": st["lon"],
                            "elevation_m": wd.get("elevation"),
                            "temperature_c": cur.get("temperature_2m"),
                            "relative_humidity_pct": cur.get("relative_humidity_2m"),
                            "precipitation_mm": cur.get("precipitation"),
                            "surface_pressure_hpa": cur.get("surface_pressure"),
                            "wind_speed_kmh": cur.get("wind_speed_10m"),
                            "timestamp": cur.get("time"),
                        })

            result = {
                "river_gauges": gauges_data,
                "weather_stations": weather_data,
                "aoi_bbox": bbox.model_dump()
            }

            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)

            total_items = len(gauges_data) + len(weather_data)
            metadata_engine.finish_ingestion_job(job_id, IngestionState.AVAILABLE, items_count=total_items)
            metadata_engine.update_service_state(
                self.service_id, IngestionState.AVAILABLE, is_available=True,
                feature_count=total_items,
                metadata={
                    "gauges_monitored": len(gauges_data),
                    "weather_stations": len(weather_data),
                    "latest_discharge_m3s": gauges_data[0].get("current_discharge_m3s") if gauges_data else None
                }
            )

            return {
                "success": True,
                "river_gauges": gauges_data,
                "weather_stations": weather_data,
                "state": IngestionState.AVAILABLE.value
            }

        except Exception as e:
            err = f"Failed to fetch real Open-Meteo flood/weather data: {str(e)}. No fabricated data generated."
            metadata_engine.finish_ingestion_job(job_id, IngestionState.ERROR, error_message=err)
            metadata_engine.update_service_state(
                self.service_id, IngestionState.ERROR, is_available=False, last_error=err
            )
            return {
                "success": False,
                "error": err,
                "state": IngestionState.ERROR.value
            }

meteo_service = MeteoService()
