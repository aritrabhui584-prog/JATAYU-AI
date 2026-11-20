"""
JATAYU AI - Phase 1: Real Data Foundation
Configuration and Project Paths
"""

import os
from pathlib import Path
from pydantic import BaseModel
from app.models.aoi import AOIPreset

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
GEOJSON_DIR = DATA_DIR / "geojson"
GEOTIFF_DIR = DATA_DIR / "geotiff"
METADATA_DIR = DATA_DIR / "metadata"
SQLITE_DIR = DATA_DIR / "sqlite"
RENDERS_DIR = GEOTIFF_DIR / "renders"
VIIRS_DIR = DATA_DIR / "viirs"
DB_PATH = SQLITE_DIR / "jatayu.db"

# Ensure all data directories exist
for directory in [DATA_DIR, GEOJSON_DIR, GEOTIFF_DIR, METADATA_DIR, SQLITE_DIR, RENDERS_DIR, VIIRS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Bounding Box Presets for Teesta River Basin, Sikkim and North Bengal
AOI_PRESETS = [
    AOIPreset(
        id="teesta_full",
        name="Teesta River Corridor (Full Basin)",
        description="Full corridor from North Sikkim mountains to North Bengal plains (Mangan, Singtam, Rangpo, Kalimpong, Sevoke, Jalpaiguri)",
        min_lat=26.50,
        min_lon=88.25,
        max_lat=27.75,
        max_lon=88.85,
    ),
    AOIPreset(
        id="teesta_upper",
        name="Upper Teesta Valley (North Sikkim)",
        description="Alpine and sub-alpine river basin covering Chungthang, Mangan, and Dikchu",
        min_lat=27.35,
        min_lon=88.40,
        max_lat=27.80,
        max_lon=88.75,
    ),
    AOIPreset(
        id="teesta_middle",
        name="Middle Teesta Gorge (Kalimpong / Rangpo / Sevoke)",
        description="Steep Himalayan gorge corridor connecting Singtam, Rangpo border, Teesta Bazaar, and Coronation Bridge Sevoke",
        min_lat=26.85,
        min_lon=88.35,
        max_lat=27.30,
        max_lon=88.65,
    ),
    AOIPreset(
        id="teesta_lower",
        name="Lower Teesta Plains (North Bengal / Jalpaiguri)",
        description="Alluvial floodplains and braided river channels covering Siliguri bypass, Jalpaiguri, Mainaguri, and Mekhliganj",
        min_lat=26.40,
        min_lon=88.40,
        max_lat=26.85,
        max_lon=88.90,
    ),
]

DEFAULT_AOI = AOI_PRESETS[0]

USER_AGENT = "JatayuAI-DisasterIntelligence/1.0 (+https://github.com/jatayu-ai; emergency-response@jatayu.ai)"
REQUEST_TIMEOUT = 30  # seconds
