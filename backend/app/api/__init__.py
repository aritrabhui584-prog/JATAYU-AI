"""
API Router aggregation
"""

from fastapi import APIRouter
from .aoi import router as aoi_router
from .layers import router as layers_router
from .ingestion import router as ingestion_router
from .gis import router as gis_router
from .satellite import router as satellite_router
from .meteo import router as meteo_router
from .metadata import router as metadata_router
from .raster import router as raster_router
from .flood import router as flood_router
from .isolation import router as isolation_router
from .nightlight import router as nightlight_router
from .priority import router as priority_router
from .overview import router as overview_router

api_router = APIRouter(prefix="/api")
api_router.include_router(aoi_router)
api_router.include_router(layers_router)
api_router.include_router(ingestion_router)
api_router.include_router(gis_router)
api_router.include_router(satellite_router)
api_router.include_router(meteo_router)
api_router.include_router(metadata_router)
api_router.include_router(raster_router)
api_router.include_router(flood_router)
api_router.include_router(isolation_router)
api_router.include_router(nightlight_router)
api_router.include_router(priority_router)
api_router.include_router(overview_router)
