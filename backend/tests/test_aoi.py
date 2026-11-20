"""
Unit tests for AOI models and bounding box validation
"""

import pytest
from app.models.aoi import BoundingBox, AOIConfig
from app.engines.aoi_engine import aoi_engine

def test_bounding_box_valid():
    bbox = BoundingBox(min_lat=26.5, min_lon=88.2, max_lat=27.5, max_lon=88.8)
    assert bbox.min_lat < bbox.max_lat
    assert bbox.min_lon < bbox.max_lon
    center_lat, center_lon = bbox.center()
    assert 26.5 <= center_lat <= 27.5
    assert 88.2 <= center_lon <= 88.8

def test_bounding_box_invalid():
    with pytest.raises(ValueError):
        BoundingBox(min_lat=28.0, min_lon=88.2, max_lat=26.0, max_lon=88.8)

def test_overpass_bbox_format():
    bbox = BoundingBox(min_lat=26.5, min_lon=88.2, max_lat=27.5, max_lon=88.8)
    assert bbox.as_overpass_bbox() == "26.5,88.2,27.5,88.8"

def test_presets_exist():
    presets = aoi_engine.get_presets()
    assert len(presets) >= 4
    preset_ids = [p.id for p in presets]
    assert "teesta_full" in preset_ids
    assert "teesta_upper" in preset_ids
    assert "teesta_middle" in preset_ids
    assert "teesta_lower" in preset_ids

def test_coordinate_validation():
    assert aoi_engine.validate_coordinates(27.0, 88.5) is True
    assert aoi_engine.validate_coordinates(95.0, 88.5) is False
    assert aoi_engine.validate_coordinates(27.0, 195.0) is False
