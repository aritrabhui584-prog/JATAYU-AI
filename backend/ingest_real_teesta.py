"""
Compact real OSM ingestion for Teesta Gorge (Sevoke / Coronation Bridge corridor)
"""

import json
from pathlib import Path
import osmnx as ox

# Bounding box covering Sevoke, Teesta Coronation Bridge, and foothills gorge
# (west, south, east, north)
bbox = (88.40, 26.85, 88.55, 27.05)
print(f"Targeting Teesta Gorge Sector: {bbox}", flush=True)

ox.settings.timeout = 25
ox.settings.use_cache = True

geojson_dir = Path("backend/data/geojson")
geojson_dir.mkdir(parents=True, exist_ok=True)

# 1. Fetch real settlements
print("Fetching real settlements...", flush=True)
settlements_gdf = ox.features_from_bbox(
    bbox=bbox,
    tags={"place": ["town", "village", "hamlet"]}
)
print(f"Settlements found: {len(settlements_gdf)}", flush=True)

settlements = []
for idx, row in settlements_gdf.iterrows():
    geom = row.geometry
    if geom.geom_type == "Point":
        name = row.get("name")
        if not name or str(name) == "nan":
            name = f"Teesta Settlement ({row.get('place', 'village')})"
        settlements.append({
            "type": "Feature",
            "id": f"node/{row.get('osmid', idx)}",
            "geometry": {
                "type": "Point",
                "coordinates": [round(geom.x, 5), round(geom.y, 5)]
            },
            "properties": {
                "osm_id": row.get("osmid", idx),
                "name": str(name),
                "place": str(row.get("place", "village")),
                "ele": float(row["ele"]) if "ele" in row and str(row["ele"]).replace(".","").isdigit() else None,
                "population": int(row["population"]) if "population" in row and str(row["population"]).isdigit() else None,
                "source": "OpenStreetMap Real Topography",
            }
        })

with open(geojson_dir / "osm_settlements.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": settlements}, f, indent=2)
print(f"Saved {len(settlements)} real settlements to osm_settlements.geojson", flush=True)

# 2. Fetch real roads (trunk, primary, secondary)
print("Fetching real roads (NH10 / primary / secondary)...", flush=True)
roads_gdf = ox.features_from_bbox(
    bbox=bbox,
    tags={"highway": ["trunk", "primary", "secondary"]}
)
print(f"Road features found: {len(roads_gdf)}", flush=True)

roads = []
for idx, row in roads_gdf.iterrows():
    geom = row.geometry
    hw = str(row.get("highway", "primary"))
    name = str(row.get("name", "NH10 / Teesta Highway"))
    if not name or name == "nan":
        name = f"Teesta Corridor Road ({hw})"

    if geom.geom_type == "LineString":
        roads.append({
            "type": "Feature",
            "id": f"way/{row.get('osmid', idx)}",
            "geometry": {
                "type": "LineString",
                "coordinates": [[round(c[0], 5), round(c[1], 5)] for c in geom.coords]
            },
            "properties": {
                "osm_id": row.get("osmid", idx),
                "name": name,
                "highway": hw,
                "surface": str(row.get("surface", "paved")),
                "source": "OpenStreetMap Real Topography",
            }
        })
    elif geom.geom_type == "MultiLineString":
        for line in geom.geoms:
            roads.append({
                "type": "Feature",
                "id": f"way/{row.get('osmid', idx)}",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[round(c[0], 5), round(c[1], 5)] for c in line.coords]
                },
                "properties": {
                    "osm_id": row.get("osmid", idx),
                    "name": name,
                    "highway": hw,
                    "surface": str(row.get("surface", "paved")),
                    "source": "OpenStreetMap Real Topography",
                }
            })

with open(geojson_dir / "osm_roads.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": roads}, f, indent=2)
print(f"Saved {len(roads)} real road segments to osm_roads.geojson", flush=True)

# 3. Fetch real waterways
print("Fetching real waterways (Teesta River channels)...", flush=True)
waterways_gdf = ox.features_from_bbox(
    bbox=bbox,
    tags={"waterway": ["river", "stream"]}
)
print(f"Waterways features found: {len(waterways_gdf)}", flush=True)

waterways = []
for idx, row in waterways_gdf.iterrows():
    geom = row.geometry
    w_type = str(row.get("waterway", "river"))
    name = str(row.get("name", "Teesta River Channel"))
    if not name or name == "nan":
        name = "Teesta River Channel"

    if geom.geom_type == "LineString":
        waterways.append({
            "type": "Feature",
            "id": f"way/{row.get('osmid', idx)}",
            "geometry": {
                "type": "LineString",
                "coordinates": [[round(c[0], 5), round(c[1], 5)] for c in geom.coords]
            },
            "properties": {
                "osm_id": row.get("osmid", idx),
                "name": name,
                "waterway": w_type,
                "source": "OpenStreetMap Real Topography",
            }
        })
    elif geom.geom_type == "MultiLineString":
        for line in geom.geoms:
            waterways.append({
                "type": "Feature",
                "id": f"way/{row.get('osmid', idx)}",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[round(c[0], 5), round(c[1], 5)] for c in line.coords]
                },
                "properties": {
                    "osm_id": row.get("osmid", idx),
                    "name": name,
                    "waterway": w_type,
                    "source": "OpenStreetMap Real Topography",
                }
            })

with open(geojson_dir / "osm_waterways.geojson", "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": waterways}, f, indent=2)
print(f"Saved {len(waterways)} real waterway channels to osm_waterways.geojson", flush=True)

# Update layer metadata in SQLite
from app.engines.metadata_engine import metadata_engine
from app.models.ingestion import IngestionState

metadata_engine.upsert_layer_metadata(
    layer_key="osm_settlements",
    layer_name="OSM Settlements (Villages & Towns)",
    category="settlements",
    data_source="OpenStreetMap OSMnx/Overpass",
    attribution="© OpenStreetMap contributors (ODbL)",
    feature_count=len(settlements),
    geometry_type="Point",
    bounds=[bbox[1], bbox[0], bbox[3], bbox[2]],
    file_path=str(geojson_dir / "osm_settlements.geojson"),
    is_available=True,
    status_message=f"{len(settlements)} verified settlements ingested"
)
metadata_engine.upsert_layer_metadata(
    layer_key="osm_roads",
    layer_name="OSM Road Network",
    category="roads",
    data_source="OpenStreetMap OSMnx/Overpass",
    attribution="© OpenStreetMap contributors (ODbL)",
    feature_count=len(roads),
    geometry_type="LineString",
    bounds=[bbox[1], bbox[0], bbox[3], bbox[2]],
    file_path=str(geojson_dir / "osm_roads.geojson"),
    is_available=True,
    status_message=f"{len(roads)} real road segments ingested"
)
metadata_engine.upsert_layer_metadata(
    layer_key="osm_waterways",
    layer_name="OSM Waterways (Teesta & Tributaries)",
    category="waterways",
    data_source="OpenStreetMap OSMnx/Overpass",
    attribution="© OpenStreetMap contributors (ODbL)",
    feature_count=len(waterways),
    geometry_type="LineString",
    bounds=[bbox[1], bbox[0], bbox[3], bbox[2]],
    file_path=str(geojson_dir / "osm_waterways.geojson"),
    is_available=True,
    status_message=f"{len(waterways)} waterway channels ingested"
)

total_items = len(settlements) + len(roads) + len(waterways)
metadata_engine.update_service_state(
    "osm", IngestionState.AVAILABLE, is_available=True,
    feature_count=total_items,
    metadata={"settlements_count": len(settlements), "roads_count": len(roads), "waterways_count": len(waterways)}
)

print(f"REAL DATA INGESTION COMPLETE: {total_items} real geographic features ingested and cached!", flush=True)
