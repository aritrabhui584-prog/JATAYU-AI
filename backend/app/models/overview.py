"""
JATAYU AI - Unified System Overview Models
Phase 7: Complete System Integration.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.aoi import AOIConfig
from app.models.priority import VillagePriorityItem


class ExecutiveDisasterMetrics(BaseModel):
    total_mapped_settlements: int = Field(..., description="Total verified OSM settlements in active AOI")
    flood_exposed_settlements: int = Field(..., description="Settlements directly inundated or within flood hazard zone")
    potentially_isolated_settlements: int = Field(..., description="Settlements severed or requiring severe detour")
    critically_isolated_settlements: int = Field(..., description="Settlements completely cut off from road access")
    possible_blackout_areas_count: int = Field(..., description="Significant VIIRS nighttime brightness drop clusters")
    blackout_affected_area_sqkm: float = Field(..., description="Total square kilometers of significant light drop")
    population_exposure_total: int = Field(..., description="Total population in flood-exposed or isolated settlements")
    high_confidence_assessments_count: int = Field(..., description="Assessments with multi-sensor verification")


class InfrastructureSummary(BaseModel):
    total_road_network_km: float
    closed_road_km: float
    severed_arteries_count: int
    operational_facilities_count: int
    trauma_centres_count: int
    teesta_discharge_m3s: Optional[float] = None
    min_elevation_m: float
    max_elevation_m: float


class UnifiedSystemOverview(BaseModel):
    timestamp: str
    active_aoi: AOIConfig
    metrics: ExecutiveDisasterMetrics
    top_5_priorities: List[VillagePriorityItem]
    infrastructure: InfrastructureSummary
    data_services_online_count: int
    data_services_total: int = 7
    scientific_disclaimer: str
    export_links: Dict[str, str] = Field(default_factory=dict)
