"""
Models package initialization
"""

from .aoi import BoundingBox, AOIConfig, AOIPreset
from .geojson import GeoJSONFeature, GeoJSONFeatureCollection, GeoJSONGeometry, LayerMetadata
from .ingestion import DataAttribution, IngestionJob, IngestionState, ServiceStatus
from .satellite import SentinelScene, VIIRSObservation
from .meteo import RiverGaugePoint, WeatherObservation

__all__ = [
    "BoundingBox",
    "AOIConfig",
    "AOIPreset",
    "GeoJSONFeature",
    "GeoJSONFeatureCollection",
    "GeoJSONGeometry",
    "LayerMetadata",
    "DataAttribution",
    "IngestionJob",
    "IngestionState",
    "ServiceStatus",
    "SentinelScene",
    "VIIRSObservation",
    "RiverGaugePoint",
    "WeatherObservation",
]
