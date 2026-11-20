"""
AOI Engine - Area of Interest Management and Coordinate Validation
"""

from typing import List, Optional
from app.config import AOI_PRESETS, DEFAULT_AOI
from app.models.aoi import AOIConfig, AOIPreset, BoundingBox
from app.engines.metadata_engine import metadata_engine

class AOIEngine:
    def __init__(self):
        pass

    def get_presets(self) -> List[AOIPreset]:
        return AOI_PRESETS

    def get_active_aoi(self) -> AOIConfig:
        row = metadata_engine.get_active_aoi()
        bbox = BoundingBox(
            min_lat=row["min_lat"],
            min_lon=row["min_lon"],
            max_lat=row["max_lat"],
            max_lon=row["max_lon"],
        )
        return AOIConfig(
            id=row["id"],
            name=row["name"],
            bbox=bbox,
            created_at=row.get("created_at")
        )

    def set_active_aoi(self, aoi_id: str, name: str, bbox: BoundingBox) -> AOIConfig:
        metadata_engine.set_active_aoi(
            aoi_id=aoi_id,
            name=name,
            min_lat=bbox.min_lat,
            min_lon=bbox.min_lon,
            max_lat=bbox.max_lat,
            max_lon=bbox.max_lon,
        )
        return self.get_active_aoi()

    def set_preset_aoi(self, preset_id: str) -> AOIConfig:
        matched = next((p for p in AOI_PRESETS if p.id == preset_id), None)
        if not matched:
            raise ValueError(f"Preset AOI with id '{preset_id}' not found.")
        bbox = BoundingBox(
            min_lat=matched.min_lat,
            min_lon=matched.min_lon,
            max_lat=matched.max_lat,
            max_lon=matched.max_lon,
        )
        return self.set_active_aoi(aoi_id=matched.id, name=matched.name, bbox=bbox)

    def validate_coordinates(self, lat: float, lon: float) -> bool:
        """Validate if coordinates are within valid WGS84 range"""
        return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0

    def get_aoi_geojson(self) -> dict:
        """Returns standard GeoJSON Feature for the active AOI bounding box"""
        aoi = self.get_active_aoi()
        return {
            "type": "Feature",
            "properties": {
                "id": aoi.id,
                "name": aoi.name,
                "min_lat": aoi.bbox.min_lat,
                "min_lon": aoi.bbox.min_lon,
                "max_lat": aoi.bbox.max_lat,
                "max_lon": aoi.bbox.max_lon,
                "area_approx_sqkm": round(aoi.bbox.area_approx_sqkm(), 2),
                "center_lat": round(aoi.bbox.center()[0], 4),
                "center_lon": round(aoi.bbox.center()[1], 4),
            },
            "geometry": aoi.bbox.as_geojson_polygon()
        }

aoi_engine = AOIEngine()
