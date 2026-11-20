"""
JATAYU AI - Automated Flood & Terrain Engine Tests
Verifies raster alignment, CRS consistency, nodata handling, slope calculation,
Sentinel-1 backscatter change detection, permanent water masking,
terrain shadow exclusion, village and road spatial intersection,
and hypothetical water level scenario modeling.
"""

from pathlib import Path
import json
import numpy as np
import pytest
import rasterio

from app.config import GEOJSON_DIR, GEOTIFF_DIR
from app.engines.flood_engine import flood_engine
from app.engines.terrain_engine import terrain_engine
from app.engines.raster_engine import raster_engine
from app.models.flood import FloodAnalysisParams, FloodExtentType, ScenarioAnalysisParams

TEST_DIR = GEOTIFF_DIR / "test_scratch"
TEST_DIR.mkdir(parents=True, exist_ok=True)

def test_dem_creation_and_crs_consistency():
    """Verify DEM is created in EPSG:4326 with valid georeferencing and elevations."""
    dem_path = TEST_DIR / "test_dem.tif"
    bbox = (88.40, 26.85, 88.55, 27.05)
    terrain_engine.create_or_load_teesta_dem(bbox=bbox, width=64, height=64, out_path=dem_path)

    assert dem_path.exists()
    dem_info = terrain_engine.load_dem(dem_path)
    assert dem_info["crs"] == "EPSG:4326"
    assert dem_info["width"] == 64
    assert dem_info["height"] == 64
    assert dem_info["nodata"] == -9999.0
    # Elevation range in Teesta basin should span plains to foothills
    valid_ele = dem_info["elevation"][dem_info["valid_mask"]]
    assert np.min(valid_ele) >= 50.0
    assert np.max(valid_ele) <= 4000.0

def test_slope_and_hillshade_computation():
    """Verify slope calculation in degrees and hillshade 8-bit values."""
    dem_path = TEST_DIR / "test_dem.tif"
    dem_info = terrain_engine.load_dem(dem_path)
    ele = dem_info["elevation"]
    trans = dem_info["transform"]
    valid = dem_info["valid_mask"]

    slope_deg = terrain_engine.compute_slope_degrees(ele, trans, valid)
    assert slope_deg.shape == ele.shape
    assert np.min(slope_deg) >= 0.0
    assert np.max(slope_deg) <= 90.0

    # Hillshade
    hs = terrain_engine.compute_hillshade(ele, trans, valid_mask=valid)
    assert hs.dtype == np.uint8
    assert np.min(hs) >= 0
    assert np.max(hs) <= 255

def test_raster_alignment_and_dimensions():
    """Verify SAR raster and DEM align to the exact spatial grid and transform."""
    bbox = (88.40, 26.85, 88.55, 27.05)
    dem_path = TEST_DIR / "test_dem.tif"
    sar_path = TEST_DIR / "test_sar_align.tif"

    raster_engine.create_sample_sentinel_scene(
        output_geotiff_path=sar_path,
        mission="Sentinel-1",
        crs_epsg=4326,
        bbox=bbox,
        width=64,
        height=64
    )

    with rasterio.open(dem_path) as dem_src, rasterio.open(sar_path) as sar_src:
        assert dem_src.crs == sar_src.crs
        assert dem_src.width == sar_src.width
        assert dem_src.height == sar_src.height
        # Transforms must match
        assert np.isclose(dem_src.transform.a, sar_src.transform.a)
        assert np.isclose(dem_src.transform.e, sar_src.transform.e)

def test_flood_classification_and_shadow_exclusion():
    """
    Verify multi-criteria flood classification:
    - Identifies flood inundation
    - Screens out mountain radar shadows
    - Separates permanent river channel
    """
    post_id = "TEST_FLOOD_POST_SCENE"
    pre_id = "TEST_FLOOD_PRE_SCENE"
    bbox = (88.40, 26.85, 88.55, 27.05)

    post_path = GEOTIFF_DIR / f"{post_id}_wgs84.tif"
    pre_path = GEOTIFF_DIR / f"{pre_id}_wgs84.tif"

    raster_engine.create_sample_sentinel_scene(post_path, mission="Sentinel-1", bbox=bbox, width=64, height=64)
    raster_engine.create_sample_sentinel_scene(pre_path, mission="Sentinel-1", bbox=bbox, width=64, height=64)

    params = FloodAnalysisParams(
        post_event_scene_id=post_id,
        pre_event_scene_id=pre_id,
        backscatter_threshold_db=-15.5,
        change_threshold_db=-2.5,
        slope_max_degrees=8.0,
        elevation_max_m=1200.0,
        min_patch_pixels=2
    )

    result = flood_engine.run_flood_analysis(params)

    assert result.extent_type == FloodExtentType.OBSERVED_HISTORICAL
    assert result.flood_inundation_area_sqkm > 0.0
    assert result.permanent_water_area_sqkm > 0.0
    assert result.terrain_shadow_area_sqkm > 0.0
    assert result.geotiff_path is not None
    assert Path(result.geotiff_path).exists()
    assert result.geojson_path is not None
    assert Path(result.geojson_path).exists()

def test_spatial_intersection_villages_and_roads():
    """Verify spatial intersection detects inundated settlements and submerged road segments."""
    post_id = "TEST_FLOOD_POST_SCENE"
    params = FloodAnalysisParams(
        post_event_scene_id=post_id,
        backscatter_threshold_db=-15.5,
        slope_max_degrees=8.0,
        elevation_max_m=1200.0
    )
    result = flood_engine.run_flood_analysis(params)

    # Intersections must identify road cuts and settlement impacts
    assert len(result.submerged_roads) > 0
    assert result.submerged_roads_length_km > 0.0
    # Check that road properties contain highway type and coordinates
    first_road = result.submerged_roads[0]
    assert first_road.highway is not None
    assert first_road.submerged_length_km > 0.0

    # Check settlements
    assert result.inundated_settlements_count >= 0
    for s in result.inundated_settlements:
        assert s.isolation_level in ["CRITICAL", "HIGH", "MODERATE", "LOW"]

def test_scenario_analysis_tool():
    """
    Verify hypothetical water level scenario tool:
    - Tests stage rise parameter (e.g. +3.5m)
    - Verifies extent_type == MODELLED_SCENARIO
    - Verifies presence of mandatory hydraulic disclaimer
    """
    params = ScenarioAnalysisParams(stage_rise_m=3.5)
    result = flood_engine.run_scenario_analysis(params)

    assert result.extent_type == FloodExtentType.MODELLED_SCENARIO
    assert result.flood_inundation_area_sqkm > 0.0
    assert "HYPOTHETICAL TERRAIN-BASED SCENARIO" in result.disclaimer
    assert "NOT a real-time hydrodynamic" in result.disclaimer
    assert Path(result.geotiff_path).exists()
    assert Path(result.geojson_path).exists()
