"""
NASA VIIRS Black Marble VNP46A2 Night-Light Intelligence Models
Phase 5: BRDF-Corrected Radiance, Quality Masking, Multi-Temporal Baseline,
Percentage Reduction, Spatial Clustering, and 500m Resolution Accounting.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class VIIRSObservationMetadata(BaseModel):
    scene_id: str
    date: str  # YYYY-MM-DD
    julian_day: str  # AYYYYJJJ
    orbit_type: str = "Nighttime VIIRS DNB (Suomi-NPP / NOAA-20)"
    tile: str = "h26v06"
    bounds: List[float]  # [south, west, north, east]
    total_pixels: int
    valid_pixels: int
    cloud_pixels: int
    poor_quality_pixels: int
    fill_pixels: int
    mean_radiance: float
    hdf5_path: str

class NightlightAnalysisParams(BaseModel):
    pre_event_dates: Optional[List[str]] = Field(
        default=None,
        description="List of pre-event dates (YYYY-MM-DD) for multi-temporal baseline calculation."
    )
    post_event_date: Optional[str] = Field(
        default=None,
        description="Single post-event date (YYYY-MM-DD) to evaluate for light reduction."
    )
    min_valid_baseline_obs: int = Field(
        default=2,
        ge=1,
        le=10,
        description="Minimum number of cloud-free, high-quality observations required per pixel to establish baseline."
    )
    radiance_reduction_threshold_pct: float = Field(
        default=40.0,
        ge=15.0,
        le=95.0,
        description="Percentage reduction in BRDF radiance (relative to baseline) to flag as significant anomaly."
    )
    min_absolute_drop_nw: float = Field(
        default=2.5,
        ge=0.5,
        le=50.0,
        description="Minimum absolute drop in radiance (nW/(cm^2 sr)) to exclude dark noise/forest flicker."
    )
    min_cluster_pixels: int = Field(
        default=3,
        ge=1,
        le=50,
        description="Minimum contiguous 500m pixels (~0.22 sq km each) required to form a statistically significant disruption cluster."
    )
    exclude_cloud_pixels: bool = Field(
        default=True,
        description="Strictly exclude cloudy and poor-quality pixels from analysis (prevents false blackouts)."
    )

class SpatialCluster(BaseModel):
    cluster_id: int
    pixel_count: int
    area_sqkm: float
    centroid_lat: float
    centroid_lon: float
    mean_baseline_radiance: float
    mean_post_radiance: float
    mean_radiance_drop_pct: float
    approximate_region: str
    spatial_resolution_note: str = "VIIRS 15 arc-sec (~500m) sensor resolution footprint"
    coordinates_bbox: List[float] = Field(default_factory=list)

class NightlightAnalysisResult(BaseModel):
    id: str
    timestamp: str
    aoi_id: str
    bounds: List[float]
    spatial_resolution_m: float = 500.0
    pre_event_dates: List[str]
    post_event_date: str
    total_pixels: int
    valid_baseline_pixels: int
    valid_post_pixels: int
    cloud_obscured_pixels: int
    invalid_observation_pixels: int
    unlit_background_pixels: int
    significant_reduction_pixels: int
    reduction_area_sqkm: float
    clusters_count: int
    clusters: List[SpatialCluster]
    observation_metadata: List[VIIRSObservationMetadata]
    scientific_disclaimer: str
    parameters: Dict[str, Any]
    geotiff_path: Optional[str] = None
    render_url: str
    geojson_export_url: str
