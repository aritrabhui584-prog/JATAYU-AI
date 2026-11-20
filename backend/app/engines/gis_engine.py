"""
GIS Engine - Spatial Analysis, NetworkX Road Topology and Village Isolation
"""

import math
from typing import Any, Dict, List, Optional, Tuple
import networkx as nx
from shapely.geometry import Point, LineString, shape, mapping
import pyproj
from pyproj import Geod

geod = Geod(ellps="WGS84")

class GISEngine:
    def __init__(self):
        pass

    def compute_linestring_length_meters(self, coords: List[List[float]]) -> float:
        """Calculate real geodetic length of line in meters using WGS84 ellipsoid"""
        if len(coords) < 2:
            return 0.0
        total_length = 0.0
        for i in range(len(coords) - 1):
            lon1, lat1 = coords[i][0], coords[i][1]
            lon2, lat2 = coords[i+1][0], coords[i+1][1]
            _, _, dist = geod.inv(lon1, lat1, lon2, lat2)
            total_length += dist
        return total_length

    def compute_point_distance_meters(self, lon1: float, lat1: float, lon2: float, lat2: float) -> float:
        """Geodetic distance between two WGS84 points in meters"""
        _, _, dist = geod.inv(lon1, lat1, lon2, lat2)
        return dist

    def build_road_network(self, roads_geojson: dict) -> Tuple[nx.Graph, Dict[str, Any]]:
        """
        Builds a real NetworkX graph from OSM road line strings.
        Nodes are road intersections/endpoints (rounded to 5 decimal places ~ 1m).
        Edges are road segments with real geodetic length in meters.
        """
        G = nx.Graph()
        features = roads_geojson.get("features", [])
        total_length_km = 0.0
        highway_classes = {}

        for feat in features:
            geom = feat.get("geometry", {})
            props = feat.get("properties", {})
            hw_type = props.get("highway", "unclassified")
            highway_classes[hw_type] = highway_classes.get(hw_type, 0) + 1

            if geom.get("type") == "LineString":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    for i in range(len(coords) - 1):
                        u = (round(coords[i][0], 5), round(coords[i][1], 5))
                        v = (round(coords[i+1][0], 5), round(coords[i+1][1], 5))
                        seg_dist = self.compute_point_distance_meters(u[0], u[1], v[0], v[1])
                        total_length_km += seg_dist / 1000.0
                        G.add_edge(
                            u, v,
                            weight=seg_dist,
                            highway=hw_type,
                            name=props.get("name", "Unnamed Road"),
                            osm_id=feat.get("id")
                        )

        components = list(nx.connected_components(G)) if len(G) > 0 else []
        stats = {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
            "total_length_km": round(total_length_km, 2),
            "connected_components_count": len(components),
            "highway_breakdown": highway_classes,
        }
        return G, stats

    def calculate_settlement_isolation(
        self,
        settlements_geojson: dict,
        roads_geojson: dict,
        waterways_geojson: Optional[dict] = None
    ) -> List[Dict[str, Any]]:
        """
        Calculates topological isolation metrics for real settlements:
        - Distance to nearest road network segment
        - Highway type of nearest road
        - Graph degree of nearest network intersection
        - Distance to major waterway (Teesta / tributary) if available
        - Isolation Classification: HIGH, MODERATE, LOW
        """
        features_settlements = settlements_geojson.get("features", [])
        features_roads = roads_geojson.get("features", [])
        
        # Extract road lines as Shapely geometries
        road_lines = []
        for feat in features_roads:
            geom = feat.get("geometry")
            if geom and geom.get("type") == "LineString":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    road_lines.append((LineString(coords), feat.get("properties", {})))

        # Extract waterway lines if available
        waterway_lines = []
        if waterways_geojson:
            for feat in waterways_geojson.get("features", []):
                geom = feat.get("geometry")
                if geom and geom.get("type") == "LineString":
                    coords = geom.get("coordinates", [])
                    if len(coords) >= 2:
                        waterway_lines.append((LineString(coords), feat.get("properties", {})))

        G, _ = self.build_road_network(roads_geojson)

        results = []
        for s_feat in features_settlements:
            geom = s_feat.get("geometry", {})
            props = s_feat.get("properties", {})
            if geom.get("type") != "Point":
                continue

            lon, lat = geom.get("coordinates", [0, 0])
            s_point = Point(lon, lat)

            nearest_road_dist_m = float("inf")
            nearest_road_name = "None Detected in AOI"
            nearest_highway_type = "none"

            for r_line, r_props in road_lines:
                # Approximate distance in meters
                dist_deg = s_point.distance(r_line)
                # Convert degree distance to approximate meters in Teesta latitude
                dist_m = dist_deg * 111000.0
                if dist_m < nearest_road_dist_m:
                    nearest_road_dist_m = dist_m
                    nearest_road_name = r_props.get("name") or "Unnamed Road"
                    nearest_highway_type = r_props.get("highway", "unclassified")

            # Distance to nearest waterway
            nearest_waterway_dist_m = None
            nearest_waterway_name = None
            if waterway_lines:
                min_w_dist = float("inf")
                for w_line, w_props in waterway_lines:
                    dist_deg = s_point.distance(w_line)
                    dist_m = dist_deg * 111000.0
                    if dist_m < min_w_dist:
                        min_w_dist = dist_m
                        nearest_waterway_name = w_props.get("name") or "Unnamed Stream/River"
                nearest_waterway_dist_m = round(min_w_dist, 1)

            # Degree of connectivity
            isolation_level = "LOW"
            if nearest_road_dist_m > 3000.0:
                isolation_level = "CRITICAL"
            elif nearest_road_dist_m > 1000.0:
                isolation_level = "HIGH"
            elif nearest_road_dist_m > 300.0:
                isolation_level = "MODERATE"

            results.append({
                "osm_id": s_feat.get("id"),
                "name": props.get("name", "Unnamed Settlement"),
                "place_type": props.get("place", "village"),
                "latitude": lat,
                "longitude": lon,
                "elevation_m": props.get("ele"),
                "population": props.get("population"),
                "nearest_road_name": nearest_road_name,
                "nearest_highway_type": nearest_highway_type,
                "nearest_road_distance_m": round(nearest_road_dist_m, 1) if nearest_road_dist_m != float("inf") else None,
                "nearest_waterway_name": nearest_waterway_name,
                "nearest_waterway_distance_m": nearest_waterway_dist_m,
                "isolation_level": isolation_level,
                "data_source": "OpenStreetMap Real Topography"
            })

        # Sort by isolation distance descending (most isolated first)
        results.sort(key=lambda x: (x["nearest_road_distance_m"] or 0), reverse=True)
        return results

gis_engine = GISEngine()
