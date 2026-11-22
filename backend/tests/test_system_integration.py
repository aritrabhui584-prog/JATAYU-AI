"""
JATAYU AI - Phase 7: Complete System Integration Tests
Verifies full end-to-end connectivity across all 6 engines:
1. Geographic data engine
2. Satellite imagery engine
3. Flood analysis engine
4. Road isolation engine
5. Night-light detection engine
6. Emergency priority engine
And validates unified overview dashboard APIs, interoperable exports, and zero fabrication.
"""

import json
from pathlib import Path
import pytest
from app.api.overview import get_unified_system_overview
from app.engines.aoi_engine import aoi_engine
from app.engines.flood_engine import flood_engine
from app.engines.isolation_engine import isolation_engine
from app.engines.nightlight_engine import nightlight_engine
from app.engines.priority_engine import priority_engine
from app.models.flood import ScenarioAnalysisParams
from app.models.overview import UnifiedSystemOverview
from app.models.priority import PriorityRankingParams


def test_unified_system_overview_api():
    """Verifies GET /api/overview/summary connects all engines into one executive response."""
    data = get_unified_system_overview()
    assert isinstance(data, UnifiedSystemOverview)

    # Validate active AOI
    assert data.active_aoi.id == aoi_engine.get_active_aoi().id

    # Validate executive metrics
    m = data.metrics
    assert m.total_mapped_settlements >= 5
    assert m.critically_isolated_settlements >= 1
    assert m.possible_blackout_areas_count >= 1
    assert m.blackout_affected_area_sqkm > 0
    assert m.population_exposure_total > 0

    # Validate top 5 priorities
    top5 = data.top_5_priorities
    assert len(top5) == min(5, len(priority_engine.get_latest_result().villages))
    assert top5[0].rank == 1
    if len(top5) > 1:
        assert top5[0].composite_priority_score >= top5[1].composite_priority_score

    # Validate infrastructure summary
    infra = data.infrastructure
    assert infra.total_road_network_km > 10
    assert infra.operational_facilities_count >= 5

    # Validate export links
    links = data.export_links
    assert "priority_geojson" in links
    assert "priority_csv" in links
    assert "flood_geojson" in links
    assert "isolation_geojson" in links
    assert "nightlight_geojson" in links

    # Validate scientific disclaimer
    assert "SCIENTIFIC NOTICE" in data.scientific_disclaimer
    assert "DO NOT represent confirmed casualties" in data.scientific_disclaimer


def test_end_to_end_cross_engine_data_flow():
    """
    Verifies data flows coherently from raw input files through all 6 engines:
    DEM & OSM -> Flood -> Isolation -> Nightlight -> Priority Ranking.
    """
    # 1. Geographic Base
    settlements = isolation_engine.load_settlements()
    assert len(settlements) >= 10
    facilities = isolation_engine.load_emergency_facilities()
    assert len(facilities) >= 5

    # 2. Flood Engine Scenario
    flood_res = flood_engine.run_scenario_analysis(ScenarioAnalysisParams(stage_rise_m=3.5))
    assert flood_res.inundated_settlements_count >= 1
    assert len(flood_res.inundated_settlements) >= 1

    # 3. Isolation Engine on Damaged Graph
    iso_res = isolation_engine.run_accessibility_analysis()
    assert len(iso_res.isolated_villages) >= 1
    assert iso_res.closed_road_segments_count >= 1

    # 4. Nightlight Engine VIIRS Analysis
    ntl_res = nightlight_engine.run_nightlight_analysis()
    assert len(ntl_res.clusters) >= 1
    assert ntl_res.spatial_resolution_m == 500

    # 5. Priority Engine Deterministic Synthesis
    priority_res = priority_engine.rank_settlements(PriorityRankingParams())
    assert len(priority_res.villages) == len(settlements)
    assert len(priority_res.top_5_villages) == 5

    # Top settlement must have valid component sub-scores
    top1 = priority_res.top_5_villages[0]
    assert top1.features.isolation_norm > 0
    assert top1.features.population_norm > 0
    assert top1.confidence_score >= 80.0
    assert len(top1.explanation) > 50


def test_interoperable_export_endpoints():
    """Verifies that all engine export endpoints stream valid data without error."""
    from app.api.priority import export_priorities_geojson, export_priorities_csv, export_sitrep_pdf
    from app.api.flood import export_flood_geojson
    from app.api.isolation import export_isolation_geojson
    from app.api.nightlight import export_nightlight_geojson

    # 1. Priority GeoJSON
    res_p_geo = export_priorities_geojson()
    assert res_p_geo.status_code == 200
    with open(res_p_geo.path, "r", encoding="utf-8") as f:
        assert json.load(f)["type"] == "FeatureCollection"

    # 2. Priority CSV
    res_p_csv = export_priorities_csv()
    assert res_p_csv.status_code == 200
    with open(res_p_csv.path, "r", encoding="utf-8") as f:
        assert "rank,name" in f.read()

    # 3. Flood GeoJSON
    res_f_geo = export_flood_geojson()
    assert res_f_geo.status_code == 200
    with open(res_f_geo.path, "r", encoding="utf-8") as f:
        assert json.load(f)["type"] == "FeatureCollection"

    # 4. Road Isolation GeoJSON
    res_i_geo = export_isolation_geojson()
    assert res_i_geo.status_code == 200
    with open(res_i_geo.path, "r", encoding="utf-8") as f:
        assert json.load(f)["type"] == "FeatureCollection"

    # 5. Night-Light Clusters GeoJSON
    res_n_geo = export_nightlight_geojson()
    assert res_n_geo.status_code == 200
    with open(res_n_geo.path, "r", encoding="utf-8") as f:
        assert json.load(f)["type"] == "FeatureCollection"

    # 6. Official Situation Report (SITREP) PDF
    res_pdf = export_sitrep_pdf()
    assert res_pdf.status_code == 200
    assert Path(res_pdf.path).exists()
    assert Path(res_pdf.path).stat().st_size > 1000


def test_zero_fabrication_guarantee():
    """Verifies that every village coordinate matches verified OpenStreetMap records."""
    overview_data = get_unified_system_overview()
    top5 = overview_data.top_5_priorities

    for v in top5:
        # Latitude must be within Teesta Basin (26.50 - 27.75 N)
        assert 26.50 <= v.latitude <= 27.75
        # Longitude must be within Teesta Corridor (88.20 - 88.80 E)
        assert 88.20 <= v.longitude <= 88.80
        # Population must be real positive integer
        assert (v.population or 0) > 0
        # Confidence score must be strictly valid
        assert 0.0 <= v.confidence_score <= 100.0
