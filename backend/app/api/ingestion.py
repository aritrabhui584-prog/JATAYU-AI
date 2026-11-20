"""
Ingestion Control and Service Status API Endpoints
Modular ingestion triggers for independent services.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, List
from app.engines.aoi_engine import aoi_engine
from app.engines.metadata_engine import metadata_engine
from app.models.ingestion import ServiceStatus
from app.services import SERVICES

router = APIRouter(prefix="/ingestion", tags=["Data Ingestion"])

@router.get("/status", response_model=List[ServiceStatus])
def get_all_services_status():
    """Returns the operational status, feature counts, and attribution for all 7 independent services"""
    return [service.get_status() for service in SERVICES.values()]

@router.post("/trigger/{service_id}")
async def trigger_service_ingestion(service_id: str):
    """Triggers ingestion for a specific data service"""
    service = SERVICES.get(service_id)
    if not service:
        raise HTTPException(status_code=404, detail=f"Data service '{service_id}' does not exist.")

    aoi = aoi_engine.get_active_aoi()
    result = await service.fetch_data(aoi.bbox)
    return {
        "service_id": service_id,
        "aoi": aoi.name,
        "result": result
    }

@router.post("/trigger-all")
async def trigger_all_ingestions():
    """Triggers ingestion across all 7 modular services sequentially"""
    aoi = aoi_engine.get_active_aoi()
    results = {}
    for sid, s in SERVICES.items():
        try:
            results[sid] = await s.fetch_data(aoi.bbox)
        except Exception as e:
            results[sid] = {"success": False, "error": str(e)}
    return {
        "aoi": aoi.name,
        "results": results
    }

@router.post("/clear/{service_id}")
def clear_service_cache(service_id: str):
    service = SERVICES.get(service_id)
    if not service:
        raise HTTPException(status_code=404, detail=f"Data service '{service_id}' does not exist.")
    cleared = service.clear_cache()
    return {"service_id": service_id, "cleared": cleared}

@router.get("/jobs")
def get_recent_jobs(limit: int = 20):
    return metadata_engine.get_recent_jobs(limit=limit)
