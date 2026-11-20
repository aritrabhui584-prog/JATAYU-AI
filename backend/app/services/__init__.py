"""
Services registry for JATAYU AI
All 7 independent modular data services
"""

from typing import Dict
from .base import BaseDataService
from .osm_service import osm_service
from .srtm_service import srtm_service
from .sentinel1_service import sentinel1_service
from .sentinel2_service import sentinel2_service
from .viirs_service import viirs_service
from .meteo_service import meteo_service
from .worldpop_service import worldpop_service

SERVICES: Dict[str, BaseDataService] = {
    "osm": osm_service,
    "srtm": srtm_service,
    "sentinel1": sentinel1_service,
    "sentinel2": sentinel2_service,
    "viirs": viirs_service,
    "meteo": meteo_service,
    "worldpop": worldpop_service,
}

__all__ = [
    "BaseDataService",
    "SERVICES",
    "osm_service",
    "srtm_service",
    "sentinel1_service",
    "sentinel2_service",
    "viirs_service",
    "meteo_service",
    "worldpop_service",
]
