"""
FastAPI Handler and Routing Unit Tests
Direct unit tests on API route handlers ensuring fast, isolated execution.
"""

from pathlib import Path
from app.main import root, health
from app.api.aoi import get_active_aoi, get_presets, select_preset, get_aoi_geojson
from app.api.ingestion import get_all_services_status
from app.api.metadata import get_data_sources_catalog
from app.api.layers import list_layers, get_layer_geojson
from app.api.raster import list_satellite_scenes, get_scene_bounds, compare_scenes, process_satellite_scene, render_satellite_scene
from app.api.flood import (
    analyze_flood,
    get_latest_flood_analysis,
    run_water_level_scenario,
    get_terrain_analysis,
    render_flood_overlay,
    export_flood_geotiff,
    export_flood_geojson,
    get_flood_intersections
)
from app.models.flood import FloodAnalysisParams, ScenarioAnalysisParams, FloodExtentType
from app.engines.raster_engine import raster_engine
from app.models.satellite import RasterSceneRecord, SceneProcessingStatus
from app.engines.metadata_engine import metadata_engine

def test_root_handler():
    res = root()
    assert res["project"] == "JATAYU AI"
    assert res["phase"] == "Phase 1: Real Data Foundation"
    assert "Teesta" in res["geographic_area"]

def test_health_handler():
    res = health()
    assert res["status"] == "healthy"
    assert res["service"] == "jatayu-backend"

def test_aoi_handlers():
    active = get_active_aoi()
    assert active.bbox.min_lat < active.bbox.max_lat
    assert 26.0 <= active.bbox.min_lat <= 28.0

    presets = get_presets()
    assert len(presets) >= 4

    geojson = get_aoi_geojson()
    assert geojson["type"] == "Feature"
    assert geojson["geometry"]["type"] == "Polygon"

def test_ingestion_status_handler():
    statuses = get_all_services_status()
    assert len(statuses) == 7
    ids = [s.service_id for s in statuses]
    for sid in ["osm", "srtm", "sentinel1", "sentinel2", "viirs", "meteo", "worldpop"]:
        assert sid in ids

def test_metadata_data_sources_handler():
    catalog = get_data_sources_catalog()
    assert len(catalog["data_sources"]) == 7
    assert "zero_fabrication_guarantee" in catalog

def test_layers_handler():
    layers = list_layers()
    assert len(layers) >= 1
    assert layers[0].layer_key == "aoi_corridor"
    
    aoi_fc = get_layer_geojson("aoi_corridor")
    assert aoi_fc["type"] == "FeatureCollection"
    assert len(aoi_fc["features"]) == 1

def test_raster_api_handlers():
    # Insert two test scenes for comparison test
    s1_id = "TEST_API_S1_BEFORE"
    s2_id = "TEST_API_S1_AFTER"
    for sid in [s1_id, s2_id]:
        rec = RasterSceneRecord(
            id=sid,
            mission="Sentinel-1",
            platform="Sentinel-1A",
            instrument="C-SAR",
            product_id=sid,
            acquisition_date="2026-11-15T00:00:00Z",
            bounds=[26.85, 88.40, 27.05, 88.55],
            status=SceneProcessingStatus.DISCOVERED
        )
        metadata_engine.upsert_scene_record(rec)

    # Test listing scenes
    res_list = list_satellite_scenes(mission="Sentinel-1", limit=10)
    assert res_list["total"] >= 2

    # Test get scene bounds
    bounds_res = get_scene_bounds(s1_id)
    assert bounds_res["scene_id"] == s1_id
    assert len(bounds_res["leaflet_bounds"]) == 2

    # Test compare scenes
    comp_res = compare_scenes(before_scene_id=s1_id, after_scene_id=s2_id, mode="sar_calibrated")
    assert comp_res["before"]["scene_id"] == s1_id
    assert comp_res["after"]["scene_id"] == s2_id
    assert "render_url" in comp_res["before"]

    # Test processing scene
    proc_res = process_satellite_scene(s1_id)
    assert proc_res["success"] is True
    assert "sar_calibrated" in proc_res["products_generated"]
    assert "sar_water_mask" in proc_res["products_generated"]

    # Test rendering scene overlay
    render_resp = render_satellite_scene(s1_id, mode="sar_calibrated")
    assert render_resp.media_type == "image/png"
    assert Path(render_resp.path).exists()

def test_flood_api_handlers():
    # 1. Test terrain analysis endpoint
    terrain_res = get_terrain_analysis()
    assert terrain_res.min_elevation_m >= 50.0
    assert terrain_res.max_elevation_m <= 4000.0
    assert "elevation_relief" in terrain_res.render_urls

    # 2. Test latest flood analysis endpoint
    latest_flood = get_latest_flood_analysis()
    assert latest_flood.extent_type == FloodExtentType.OBSERVED_HISTORICAL
    assert latest_flood.flood_inundation_area_sqkm > 0.0

    # 3. Test scenario analysis endpoint
    scen_params = ScenarioAnalysisParams(stage_rise_m=2.5)
    scen_res = run_water_level_scenario(scen_params)
    assert scen_res.extent_type == FloodExtentType.MODELLED_SCENARIO
    assert "HYPOTHETICAL TERRAIN-BASED SCENARIO" in scen_res.disclaimer

    # 4. Test render overlay endpoint
    flood_overlay = render_flood_overlay(type="flood_extent", id=latest_flood.id)
    assert flood_overlay.media_type == "image/png"
    assert Path(flood_overlay.path).exists()

    # 5. Test GeoTIFF and GeoJSON export endpoints
    tif_resp = export_flood_geotiff(id=latest_flood.id)
    assert tif_resp.media_type == "image/tiff"
    assert Path(tif_resp.path).exists()

    json_resp = export_flood_geojson(id=latest_flood.id)
    assert json_resp.media_type == "application/geo+json"
    assert Path(json_resp.path).exists()

    # 6. Test intersections endpoint
    intersections = get_flood_intersections()
    assert "inundated_settlements" in intersections
    assert "submerged_roads" in intersections


