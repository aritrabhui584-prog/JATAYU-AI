"""
JATAYU AI - Standalone CLI Ingestion Runner
Runs real-data ingestion for the Teesta River Basin corridor.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

# Set up logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("jatayu.ingest")

from app.config import AOI_PRESETS, DEFAULT_AOI
from app.engines.aoi_engine import aoi_engine
from app.engines.terrain_engine import terrain_engine
from app.services import SERVICES

async def run_ingestion(service_key: str = "all", preset_id: str = "teesta_middle"):
    matched_preset = next((p for p in AOI_PRESETS if p.id == preset_id), DEFAULT_AOI)
    logger.info(f"Target AOI: {matched_preset.name} [{matched_preset.as_overpass_bbox()}]")
    bbox = matched_preset.to_bounding_box()

    # 1. Authentic Copernicus DEM GLO-90 Ingestion
    if service_key in ["all", "dem", "srtm"]:
        logger.info("=== Starting Ingestion for: Copernicus DEM GLO-90 (AWS Open Data) ===")
        try:
            dem_path = terrain_engine.download_and_ingest_copernicus_dem(
                aoi_bounds=(88.20, 26.50, 88.80, 27.75)
            )
            logger.info(f"SUCCESS [dem]: Verified authentic DEM saved to {dem_path}")
        except Exception as e:
            logger.error(f"FAILED [dem]: {str(e)}")

    # 2. Authentic Sentinel-1 C-SAR Ingestion (Microsoft Planetary Computer)
    if service_key in ["all", "sar", "sentinel1"]:
        logger.info("=== Starting Ingestion for: Sentinel-1 C-SAR (Planetary Computer) ===")
        try:
            from app.services.sentinel1_service import sentinel1_service
            sar_files = sentinel1_service.ingest_authentic_sar_pairs(
                aoi_bounds=(bbox.min_lon, bbox.min_lat, bbox.max_lon, bbox.max_lat)
            )
            logger.info(f"SUCCESS [sar]: Ingested {len(sar_files)} authentic SAR scenes to geotiff/sar/")
        except Exception as e:
            logger.error(f"FAILED [sar]: {str(e)}")

    # 3. Authentic Sentinel-2 L2A Optical Ingestion (Microsoft Planetary Computer)
    if service_key in ["all", "optical", "sentinel2"]:
        logger.info("=== Starting Ingestion for: Sentinel-2 MSI Optical (Planetary Computer) ===")
        try:
            from app.services.sentinel2_service import sentinel2_service
            s2_path = sentinel2_service.ingest_authentic_s2_scene()
            logger.info(f"SUCCESS [optical]: Ingested authentic 4-band Sentinel-2 scene to {s2_path}")
        except Exception as e:
            logger.error(f"FAILED [optical]: {str(e)}")

    services_to_run = SERVICES if service_key == "all" else ({service_key: SERVICES[service_key]} if service_key in SERVICES else {})

    for sid, s in services_to_run.items():
        logger.info(f"=== Starting Ingestion for: {s.service_name} ({sid}) ===")
        try:
            res = await s.fetch_data(bbox)
            if res.get("success"):
                logger.info(f"SUCCESS [{sid}]: state={res.get('state')}, items={res.get('total_features') or res.get('scene_count') or 1}")
            else:
                logger.warning(f"UNAVAILABLE [{sid}]: {res.get('error')}")
        except Exception as e:
            logger.error(f"FAILED [{sid}]: {str(e)}")

    logger.info("=== Ingestion sequence completed ===")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="JATAYU AI Data Ingestion CLI")
    parser.add_argument("--service", default="all", choices=list(SERVICES.keys()) + ["all", "dem", "sar", "sentinel1", "optical", "sentinel2"], help="Service to ingest")
    parser.add_argument("--preset", default="teesta_middle", choices=[p.id for p in AOI_PRESETS], help="AOI Preset to use")
    args = parser.parse_args()

    asyncio.run(run_ingestion(args.service, args.preset))
