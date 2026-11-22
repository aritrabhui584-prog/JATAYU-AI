import os
import sys
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OPTICAL_DIR = DATA_DIR / "geotiff" / "optical"
OPTICAL_DIR.mkdir(parents=True, exist_ok=True)
GEOTIFF_DIR = DATA_DIR / "geotiff"
RENDERS_DIR = GEOTIFF_DIR / "renders"
RENDERS_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "sqlite" / "jatayu.db"

# Target AOI for Lower/Middle Teesta Gorge Corridor (Tile T45RXK): [min_lon, min_lat, max_lon, max_lat]
AOI_BOUNDS = (88.25, 26.50, 88.85, 27.10)
# Height=720, Width=600 (~90m-100m grid for fast responsive Leaflet overlays and instant NDWI rendering)
HEIGHT, WIDTH = 720, 600

HISTORICAL_SCENE = {
    "id": "S2A_MSIL2A_20231120_TEESTA_POST",
    "stac_id": "S2A_MSIL2A_20231120T044101_R033_T45RXK_20241103T044510",
    "date": "2023-11-20T04:41:01Z",
    "cloud_cover": 2.85,
    "filename": "s2_teesta_post_20231120.tif",
    "tile_id": "T45RXK",
    "platform": "Sentinel-2A",
    "instrument": "MSI"
}

CURRENT_SCENE = {
    "id": "S2B_MSIL2A_20261119_TEESTA_CURRENT",
    "stac_id": "S2B_MSIL2A_20261119T044059_R033_T45RXK_20261119T081311",
    "date": "2026-11-19T04:40:59Z",
    "cloud_cover": 1.87,
    "filename": "s2_teesta_current_20261119.tif",
    "tile_id": "T45RXK",
    "platform": "Sentinel-2B",
    "instrument": "MSI"
}

# Default to authentic current scene
SCENE_METADATA = CURRENT_SCENE

def sign_asset_url(raw_url: str) -> str:
    sign_api = "https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=" + urllib.parse.quote(raw_url, safe="")
    req = urllib.request.Request(sign_api, headers={"User-Agent": "JatayuAI/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.loads(resp.read().decode("utf-8"))["href"]
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(2)

def fetch_and_clip_sentinel2(scene_info: dict = None):
    scene = scene_info or SCENE_METADATA
    out_path = OPTICAL_DIR / scene["filename"]
    legacy_path = GEOTIFF_DIR / f"{scene['id']}_wgs84.tif"

    if out_path.exists() and out_path.stat().st_size > 500000:
        print(f"[EXISTS] {out_path} already exists ({out_path.stat().st_size} bytes)", flush=True)
    else:
        print(f"[STAC] Fetching item metadata for {scene['stac_id']}...", flush=True)
        item_url = f"https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/{scene['stac_id']}"
        req = urllib.request.Request(item_url, headers={"User-Agent": "JatayuAI/1.0"})
        item = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=25) as resp:
                    item = json.loads(resp.read().decode("utf-8"))
                    break
            except Exception as e:
                if attempt == 2:
                    raise
                time.sleep(2)

        bands = ["B04", "B03", "B02", "B08"] # Red, Green, Blue, NIR
        band_arrays = []

        dst_crs = "EPSG:4326"
        dst_transform = from_bounds(AOI_BOUNDS[0], AOI_BOUNDS[1], AOI_BOUNDS[2], AOI_BOUNDS[3], WIDTH, HEIGHT)

        for b_name in bands:
            raw_href = item["assets"][b_name]["href"]
            print(f"[SIGN] Signing URL for Band {b_name}...", flush=True)
            signed_href = sign_asset_url(raw_href)

            print(f"[STREAM] Reprojecting Band {b_name} over Teesta AOI...", flush=True)
            t0 = time.time()
            band_arr = np.zeros((HEIGHT, WIDTH), dtype=np.uint16)
            with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
                with rasterio.open(signed_href) as src:
                    reproject(
                        source=rasterio.band(src, 1),
                        destination=band_arr,
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=dst_transform,
                        dst_crs=dst_crs,
                        resampling=Resampling.bilinear
                    )
            print(f"  -> Band {b_name} processed in {time.time()-t0:.1f}s (min={band_arr.min()}, max={band_arr.max()})", flush=True)
            band_arrays.append(band_arr)

        # Write 4-band GeoTIFF
        meta = {
            "driver": "GTiff",
            "height": HEIGHT,
            "width": WIDTH,
            "count": 4,
            "dtype": "uint16",
            "crs": dst_crs,
            "transform": dst_transform,
            "compress": "deflate",
            "nodata": 0,
        }

        with rasterio.open(out_path, "w", **meta) as dst:
            for idx, arr in enumerate(band_arrays, 1):
                dst.write(arr, idx)

        # Also save legacy path
        with rasterio.open(legacy_path, "w", **meta) as dst:
            for idx, arr in enumerate(band_arrays, 1):
                dst.write(arr, idx)

        print(f"[SAVED] Authentic 4-Band Sentinel-2 GeoTIFF saved to {out_path} ({out_path.stat().st_size} bytes)", flush=True)

    # Pre-render True Color RGB and NDWI
    print(f"[RENDER] Pre-rendering RGB, NDWI, and Cloud Mask for {scene['id']}...", flush=True)
    sys.path.insert(0, str(BASE_DIR))
    from app.engines.raster_engine import raster_engine

    rgb_png = RENDERS_DIR / f"{scene['id']}_true_color.png"
    ndwi_png = RENDERS_DIR / f"{scene['id']}_ndwi.png"
    cloud_png = RENDERS_DIR / f"{scene['id']}_cloud_mask.png"

    raster_engine.generate_sentinel2_rgb(out_path, rgb_png)
    raster_engine.compute_ndwi(out_path, ndwi_png)
    raster_engine.compute_cloud_mask(out_path, cloud_png)
    print(f"[RENDER] Generated {rgb_png.name}, {ndwi_png.name}, {cloud_png.name}", flush=True)

    # Register into SQLite database
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    bounds_json = json.dumps([AOI_BOUNDS[1], AOI_BOUNDS[0], AOI_BOUNDS[3], AOI_BOUNDS[2]]) # [south, west, north, east]
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    cur.execute("""
    INSERT INTO satellite_scenes (
        id, mission, platform, instrument, product_id, acquisition_date,
        cloud_cover, bounds_json, status, status_message, crs, resolution_m,
        geotiff_path, thumbnail_url, assets_json, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        status_message = excluded.status_message,
        geotiff_path = excluded.geotiff_path,
        cloud_cover = excluded.cloud_cover,
        bounds_json = excluded.bounds_json,
        updated_at = excluded.updated_at
    """, (
        scene["id"],
        "Sentinel-2",
        scene["platform"],
        scene["instrument"],
        scene["id"],
        scene["date"],
        scene["cloud_cover"],
        bounds_json,
        "Processed",
        "Authentic Sentinel-2 L2A 4-band MSI raster acquired and calibrated",
        "EPSG:4326",
        10.0,
        str(out_path.resolve()),
        None,
        json.dumps({}),
        json.dumps({"tile_id": scene["tile_id"]}),
        now,
        now
    ))
    conn.commit()
    conn.close()
    print(f"[DB] Scene {scene['id']} successfully registered in {DB_PATH}", flush=True)

if __name__ == "__main__":
    fetch_and_clip_sentinel2(CURRENT_SCENE)
