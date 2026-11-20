"""
GeoJSON and Layer Metadata Models
"""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field

class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: Any

class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    id: Optional[Union[str, int]] = None
    geometry: Optional[GeoJSONGeometry] = None
    properties: Dict[str, Any] = Field(default_factory=dict)

class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None

class LayerMetadata(BaseModel):
    layer_key: str
    layer_name: str
    category: str  # "roads", "settlements", "waterways", "aoi", "sensors"
    data_source: str
    attribution: str
    feature_count: int
    geometry_type: Optional[str] = None
    bounds: Optional[List[float]] = None  # [min_lat, min_lon, max_lat, max_lon]
    file_path: Optional[str] = None
    updated_at: Optional[str] = None
    is_available: bool = False
    status_message: str = "Awaiting ingestion"
