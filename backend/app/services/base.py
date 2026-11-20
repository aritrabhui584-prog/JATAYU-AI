"""
Base Data Service Abstract Class
Every independent data source implements this interface.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from app.models.aoi import BoundingBox
from app.models.ingestion import DataAttribution, IngestionState, ServiceStatus

class BaseDataService(ABC):
    def __init__(self, service_id: str, service_name: str, category: str):
        self.service_id = service_id
        self.service_name = service_name
        self.category = category

    @abstractmethod
    def get_attribution(self) -> DataAttribution:
        """Returns official data source attribution, citation, and license"""
        pass

    @abstractmethod
    async def fetch_data(self, bbox: BoundingBox) -> Dict[str, Any]:
        """
        Executes real data query/ingestion for the given bounding box.
        MUST NOT return fabricated data.
        Returns a dictionary containing results and status.
        """
        pass

    @abstractmethod
    def get_status(self) -> ServiceStatus:
        """Returns the current operational and ingestion status of this service"""
        pass

    @abstractmethod
    def clear_cache(self) -> bool:
        """Clears cached data files for this service"""
        pass
