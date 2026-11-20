"""
JATAYU AI - Standalone CLI Ingestion Runner
Runs real-data ingestion for the Teesta River Basin corridor.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Set up logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("jatayu.ingest")

from app.config import AOI_PRESETS, DEFAULT_AOI
from app.engines.aoi_engine import aoi_engine
from app.services import SERVICES

async def run_ingestion(service_key: str = "all", preset_id: str = "teesta_middle"):
    matched_preset = next((p for p in AOI_PRESETS if p.id == preset_id), DEFAULT_AOI)
    logger.info(f"Target AOI: {matched_preset.name} [{matched_preset.as_overpass_bbox()}]")
    bbox = matched_preset.to_bounding_box()

    services_to_run = SERVICES if service_key == "all" else {service_key: SERVICES[service_key]}

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
    parser.add_argument("--service", default="all", choices=list(SERVICES.keys()) + ["all"], help="Service to ingest")
    parser.add_argument("--preset", default="teesta_middle", choices=[p.id for p in AOI_PRESETS], help="AOI Preset to use")
    args = parser.parse_args()

    asyncio.run(run_ingestion(args.service, args.preset))
