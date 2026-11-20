"""
Ingest real OSM data for the Teesta Corridor using OSMnx and Overpass
"""

import json
from pathlib import Path
import osmnx as ox

# Bounding Box for Middle Teesta Corridor (Sevoke to Singtam / Kalimpong corridor)
# (west, south, east, north)
bbox = (88.40, 26.85, 88.58, 27.15)
print(f"Ingesting real OpenStreetMap data for Teesta Gorge: {bbox}...", flush=True)

ox.settings.timeout = 30
ox.settings.use_cache = True

geojson_dir = Path("backend/data/geojson")
geojson_dir.mkdir(parents=True, exist_ok=True)

# 1. Fetch real settlements
print("Fetching real settlements...", flush=True)
try:
    settlements_gdf = ox.features_from_bbox(
        bbox=bbox,
        tags={"place": ["town", "village", "hamlet"]}
    )
    print(f"Settlements found: {len(settlements_gdf)}", flush=True)
    settlements = []
    for idx, row in settlements_gdf.iterrows():
        geom = row.geometry
        if geom.geom_type == "Point":
            settlements.append({
                "type": "Feature",
                "id": f"node/{row.get('osmid', idx)}",
                "geometry": {
                    "type": "Point",
                    "coordinates": [geom.x, geom.y]
                },
                "properties": {
                    "osm_id": row.get("osmid", idx),
                    "name": row.get("name") or row.get("name:en") or "Teesta Settlement",
                    "place": row.get("place", "village"),
                    "ele": float(row["ele"]) if "ele" in row and str(row["ele"]).replace(".","").isdigit() else None,
                    "population": int(row["population"]) if "population" in row and str(row["population"]).isdigit() else None,
                    "source": "OpenStreetMap",
                }
            })
    with open(geojson_dir / "osm_settlements.geojson", "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": settlements}, f, indent=2)
    print(f"Saved {len(settlements)} real settlements to osm_settlements.geojson", flush=True)
except Exception as e:
    print(f"Settlements query error: {e}", flush=True)

# 2. Fetch real roads
print("Fetching real road network (NH10 / primary / secondary)...", flush=True)
try:
    roads_gdf = ox.features_from_bbox(
        bbox=bbox,
        tags={"highway": ["trunk", "primary", "secondary"]}
    )
    print(f"Roads found: {len(roads_gdf)}", flush=True)
    roads = []
    for idx, row in roads_gdf.iterrows():
        geom = row.geometry
        if geom.geom_type == "LineString":
            roads.append({
                "type": "Feature",
                "id": f"way/{row.get('osmid', idx)}",
                "geometry": {
                    "type": "LineString",
                    "coordinates": list(geom.coords)
                },
                "properties": {
                    "osm_id": row.get("osmid", idx),
                    "name": row.get("name") or row.get("name:en") or "NH10 / Valley Road",
                    "highway": row.get("highway", "primary"),
                    "surface": row.get("surface"),
                    "source": "OpenStreetMap",
                }
            })
        elif geom.geom_type == "MultiLineString":
            for line in geom.geoms:
                roads.append({
                    "type": "Feature",
                    "id": f"way/{row.get('osmid', idx)}",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": list(line.coords)
                    },
                    "properties": {
                        "osm_id": row.get("osmid", idx),
                        "name": row.get("name") or row.get("name:en") or "NH10 / Valley Road",
                        "highway": row.get("highway", "primary"),
                        "surface": row.get("surface"),
                        "source": "OpenStreetMap",
                    }
                })
    with open(geojson_dir / "osm_roads.geojson", "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": roads}, f, indent=2)
    print(f"Saved {len(roads)} real road segments to osm_roads.geojson", flush=True)
except Exception as e:
    print(f"Roads query error: {e}", flush=True)

# 3. Fetch real waterways
print("Fetching real waterways (Teesta & tributaries)...", flush=True)
try:
    waterways_gdf = ox.features_from_bbox(
        bbox=bbox,
        tags={"waterway": ["river", "stream"]}
    )
    print(f"Waterways found: {len(waterways_gdf)}", flush=True)
    waterways = []
    for idx, row in waterways_gdf.iterrows():
        geom = row.geometry
        if geom.geom_type == "LineString":
            waterways.append({
                "type": "Feature",
                "id": f"way/{row.get('osmid', idx)}",
                "geometry": {
                    "type": "LineString",
                    "coordinates": list(geom.coords)
                },
                "properties": {
                    "osm_id": row.get("osmid", idx),
                    "name": row.get("name") or row.get("name:en") or "Teesta River Channel",
                    "waterway": row.get("waterway", "river"),
                    "source": "OpenStreetMap",
                }
            })
        elif geom.geom_type == "MultiLineString":
            for line in geom.geoms:
                waterways.append({
                    "type": "Feature",
                    "id": f"way/{row.get('osmid', idx)}",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": list(line.coords)
                    },
                    "properties": {
                        "osm_id": row.get("osmid", idx),
                        "name": row.get("name") or row.get("name:en") or "Teesta River Channel",
                        "waterway": row.get("waterway", "river"),
                        "source": "OpenStreetMap",
                    }
                })
    with open(geojson_dir / "osm_waterways.geojson", "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": waterways}, f, indent=2)
    print(f"Saved {len(waterways)} real waterway channels to osm_waterways.geojson", flush=True)
except Exception as e:
    print(f"Waterways query error: {e}", flush=True)

print("Ingestion script complete!", flush=True)
