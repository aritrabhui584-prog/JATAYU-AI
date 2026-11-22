"""
JATAYU AI - Emergency Priority Engine Models
Phase 6: Deterministic Multi-Criteria Decision Model for Settlement Prioritization.

Zero fabrication:
- Strict mathematical normalization (0-100) of real observational & topological inputs.
- Configurable weighted scoring model (Isolation 35%, Night-light 30%, Population 20%, Accessibility 15%).
- Independent confidence score separated from risk.
- Never describes a risk score as a confirmed emergency.
- Never fabricates missing or cloudy observations as blackouts.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class PriorityTier(str, Enum):
    P1_CRITICAL = "P1_CRITICAL"   # Urgent logistics & immediate reconnaissance required (Score >= 70)
    P2_HIGH = "P2_HIGH"           # High priority for resupply & corridor monitoring (Score 45-69)
    P3_MODERATE = "P3_MODERATE"   # Monitored secondary concern (Score 25-44)
    P4_LOW = "P4_LOW"             # Standard situational awareness (Score < 25)


class ConfidenceTier(str, Enum):
    HIGH = "HIGH"         # Multi-sensor satellite confirmation & verified ground topology (>= 80%)
    MODERATE = "MODERATE" # Partial cloud interference or single-sensor telemetry (50-79%)
    LOW = "LOW"           # Substantial cloud obstruction or unverified baseline (< 50%)


class ScoringWeights(BaseModel):
    isolation: float = Field(0.35, ge=0.0, le=1.0, description="Weight for road-network isolation status (default 35%)")
    nightlight: float = Field(0.30, ge=0.0, le=1.0, description="Weight for VIIRS night-light brightness reduction (default 30%)")
    population: float = Field(0.20, ge=0.0, le=1.0, description="Weight for population exposure (default 20%)")
    accessibility: float = Field(0.15, ge=0.0, le=1.0, description="Weight for emergency facility inaccessibility (default 15%)")


class FeatureComponents(BaseModel):
    isolation_raw_status: str
    isolation_raw_detour_min: Optional[float] = None
    isolation_norm: float = Field(..., ge=0.0, le=100.0, description="Normalized isolation score (0-100)")
    isolation_weight: float
    isolation_score_contribution: float

    nightlight_raw_reduction_pct: float = Field(0.0, ge=0.0, le=100.0)
    nightlight_norm: float = Field(..., ge=0.0, le=100.0, description="Normalized night-light drop score (0-100)")
    nightlight_weight: float
    nightlight_score_contribution: float
    nightlight_cluster_id: Optional[int] = None
    nightlight_cloud_obscured: bool = False

    population_raw: Optional[int] = None
    population_norm: float = Field(..., ge=0.0, le=100.0, description="Normalized population exposure score (0-100)")
    population_weight: float
    population_score_contribution: float

    accessibility_raw_travel_time_min: float
    accessibility_raw_distance_km: float
    accessibility_norm: float = Field(..., ge=0.0, le=100.0, description="Normalized inaccessibility score (0-100)")
    accessibility_weight: float
    accessibility_score_contribution: float

    direct_flood_inundation: bool = False
    flood_water_proximity_m: float = 0.0


class ConfidenceBreakdown(BaseModel):
    overall_confidence: float = Field(..., ge=0.0, le=100.0, description="Independent confidence score (0-100%)")
    confidence_tier: ConfidenceTier
    viirs_nightlight_quality: str
    viirs_confidence_pts: float
    sentinel_flood_quality: str
    sentinel_confidence_pts: float
    road_network_quality: str
    road_confidence_pts: float
    census_population_quality: str
    census_confidence_pts: float
    missing_observations: List[str] = Field(default_factory=list)


class VillagePriorityItem(BaseModel):
    rank: int
    osm_id: Union[str, int]
    name: str
    place_type: str
    latitude: float
    longitude: float
    elevation_m: float
    population: Optional[int] = None
    composite_priority_score: float = Field(..., ge=0.0, le=100.0)
    priority_tier: PriorityTier
    priority_tier_label: str
    priority_badge_color: str
    confidence_score: float = Field(..., ge=0.0, le=100.0)
    confidence_tier: ConfidenceTier
    features: FeatureComponents
    confidence: ConfidenceBreakdown
    nearest_facility_name: Optional[str] = None
    nearest_facility_type: Optional[str] = None
    route_status: str
    detour_delay_min: Optional[float] = None
    reachable_travel_time_min: Optional[float] = None
    route_coordinates: List[List[float]] = Field(default_factory=list)
    explanation: str
    limiting_factors: List[str] = Field(default_factory=list)


class PrioritySummaryStats(BaseModel):
    total_settlements: int
    p1_critical_count: int
    p2_high_count: int
    p3_moderate_count: int
    p4_low_count: int
    severed_isolation_count: int
    nightlight_drop_cluster_count: int
    high_confidence_count: int
    moderate_confidence_count: int
    low_confidence_count: int
    mean_priority_score: float
    max_priority_score: float


class PriorityRankingParams(BaseModel):
    weights: Optional[ScoringWeights] = None
    stage_rise_m: Optional[float] = Field(None, ge=0.5, le=15.0, description="Optional flood scenario stage rise")
    severity_filter: Optional[str] = Field("ALL", description="Filter: ALL, P1_CRITICAL, P2_HIGH, P3_MODERATE, P4_LOW")
    min_confidence: Optional[float] = Field(0.0, ge=0.0, le=100.0, description="Minimum confidence threshold")


class EmergencyPriorityResult(BaseModel):
    id: str
    timestamp: str
    aoi_id: str
    weights: ScoringWeights
    effective_normalized_weights: Dict[str, float]
    top_5_villages: List[VillagePriorityItem]
    villages: List[VillagePriorityItem]
    summary_stats: PrioritySummaryStats
    emergency_routes: List[Dict[str, Any]] = Field(default_factory=list)
    scientific_disclaimer: str
    geojson_export_url: str
    csv_export_url: str
