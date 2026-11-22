import urllib.request
import json
import sys

get_endpoints = [
    ("Backend Health", "http://127.0.0.1:8000/api/health"),
    ("Overview Summary", "http://127.0.0.1:8000/api/overview/summary"),
    ("Layers Metadata", "http://127.0.0.1:8000/api/layers"),
    ("OSM Waterways", "http://127.0.0.1:8000/api/layers/osm_waterways"),
    ("OSM Roads", "http://127.0.0.1:8000/api/layers/osm_roads"),
    ("OSM Settlements", "http://127.0.0.1:8000/api/layers/osm_settlements"),
    ("OSM Facilities", "http://127.0.0.1:8000/api/layers/osm_facilities"),
    ("GIS Road Stats", "http://127.0.0.1:8000/api/gis/network-stats"),
    ("DEM Terrain Analysis", "http://127.0.0.1:8000/api/flood/terrain"),
    ("Priority Top 5", "http://127.0.0.1:8000/api/priority/top5"),
    ("SITREP PDF Export", "http://127.0.0.1:8000/api/priority/export/sitrep.pdf"),
    ("Frontend UI", "http://127.0.0.1:8000/"),
]

post_endpoints = [
    ("Flood Scenario (DEM)", "http://127.0.0.1:8000/api/flood/scenario", {"stage_rise_m": 3.0}),
    ("Road Isolation", "http://127.0.0.1:8000/api/isolation/analyze", {}),
    ("Nightlight Analysis", "http://127.0.0.1:8000/api/nightlight/analyze", {}),
]

all_passed = True

print("=== GET ENDPOINTS ===")
for name, url in get_endpoints:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "").split(";")[0]
            print(f"[PASS] {name:<22} -> HTTP {resp.status} ({content_type})")
    except Exception as e:
        print(f"[FAIL] {name:<22} -> {e}")
        all_passed = False

print("\n=== POST ENDPOINTS ===")
for name, url, body in post_endpoints:
    try:
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "").split(";")[0]
            print(f"[PASS] {name:<22} -> HTTP {resp.status} ({content_type})")
    except Exception as e:
        print(f"[FAIL] {name:<22} -> {e}")
        all_passed = False

if not all_passed:
    sys.exit(1)
print("\n>>> ALL 15 LIVE ENDPOINTS VERIFIED OPERATIONAL (HTTP 200) WITH ZERO ERRORS! <<<")
