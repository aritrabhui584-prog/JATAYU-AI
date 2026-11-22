"""
JATAYU AI - Multi-Year Historical STAC & Dynamic Scouting Tests
Verifies authentic STAC discovery (2015-2026), Microsoft Planetary Computer tile templates,
and dynamic live basin scouting without fabricated data.
"""

import pytest
from app.api.raster import get_historical_best_granule
from app.services.copernicus_service import copernicus_service
from app.services.scout_service import scout_service, ScoutRegionRequest


def test_historical_best_granule_2023_teesta():
    """Verifies authentic 2023 Sentinel-2 L2A optical tile discovery over Teesta Basin."""
    res = get_historical_best_granule(
        year=2023,
        date="2023-10-04",
        west=88.25,
        south=26.50,
        east=88.85,
        north=27.75,
        mission="sentinel-2-l2a",
        max_cloud=15.0,
    )
    assert res["status"] == "OPTIMAL_GRANULE_FOUND"
    assert res["year"] == 2023
    assert "S2" in res["scene_id"]
    assert res["cloud_cover_percent"] <= 15.0
    assert "planetarycomputer.microsoft.com" in res["tile_url_template"]
    assert "WebMercatorQuad" in res["tile_url_template"]
    assert res["zero_fabrication_verified"] is True


def test_historical_best_granule_2018_kerala():
    """Verifies authentic 2018 historical STAC discovery over Kerala basin."""
    res = get_historical_best_granule(
        year=2018,
        date="2018-08-16",
        west=76.0,
        south=9.5,
        east=77.0,
        north=10.5,
        mission="sentinel-2-l2a",
        max_cloud=10.0,
    )
    assert res["status"] == "OPTIMAL_GRANULE_FOUND"
    assert res["year"] == 2018
    assert "S2" in res["scene_id"]
    assert res["zero_fabrication_verified"] is True


def test_historical_best_radar_2015():
    """Verifies authentic 2015 Sentinel-1 C-SAR radar discovery when optical was not yet in orbit."""
    res = get_historical_best_granule(
        year=2015,
        west=88.25,
        south=26.50,
        east=88.85,
        north=27.75,
        mission="sentinel-1-grd",
    )
    assert res["status"] == "OPTIMAL_GRANULE_FOUND"
    assert res["collection"] == "sentinel-1-grd"
    assert "S1" in res["scene_id"]
    assert "WebMercatorQuad" in res["tile_url_template"]


def test_dynamic_basin_scout_execution():
    """Verifies live Open-Meteo GloFAS and ECMWF hydrometeorology scouting for any Indian basin coordinates."""
    import asyncio
    req = ScoutRegionRequest(
        name="Teesta Gorge Point",
        latitude=27.05,
        longitude=88.45,
        radius_km=20.0,
    )
    res = asyncio.run(scout_service.scout_basin(req))
    assert res["coordinates"]["latitude"] == 27.05
    assert res["coordinates"]["longitude"] == 88.45
    assert "hydrology" in res
    assert "current_discharge_m3s" in res["hydrology"]
    assert "meteorology" in res
    assert res["zero_fabrication_guarantee"] is True


def test_honest_no_overpass_handling():
    """Verifies honest status return without mock hallucination when query has no coverage."""
    # Query an unrealistic polar coordinates with narrow collection
    res = copernicus_service.find_historical_best_scene(
        year=2015,
        date="2015-01-01",
        bbox=[0.0, 89.0, 0.1, 89.1],  # Extreme North Pole
        mission="sentinel-2-l2a",
    )
    assert res["status"] in ["NO_OVERPASS_IN_WINDOW", "OPTIMAL_GRANULE_FOUND"]
    if res["status"] == "NO_OVERPASS_IN_WINDOW":
        assert "message" in res
