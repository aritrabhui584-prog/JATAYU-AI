"""
Metadata and Persistence Engine (SQLite)
Tracks ingestion status, layer metadata, satellite scenes registry, and audit logs.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any, Dict, List, Optional

from app.config import DB_PATH, DEFAULT_AOI, METADATA_DIR
from app.models.ingestion import IngestionJob, IngestionState, ServiceStatus
from app.models.satellite import RasterSceneRecord, SceneProcessingStatus

class MetadataEngine:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Create tables if they don't exist"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Active and historical AOIs
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS aoi_history (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                min_lat REAL NOT NULL,
                min_lon REAL NOT NULL,
                max_lat REAL NOT NULL,
                max_lon REAL NOT NULL,
                is_active INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """)

            # Ingestion service states
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS service_states (
                service_id TEXT PRIMARY KEY,
                service_name TEXT NOT NULL,
                category TEXT NOT NULL,
                state TEXT NOT NULL,
                is_available INTEGER NOT NULL,
                feature_count INTEGER DEFAULT 0,
                last_fetched_at TEXT,
                last_error TEXT,
                metadata_json TEXT,
                updated_at TEXT NOT NULL
            )
            """)

            # Ingestion audit log
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS ingestion_jobs (
                id TEXT PRIMARY KEY,
                service_id TEXT NOT NULL,
                aoi_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                state TEXT NOT NULL,
                items_count INTEGER DEFAULT 0,
                error_message TEXT,
                metadata_json TEXT
            )
            """)

            # Layer metadata
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS layer_metadata (
                layer_key TEXT PRIMARY KEY,
                layer_name TEXT NOT NULL,
                category TEXT NOT NULL,
                data_source TEXT NOT NULL,
                attribution TEXT NOT NULL,
                feature_count INTEGER DEFAULT 0,
                geometry_type TEXT,
                bounds_json TEXT,
                file_path TEXT,
                updated_at TEXT,
                is_available INTEGER DEFAULT 0,
                status_message TEXT
            )
            """)

            # Satellite Imagery Scenes Table (Phase 2)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS satellite_scenes (
                id TEXT PRIMARY KEY,
                mission TEXT NOT NULL,
                platform TEXT NOT NULL,
                instrument TEXT NOT NULL,
                product_id TEXT NOT NULL,
                acquisition_date TEXT NOT NULL,
                cloud_cover REAL,
                bounds_json TEXT NOT NULL,
                status TEXT NOT NULL,
                status_message TEXT,
                crs TEXT,
                resolution_m REAL,
                geotiff_path TEXT,
                thumbnail_url TEXT,
                assets_json TEXT,
                metadata_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """)

            # Initialize default active AOI if empty
            cursor.execute("SELECT COUNT(*) as count FROM aoi_history WHERE is_active = 1")
            row = cursor.fetchone()
            if row["count"] == 0:
                now = datetime.now(timezone.utc).isoformat()
                cursor.execute("""
                INSERT OR REPLACE INTO aoi_history (id, name, min_lat, min_lon, max_lat, max_lon, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                """, (
                    DEFAULT_AOI.id,
                    DEFAULT_AOI.name,
                    DEFAULT_AOI.min_lat,
                    DEFAULT_AOI.min_lon,
                    DEFAULT_AOI.max_lat,
                    DEFAULT_AOI.max_lon,
                    now
                ))

            # Seed real satellite scenes from verified metadata if empty
            cursor.execute("SELECT COUNT(*) as count FROM satellite_scenes")
            if cursor.fetchone()["count"] == 0:
                self._seed_satellite_scenes(cursor)

            conn.commit()

    def _seed_satellite_scenes(self, cursor: sqlite3.Cursor):
        """Populates initial verified Copernicus scenes from local metadata cache."""
        now = datetime.now(timezone.utc).isoformat()
        
        # 1. Seed Sentinel-1
        s1_file = METADATA_DIR / "sentinel1_scenes.json"
        if s1_file.exists():
            try:
                with open(s1_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for sc in data.get("scenes", []):
                        raw_bounds = sc.get("bounds", [87.06, 25.60, 89.81, 27.52])
                        if len(raw_bounds) == 4:
                            if raw_bounds[0] > 80.0:  # [min_lon, min_lat, max_lon, max_lat]
                                bounds = [raw_bounds[1], raw_bounds[0], raw_bounds[3], raw_bounds[2]]
                            else:
                                bounds = raw_bounds
                        else:
                            bounds = [26.50, 88.25, 27.75, 88.85]

                        cursor.execute("""
                        INSERT OR IGNORE INTO satellite_scenes (
                            id, mission, platform, instrument, product_id, acquisition_date,
                            cloud_cover, bounds_json, status, status_message, crs, resolution_m,
                            geotiff_path, thumbnail_url, assets_json, metadata_json, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            sc["id"],
                            "Sentinel-1",
                            sc.get("platform", "Sentinel-1A"),
                            "C-SAR",
                            sc["id"],
                            sc.get("acquisition_date", "Unknown"),
                            None,
                            json.dumps(bounds),
                            SceneProcessingStatus.DISCOVERED.value,
                            "Copernicus Sentinel-1 C-SAR GRD discovery record",
                            "EPSG:4326",
                            20.0,
                            None,
                            sc.get("thumbnail_url"),
                            json.dumps({}),
                            json.dumps({"orbit_direction": sc.get("orbit_direction"), "polarization": sc.get("polarization")}),
                            now,
                            now
                        ))
            except Exception:
                pass

        # 2. Seed Sentinel-2
        s2_file = METADATA_DIR / "sentinel2_scenes.json"
        if s2_file.exists():
            try:
                with open(s2_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for sc in data.get("scenes", []):
                        raw_bounds = sc.get("bounds", [88.0, 26.1, 89.1, 27.1])
                        if len(raw_bounds) == 4:
                            if raw_bounds[0] > 80.0:
                                bounds = [raw_bounds[1], raw_bounds[0], raw_bounds[3], raw_bounds[2]]
                            else:
                                bounds = raw_bounds
                        else:
                            bounds = [26.50, 88.25, 27.75, 88.85]

                        cursor.execute("""
                        INSERT OR IGNORE INTO satellite_scenes (
                            id, mission, platform, instrument, product_id, acquisition_date,
                            cloud_cover, bounds_json, status, status_message, crs, resolution_m,
                            geotiff_path, thumbnail_url, assets_json, metadata_json, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            sc["id"],
                            "Sentinel-2",
                            sc.get("platform", "Sentinel-2B"),
                            "MSI",
                            sc["id"],
                            sc.get("acquisition_date", "Unknown"),
                            sc.get("cloud_coverage_percent"),
                            json.dumps(bounds),
                            SceneProcessingStatus.DISCOVERED.value,
                            "Copernicus Sentinel-2 MSI Level-2A discovery record",
                            "EPSG:4326",
                            10.0,
                            None,
                            sc.get("thumbnail_url"),
                            json.dumps({}),
                            json.dumps({"tile_id": sc.get("tile_id")}),
                            now,
                            now
                        ))
            except Exception:
                pass

    def set_active_aoi(self, aoi_id: str, name: str, min_lat: float, min_lon: float, max_lat: float, max_lon: float):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE aoi_history SET is_active = 0")
            cursor.execute("""
            INSERT OR REPLACE INTO aoi_history (id, name, min_lat, min_lon, max_lat, max_lon, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """, (aoi_id, name, min_lat, min_lon, max_lat, max_lon, now))
            conn.commit()

    def get_active_aoi(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM aoi_history WHERE is_active = 1 LIMIT 1")
            row = cursor.fetchone()
            if row:
                return dict(row)
            return {
                "id": DEFAULT_AOI.id,
                "name": DEFAULT_AOI.name,
                "min_lat": DEFAULT_AOI.min_lat,
                "min_lon": DEFAULT_AOI.min_lon,
                "max_lat": DEFAULT_AOI.max_lat,
                "max_lon": DEFAULT_AOI.max_lon,
            }

    def update_service_state(
        self,
        service_id: str,
        state: IngestionState,
        is_available: bool,
        feature_count: int = 0,
        last_error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO service_states (service_id, service_name, category, state, is_available, feature_count, last_fetched_at, last_error, metadata_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(service_id) DO UPDATE SET
                state = excluded.state,
                is_available = excluded.is_available,
                feature_count = excluded.feature_count,
                last_fetched_at = excluded.last_fetched_at,
                last_error = excluded.last_error,
                metadata_json = COALESCE(excluded.metadata_json, service_states.metadata_json),
                updated_at = excluded.updated_at
            """, (
                service_id,
                service_id.upper(),
                "Remote Sensing / Geospatial",
                state.value,
                1 if is_available else 0,
                feature_count,
                now,
                last_error,
                json.dumps(metadata or {}),
                now
            ))
            conn.commit()

    def get_service_state(self, service_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM service_states WHERE service_id = ?", (service_id,))
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d["metadata"] = json.loads(d.get("metadata_json") or "{}")
                return d
            return None

    def list_all_service_states(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM service_states ORDER BY service_id")
            results = []
            for row in cursor.fetchall():
                d = dict(row)
                d["metadata"] = json.loads(d.get("metadata_json") or "{}")
                results.append(d)
            return results

    def start_ingestion_job(self, job_id: str, service_id: str, aoi_id: str):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR REPLACE INTO ingestion_jobs (id, service_id, aoi_id, started_at, state)
            VALUES (?, ?, ?, ?, ?)
            """, (job_id, service_id, aoi_id, now, IngestionState.INGESTING.value))
            conn.commit()

    def finish_ingestion_job(
        self,
        job_id: str,
        state: IngestionState,
        items_count: int = 0,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE ingestion_jobs
            SET finished_at = ?, state = ?, items_count = ?, error_message = ?, metadata_json = ?
            WHERE id = ?
            """, (now, state.value, items_count, error_message, json.dumps(metadata or {}), job_id))
            conn.commit()

    def update_layer_metadata(
        self,
        layer_key: str,
        layer_name: str,
        category: str,
        data_source: str,
        attribution: str,
        feature_count: int,
        geometry_type: str,
        bounds: List[float],
        file_path: str,
        is_available: bool,
        status_message: Optional[str] = None
    ):
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO layer_metadata (
                layer_key, layer_name, category, data_source, attribution,
                feature_count, geometry_type, bounds_json, file_path, updated_at, is_available, status_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(layer_key) DO UPDATE SET
                feature_count = excluded.feature_count,
                geometry_type = excluded.geometry_type,
                bounds_json = excluded.bounds_json,
                file_path = excluded.file_path,
                updated_at = excluded.updated_at,
                is_available = excluded.is_available,
                status_message = excluded.status_message
            """, (
                layer_key, layer_name, category, data_source, attribution,
                feature_count, geometry_type, json.dumps(bounds), file_path, now,
                1 if is_available else 0, status_message
            ))
            conn.commit()

    def get_layer_metadata(self, layer_key: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM layer_metadata WHERE layer_key = ?", (layer_key,))
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d["bounds"] = json.loads(d.get("bounds_json") or "[]")
                return d
            return None

    def list_layer_metadata(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM layer_metadata ORDER BY category, layer_name")
            layers = []
            for row in cursor.fetchall():
                d = dict(row)
                d["bounds"] = json.loads(d.get("bounds_json") or "[]")
                layers.append(d)
            return layers

    get_all_layer_metadata = list_layer_metadata
    upsert_layer_metadata = update_layer_metadata

    # ----------------------------------------------------
    # Satellite Imagery Database Operations (Phase 2)
    # ----------------------------------------------------
    def upsert_scene_record(self, record: RasterSceneRecord) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO satellite_scenes (
                id, mission, platform, instrument, product_id, acquisition_date,
                cloud_cover, bounds_json, status, status_message, crs, resolution_m,
                geotiff_path, thumbnail_url, assets_json, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                status_message = excluded.status_message,
                crs = COALESCE(excluded.crs, satellite_scenes.crs),
                resolution_m = COALESCE(excluded.resolution_m, satellite_scenes.resolution_m),
                geotiff_path = COALESCE(excluded.geotiff_path, satellite_scenes.geotiff_path),
                thumbnail_url = COALESCE(excluded.thumbnail_url, satellite_scenes.thumbnail_url),
                assets_json = COALESCE(excluded.assets_json, satellite_scenes.assets_json),
                metadata_json = COALESCE(excluded.metadata_json, satellite_scenes.metadata_json),
                updated_at = excluded.updated_at
            """, (
                record.id,
                record.mission,
                record.platform,
                record.instrument,
                record.product_id,
                record.acquisition_date,
                record.cloud_cover,
                json.dumps(record.bounds),
                record.status.value,
                record.status_message,
                record.crs,
                record.resolution_m,
                record.geotiff_path,
                record.thumbnail_url,
                json.dumps(record.assets),
                json.dumps(record.metadata),
                now,
                now
            ))
            conn.commit()
            return True

    def get_scene_record(self, scene_id: str) -> Optional[RasterSceneRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM satellite_scenes WHERE id = ?", (scene_id,))
            row = cursor.fetchone()
            if not row:
                return None
            d = dict(row)
            return RasterSceneRecord(
                id=d["id"],
                mission=d["mission"],
                platform=d["platform"],
                instrument=d["instrument"],
                product_id=d["product_id"],
                acquisition_date=d["acquisition_date"],
                cloud_cover=d["cloud_cover"],
                bounds=json.loads(d["bounds_json"]),
                status=SceneProcessingStatus(d["status"]),
                status_message=d.get("status_message"),
                crs=d.get("crs"),
                resolution_m=d.get("resolution_m"),
                geotiff_path=d.get("geotiff_path"),
                thumbnail_url=d.get("thumbnail_url"),
                assets=json.loads(d.get("assets_json") or "{}"),
                metadata=json.loads(d.get("metadata_json") or "{}"),
            )

    def list_scene_records(self, mission: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> List[RasterSceneRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM satellite_scenes"
            params = []
            conditions = []
            if mission and mission.lower() != "all":
                conditions.append("mission = ?")
                params.append(mission)
            if status:
                conditions.append("status = ?")
                params.append(status)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY acquisition_date DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, tuple(params))
            records = []
            for row in cursor.fetchall():
                d = dict(row)
                records.append(RasterSceneRecord(
                    id=d["id"],
                    mission=d["mission"],
                    platform=d["platform"],
                    instrument=d["instrument"],
                    product_id=d["product_id"],
                    acquisition_date=d["acquisition_date"],
                    cloud_cover=d["cloud_cover"],
                    bounds=json.loads(d["bounds_json"]),
                    status=SceneProcessingStatus(d["status"]),
                    status_message=d.get("status_message"),
                    crs=d.get("crs"),
                    resolution_m=d.get("resolution_m"),
                    geotiff_path=d.get("geotiff_path"),
                    thumbnail_url=d.get("thumbnail_url"),
                    assets=json.loads(d.get("assets_json") or "{}"),
                    metadata=json.loads(d.get("metadata_json") or "{}"),
                ))
            return records

    def update_scene_status(self, scene_id: str, status: SceneProcessingStatus, 
                            status_message: Optional[str] = None, geotiff_path: Optional[str] = None,
                            crs: Optional[str] = None, resolution_m: Optional[float] = None) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE satellite_scenes
            SET status = ?, status_message = COALESCE(?, status_message),
                geotiff_path = COALESCE(?, geotiff_path),
                crs = COALESCE(?, crs),
                resolution_m = COALESCE(?, resolution_m),
                updated_at = ?
            WHERE id = ?
            """, (status.value, status_message, geotiff_path, crs, resolution_m, now, scene_id))
            conn.commit()
            return cursor.rowcount > 0

# Singleton instance
metadata_engine = MetadataEngine()
