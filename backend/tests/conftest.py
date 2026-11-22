"""
Pytest configuration and test database isolation.
Ensures pytest runs against an isolated temporary SQLite database,
never polluting or modifying the production jatayu.db.
"""

import shutil
from pathlib import Path
import pytest
from app.config import DB_PATH
from app.engines.metadata_engine import metadata_engine

@pytest.fixture(scope="session", autouse=True)
def isolate_test_database(tmp_path_factory):
    temp_dir = tmp_path_factory.mktemp("db_test")
    test_db_path = temp_dir / "test_jatayu.db"
    
    # Copy production DB as clean baseline or initialize
    if DB_PATH.exists():
        shutil.copy2(DB_PATH, test_db_path)
    
    original_db_path = metadata_engine.db_path
    metadata_engine.db_path = test_db_path
    metadata_engine._init_db()
    
    yield test_db_path
    
    metadata_engine.db_path = original_db_path
