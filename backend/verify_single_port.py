import urllib.request
import urllib.error
import json
import re
import sys

base = "http://127.0.0.1:8000"

checks = []

# 1. Root SPA HTML
try:
    with urllib.request.urlopen(f"{base}/", timeout=10) as r:
        body = r.read().decode("utf-8")
        status = r.status
        content_type = r.headers.get("Content-Type", "")
        has_root = '<div id="root">' in body
        has_title = 'JATAYU' in body
        checks.append(("SPA Root UI (/)", status == 200 and has_root and has_title, f"HTTP {status}, root_div={has_root}, title={has_title}"))
except Exception as e:
    checks.append(("SPA Root UI (/)", False, str(e)))

# 2. Swagger Docs
try:
    with urllib.request.urlopen(f"{base}/docs", timeout=10) as r:
        body = r.read().decode("utf-8")
        checks.append(("Swagger UI (/docs)", r.status == 200 and "swagger-ui" in body.lower(), f"HTTP {r.status}"))
except Exception as e:
    checks.append(("Swagger UI (/docs)", False, str(e)))

# 3. Client SPA Route (/flood-analysis)
try:
    with urllib.request.urlopen(f"{base}/flood-analysis", timeout=10) as r:
        body = r.read().decode("utf-8")
        has_root = '<div id="root">' in body
        checks.append(("SPA Client Route (/flood-analysis)", r.status == 200 and has_root, f"HTTP {r.status}, root_div={has_root}"))
except Exception as e:
    checks.append(("SPA Client Route (/flood-analysis)", False, str(e)))

# 4. API Health
try:
    with urllib.request.urlopen(f"{base}/api/health", timeout=10) as r:
        data = json.loads(r.read().decode("utf-8"))
        checks.append(("API Health (/api/health)", r.status == 200 and data.get("status") == "healthy", f"HTTP {r.status}, {data}"))
except Exception as e:
    checks.append(("API Health (/api/health)", False, str(e)))

# 5. Overview Summary
try:
    with urllib.request.urlopen(f"{base}/api/overview/summary", timeout=10) as r:
        data = json.loads(r.read().decode("utf-8"))
        checks.append(("API Overview (/api/overview/summary)", r.status == 200 and "active_aoi" in data, f"HTTP {r.status}, aoi={data.get('active_aoi', {}).get('name')}"))
except Exception as e:
    checks.append(("API Overview (/api/overview/summary)", False, str(e)))

# 6. Priority Top 5
try:
    with urllib.request.urlopen(f"{base}/api/priority/top5", timeout=10) as r:
        data = json.loads(r.read().decode("utf-8"))
        checks.append(("API Priority (/api/priority/top5)", r.status == 200 and len(data) > 0, f"HTTP {r.status}, count={len(data)}"))
except Exception as e:
    checks.append(("API Priority (/api/priority/top5)", False, str(e)))

# 7. SITREP PDF Export
try:
    with urllib.request.urlopen(f"{base}/api/priority/export/sitrep.pdf", timeout=10) as r:
        data = r.read()
        is_pdf = data[:5] == b"%PDF-"
        checks.append(("API SITREP PDF (/api/priority/export/sitrep.pdf)", r.status == 200 and is_pdf, f"HTTP {r.status}, bytes={len(data)}, is_pdf={is_pdf}"))
except Exception as e:
    checks.append(("API SITREP PDF (/api/priority/export/sitrep.pdf)", False, str(e)))

# 8. Unmatched API 404 (must return JSON 404, not HTML)
try:
    urllib.request.urlopen(f"{base}/api/unmatched_route_test", timeout=10)
    checks.append(("API 404 Handling (/api/unmatched_route_test)", False, "Expected 404 but got 200"))
except urllib.error.HTTPError as e:
    is_json = "application/json" in e.headers.get("Content-Type", "")
    checks.append(("API 404 Handling (/api/unmatched_route_test)", e.code == 404 and is_json, f"HTTP {e.code}, json={is_json}"))
except Exception as e:
    checks.append(("API 404 Handling (/api/unmatched_route_test)", False, str(e)))

# Print Results
print("==================================================================")
print("  JATAYU AI — SINGLE-PORT (8000) VERIFICATION RESULTS             ")
print("==================================================================")
all_ok = True
for name, passed, detail in checks:
    flag = "[PASS]" if passed else "[FAIL]"
    print(f"{flag} {name:<45} -> {detail}")
    if not passed:
        all_ok = False

if not all_ok:
    sys.exit(1)
print("\n>>> ALL SINGLE-PORT (8000) OPERATIONAL CHECKS PASSED PERFECTLY! <<<")
