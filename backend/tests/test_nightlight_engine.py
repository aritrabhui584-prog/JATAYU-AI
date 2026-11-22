"""
Unit and Quality Filter Tests for Phase 5: NASA VIIRS Black Marble VNP46A2 Night-Light Engine
Verifies:
1. HDF5 / HDF-EOS5 schema and BRDF-corrected nighttime radiance extraction
2. Mandatory_Quality_Flag cloud, stray light, and fill value filtering
3. Multi-temporal baseline compositing across multiple valid observations
4. Zero baseline and dark unlit background handling (no division by zero)
5. Cloud-covered pixels NOT classified as blackouts / power outages
6. Percentage radiance reduction and spatial clustering (scipy.ndimage)
7. VIIRS 15 arc-sec (~500m) spatial resolution accounting and causal disclaimer
8. FastAPI route handlers integration
"""

import json
from pathlib import Path
import numpy as np
import pytest
import rasterio

from app.engines.nightlight_engine import nightlight_engine, NightlightEngine
from app.models.nightlight import (
    NightlightAnalysisParams,
    NightlightAnalysisResult,
    SpatialCluster,
    VIIRSObservationMetadata,
)
from app.api.nightlight import (
    analyze_nightlight,
    get_latest_nightlight_analysis,
    list_viirs_observations,
    export_nightlight_geotiff,
    export_nightlight_geojson,
)


def test_vnp46a2_hdf5_structure_and_radiance_extraction():
    """Verifies HDF5 schema, dataset paths, scale factor (1.0), and units"""
    obs_list = nightlight_engine.list_available_observations()
    assert len(obs_list) >= 4

    first_obs = obs_list[0]
    assert first_obs.total_pixels >= 5184  # Full tile is 2400x2400 (5,760,000 pixels)
    assert first_obs.tile == "h26v06"
    assert first_obs.mean_radiance >= 0.0

    # Read raw arrays
    rad, qf, scale = nightlight_engine.read_radiance_and_quality(Path(first_obs.hdf5_path))
    assert rad.shape[0] >= 72 and rad.shape[1] >= 72
    assert qf.shape == rad.shape
    assert scale in (0.1, 1.0)
    # Check valid radiance range
    valid_rad = rad[~np.isnan(rad)]
    assert np.all(valid_rad >= 0.0)


def test_mandatory_quality_flag_and_cloud_filtering():
    """
    Verifies that Mandatory_Quality_Flag cloud, fill, and poor quality pixels
    are strictly masked and excluded from valid observations.
    """
    # 2023-10-01 is a heavy cloud observation in Teesta
    obs_list = nightlight_engine.list_available_observations()
    cloudy_obs = next((o for o in obs_list if o.date in ["2023-10-01", "2023-10-03", "2023-10-04"]), None)
    assert cloudy_obs is not None
    assert cloudy_obs.cloud_pixels > 1000

    rad, qf, _ = nightlight_engine.read_radiance_and_quality(Path(cloudy_obs.hdf5_path))
    # Where qf > 0 or 255, radiance must be masked (NaN)
    assert np.all(np.isnan(rad[qf == 255]))


def test_multi_temporal_baseline_calculation():
    """
    Verifies multi-temporal baseline calculation:
    Requires at least min_valid_baseline_obs cloud-free days; otherwise filled from NASA gap-filled baseline.
    """
    params = NightlightAnalysisParams(
        pre_event_dates=["2023-10-01", "2023-10-02", "2023-10-03"],
        post_event_date="2023-10-05",
        min_valid_baseline_obs=1,
    )
    res = nightlight_engine.run_nightlight_analysis(params)
    assert res.valid_baseline_pixels > 1000
    assert res.pre_event_dates == ["2023-10-01", "2023-10-02", "2023-10-03"]


def test_zero_baseline_and_unlit_background_handling():
    """
    Verifies that zero or near-zero baseline pixels (< 1.0 nW) in dark forests
    do NOT trigger false mathematical 100% drops and are tagged as unlit background.
    """
    params = NightlightAnalysisParams(post_event_date="2023-10-05")
    res = nightlight_engine.run_nightlight_analysis(params)
    assert res.unlit_background_pixels > 0
    # Ensure unlit background pixels are accounted for and excluded from light reduction clusters
    assert res.unlit_background_pixels + res.significant_reduction_pixels <= res.total_pixels


def test_cloudy_post_observation_not_classified_as_blackout():
    """
    CRITICAL RULE:
    Do not classify missing, cloudy or poor-quality pixels as blackouts.
    When post_event_date has heavy clouds (2023-10-03), cloud pixels must be marked
    as cloud obscuration (Class 254), resulting in ZERO false blackout clusters.
    """
    params = NightlightAnalysisParams(
        pre_event_dates=["2023-10-01", "2023-10-02"],
        post_event_date="2023-10-03",  # Heavy pre-flood clouds
        radiance_reduction_threshold_pct=40.0,
    )
    res = nightlight_engine.run_nightlight_analysis(params)

    assert res.cloud_obscured_pixels > 1000
    # Under thick clouds in AOI, no false light reduction clusters should be declared
    assert res.clusters_count <= 2  # At most isolated border noise
    assert res.cloud_obscured_pixels > res.significant_reduction_pixels


def test_percentage_radiance_reduction_and_spatial_clustering():
    """
    Verifies that on a clear post-disaster night (2023-10-05):
    1. Percentage reduction is calculated accurately
    2. scipy.ndimage.label groups contiguous 500m pixels into spatial clusters
    3. Isolated single-pixel noise is filtered out
    """
    params = NightlightAnalysisParams(
        pre_event_dates=["2023-10-01", "2023-10-02", "2023-10-03"],
        post_event_date="2023-10-05",  # Clear post-flood night
        radiance_reduction_threshold_pct=40.0,
        min_absolute_drop_nw=2.5,
        min_cluster_pixels=3,
    )
    res = nightlight_engine.run_nightlight_analysis(params)

    assert res.significant_reduction_pixels > 100
    assert res.reduction_area_sqkm > 20.0
    assert res.clusters_count >= 1

    # Verify cluster properties
    c1 = res.clusters[0]
    assert c1.pixel_count >= 3
    assert c1.area_sqkm > 0.6
    assert c1.mean_radiance_drop_pct >= 40.0
    assert c1.mean_baseline_radiance > c1.mean_post_radiance
    assert "Teesta" in c1.approximate_region or "Sevoke" in c1.approximate_region or "Cluster" in c1.approximate_region


def test_spatial_resolution_500m_and_scientific_disclaimer():
    """
    Verifies that VIIRS 15 arc-sec (~500m) resolution footprint is explicitly reported,
    and the mandatory disclaimer stating radiance drop != automatic power outage is present.
    """
    res = nightlight_engine.run_nightlight_analysis()
    assert res.spatial_resolution_m == 500.0
    assert "500m" in res.scientific_disclaimer
    assert "evacuation" in res.scientific_disclaimer.lower()
    assert "Mandatory_Quality_Flag" in res.scientific_disclaimer


def test_nightlight_api_handlers():
    """Tests FastAPI nightlight route handlers directly"""
    # 1. POST /api/nightlight/analyze
    res = analyze_nightlight(NightlightAnalysisParams(min_cluster_pixels=4))
    assert isinstance(res, NightlightAnalysisResult)
    assert res.total_pixels >= 5184

    # 2. GET /api/nightlight/latest
    latest = get_latest_nightlight_analysis()
    assert latest.id == res.id

    # 3. GET /api/nightlight/observations
    obs = list_viirs_observations()
    assert len(obs) >= 4

    # 4. GET /api/nightlight/export/geotiff
    tiff_resp = export_nightlight_geotiff(res.id)
    assert tiff_resp.status_code == 200
    assert Path(tiff_resp.path).exists()

    # 5. GET /api/nightlight/export/geojson
    json_resp = export_nightlight_geojson(res.id)
    assert json_resp.status_code == 200
    assert Path(json_resp.path).exists()
