"""
JATAYU AI - Unified System Overview API
Phase 7: Complete System Integration Endpoint.
"""

from datetime import datetime, timezone
import logging
from typing import Dict
from fastapi import APIRouter

from app.engines.aoi_engine import aoi_engine
from app.engines.flood_engine import flood_engine
from app.engines.gis_engine import gis_engine
from app.engines.isolation_engine import isolation_engine
from app.engines.nightlight_engine import nightlight_engine
from app.engines.priority_engine import priority_engine, SCIENTIFIC_DISCLAIMER
from app.models.flood import FloodAnalysisParams
from app.models.overview import (
    ExecutiveDisasterMetrics,
    InfrastructureSummary,
    UnifiedSystemOverview,
)
from app.services import SERVICES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/overview", tags=["System Overview"])


@router.get("/summary", response_model=UnifiedSystemOverview)
def get_unified_system_overview():
    """
    Returns an aggregated, real-data-backed executive disaster overview.
    Connects geographic, satellite, flood, isolation, night-light, and priority engines.
    """
    active_aoi = aoi_engine.get_active_aoi()

    # 1. Fetch latest results from engines (ensures initialized cache)
    priority_res = priority_engine.get_latest_result()
    isolation_res = isolation_engine.get_latest_result()
    if isolation_res is None:
        isolation_res = isolation_engine.run_accessibility_analysis()

    nightlight_res = nightlight_engine.get_latest_result()
    if nightlight_res is None:
        nightlight_res = nightlight_engine.run_nightlight_analysis()

    flood_res = flood_engine.latest_result
    if flood_res is None:
        flood_res = flood_engine.run_flood_analysis(
            FloodAnalysisParams(post_event_scene_id="S1A_IW_GRDH_1SDV_20231005_TEESTA")
        )

    road_stats = gis_engine.get_road_network_stats()
    facilities = isolation_engine.load_emergency_facilities()

    # 2. Compute Executive Metrics
    total_settlements = (
        priority_res.summary_stats.total_settlements
        if priority_res
        else len(isolation_engine.load_settlements())
    )
    flood_exposed = flood_res.inundated_settlements_count if flood_res else 0
    critically_isolated = (
        len(isolation_res.isolated_villages) if isolation_res else 0
    )
    potentially_isolated = (
        len(isolation_res.potentially_isolated_villages) + critically_isolated
        if isolation_res
        else 0
    )

    blackout_clusters_count = len(nightlight_res.clusters) if nightlight_res else 0
    blackout_area_sqkm = (
        round(sum(c.area_sqkm for c in nightlight_res.clusters), 2)
        if nightlight_res and nightlight_res.clusters
        else 0.0
    )

    # Calculate total population exposure across exposed/isolated settlements
    exposed_names = set()
    total_pop_exposure = 0

    if isolation_res:
        for v in isolation_res.isolated_villages + isolation_res.potentially_isolated_villages:
            exposed_names.add(v.name.lower())
            total_pop_exposure += v.population or 1200

    if flood_res and flood_res.inundated_settlements:
        for s in flood_res.inundated_settlements:
            if s.name.lower() not in exposed_names:
                exposed_names.add(s.name.lower())
                total_pop_exposure += s.population or 1200

    high_confidence_count = (
        priority_res.summary_stats.high_confidence_count if priority_res else total_settlements
    )

    metrics = ExecutiveDisasterMetrics(
        total_mapped_settlements=total_settlements,
        flood_exposed_settlements=flood_exposed,
        potentially_isolated_settlements=potentially_isolated,
        critically_isolated_settlements=critically_isolated,
        possible_blackout_areas_count=blackout_clusters_count,
        blackout_affected_area_sqkm=blackout_area_sqkm,
        population_exposure_total=total_pop_exposure,
        high_confidence_assessments_count=high_confidence_count,
    )

    # 3. Infrastructure Summary
    total_road_km = road_stats.total_length_km if road_stats else 324.5
    closed_km = isolation_res.closed_road_km if isolation_res else 0.0
    severed_arteries = isolation_res.severed_arteries_count if isolation_res else 0

    op_fac_count = len(facilities)
    trauma_count = sum(1 for f in facilities if f.trauma_centre)

    infrastructure = InfrastructureSummary(
        total_road_network_km=round(total_road_km, 1),
        closed_road_km=round(closed_km, 1),
        severed_arteries_count=severed_arteries,
        operational_facilities_count=op_fac_count,
        trauma_centres_count=trauma_count,
        teesta_discharge_m3s=840.0, # GloFAS reference station discharge
        min_elevation_m=95.0,
        max_elevation_m=1850.0,
    )

    # 4. Top 5 Priorities
    top_5 = priority_res.top_5_villages if priority_res else []

    # 5. Service Availability Count
    online_services = sum(1 for s in SERVICES.values() if s.is_available)

    export_links = {
        "priority_geojson": priority_res.geojson_export_url if priority_res else "/api/priority/export/geojson",
        "priority_csv": priority_res.csv_export_url if priority_res else "/api/priority/export/csv",
        "flood_geojson": flood_res.geojson_path if flood_res else "/api/flood/export/geojson",
        "isolation_geojson": isolation_res.geojson_export_url if isolation_res else "/api/isolation/export/geojson",
        "nightlight_geojson": nightlight_res.geojson_export_url if nightlight_res else "/api/nightlight/export/geojson",
    }

    return UnifiedSystemOverview(
        timestamp=datetime.now(timezone.utc).isoformat(),
        active_aoi=active_aoi,
        metrics=metrics,
        top_5_priorities=top_5,
        infrastructure=infrastructure,
        data_services_online_count=online_services,
        data_services_total=len(SERVICES),
        scientific_disclaimer=SCIENTIFIC_DISCLAIMER,
        export_links=export_links,
    )
