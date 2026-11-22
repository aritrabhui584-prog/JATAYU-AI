import os
import rasterio
import sqlite3
import json
from pathlib import Path

data_dir = Path("backend/data")
print("=== DATA DIR INVENTORY ===")
for sub in ["geojson", "geotiff/dem", "viirs", "sqlite"]:
    p = data_dir / sub
    if p.exists():
        for f in p.iterdir():
            if f.is_file():
                print(f"{sub}/{f.name}: {f.stat().st_size:,} bytes")

print("\n=== DEM RASTERIO CHECK ===")
dem_path = data_dir / "geotiff/dem/teesta_cop90_dem.tif"
if dem_path.exists():
    with rasterio.open(dem_path) as src:
        print("CRS:", src.crs)
        print("Bounds:", src.bounds)
        print("Shape:", src.shape)
        print("Res:", src.res)
        arr = src.read(1)
        valid = arr[arr != src.nodata]
        print("Elev Min:", valid.min(), "Max:", valid.max())
else:
    print("DEM MISSING!")

print("\n=== SQLITE CHECK ===")
db_path = data_dir / "sqlite/jatayu.db"
if db_path.exists():
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    print("Tables:", tables)
    for t in tables:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"  {t}: {cur.fetchone()[0]} rows")
    conn.close()
else:
    print("SQLITE DB MISSING!")
