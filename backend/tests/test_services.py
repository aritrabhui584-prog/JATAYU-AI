"""
Unit tests for the 7 independent data services
"""

from app.services import SERVICES

def test_all_seven_services_registered():
    assert len(SERVICES) == 7
    expected = ["osm", "srtm", "sentinel1", "sentinel2", "viirs", "meteo", "worldpop"]
    for sid in expected:
        assert sid in SERVICES
        s = SERVICES[sid]
        assert s.service_id == sid
        assert s.service_name is not None
        assert s.category is not None

def test_service_attributions():
    for sid, s in SERVICES.items():
        attr = s.get_attribution()
        assert attr.provider is not None
        assert attr.license is not None
        assert attr.license_url.startswith("http")
        assert attr.documentation_url.startswith("http")

def test_service_initial_status():
    for sid, s in SERVICES.items():
        status = s.get_status()
        assert status.service_id == sid
        assert status.state in ["IDLE", "AVAILABLE", "UNAVAILABLE", "ERROR", "AUTH_REQUIRED", "FETCHING"]
        assert status.attribution is not None
