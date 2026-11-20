"""
Ingestion Status and Data Attribution Models
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class IngestionState(str, Enum):
    IDLE = "IDLE"
    FETCHING = "FETCHING"
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    ERROR = "ERROR"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    RATE_LIMITED = "RATE_LIMITED"

class DataAttribution(BaseModel):
    service_id: str
    service_name: str
    provider: str
    citation: str
    license: str
    license_url: str
    documentation_url: str
    terms_of_use: str

class ServiceStatus(BaseModel):
    service_id: str
    service_name: str
    category: str
    state: IngestionState
    is_available: bool
    feature_count: int = 0
    last_fetched_at: Optional[str] = None
    last_error: Optional[str] = None
    attribution: DataAttribution
    metadata: Dict[str, Any] = Field(default_factory=dict)
    api_endpoint: str
    requires_auth: bool = False

class IngestionJob(BaseModel):
    id: str
    service_id: str
    state: IngestionState
    started_at: str
    completed_at: Optional[str] = None
    items_count: int = 0
    error_message: Optional[str] = None
    aoi_id: str
