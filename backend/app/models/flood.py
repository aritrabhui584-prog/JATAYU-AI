"""
JATAYU AI - Flood Analysis & Terrain Models
Covers observed historical flood extent, DEM terrain & slope analysis,
and hypothetical water level scenario models.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class FloodExtentType(str, Enum):
    OBSERVED_HISTORICAL = "Observed Historical"   # Real satellite radar/optical observations
    MODELLED_SCENARIO = "Modelled Scenario"       # Topographic stage simulation (DEM elevation capacity)
    PREDICTED_FUTURE = "Predicted Future"         # Hydrometeorological forecast (GloFAS / ECMWF)

class FloodAnalysisParams(BaseModel):
    post_event_scene_id: str
    pre_event_scene_id: Optional[str] = None
    backscatter_threshold_db: float = Field(-16.0, ge=-25.0, le=-10.0, description="Radar water threshold in dB")
    change_threshold_db: float = Field(-3.0, ge=-10.0, le=0.0, description="Backscatter drop threshold in dB")
    slope_max_degrees: float = Field(8.0, ge=1.0, le=25.0, description="Max terrain slope for flood accumulation")
    elevation_max_m: float = Field(1200.0, ge=50.0, le=4000.0, description="Max elevation cutoff for floodplain")
    min_patch_pixels: int = Field(5, ge=1, le=50, description="Minimum patch size to suppress speckle noise")

class ScenarioAnalysisParams(BaseModel):
    stage_rise_m: float = Field(3.0, ge=0.5, le=15.0, description="Hypothetical river stage rise in meters above normal")
    aoi_id: Optional[str] = None

class InundatedSettlement(BaseModel):
    name: str
    place_type: str
    latitude: float
    longitude: float
    elevation_m: float
    population: Optional[int] = None
    water_proximity_m: float
    is_directly_flooded: bool
    flood_depth_proxy_m: Optional[float] = None
    isolation_level: str

class SubmergedRoadSegment(BaseModel):
    osm_id: str
    name: str
    highway: str
    submerged_length_km: float
    total_length_km: float
    submerged_fraction: float
    is_trunk_artery: bool  # True for NH10 or primary arteries
    coordinates: List[List[float]] = Field(default_factory=list)

class TerrainAnalysisResult(BaseModel):
    min_elevation_m: float
    max_elevation_m: float
    mean_elevation_m: float
    median_elevation_m: float
    elevation_range_m: float
    mean_slope_degrees: float
    max_slope_degrees: float
    flat_terrain_percent: float     # < 5 degrees
    moderate_terrain_percent: float # 5 - 15 degrees
    steep_terrain_percent: float    # > 15 degrees
    hypsometry_histogram: Dict[str, int] = Field(default_factory=dict)
    bounds: List[float] = Field(default_factory=list)
    render_urls: Dict[str, str] = Field(default_factory=dict)

class FloodAnalysisResult(BaseModel):
    id: str
    extent_type: FloodExtentType
    timestamp: str
    aoi_id: str
    bounds: List[float] # [south, west, north, east]
    total_aoi_area_sqkm: float
    permanent_water_area_sqkm: float
    flood_inundation_area_sqkm: float
    terrain_shadow_area_sqkm: float
    inundated_settlements_count: int
    submerged_roads_length_km: float
    affected_population_estimate: int
    severed_arteries_count: int
    disclaimer: str
    parameters: Dict[str, Any]
    inundated_settlements: List[InundatedSettlement] = Field(default_factory=list)
    submerged_roads: List[SubmergedRoadSegment] = Field(default_factory=list)
    geotiff_path: Optional[str] = None
    geojson_path: Optional[str] = None
    render_url: str
