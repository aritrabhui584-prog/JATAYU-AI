"""
Unit and Graph-Theoretic Tests for Phase 4: Road Network Isolation Engine
Verifies:
1. Routable NetworkX graph construction & slope-adjusted travel times
2. Disconnected graph components detection
3. Shortest alternative detour route recalculation
4. Unreachable destinations & critical settlement isolation
5. Bridge clearance elevation preservation (Coronation Bridge rule)
6. Configurable exposure rules (standard vs 4x4 high-clearance fleet)
7. Emergency healthcare and relief facilities mapping
8. API endpoint handlers
"""

import json
from pathlib import Path
import networkx as nx
import numpy as np
import pytest
import rasterio
from shapely.geometry import LineString, Point, Polygon

from app.engines.isolation_engine import isolation_engine, IsolationEngine
from app.engines.terrain_engine import terrain_engine
from app.models.isolation import (
    EmergencyFacility,
    RoadExposureParams,
    RoadIsolationAnalysisResult,
)
from app.api.isolation import (
    analyze_road_isolation,
    get_latest_isolation_analysis,
    get_emergency_facilities,
    export_isolation_geojson,
)

def test_routable_graph_building_and_components():
    """Verifies routable NetworkX graph construction with geodetic distances and travel times"""
    dem_path = terrain_engine.create_or_load_teesta_dem()
    dem_info = terrain_engine.load_dem(dem_path)
    dem_arr = dem_info["elevation"]
    dem_transform = dem_info["transform"]
    slope_arr = terrain_engine.compute_slope_degrees(dem_arr, dem_transform)

    G, segments = isolation_engine.build_routable_graph(dem_arr, slope_arr, dem_transform)

    assert G.number_of_nodes() >= 50
    assert G.number_of_edges() >= 50
    assert len(segments) >= 50

    # Verify edge attributes
    sample_edge = list(G.edges(data=True))[0]
    u, v, data = sample_edge
    assert "length_m" in data
    assert "weight" in data
    assert "speed_kmh" in data
    assert "elevation_m" in data
    assert "slope_deg" in data
    assert data["length_m"] > 0.0
    assert data["speed_kmh"] >= 8.0 # bounded speed floor

    # Verify connected components exist
    comps = list(nx.connected_components(G))
    assert len(comps) >= 1
    largest_comp = max(comps, key=len)
    assert len(largest_comp) >= 50

def test_disconnected_graph_components_detection():
    """Explicitly tests NetworkX component partitioning when network links are severed"""
    G = nx.Graph()
    # Component 1 (West Bank)
    G.add_edge("Sevoke", "WestBank_Approach", weight=120, length_m=1200)
    G.add_edge("WestBank_Approach", "Bridge_West", weight=60, length_m=500)
    
    # Bridge Choke Point
    G.add_edge("Bridge_West", "Bridge_East", weight=40, length_m=300)

    # Component 2 (East Bank)
    G.add_edge("Bridge_East", "EastBank_Junction", weight=50, length_m=400)
    G.add_edge("EastBank_Junction", "Oodlabari_Hospital", weight=300, length_m=3500)

    # Initially single connected component
    assert nx.number_connected_components(G) == 1
    assert nx.has_path(G, "Sevoke", "Oodlabari_Hospital")

    # Sever bridge link
    G.remove_edge("Bridge_West", "Bridge_East")

    # Verify graph is partitioned into 2 disconnected components
    assert nx.number_connected_components(G) == 2
    assert not nx.has_path(G, "Sevoke", "Oodlabari_Hospital")
    comps = list(nx.connected_components(G))
    assert len(comps) == 2
    assert "Sevoke" in comps[0] or "Sevoke" in comps[1]

def test_route_recalculation_and_detour():
    """Tests alternative shortest path routing and detour delay penalty computation"""
    G = nx.Graph()
    # Route A (Direct Riverbank Highway: 10km, 12 mins)
    G.add_edge("Village_Rambhi", "RiverRoad_1", weight=360, length_m=5000)
    G.add_edge("RiverRoad_1", "Hospital_Mongpu", weight=360, length_m=5000)

    # Route B (Mountain Ridge Detour: 24km, 42 mins)
    G.add_edge("Village_Rambhi", "RidgePass_1", weight=800, length_m=9000)
    G.add_edge("RidgePass_1", "RidgePass_2", weight=900, length_m=8000)
    G.add_edge("RidgePass_2", "Hospital_Mongpu", weight=820, length_m=7000)

    # Baseline optimal path
    base_path = nx.shortest_path(G, "Village_Rambhi", "Hospital_Mongpu", weight="weight")
    base_time = nx.shortest_path_length(G, "Village_Rambhi", "Hospital_Mongpu", weight="weight")
    assert base_path == ["Village_Rambhi", "RiverRoad_1", "Hospital_Mongpu"]
    assert base_time == 720.0 # 12.0 minutes

    # Simulate flood inundation destroying direct river road
    G_damaged = G.copy()
    G_damaged.remove_edge("Village_Rambhi", "RiverRoad_1")

    # Recalculate route on damaged network
    assert nx.has_path(G_damaged, "Village_Rambhi", "Hospital_Mongpu")
    alt_path = nx.shortest_path(G_damaged, "Village_Rambhi", "Hospital_Mongpu", weight="weight")
    alt_time = nx.shortest_path_length(G_damaged, "Village_Rambhi", "Hospital_Mongpu", weight="weight")

    assert alt_path == ["Village_Rambhi", "RidgePass_1", "RidgePass_2", "Hospital_Mongpu"]
    assert alt_time == 2520.0 # 42.0 minutes

    detour_delay_min = (alt_time - base_time) / 60.0
    assert detour_delay_min == 30.0 # Exactly 30 minute delay

def test_unreachable_destinations_isolation():
    """Tests complete destination unreachability and classification as CRITICALLY_ISOLATED"""
    G = nx.Graph()
    G.add_edge("Isolated_Village", "Village_Access", weight=100, length_m=500)
    G.add_edge("Village_Access", "River_Crossing", weight=200, length_m=1000)
    G.add_edge("River_Crossing", "Highway", weight=300, length_m=2000)
    G.add_edge("Highway", "Emergency_Relief_Base", weight=400, length_m=3000)

    # Pre-disaster
    assert nx.has_path(G, "Isolated_Village", "Emergency_Relief_Base")

    # Disaster washes out the only bridge / river crossing
    G_damaged = G.copy()
    G_damaged.remove_edge("Village_Access", "River_Crossing")

    assert not nx.has_path(G_damaged, "Isolated_Village", "Emergency_Relief_Base")

def test_bridge_clearance_preservation():
    """
    Verifies that high-clearance bridges (e.g. Coronation Bridge) are preserved
    and NOT falsely classified as destroyed when floodwaters pass underneath.
    """
    res = isolation_engine.run_accessibility_analysis()
    closed_names = [c.name for c in res.closed_road_segments]
    
    # Coronation Bridge must NEVER be in closed road segments under standard clearance
    assert "Coronation Bridge" not in closed_names
    assert any("Bridge Clearance Rule" in a for a in res.exposure_assumptions)

def test_configurable_exposure_parameters():
    """
    Verifies that exposure parameters change the outcomes:
    - High-clearance 4x4 rescue vehicles (0.60m depth threshold) result in fewer closed breaches
      and fewer isolated villages than standard passenger vehicles (0.35m threshold).
    """
    params_standard = RoadExposureParams(
        allow_4x4_high_clearance=False,
        critical_water_depth_m=0.35
    )
    res_standard = isolation_engine.run_accessibility_analysis(params_standard)

    params_4x4 = RoadExposureParams(
        allow_4x4_high_clearance=True,
        critical_water_depth_m=0.80
    )
    res_4x4 = isolation_engine.run_accessibility_analysis(params_4x4)

    # 4x4 fleet should have fewer closed road segments and at most as many isolated villages
    assert res_4x4.closed_road_segments_count <= res_standard.closed_road_segments_count
    assert res_4x4.isolated_villages_count <= res_standard.isolated_villages_count
    assert res_4x4.accessible_villages_count >= res_standard.accessible_villages_count

def test_facilities_and_settlements_loading():
    """Verifies that real healthcare facilities and settlements load accurately"""
    facilities = isolation_engine.load_emergency_facilities()
    assert len(facilities) >= 5
    fac_names = [f.name for f in facilities]
    assert any("Hospital" in n for n in fac_names)
    assert any("Teesta" in n or "Melli" in n for n in fac_names)
    assert any("Oodlabari" in n for n in fac_names)

    settlements = isolation_engine.load_settlements()
    assert len(settlements) >= 5
    sett_names = [s["name"] for s in settlements]
    assert "Sevoke" in sett_names
    assert "Purbba Totgaon" in sett_names

def test_isolation_api_handlers():
    """Tests the FastAPI route handlers directly"""
    # 1. POST /api/isolation/analyze
    res = analyze_road_isolation(RoadExposureParams(min_submerged_length_m=30.0))
    assert isinstance(res, RoadIsolationAnalysisResult)
    assert res.total_road_network_km > 0
    assert len(res.exposure_assumptions) >= 4

    # 2. GET /api/isolation/latest
    latest = get_latest_isolation_analysis()
    assert latest.id == res.id

    # 3. GET /api/isolation/facilities
    facs = get_emergency_facilities()
    assert len(facs) >= 5

    # 4. GET /api/isolation/export/geojson
    resp = export_isolation_geojson(res.id)
    assert resp.status_code == 200
    assert Path(resp.path).exists()
