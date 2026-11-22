"""
Satellite Observation and Raster Processing Models
Copernicus Sentinel-1 SAR and Sentinel-2 L2A
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class SceneProcessingStatus(str, Enum):
    DISCOVERED = "Discovered"
    DOWNLOADED = "Downloaded"
    PROCESSED = "Processed"
    FAILED = "Failed"

class RasterRenderMode(str, Enum):
    TRUE_COLOR = "true_color"            # Sentinel-2 RGB (B04, B03, B02)
    NDWI = "ndwi"                        # Normalized Difference Water Index (B03, B08)
    CLOUD_MASK = "cloud_mask"            # Cloud and shadow mask
    SAR_CALIBRATED = "sar_calibrated"    # Sentinel-1 calibrated sigma0 dB backscatter
    SAR_WATER_MASK = "sar_water_mask"    # Filtered water mask (terrain shadow & permanent water excluded)

class SentinelScene(BaseModel):
    id: str
    constellation: str = "Sentinel-1"
    platform: str = "Sentinel-1A"
    instrument: str = "C-SAR"
    acquisition_date: str
    cloud_cover: Optional[float] = None
    orbit_direction: Optional[str] = None
    relative_orbit: Optional[int] = None
    polarization: Optional[List[str]] = None
    bounds: List[float] = Field(default_factory=list)
    footprint_geojson: Optional[Dict[str, Any]] = None
    thumbnail_url: Optional[str] = None
    stac_item_url: Optional[str] = None
    source_catalog: Optional[str] = None

class VIIRSObservation(BaseModel):
    timestamp: str
    lunar_phase: str
    lunar_illumination_percent: float
    satellite_platform: str
    radiance_units: str = "nW/(cm^2*sr)"
    auth_status: str

class SatelliteSearchQuery(BaseModel):
    min_lat: float = Field(..., ge=-90, le=90)
    min_lon: float = Field(..., ge=-180, le=180)
    max_lat: float = Field(..., ge=-90, le=90)
    max_lon: float = Field(..., ge=-180, le=180)
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format")
    mission: Optional[str] = Field("all", description="'all', 'Sentinel-1', or 'Sentinel-2'")
    max_cloud_cover: Optional[float] = Field(50.0, ge=0, le=100)
    limit: Optional[int] = Field(15, ge=1, le=50)

class RasterSceneRecord(BaseModel):
    id: str
    mission: str  # "Sentinel-1" or "Sentinel-2"
    platform: str # "Sentinel-1A", "Sentinel-2B", etc.
    instrument: str # "C-SAR" or "MSI"
    product_id: str
    acquisition_date: str
    cloud_cover: Optional[float] = None
    orbit_direction: Optional[str] = None
    relative_orbit: Optional[int] = None
    polarization: Optional[List[str]] = None
    tile_id: Optional[str] = None
    bounds: List[float] = Field(default_factory=list) # [south, west, north, east]
    status: SceneProcessingStatus = SceneProcessingStatus.DISCOVERED
    status_message: Optional[str] = None
    crs: Optional[str] = None
    resolution_m: Optional[float] = None
    geotiff_path: Optional[str] = None
    thumbnail_url: Optional[str] = None
    has_local_raster: bool = False
    assets: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RasterImportRequest(BaseModel):
    mission: str = Field(..., description="'Sentinel-1' or 'Sentinel-2'")
    file_path: str = Field(..., description="Absolute or relative path to GeoTIFF file")
    product_id: Optional[str] = None
    acquisition_date: Optional[str] = None
    cloud_cover: Optional[float] = None

class BeforeAfterComparison(BaseModel):
    before_scene_id: str
    after_scene_id: str
    comparison_mode: str = "split" # "split" or "toggle"
    opacity: float = Field(1.0, ge=0.0, le=1.0)
    render_mode: RasterRenderMode = RasterRenderMode.TRUE_COLOR
