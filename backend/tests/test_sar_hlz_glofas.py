"""
JATAYU AI - Operational Capabilities Test Suite
Verifies:
1. Copernicus DEM-based Helicopter Landing Zone (HLZ) detection & API
2. Live Open-Meteo GloFAS river discharge & early-warning telemetry
3. Sentinel-1 SAR speckle filtering, Otsu thresholding & authentic flood delineation
"""

import asyncio
import numpy as np
import pytest
from app.engines.terrain_engine import terrain_engine
from app.engines.raster_engine import raster_engine
from app.engines.flood_engine import flood_engine
from app.services import meteo_service
from app.api.terrain import get_helicopter_landing_zones
from app.api.overview import get_early_warning_telemetry
from app.models.flood import FloodAnalysisParams


def test_helicopter_landing_zones_engine():
    """Verifies automated HLZ air-rescue detection using Copernicus DEM and OSM layers."""
    hlz_fc = terrain_engine.detect_helicopter_landing_zones(
        max_slope_deg=4.5,
        min_clearance_cells=4,
        max_distance_to_village_km=3.5,
    )
    assert hlz_fc["type"] == "FeatureCollection"
    features = hlz_fc["features"]
    assert len(features) >= 5, f"Expected at least 5 candidate HLZs, got {len(features)}"

    for feat in features:
        assert feat["type"] == "Feature"
        geom = feat["geometry"]
        assert geom["type"] == "Point"
        assert len(geom["coordinates"]) == 2
        lon, lat = geom["coordinates"]
        assert 88.0 <= lon <= 89.0
        assert 26.5 <= lat <= 27.8

        props = feat["properties"]
        assert "hlz_id" in props
        assert props["elevation_m"] > 0
        assert props["slope_degrees"] <= 4.5
        assert props["clearance_footprint_m"] >= 90
        assert props["distance_to_settlement_km"] <= 3.5
        assert props["suitability_score"] > 0
        assert "Tier 1" in props["suitability_tier"] or "Tier 2" in props["suitability_tier"]
        assert "Clear" in props["operational_status"] or "Approachable" in props["operational_status"]


def test_helicopter_landing_zones_api():
    """Verifies GET /api/terrain/landing-zones returns 200 with valid GeoJSON."""
    res = get_helicopter_landing_zones(
        max_slope_deg=4.5,
        min_clearance_cells=4,
        max_distance_to_village_km=3.5,
    )
    assert res["type"] == "FeatureCollection"
    assert "features" in res
    assert len(res["features"]) > 0


def test_glofas_early_warning_service():
    """Verifies Open-Meteo GloFAS river discharge telemetry and 3-tier classification."""
    telemetry = meteo_service.fetch_glofas_early_warning()
    assert telemetry["status"] == "success"
    assert telemetry["overall_alert_tier"] in ["NORMAL", "WARNING", "CRITICAL"]
    assert "peak_forecast_discharge_m3s" in telemetry
    assert telemetry["peak_forecast_discharge_m3s"] >= 0.0

    stations = telemetry["stations"]
    assert len(stations) >= 2, f"Expected 2 monitoring stations, got {len(stations)}"

    bazar_st = next((s for s in stations if "bazar" in s["station_id"].lower() or "midstream" in s["station_id"].lower()), stations[0] if stations else None)
    assert bazar_st is not None, "Station telemetry missing from GloFAS response"
    assert bazar_st["current_discharge_m3s"] >= 0.0
    assert bazar_st["alert_tier"] in ["NORMAL", "WARNING", "CRITICAL"]
    assert len(bazar_st["time_series"]) >= 10, "Expected at least 10 days of hydrograph telemetry"

    # Verify time series structure
    first_pt = bazar_st["time_series"][0]
    assert "date" in first_pt
    assert "discharge_m3s" in first_pt


def test_glofas_early_warning_api():
    """Verifies GET /api/overview/early-warning endpoint returns structured telemetry."""
    res = get_early_warning_telemetry()
    assert res["status"] == "success"
    assert "overall_alert_tier" in res
    assert "stations" in res
    assert len(res["stations"]) >= 2


def test_raster_lee_filter_and_otsu():
    """Verifies SAR speckle noise attenuation via Lee filter and Otsu thresholding."""
    # Test Lee Filter on synthetic radar array with speckle
    np.random.seed(42)
    clean_signal = np.full((30, 30), 10.0)
    speckle_noise = np.random.normal(0, 3.0, (30, 30))
    noisy_sar = clean_signal + speckle_noise

    filtered = raster_engine._apply_lee_filter(noisy_sar, kernel_size=5, num_looks=1)
    assert filtered.shape == noisy_sar.shape
    assert not np.isnan(filtered).any()
    # Variance should be reduced by Lee filtering
    assert np.var(filtered) < np.var(noisy_sar)

    # Test Otsu thresholding on bimodal distribution (water vs land backscatter)
    water_backscatter = np.random.normal(-20.0, 2.0, 500)  # Dark water
    land_backscatter = np.random.normal(-10.0, 2.0, 500)   # Brighter land
    bimodal = np.concatenate([water_backscatter, land_backscatter])

    threshold = raster_engine.compute_otsu_threshold(bimodal)
    # Optimum threshold should cleanly divide -20 dB and -10 dB (~ -15 dB)
    assert -18.0 <= threshold <= -12.0


def test_authentic_sar_flood_analysis_engine():
    """Verifies end-to-end multi-criteria flood delineation using authentic Sentinel-1 SAR scenes."""
    params = FloodAnalysisParams(
        post_event_scene_id="S1A_IW_GRDH_1SDV_20231010_TEESTA_POST",
        pre_event_scene_id="S1A_IW_GRDH_1SDV_20230928_TEESTA_PRE",
        backscatter_threshold_db=-16.0,
        change_threshold_db=-3.0,
        slope_max_degrees=8.0,
        elevation_max_m=1200.0,
        min_patch_pixels=5,
    )
    result = flood_engine.run_flood_analysis(params)
    assert result.id is not None
    assert result.flood_inundation_area_sqkm > 0.0
    assert result.inundated_settlements_count > 0
    assert result.submerged_roads_length_km > 0.0
    assert len(result.submerged_roads) > 0
    assert len(result.inundated_settlements) > 0
    assert result.terrain_shadow_area_sqkm > 0.0
