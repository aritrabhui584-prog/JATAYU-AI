"""
Road Network Isolation and Emergency Accessibility Data Models
Phase 4: Real Graph-Theoretic Road Inaccessibility & Detour Routing
"""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field

class EmergencyFacility(BaseModel):
    facility_id: str
    name: str
    facility_type: str  # "district_hospital", "primary_health_centre", "rural_hospital", "relief_camp", "tertiary_referral_hospital"
    emergency_level: str
    capacity_beds: int = 0
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None
    icu_available: bool = False
    trauma_centre: bool = False
    address: Optional[str] = None
    operational_status: Literal["OPERATIONAL", "SUBMERGED", "ACCESSIBLE_BY_AIR_ONLY"] = "OPERATIONAL"
    nearest_graph_node: Optional[List[float]] = None

class RoadExposureParams(BaseModel):
    critical_water_depth_m: float = Field(
        default=0.35,
        ge=0.10,
        le=2.00,
        description="Water depth in meters at which standard emergency vehicles cannot cross (default 0.35m)."
    )
    bridge_clearance_bonus_m: float = Field(
        default=3.5,
        ge=0.5,
        le=15.0,
        description="Vertical elevation clearance allowance for bridge decks spanning river gorges (default 3.5m)."
    )
    min_submerged_length_m: float = Field(
        default=25.0,
        ge=5.0,
        le=200.0,
        description="Minimum contiguous submerged road length in meters to classify as a structural breach."
    )
    allow_4x4_high_clearance: bool = Field(
        default=False,
        description="Whether high-clearance 4x4 rescue trucks (allowing up to 0.6m wading depth) are operational."
    )
    slope_debris_hazard_degrees: float = Field(
        default=18.0,
        ge=10.0,
        le=45.0,
        description="Terrain slope angle threshold adjoining flood zone where mountain roads face debris flow / landslide washouts."
    )
    scenario_id: Optional[str] = Field(
        default=None,
        description="Specific flood scenario ID or analysis ID to evaluate. Defaults to the latest available flood result."
    )

class ClosedRoadSegment(BaseModel):
    osm_id: str
    name: str
    highway: str
    total_length_km: float
    submerged_length_km: float
    is_bridge: bool
    is_trunk_artery: bool
    elevation_m: Optional[float] = None
    estimated_water_depth_m: Optional[float] = None
    closure_reason: str
    coordinates: List[List[float]] = Field(default_factory=list)

class RouteAlternative(BaseModel):
    origin_village: str
    origin_coords: List[float]
    destination_facility: str
    destination_coords: List[float]
    baseline_distance_km: float
    baseline_travel_time_min: float
    post_disaster_distance_km: Optional[float] = None
    post_disaster_travel_time_min: Optional[float] = None
    detour_distance_km: Optional[float] = None
    detour_delay_min: Optional[float] = None
    status: Literal["OPTIMAL", "DETOUR_REQUIRED", "SEVERED_UNREACHABLE"]
    baseline_path: List[List[float]] = Field(default_factory=list)
    alternative_path: List[List[float]] = Field(default_factory=list)

class VillageAccessibility(BaseModel):
    osm_id: Union[int, str]
    name: str
    place_type: str
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None
    population: Optional[int] = None
    status: Literal["ACCESSIBLE", "POTENTIALLY_ISOLATED", "CRITICALLY_ISOLATED"]
    isolation_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Topological isolation score: 0.0 (fully accessible) to 1.0 (completely cut off)."
    )
    nearest_facility_name: Optional[str] = None
    nearest_facility_type: Optional[str] = None
    distance_km: Optional[float] = None
    travel_time_min: Optional[float] = None
    baseline_travel_time_min: Optional[float] = None
    detour_delay_min: Optional[float] = None
    route_status: str
    explanation: str
    best_route: Optional[RouteAlternative] = None

class RoadIsolationAnalysisResult(BaseModel):
    id: str
    timestamp: str
    flood_source: str
    total_road_network_km: float
    total_segments_count: int
    closed_road_segments_count: int
    closed_road_km: float
    severed_arteries_count: int
    total_settlements_count: int
    accessible_villages_count: int
    potentially_isolated_count: int
    isolated_villages_count: int
    isolated_population_estimate: int
    facilities_count: int
    accessible_facilities_count: int
    parameters: Dict[str, Any]
    exposure_assumptions: List[str]
    accessible_villages: List[VillageAccessibility]
    potentially_isolated_villages: List[VillageAccessibility]
    isolated_villages: List[VillageAccessibility]
    closed_road_segments: List[ClosedRoadSegment]
    facilities: List[EmergencyFacility]
    geojson_export_url: Optional[str] = None
