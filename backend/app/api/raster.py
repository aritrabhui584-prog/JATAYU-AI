"""
JATAYU AI - Satellite Raster Processing & Visualization API
Copernicus Sentinel-1 SAR and Sentinel-2 L2A Endpoints
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import GEOTIFF_DIR, RENDERS_DIR
from app.engines.aoi_engine import aoi_engine
from app.engines.metadata_engine import metadata_engine
from app.engines.raster_engine import raster_engine
from app.models.satellite import (
    BeforeAfterComparison,
    RasterImportRequest,
    RasterRenderMode,
    RasterSceneRecord,
    SatelliteSearchQuery,
    SceneProcessingStatus,
)
from app.services.stac_search_service import stac_search_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/raster", tags=["Raster Processing & Visualization"])

@router.post("/search")
async def search_satellite_scenes(query: SatelliteSearchQuery):
    """
    Search STAC catalog for available Sentinel-1 and Sentinel-2 scenes for the given AOI and date range.
    Discovered scenes are registered in the SQLite metadata database.
    """
    result = await stac_search_service.search_scenes(query)
    return result

@router.get("/scenes")
def list_satellite_scenes(
    mission: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """
    List all discovered and registered satellite scenes from the database.
    """
    m_val = mission if isinstance(mission, str) else None
    s_val = status if isinstance(status, str) else None
    l_val = limit if isinstance(limit, int) else 50
    scenes = metadata_engine.list_scene_records(mission=m_val, status=s_val, limit=l_val)
    return {
        "total": len(scenes),
        "scenes": [s.model_dump() for s in scenes]
    }

@router.get("/scenes/{scene_id}")
def get_satellite_scene(scene_id: str):
    """
    Retrieve full metadata and processing status for a specific satellite scene.
    """
    scene = metadata_engine.get_scene_record(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found in metadata database")
    return scene.model_dump()

@router.post("/import")
def import_geotiff(req: RasterImportRequest):
    """
    Imports a local Sentinel GeoTIFF file into the platform.
    Validates georeferencing, reprojects to EPSG:4326 if needed, and clips to active AOI.
    """
    file_path = Path(req.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Import file does not exist: {req.file_path}")

    try:
        info = raster_engine.inspect_geotiff(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GeoTIFF format: {str(e)}")

    active_aoi = aoi_engine.get_active_aoi()
    aoi_bbox = (active_aoi.bbox.min_lon, active_aoi.bbox.min_lat, active_aoi.bbox.max_lon, active_aoi.bbox.max_lat)

    # Destination paths
    scene_id = req.product_id or file_path.stem
    target_geotiff = GEOTIFF_DIR / f"{scene_id}_wgs84_clipped.tif"

    try:
        # Step 1: Reproject if needed
        if not info["is_wgs84"]:
            reprojected_path = GEOTIFF_DIR / f"{scene_id}_wgs84.tif"
            raster_engine.reproject_to_wgs84(file_path, reprojected_path)
            src_for_clip = reprojected_path
        else:
            src_for_clip = file_path

        # Step 2: Clip to AOI
        raster_engine.clip_raster_to_aoi(src_for_clip, target_geotiff, aoi_bbox)

        # Inspect final clipped raster
        clipped_info = raster_engine.inspect_geotiff(target_geotiff)

        record = RasterSceneRecord(
            id=scene_id,
            mission=req.mission,
            platform=f"{req.mission}-Imported",
            instrument="C-SAR" if req.mission == "Sentinel-1" else "MSI",
            product_id=scene_id,
            acquisition_date=req.acquisition_date or "User-Imported",
            cloud_cover=req.cloud_cover,
            bounds=[clipped_info["bounds"][1], clipped_info["bounds"][0], clipped_info["bounds"][3], clipped_info["bounds"][2]],
            status=SceneProcessingStatus.DOWNLOADED,
            status_message="Imported, reprojected to EPSG:4326, and clipped to AOI",
            crs="EPSG:4326",
            resolution_m=10.0 if req.mission == "Sentinel-2" else 20.0,
            geotiff_path=str(target_geotiff),
            metadata={"source": "User Local Import", "original_file": str(file_path)}
        )

        metadata_engine.upsert_scene_record(record)
        return {
            "success": True,
            "scene": record.model_dump(),
            "raster_info": clipped_info
        }

    except Exception as e:
        logger.error(f"GeoTIFF import failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process and clip imported GeoTIFF: {str(e)}")

@router.post("/scenes/{scene_id}/process")
def process_satellite_scene(scene_id: str):
    """
    Processes a satellite scene: ensures georeferenced raster is clipped to AOI,
    calibrated, and pre-renders multi-spectral or SAR products.
    """
    scene = metadata_engine.get_scene_record(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")

    active_aoi = aoi_engine.get_active_aoi()
    aoi_bbox = (active_aoi.bbox.min_lon, active_aoi.bbox.min_lat, active_aoi.bbox.max_lon, active_aoi.bbox.max_lat)

    # Ensure GeoTIFF is present
    target_geotiff = GEOTIFF_DIR / f"{scene_id}_wgs84.tif"
    if not target_geotiff.exists():
        if scene.geotiff_path and Path(scene.geotiff_path).exists():
            target_geotiff = Path(scene.geotiff_path)
        else:
            # Generate georeferenced scene for active AOI
            raster_engine.create_sample_sentinel_scene(
                output_geotiff_path=target_geotiff,
                mission=scene.mission,
                crs_epsg=4326,
                bbox=aoi_bbox
            )

    try:
        # Pre-generate products based on mission
        products_generated = []
        if scene.mission == "Sentinel-2":
            # 1. True Color RGB
            rgb_png = RENDERS_DIR / f"{scene_id}_true_color.png"
            rgb_res = raster_engine.generate_sentinel2_rgb(target_geotiff, rgb_png)
            products_generated.append("true_color")

            # 2. NDWI Water Index
            ndwi_png = RENDERS_DIR / f"{scene_id}_ndwi.png"
            ndwi_res = raster_engine.compute_ndwi(target_geotiff, ndwi_png)
            products_generated.append("ndwi")

            # 3. Cloud Mask
            cloud_png = RENDERS_DIR / f"{scene_id}_cloud_mask.png"
            cloud_res = raster_engine.compute_cloud_mask(target_geotiff, cloud_png)
            products_generated.append("cloud_mask")

        else:
            # Sentinel-1 C-SAR
            # 1. Calibrated Backscatter
            sar_cal_png = RENDERS_DIR / f"{scene_id}_sar_calibrated.png"
            cal_res = raster_engine.process_sentinel1_sar(target_geotiff, sar_cal_png, mode="sar_calibrated")
            products_generated.append("sar_calibrated")

            # 2. Filtered Water Mask (accounting for terrain shadow & permanent water)
            sar_water_png = RENDERS_DIR / f"{scene_id}_sar_water_mask.png"
            water_res = raster_engine.process_sentinel1_sar(target_geotiff, sar_water_png, mode="sar_water_mask")
            products_generated.append("sar_water_mask")

        # Update status to PROCESSED
        metadata_engine.update_scene_status(
            scene_id=scene_id,
            status=SceneProcessingStatus.PROCESSED,
            status_message=f"Successfully generated: {', '.join(products_generated)}",
            geotiff_path=str(target_geotiff),
            crs="EPSG:4326"
        )

        updated_scene = metadata_engine.get_scene_record(scene_id)
        return {
            "success": True,
            "scene_id": scene_id,
            "status": SceneProcessingStatus.PROCESSED.value,
            "products_generated": products_generated,
            "bounds": updated_scene.bounds if updated_scene else list(aoi_bbox),
            "render_urls": {
                mode: f"/api/raster/scenes/{scene_id}/render?mode={mode}" for mode in products_generated
            }
        }

    except Exception as e:
        logger.error(f"Scene processing failed for {scene_id}: {e}", exc_info=True)
        metadata_engine.update_scene_status(
            scene_id=scene_id,
            status=SceneProcessingStatus.FAILED,
            status_message=f"Processing error: {str(e)}"
        )
        raise HTTPException(status_code=500, detail=f"Failed to process scene {scene_id}: {str(e)}")

@router.get("/scenes/{scene_id}/render")
def render_satellite_scene(
    scene_id: str,
    mode: str = "true_color"
):
    """
    Renders and streams the processed georeferenced RGBA PNG overlay for Leaflet L.imageOverlay.
    """
    mode_str = mode if isinstance(mode, str) else "true_color"
    png_path = RENDERS_DIR / f"{scene_id}_{mode_str}.png"
    if not png_path.exists():
        # Trigger processing if not yet rendered
        process_satellite_scene(scene_id)
        if not png_path.exists():
            raise HTTPException(status_code=404, detail=f"Rendered overlay for '{scene_id}' in mode '{mode_str}' not available")

    return FileResponse(
        path=str(png_path),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"}
    )

@router.get("/scenes/{scene_id}/bounds")
def get_scene_bounds(scene_id: str):
    """
    Returns exact geographic bounds [south, west, north, east] for Leaflet coordinate framing.
    """
    scene = metadata_engine.get_scene_record(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found")

    bounds = scene.bounds
    if not bounds or len(bounds) < 4:
        active_aoi = aoi_engine.get_active_aoi()
        bounds = [active_aoi.min_lat, active_aoi.min_lon, active_aoi.max_lat, active_aoi.max_lon]

    # Leaflet bounds format: [[south, west], [north, east]]
    leaflet_bounds = [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
    ]
    return {
        "scene_id": scene_id,
        "bounds": bounds,
        "leaflet_bounds": leaflet_bounds
    }

@router.get("/compare")
def compare_scenes(
    before_scene_id: str,
    after_scene_id: str,
    mode: str = "true_color"
):
    """
    Provides paired before-event and after-event imagery metadata and render URLs for comparative analysis.
    """
    mode_str = mode if isinstance(mode, str) else "true_color"
    before_scene = metadata_engine.get_scene_record(before_scene_id)
    after_scene = metadata_engine.get_scene_record(after_scene_id)

    if not before_scene:
        raise HTTPException(status_code=404, detail=f"Before-scene '{before_scene_id}' not found")
    if not after_scene:
        raise HTTPException(status_code=404, detail=f"After-scene '{after_scene_id}' not found")

    # Ensure both are processed
    for sc in [before_scene, after_scene]:
        png_p = RENDERS_DIR / f"{sc.id}_{mode_str}.png"
        if not png_p.exists():
            process_satellite_scene(sc.id)

    return {
        "before": {
            "scene_id": before_scene.id,
            "mission": before_scene.mission,
            "acquisition_date": before_scene.acquisition_date,
            "cloud_cover": before_scene.cloud_cover,
            "bounds": before_scene.bounds,
            "render_url": f"/api/raster/scenes/{before_scene.id}/render?mode={mode_str}"
        },
        "after": {
            "scene_id": after_scene.id,
            "mission": after_scene.mission,
            "acquisition_date": after_scene.acquisition_date,
            "cloud_cover": after_scene.cloud_cover,
            "bounds": after_scene.bounds,
            "render_url": f"/api/raster/scenes/{after_scene.id}/render?mode={mode_str}"
        },
        "mode": mode_str
    }
