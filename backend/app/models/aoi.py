"""
AOI (Area of Interest) Models and Bounding Box Validation
"""

from typing import List, Optional
from pydantic import BaseModel, Field, model_validator

class BoundingBox(BaseModel):
    min_lat: float = Field(..., ge=-90, le=90, description="Minimum latitude (South)")
    min_lon: float = Field(..., ge=-180, le=180, description="Minimum longitude (West)")
    max_lat: float = Field(..., ge=-90, le=90, description="Maximum latitude (North)")
    max_lon: float = Field(..., ge=-180, le=180, description="Maximum longitude (East)")

    @model_validator(mode="after")
    def validate_bounds(self) -> "BoundingBox":
        if self.min_lat >= self.max_lat:
            raise ValueError(f"min_lat ({self.min_lat}) must be less than max_lat ({self.max_lat})")
        if self.min_lon >= self.max_lon:
            raise ValueError(f"min_lon ({self.min_lon}) must be less than max_lon ({self.max_lon})")
        return self

    def as_overpass_bbox(self) -> str:
        """Returns bbox string format for Overpass API: (south, west, north, east)"""
        return f"{self.min_lat},{self.min_lon},{self.max_lat},{self.max_lon}"

    def as_geojson_polygon(self) -> dict:
        """Returns standard GeoJSON Polygon geometry coordinates [lon, lat]"""
        return {
            "type": "Polygon",
            "coordinates": [[
                [self.min_lon, self.min_lat],
                [self.max_lon, self.min_lat],
                [self.max_lon, self.max_lat],
                [self.min_lon, self.max_lat],
                [self.min_lon, self.min_lat],
            ]]
        }

    def center(self) -> tuple[float, float]:
        """Returns (center_lat, center_lon)"""
        return ((self.min_lat + self.max_lat) / 2.0, (self.min_lon + self.max_lon) / 2.0)

    def area_approx_sqkm(self) -> float:
        """Approximate area in square km for sanity check"""
        import math
        lat_dist = (self.max_lat - self.min_lat) * 111.0
        avg_lat = (self.min_lat + self.max_lat) / 2.0
        lon_dist = (self.max_lon - self.min_lon) * 111.0 * math.cos(math.radians(avg_lat))
        return abs(lat_dist * lon_dist)

class AOIPreset(BaseModel):
    id: str
    name: str
    description: str
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float

    def as_overpass_bbox(self) -> str:
        return f"{self.min_lat},{self.min_lon},{self.max_lat},{self.max_lon}"

    def as_geojson_polygon(self) -> dict:
        return {
            "type": "Polygon",
            "coordinates": [[
                [self.min_lon, self.min_lat],
                [self.max_lon, self.min_lat],
                [self.max_lon, self.max_lat],
                [self.min_lon, self.max_lat],
                [self.min_lon, self.min_lat],
            ]]
        }

    def center(self) -> tuple[float, float]:
        return ((self.min_lat + self.max_lat) / 2.0, (self.min_lon + self.max_lon) / 2.0)

    def to_bounding_box(self) -> "BoundingBox":
        return BoundingBox(
            min_lat=self.min_lat,
            min_lon=self.min_lon,
            max_lat=self.max_lat,
            max_lon=self.max_lon,
        )

class AOIConfig(BaseModel):
    id: str = "custom"
    name: str = "Active Area of Interest"
    bbox: BoundingBox
    description: Optional[str] = None
    created_at: Optional[str] = None
