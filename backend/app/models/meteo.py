"""
Hydrometeorological Observation Models
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class RiverGaugePoint(BaseModel):
    station_name: str
    river_name: str = "Teesta"
    latitude: float
    longitude: float
    current_discharge_m3s: Optional[float] = None
    mean_historical_m3s: Optional[float] = None
    flood_warning_m3s: Optional[float] = None
    timestamp: Optional[str] = None
    source: str = "GloFAS / Open-Meteo Flood API"

class WeatherObservation(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None
    temperature_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    wind_speed_kmh: Optional[float] = None
    surface_pressure_hpa: Optional[float] = None
    timestamp: str
    source: str = "ECMWF / Open-Meteo Forecast API"
