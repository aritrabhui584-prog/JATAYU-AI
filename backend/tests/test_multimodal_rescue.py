"""
JATAYU AI - Multi-Modal Pre-Disaster Rescue Routing & All-India Surveillance Unit Tests
Direct unit tests on API route handlers and isolation engine ensuring fast, isolated execution.
Tests:
1. Pre-blocking road network time-to-closure classification (OPEN_SAFE, CLOSING_SOON, SEVERED)
2. Fastest pre-closure highway routing (with 60-min safety buffer) vs High-Ground flood-safe bypass
3. Northeast Frontier Railway safe railhead extraction and road feeder routing
4. Airway rescue corridors: Pickup HLZ pairing and direct Air-Bridge flight vectors to Bagdogra AFB
5. REST API handlers: compute_multimodal_rescue, get_multimodal_rescue, get_railway_infrastructure, get_surveillance_dates
"""

import pytest
from app.engines.isolation_engine import isolation_engine
from app.models.isolation import RoadExposureParams
from app.api.isolation import (
    compute_multimodal_rescue,
    get_multimodal_rescue,
    get_railway_infrastructure,
)
from app.api.aoi import (
    get_surveillance_dates,
    scout_region,
)
from app.services.scout_service import ScoutRegionRequest

def test_multimodal_rescue_engine_direct():
    """Verify isolation_engine.analyze_multimodal_rescue() executes cleanly and returns all 3 modalities"""
    params = RoadExposureParams()
    result = isolation_engine.analyze_multimodal_rescue(params)

    assert result.status == "success"
    assert result.zero_fabrication_guarantee is True
    assert "total_settlements" in result.summary
    assert result.summary["total_settlements"] > 0
    assert "operational_hlzs_count" in result.summary
    assert result.summary["operational_hlzs_count"] > 0

    # Verify road network summary
    assert "open_safe_km" in result.roadway_network
    assert "closing_soon_km" in result.roadway_network
    assert "severed_km" in result.roadway_network

    # Verify railway system
    assert len(result.railway_system["active_railheads"]) > 0
    station_names = [st["name"] for st in result.railway_system["active_railheads"]]
    assert any("Sevoke" in s or "Siliguri" in s or "Jalpaiguri" in s for s in station_names)

    # Verify airway system
    assert "Bagdogra" in result.airway_system["strategic_airbase"]["name"]
    assert result.airway_system["flight_speed_kmh"] == 180.0

    # Verify settlement plans
    assert len(result.settlement_plans) > 0
    sample_plan = result.settlement_plans[0]
    assert sample_plan.operational_status in ["OPEN_SAFE", "CLOSING_SOON", "SEVERED"]
    assert sample_plan.urgency_badge is not None

    # Check Roadway options
    assert sample_plan.roadway.fastest_pre_block is not None
    assert sample_plan.roadway.flood_safe_bypass is not None
    assert sample_plan.roadway.baseline_shortest is not None

    # Check Railway plan
    assert sample_plan.railway.nearest_railhead is not None
    assert sample_plan.railway.station_coords is not None

    # Check Airway plan
    if sample_plan.airway.pickup_hlz:
        assert "HLZ" in sample_plan.airway.pickup_hlz.hlz_id
        assert sample_plan.airway.air_bridge is not None
        assert sample_plan.airway.air_bridge.compass_bearing_deg >= 0.0
        assert sample_plan.airway.air_bridge.estimated_flight_time_min > 0.0


def test_multimodal_rescue_api_handlers():
    """Verify compute_multimodal_rescue, get_multimodal_rescue, and get_railway_infrastructure handlers"""
    params = RoadExposureParams(
        critical_water_depth_m=0.35,
        bridge_clearance_bonus_m=3.5,
        min_submerged_length_m=25.0,
        allow_4x4_high_clearance=False,
        slope_debris_hazard_degrees=18.0
    )
    # 1. compute_multimodal_rescue handler
    res_post = compute_multimodal_rescue(params)
    assert res_post.status == "success"
    assert len(res_post.settlement_plans) > 0

    # 2. get_multimodal_rescue handler
    res_get = get_multimodal_rescue()
    assert res_get.status == "success"
    assert res_get.summary["total_settlements"] == res_post.summary["total_settlements"]

    # 3. get_railway_infrastructure handler
    res_rw = get_railway_infrastructure()
    assert "stations" in res_rw
    assert len(res_rw["stations"]) > 0


def test_surveillance_dates_handler():
    """Verify get_surveillance_dates handler returns valid temporal anchors"""
    res = get_surveillance_dates()
    assert "date_1y_ago" in res
    assert "date_7d_ago" in res
    assert "date_1d_ago" in res
    assert "date_live" in res
    assert "timestamp_ist" in res


import asyncio
from unittest.mock import AsyncMock, patch

def test_basin_scout_handler():
    """Verify scout_region handler accepts coordinates and returns hydrological diagnostics"""
    mock_result = {
        "scout_id": "scout_test_1",
        "region_name": "Teesta Basin Point",
        "coordinates": {"latitude": 26.92, "longitude": 88.48},
        "bounding_box": [26.77, 88.33, 27.07, 88.63],
        "nearest_basin": "Teesta River Basin",
        "state_jurisdiction": "Sikkim & West Bengal",
        "telemetry_timestamp_utc": "2026-11-21T18:00:00Z",
        "telemetry_timestamp_ist": "21 Nov 2026, 11:30 PM IST",
        "hydrology": {
            "current_discharge_m3s": 520.0,
            "peak_forecast_m3s": 710.0,
            "warning_threshold_m3s": 600.0,
            "critical_threshold_m3s": 1500.0,
            "discharge_timeline": [],
            "alert_tier": "WARNING",
            "alert_color": "amber",
            "alert_title": "FLOOD WATCH",
            "alert_description": "Projected discharge exceeds warning threshold.",
            "data_source": "Copernicus GloFAS via Open-Meteo API"
        },
        "meteorology": {
            "temperature_c": 18.5,
            "precipitation_current_mm": 12.0,
            "relative_humidity_pct": 88,
            "wind_speed_kmh": 14.2,
            "rain_7day_accumulated_mm": 50.0,
            "data_source": "ECMWF IFS Forecast via Open-Meteo"
        },
        "operational_recommendations": [
            "Ground Surveillance: Monitor embankments.",
            "Weather Outlook: Active rain expected."
        ],
        "zero_fabrication_guarantee": True
    }
    with patch("app.api.aoi.scout_service.scout_basin", AsyncMock(return_value=mock_result)):
        req = ScoutRegionRequest(
            latitude=26.92,
            longitude=88.48,
            name="Teesta Basin Point"
        )
        res = asyncio.run(scout_region(req))
        assert res["zero_fabrication_guarantee"] is True
        assert "hydrology" in res
        assert "current_discharge_m3s" in res["hydrology"]
        assert "alert_tier" in res["hydrology"]
        assert "meteorology" in res
        assert len(res["operational_recommendations"]) > 0
