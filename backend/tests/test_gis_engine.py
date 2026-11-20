"""
Unit tests for GIS Engine: Geodetic calculations, NetworkX graph, and isolation metrics
"""

from app.engines.gis_engine import gis_engine

def test_geodetic_distance():
    # Teesta Coronation bridge Sevoke (~26.88 N, 88.47 E) to Siliguri (~26.72 N, 88.42 E) ~ 18-20 km
    dist_m = gis_engine.compute_point_distance_meters(88.47, 26.88, 88.42, 26.72)
    assert 15000 < dist_m < 25000

def test_road_network_building():
    sample_roads = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "way/1",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[88.47, 26.88], [88.48, 26.89], [88.49, 26.90]]
                },
                "properties": {"highway": "primary", "name": "NH10 Teesta Corridor"}
            }
        ]
    }
    G, stats = gis_engine.build_road_network(sample_roads)
    assert stats["node_count"] == 3
    assert stats["edge_count"] == 2
    assert stats["total_length_km"] > 0
    assert "primary" in stats["highway_breakdown"]

def test_settlement_isolation_calculation():
    sample_settlements = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "node/101",
                "geometry": {"type": "Point", "coordinates": [88.471, 26.881]},
                "properties": {"name": "Sevoke Village", "place": "village"}
            },
            {
                "type": "Feature",
                "id": "node/102",
                "geometry": {"type": "Point", "coordinates": [88.600, 27.200]},
                "properties": {"name": "Remote Alpine Hamlet", "place": "hamlet"}
            }
        ]
    }
    sample_roads = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": "way/1",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[88.47, 26.88], [88.48, 26.89]]
                },
                "properties": {"highway": "trunk", "name": "NH10"}
            }
        ]
    }
    isolation = gis_engine.calculate_settlement_isolation(sample_settlements, sample_roads)
    assert len(isolation) == 2
    sevoke = next(s for s in isolation if s["name"] == "Sevoke Village")
    remote = next(s for s in isolation if s["name"] == "Remote Alpine Hamlet")
    assert sevoke["nearest_road_distance_m"] < 1000.0
    assert remote["nearest_road_distance_m"] > 5000.0
    assert remote["isolation_level"] == "CRITICAL"
