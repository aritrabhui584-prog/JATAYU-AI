"""
JATAYU AI - Emergency Priority API Endpoints
Phase 6: Multi-Criteria Priority Ranking, Top 5 Extraction, and Export Endpoints.
"""

import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse

from app.config import DATA_DIR, GEOJSON_DIR
from app.engines.priority_engine import priority_engine
from app.models.priority import (
    EmergencyPriorityResult,
    PriorityRankingParams,
    ScoringWeights,
    VillagePriorityItem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/priority", tags=["Emergency Priorities"])


@router.post("/rank", response_model=EmergencyPriorityResult)
def rank_settlements(params: PriorityRankingParams):
    """
    Executes multi-criteria deterministic settlement prioritization.
    Allows operator configuration of weights, scenario stage rise, and severity filters.
    """
    try:
        result = priority_engine.rank_settlements(params)
        return result
    except Exception as e:
        logger.error(f"Error calculating settlement priorities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest", response_model=EmergencyPriorityResult)
def get_latest_priorities():
    """Returns the latest settlement emergency priority ranking result."""
    result = priority_engine.get_latest_result()
    if result is None:
        result = priority_engine.rank_settlements(PriorityRankingParams())
    return result


@router.get("/top5", response_model=List[VillagePriorityItem])
def get_top5_priorities():
    """Returns the top 5 highest emergency priority settlements."""
    result = priority_engine.get_latest_result()
    if result is None:
        result = priority_engine.rank_settlements(PriorityRankingParams())
    return result.top_5_villages


@router.get("/export/geojson")
def export_priorities_geojson(run_id: Optional[str] = Query(None)):
    """Exports priority ranking results as a downloadable GeoJSON FeatureCollection."""
    latest = priority_engine.get_latest_result()
    if latest is None:
        latest = priority_engine.rank_settlements(PriorityRankingParams())

    target_id = run_id or latest.id
    geojson_path = GEOJSON_DIR / f"emergency_priorities_{target_id}.geojson"

    if not geojson_path.exists():
        # Fallback to writing current latest
        priority_engine._export_geojson(
            latest.villages, geojson_path, latest.summary_stats, latest.effective_normalized_weights
        )

    return FileResponse(
        path=str(geojson_path),
        media_type="application/geo+json",
        filename=f"jatayu_emergency_priorities_{target_id}.geojson",
    )


@router.get("/export/csv")
def export_priorities_csv(run_id: Optional[str] = Query(None)):
    """Exports priority ranking results as a downloadable CSV spreadsheet."""
    latest = priority_engine.get_latest_result()
    if latest is None:
        latest = priority_engine.rank_settlements(PriorityRankingParams())

    target_id = run_id or latest.id
    csv_path = DATA_DIR / f"emergency_priorities_{target_id}.csv"

    if not csv_path.exists():
        priority_engine._export_csv(
            latest.villages, csv_path, latest.effective_normalized_weights
        )

    return FileResponse(
        path=str(csv_path),
        media_type="text/csv",
        filename=f"jatayu_emergency_priorities_{target_id}.csv",
    )


@router.get("/export/sitrep.pdf")
def export_sitrep_pdf(run_id: Optional[str] = Query(None)):
    """
    Exports official NDMA / SDMA Emergency Situation Report (SITREP) PDF.
    Contains operational command headers, live KPIs, top 5 prioritized settlements,
    corridor severance breaches, and multi-source satellite citations.
    """
    from app.services.pdf_service import generate_sitrep_pdf

    latest = priority_engine.get_latest_result()
    if latest is None:
        latest = priority_engine.rank_settlements(PriorityRankingParams())

    target_id = run_id or latest.id
    pdf_path = DATA_DIR / f"jatayu_sitrep_{target_id}.pdf"

    if not pdf_path.exists():
        generate_sitrep_pdf(pdf_path, latest)

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=f"JATAYU_AI_SITREP_{target_id}.pdf",
    )
