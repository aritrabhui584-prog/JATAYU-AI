"""
JATAYU AI - Automated Raster Engine & Remote Sensing Tests
Verifies raster loading, coordinate reference systems (CRS reprojection),
AOI clipping, multi-spectral band indices (NDWI, cloud mask),
and Sentinel-1 SAR calibration, speckle filtering, and terrain shadow screening.
"""

from pathlib import Path
import numpy as np
import pytest
import rasterio

from app.config import DATA_DIR, RENDERS_DIR
from app.engines.raster_engine import raster_engine
from app.engines.metadata_engine import metadata_engine
from app.models.satellite import SceneProcessingStatus, RasterSceneRecord

TEST_OUTPUT_DIR = DATA_DIR / "geotiff" / "test_scratch"
TEST_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def test_create_and_inspect_geotiff():
    """Test generating a genuine georeferenced GeoTIFF and reading its metadata."""
    tif_path = TEST_OUTPUT_DIR / "test_s2_sample.tif"
    res = raster_engine.create_sample_sentinel_scene(
        output_geotiff_path=tif_path,
        mission="Sentinel-2",
        crs_epsg=4326,
        bbox=(88.40, 26.85, 88.55, 27.05),
        width=128,
        height=128
    )

    assert tif_path.exists()
    assert res["crs"] == "EPSG:4326"
    assert res["count"] == 4

    # Inspect with engine
    info = raster_engine.inspect_geotiff(tif_path)
    assert info["is_wgs84"] is True
    assert info["count"] == 4
    assert info["width"] == 128
    assert info["height"] == 128
    assert len(info["bounds"]) == 4

def test_reproject_utm_to_wgs84():
    """Test reprojecting a GeoTIFF from UTM Zone 45N (EPSG:32645) to WGS84 (EPSG:4326)."""
    utm_path = TEST_OUTPUT_DIR / "test_utm.tif"
    wgs84_path = TEST_OUTPUT_DIR / "test_reprojected_wgs84.tif"

    # Create UTM raster (Teesta corridor in UTM Zone 45N meters: approx 640000m E, 2970000m N)
    raster_engine.create_sample_sentinel_scene(
        output_geotiff_path=utm_path,
        mission="Sentinel-2",
        crs_epsg=32645,
        bbox=(640000.0, 2970000.0, 655000.0, 2990000.0),
        width=64,
        height=64
    )

    info_utm = raster_engine.inspect_geotiff(utm_path)
    assert "32645" in info_utm["crs"]
    assert info_utm["is_wgs84"] is False

    # Reproject
    raster_engine.reproject_to_wgs84(utm_path, wgs84_path)
    assert wgs84_path.exists()

    info_wgs84 = raster_engine.inspect_geotiff(wgs84_path)
    assert info_wgs84["is_wgs84"] is True
    assert "4326" in info_wgs84["crs"]

def test_clip_raster_to_aoi():
    """Test clipping raster to a tighter AOI bounding box."""
    src_path = TEST_OUTPUT_DIR / "test_s2_sample.tif"
    clipped_path = TEST_OUTPUT_DIR / "test_clipped.tif"

    # Original bbox: (88.40, 26.85, 88.55, 27.05)
    # Clip to subset: (88.42, 26.88, 88.50, 26.98)
    clip_bbox = (88.42, 26.88, 88.50, 26.98)
    raster_engine.clip_raster_to_aoi(src_path, clipped_path, clip_bbox)

    assert clipped_path.exists()
    clipped_info = raster_engine.inspect_geotiff(clipped_path)
    # Clipped dimensions must be smaller than the 128x128 source
    assert clipped_info["width"] < 128
    assert clipped_info["height"] < 128
    # Bounds must fall within clip box
    assert clipped_info["bounds"][0] >= 88.40
    assert clipped_info["bounds"][2] <= 88.55

def test_sentinel2_rgb_generation():
    """Test True-Color RGB composite creation with dynamic contrast stretching."""
    src_path = TEST_OUTPUT_DIR / "test_s2_sample.tif"
    png_path = TEST_OUTPUT_DIR / "test_rgb.png"

    res = raster_engine.generate_sentinel2_rgb(src_path, png_path, red_band=1, green_band=2, blue_band=3)

    assert png_path.exists()
    assert png_path.stat().st_size > 0
    assert res["valid_pixels"] > 0
    assert "bounds" in res

def test_sentinel2_ndwi_computation():
    """Test NDWI water index calculation and surface water identification."""
    src_path = TEST_OUTPUT_DIR / "test_s2_sample.tif"
    ndwi_png = TEST_OUTPUT_DIR / "test_ndwi.png"

    res = raster_engine.compute_ndwi(src_path, ndwi_png, green_band=2, nir_band=4, threshold=0.0)

    assert ndwi_png.exists()
    assert res["water_pixel_count"] > 0
    assert res["water_fraction"] > 0.0
    assert res["water_fraction"] < 1.0  # Not 100% water

def test_sentinel2_cloud_mask():
    """Test optical cloud mask detection."""
    src_path = TEST_OUTPUT_DIR / "test_s2_sample.tif"
    cloud_png = TEST_OUTPUT_DIR / "test_cloud.png"

    res = raster_engine.compute_cloud_mask(src_path, cloud_png, red_band=1, green_band=2, blue_band=3, nir_band=4)

    assert cloud_png.exists()
    assert res["cloud_pixel_count"] > 0
    assert res["cloud_cover_percent"] > 0.0

def test_sentinel1_sar_calibration_and_water_masking():
    """
    Test Sentinel-1 C-SAR processing:
    1. Radiometric calibration to sigma0 dB.
    2. Speckle noise filtering.
    3. SCREENING: Verifies terrain shadows and permanent river channels are explicitly
       screened out and NOT falsely tagged as newly flooded areas.
    """
    sar_path = TEST_OUTPUT_DIR / "test_s1_sample.tif"
    raster_engine.create_sample_sentinel_scene(
        output_geotiff_path=sar_path,
        mission="Sentinel-1",
        crs_epsg=4326,
        bbox=(88.40, 26.85, 88.55, 27.05),
        width=128,
        height=128
    )

    # 1. Calibrated backscatter test
    cal_png = TEST_OUTPUT_DIR / "test_sar_calibrated.png"
    cal_res = raster_engine.process_sentinel1_sar(sar_path, cal_png, mode="sar_calibrated")

    assert cal_png.exists()
    assert cal_res["mode"] == "sar_calibrated"
    assert cal_res["mean_backscatter_db"] < 0.0  # Backscatter in dB is negative

    # 2. SAR Water Mask with terrain shadow & permanent water exclusion
    water_png = TEST_OUTPUT_DIR / "test_sar_water.png"
    water_res = raster_engine.process_sentinel1_sar(sar_path, water_png, mode="sar_water_mask")

    assert water_png.exists()
    assert water_res["mode"] == "sar_water_mask"
    assert water_res["terrain_filtered_out"] is True
    # Verify terrain shadow pixels were identified and screened out from flood inundation
    assert water_res["terrain_shadow_pixels"] > 0
    # Verify permanent water was distinguished from flood inundation
    assert water_res["permanent_water_pixels"] > 0
    # True flood inundation is isolated
    assert water_res["flood_inundation_pixels"] > 0

def test_sqlite_scene_lifecycle():
    """Test imagery metadata database transitions: Discovered -> Processed."""
    scene_id = "TEST_S2A_MSIL2A_20261120_VERIFY"
    rec = RasterSceneRecord(
        id=scene_id,
        mission="Sentinel-2",
        platform="Sentinel-2A",
        instrument="MSI",
        product_id=scene_id,
        acquisition_date="2026-11-20T04:50:00Z",
        cloud_cover=4.5,
        bounds=[26.85, 88.40, 27.05, 88.55],
        status=SceneProcessingStatus.DISCOVERED,
        status_message="Discovered from Copernicus catalog"
    )

    metadata_engine.upsert_scene_record(rec)
    fetched = metadata_engine.get_scene_record(scene_id)
    assert fetched is not None
    assert fetched.status == SceneProcessingStatus.DISCOVERED

    # Update to Processed
    metadata_engine.update_scene_status(
        scene_id,
        status=SceneProcessingStatus.PROCESSED,
        status_message="Products rendered: true_color, ndwi, cloud_mask",
        crs="EPSG:4326"
    )
    updated = metadata_engine.get_scene_record(scene_id)
    assert updated.status == SceneProcessingStatus.PROCESSED
    assert updated.crs == "EPSG:4326"
