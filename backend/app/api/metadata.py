"""
Metadata, Methodology and Attribution API Endpoints
"""

from fastapi import APIRouter
from typing import Dict, List
from app.services import SERVICES

router = APIRouter(prefix="/metadata", tags=["Metadata & Methodology"])

@router.get("/data-sources")
def get_data_sources_catalog():
    """Returns official attributions, citations, licenses, and documentation for all data sources"""
    sources = []
    for sid, s in SERVICES.items():
        attr = s.get_attribution()
        sources.append(attr.model_dump())
    return {
        "platform": "JATAYU AI - Disaster Intelligence Platform",
        "phase": "Phase 1: Real Data Foundation",
        "geographic_area": "Teesta River Corridor, Sikkim and North Bengal, India",
        "zero_fabrication_guarantee": "All data displayed is ingested strictly from official satellites, meteorological agencies, and open geospatial databases. If an external service is unavailable or rate-limited, no synthetic or fabricated records are ever introduced.",
        "data_sources": sources,
    }
