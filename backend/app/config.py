"""
JATAYU AI - Phase 1: Real Data Foundation
Configuration and Project Paths
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel
from app.models.aoi import AOIPreset

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()  # fallback to current working directory

DATA_DIR = BASE_DIR / "data"
GEOJSON_DIR = DATA_DIR / "geojson"
GEOTIFF_DIR = DATA_DIR / "geotiff"
LIVE_GEOTIFF_DIR = GEOTIFF_DIR / "live"
METADATA_DIR = DATA_DIR / "metadata"
SQLITE_DIR = DATA_DIR / "sqlite"
RENDERS_DIR = GEOTIFF_DIR / "renders"
VIIRS_DIR = DATA_DIR / "viirs"
DB_PATH = SQLITE_DIR / "jatayu.db"

# Ensure all data directories exist
for directory in [DATA_DIR, GEOJSON_DIR, GEOTIFF_DIR, LIVE_GEOTIFF_DIR, METADATA_DIR, SQLITE_DIR, RENDERS_DIR, VIIRS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Bounding Box Presets for Teesta River Basin, Sikkim and North Bengal + Major Flood Corridors in India
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
    AOIPreset(
        id="brahmaputra_guwahati",
        name="Brahmaputra Valley (Guwahati / Kamrup)",
        description="High-volume braided Himalayan river corridor across Guwahati, Hajo, and North Guwahati floodplains",
        min_lat=26.05,
        min_lon=91.55,
        max_lat=26.35,
        max_lon=91.95,
    ),
    AOIPreset(
        id="kosi_bihar",
        name="Kosi River Basin (Supaul / Saharsa / Bihar)",
        description="Active braided avulsive river channel and embankment breach hazard zones in North Bihar",
        min_lat=25.80,
        min_lon=86.40,
        max_lat=26.30,
        max_lon=87.05,
    ),
    AOIPreset(
        id="ganga_patna",
        name="Ganga River Corridor (Patna / Hajipur)",
        description="Major confluence of Ganga, Gandak, and Son rivers with severe seasonal monsoon inundation risk",
        min_lat=25.50,
        min_lon=85.05,
        max_lat=25.80,
        max_lon=85.40,
    ),
]

DEFAULT_AOI = AOI_PRESETS[0]

USER_AGENT = "JatayuAI-DisasterIntelligence/1.0 (+https://github.com/jatayu-ai; emergency-response@jatayu.ai)"
REQUEST_TIMEOUT = 30  # seconds

# Authentication & Credentials
EARTHDATA_TOKEN = os.getenv("EARTHDATA_TOKEN", "")
COPERNICUS_CLIENT_ID = os.getenv("COPERNICUS_CLIENT_ID", "")
COPERNICUS_CLIENT_SECRET = os.getenv("COPERNICUS_CLIENT_SECRET", "")
