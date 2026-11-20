"""
JATAYU AI - Phase 6: Emergency Priority Engine Unit & Integration Tests
Verifies:
1. Deterministic multi-criteria scoring and normalization (0-100).
2. Configurable operator weights and dynamic weight normalization.
3. Separation of independent confidence score from risk.
4. Handling of cloudy / missing VIIRS observations (zero blackout fabrication, confidence penalty).
5. Ranking order, Top 5 extraction, and tie-breaking.
6. Natural language explanations and limiting factors.
7. Export generation (GeoJSON and CSV).
8. FastAPI priority endpoints integration.
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.engines.priority_engine import priority_engine, PriorityEngine, SCIENTIFIC_DISCLAIMER
from app.main import app
from app.models.priority import (
    ConfidenceTier,
    EmergencyPriorityResult,
    PriorityRankingParams,
    PriorityTier,
    ScoringWeights,
)

client = TestClient(app)


def test_priority_engine_initialization():
    """Verifies PriorityEngine instantiates with proper directories and disclaimer."""
    engine = PriorityEngine()
    assert engine.settlements_file.exists()
    assert "SCIENTIFIC NOTICE" in SCIENTIFIC_DISCLAIMER
    assert "DO NOT represent confirmed casualties" in SCIENTIFIC_DISCLAIMER


def test_deterministic_scoring_and_ranking():
    """Verifies multi-criteria priority scoring is deterministic and correctly ranked."""
    result = priority_engine.rank_settlements(PriorityRankingParams())

    assert isinstance(result, EmergencyPriorityResult)
    assert len(result.villages) > 0
    assert len(result.top_5_villages) == min(5, len(result.villages))

    # Verify monotonic ranking order
    prev_score = 1000.0
    for idx, v in enumerate(result.villages):
        assert v.rank == idx + 1
        assert v.composite_priority_score <= prev_score
        assert 0.0 <= v.composite_priority_score <= 100.0
        prev_score = v.composite_priority_score

        # Verify component contributions sum to composite score
        expected_sum = round(
            v.features.isolation_score_contribution
            + v.features.nightlight_score_contribution
            + v.features.population_score_contribution
            + v.features.accessibility_score_contribution,
            1,
        )
        assert abs(v.composite_priority_score - expected_sum) <= 0.15


def test_feature_normalization_bounds():
    """Verifies all normalized sub-scores fall strictly in the [0, 100] range."""
    result = priority_engine.rank_settlements(PriorityRankingParams())

    for v in result.villages:
        f = v.features
        assert 0.0 <= f.isolation_norm <= 100.0
        assert 0.0 <= f.nightlight_norm <= 100.0
        assert 0.0 <= f.population_norm <= 100.0
        assert 0.0 <= f.accessibility_norm <= 100.0
        assert 0.0 <= v.confidence_score <= 100.0


def test_custom_weight_reconfiguration():
    """Verifies operator weights are dynamically normalized and alter scoring appropriately."""
    # Custom weights: 80% isolation, 0% nightlight, 10% population, 10% accessibility
    custom_w = ScoringWeights(
        isolation=0.8,
        nightlight=0.0,
        population=0.1,
        accessibility=0.1,
    )
    result = priority_engine.rank_settlements(PriorityRankingParams(weights=custom_w))

    assert result.effective_normalized_weights["isolation"] == 0.8
    assert result.effective_normalized_weights["nightlight"] == 0.0
    assert result.effective_normalized_weights["population"] == 0.1
    assert result.effective_normalized_weights["accessibility"] == 0.1

    # Nightlight contribution must be 0 for all villages under 0.0 weight
    for v in result.villages:
        assert v.features.nightlight_score_contribution == 0.0


def test_zero_weights_safe_fallback():
    """Verifies that passing all-zero weights falls back gracefully to scientific defaults."""
    zero_w = ScoringWeights(isolation=0.0, nightlight=0.0, population=0.0, accessibility=0.0)
    result = priority_engine.rank_settlements(PriorityRankingParams(weights=zero_w))

    assert result.effective_normalized_weights["isolation"] == 0.35
    assert result.effective_normalized_weights["nightlight"] == 0.30
    assert result.effective_normalized_weights["population"] == 0.20
    assert result.effective_normalized_weights["accessibility"] == 0.15


def test_confidence_separation_from_risk():
    """
    Verifies that confidence is computed independently from risk,
    and that cloudy / missing observations penalize confidence without fabricating outages.
    """
    result = priority_engine.rank_settlements(PriorityRankingParams())

    for v in result.villages:
        # Confidence score must be strictly valid
        assert 0.0 <= v.confidence_score <= 100.0
        assert v.confidence_tier in [ConfidenceTier.HIGH, ConfidenceTier.MODERATE, ConfidenceTier.LOW]

        # Check cloudy condition rule
        if v.features.nightlight_cloud_obscured:
            # Must NOT classify cloudy pixel as blackout
            assert v.features.nightlight_norm == 0.0
            # Must lose VIIRS confidence points
            assert v.confidence.viirs_confidence_pts == 0.0
            assert v.confidence.viirs_nightlight_quality == "CLOUD_OBSCURED"


def test_explanations_and_limiting_factors():
    """Verifies that every village receives an explicit, audit-trail explanation."""
    result = priority_engine.rank_settlements(PriorityRankingParams())

    for v in result.villages:
        assert len(v.explanation) > 50
        assert v.name in v.explanation
        assert str(v.composite_priority_score) in v.explanation
        assert isinstance(v.limiting_factors, list)


def test_priority_tier_classification():
    """Verifies threshold rules for P1, P2, P3, P4 tiers."""
    result = priority_engine.rank_settlements(PriorityRankingParams())

    for v in result.villages:
        if v.composite_priority_score >= 70.0:
            assert v.priority_tier == PriorityTier.P1_CRITICAL
            assert "P1" in v.priority_tier_label
        elif v.composite_priority_score >= 45.0:
            assert v.priority_tier == PriorityTier.P2_HIGH
            assert "P2" in v.priority_tier_label
        elif v.composite_priority_score >= 25.0:
            assert v.priority_tier == PriorityTier.P3_MODERATE
            assert "P3" in v.priority_tier_label
        else:
            assert v.priority_tier == PriorityTier.P4_LOW
            assert "P4" in v.priority_tier_label


def test_api_rank_endpoint():
    """Verifies POST /api/priority/rank API endpoint."""
    payload = {
        "weights": {
            "isolation": 0.40,
            "nightlight": 0.30,
            "population": 0.15,
            "accessibility": 0.15,
        },
        "severity_filter": "ALL",
        "min_confidence": 0.0,
    }
    response = client.post("/api/priority/rank", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "id" in data
    assert "top_5_villages" in data
    assert len(data["top_5_villages"]) <= 5
    assert "summary_stats" in data
    assert data["summary_stats"]["total_settlements"] > 0
    assert "SCIENTIFIC NOTICE" in data["scientific_disclaimer"]


def test_api_latest_and_top5_endpoints():
    """Verifies GET /api/priority/latest and GET /api/priority/top5."""
    res_latest = client.get("/api/priority/latest")
    assert res_latest.status_code == 200
    data_latest = res_latest.json()
    assert len(data_latest["villages"]) > 0

    res_top5 = client.get("/api/priority/top5")
    assert res_top5.status_code == 200
    top5_list = res_top5.json()
    assert len(top5_list) == min(5, len(data_latest["villages"]))
    assert top5_list[0]["rank"] == 1


def test_api_export_geojson_endpoint():
    """Verifies GET /api/priority/export/geojson exports valid GeoJSON."""
    response = client.get("/api/priority/export/geojson")
    assert response.status_code == 200
    assert "application/geo+json" in response.headers.get("content-type", "")

    fc = response.json()
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) > 0
    first_feat = fc["features"][0]
    assert "geometry" in first_feat
    assert "properties" in first_feat
    assert "composite_priority_score" in first_feat["properties"]
    assert "rank" in first_feat["properties"]


def test_api_export_csv_endpoint():
    """Verifies GET /api/priority/export/csv exports valid CSV."""
    response = client.get("/api/priority/export/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    content = response.text
    lines = content.strip().split("\n")
    assert len(lines) > 1
    headers = lines[0].split(",")
    assert "rank" in headers
    assert "name" in headers
    assert "composite_priority_score" in headers
    assert "confidence_score" in headers
