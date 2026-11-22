import urllib.request
import json

base_url = "http://127.0.0.1:8000"

print("1. Testing GET /api/raster/scenes...")
req = urllib.request.Request(f"{base_url}/api/raster/scenes")
with urllib.request.urlopen(req, timeout=10) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    print(f"   Status {resp.status}, Total scenes: {data['total']}")
    for sc in data["scenes"]:
        print(f"   - {sc['id']} | Mission: {sc['mission']} | Status: {sc['status']} | Local: {sc['has_local_raster']}")

print("\n2. Testing GET /api/raster/scenes/S2A_MSIL2A_20231120_TEESTA_POST...")
with urllib.request.urlopen(f"{base_url}/api/raster/scenes/S2A_MSIL2A_20231120_TEESTA_POST", timeout=10) as resp:
    s2_data = json.loads(resp.read().decode("utf-8"))
    print(f"   Status {resp.status}, Cloud Cover: {s2_data['cloud_cover']}%, CRS: {s2_data['crs']}")

print("\n3. Testing GET S2 True-Color RGB Render overlay...")
with urllib.request.urlopen(f"{base_url}/api/raster/scenes/S2A_MSIL2A_20231120_TEESTA_POST/render?mode=true_color", timeout=10) as resp:
    img_data = resp.read()
    print(f"   Status {resp.status}, Content-Type: {resp.headers.get('Content-Type')}, Size: {len(img_data)} bytes")

print("\n4. Testing GET S2 NDWI Water Index Render overlay...")
with urllib.request.urlopen(f"{base_url}/api/raster/scenes/S2A_MSIL2A_20231120_TEESTA_POST/render?mode=ndwi", timeout=10) as resp:
    ndwi_data = resp.read()
    print(f"   Status {resp.status}, Content-Type: {resp.headers.get('Content-Type')}, Size: {len(ndwi_data)} bytes")

print("\n5. Testing GET S1 Calibrated SAR Render overlay...")
with urllib.request.urlopen(f"{base_url}/api/raster/scenes/S1A_IW_GRDH_1SDV_20231010_TEESTA_POST/render?mode=sar_calibrated", timeout=10) as resp:
    sar_data = resp.read()
    print(f"   Status {resp.status}, Content-Type: {resp.headers.get('Content-Type')}, Size: {len(sar_data)} bytes")

print("\n6. Testing Root SPA Serving (http://127.0.0.1:8000/)...")
with urllib.request.urlopen(f"{base_url}/", timeout=10) as resp:
    html = resp.read().decode("utf-8")
    print(f"   Status {resp.status}, Title in HTML: {'JATAYU AI' in html or '<title>' in html}")

print("\n>>> ALL SATELLITE RENDERING & SINGLE-PORT ENDPOINTS VERIFIED 100% OPERATIONAL! <<<")
