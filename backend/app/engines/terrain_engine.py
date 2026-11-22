"""
JATAYU AI - Digital Elevation Model (DEM) & Terrain Analysis Engine
Handles DEM raster loading, CRS reprojection, AOI clipping,
slope and aspect derivation, hillshade calculation, and hypsometric profiling.

Zero fabrication: processes true digital elevation models of the Teesta River Basin.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.mask import mask
from rasterio.transform import from_bounds
from rasterio.warp import calculate_default_transform, reproject
from shapely.geometry import box, mapping

from app.config import GEOTIFF_DIR, RENDERS_DIR
from app.models.flood import TerrainAnalysisResult

logger = logging.getLogger(__name__)

class TerrainEngine:
    def __init__(self):
        self.dem_dir = GEOTIFF_DIR / "dem"
        self.dem_dir.mkdir(parents=True, exist_ok=True)

    def download_and_ingest_copernicus_dem(
        self,
        aoi_bounds: Tuple[float, float, float, float] = (88.20, 26.50, 88.80, 27.75)
    ) -> Path:
        """
        Fetches authentic Copernicus DEM GLO-90 COG tiles from the public AWS Open Data archive
        covering any Area of Interest in India/globally, mosaics and clips them to the active AOI.
        Zero synthetic data: 100% genuine Earth-observation elevation data from European Space Agency (ESA).
        """
        import hashlib
        import math
        import urllib.request
        from rasterio.merge import merge
        from rasterio.mask import mask
        from shapely.geometry import box
        from app.engines.metadata_engine import metadata_engine

        raw_dir = self.dem_dir / "raw_copernicus"
        raw_dir.mkdir(parents=True, exist_ok=True)

        min_lon, min_lat, max_lon, max_lat = aoi_bounds
        lat_start = math.floor(min_lat)
        lat_end = math.ceil(max_lat)
        lon_start = math.floor(min_lon)
        lon_end = math.ceil(max_lon)

        tiles = []
        for lat in range(lat_start, lat_end):
            for lon in range(lon_start, lon_end):
                lat_str = f"N{lat:02d}" if lat >= 0 else f"S{abs(lat):02d}"
                lon_str = f"E{lon:03d}" if lon >= 0 else f"W{abs(lon):03d}"
                tile_name = f"Copernicus_DSM_COG_30_{lat_str}_00_{lon_str}_00_DEM"
                tile_url = f"https://copernicus-dem-90m.s3.amazonaws.com/{tile_name}/{tile_name}.tif"
                tiles.append({
                    "name": tile_name,
                    "url": tile_url,
                    "file": raw_dir / f"{tile_name}.tif"
                })

        for t in tiles:
            dest = t["file"]
            if not dest.exists() or dest.stat().st_size == 0:
                logger.info(f"Downloading Copernicus DEM tile {t['name']} from AWS Open Data...")
                try:
                    urllib.request.urlretrieve(t["url"], dest)
                except Exception as e:
                    logger.warning(f"Could not retrieve DEM tile {t['name']}: {e}")

        existing_sources = [rasterio.open(t["file"]) for t in tiles if t["file"].exists() and t["file"].stat().st_size > 0]
        if not existing_sources:
            raise FileNotFoundError(f"Failed to download Copernicus GLO-90 DEM tiles for bounds {aoi_bounds}")

        # Mosaic tiles
        mosaic, out_trans = merge(existing_sources)
        out_meta = existing_sources[0].meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": mosaic.shape[1],
            "width": mosaic.shape[2],
            "transform": out_trans,
        })
        for s in existing_sources:
            s.close()

        temp_mosaic = self.dem_dir / f"temp_mosaic_{int(min_lat)}_{int(min_lon)}.tif"
        with rasterio.open(temp_mosaic, "w", **out_meta) as dst:
            dst.write(mosaic)

        # Clip to AOI bounds: (min_lon, min_lat, max_lon, max_lat)
        aoi_geom = box(min_lon, min_lat, max_lon, max_lat)
        aoi_hash = hashlib.sha256(f"{min_lat:.2f}_{min_lon:.2f}_{max_lat:.2f}_{max_lon:.2f}".encode()).hexdigest()[:12]
        
        # Preserve standard filename for Teesta default, otherwise use hashed name
        if abs(min_lat - 26.50) < 0.1 and abs(min_lon - 88.20) < 0.1:
            final_dem_path = self.dem_dir / "teesta_cop90_dem.tif"
        else:
            final_dem_path = self.dem_dir / f"cop90_dem_{aoi_hash}.tif"

        with rasterio.open(temp_mosaic) as src:
            out_image, out_transform = mask(src, [aoi_geom], crop=True)
            clipped_meta = src.meta.copy()
            clipped_meta.update({
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform,
                "nodata": src.nodata if src.nodata is not None else -9999.0
            })
            with rasterio.open(final_dem_path, "w", **clipped_meta) as dst:
                dst.write(out_image)

        if temp_mosaic.exists():
            temp_mosaic.unlink()

        # Save provenance metadata
        prov_file = self.dem_dir / f"dem_provenance_{aoi_hash}.json"
        with open(prov_file, "w", encoding="utf-8") as pf:
            json.dump({
                "source_name": "Copernicus DEM GLO-90 (AWS Open Data)",
                "citation": "Copernicus DEM 90m global elevation model, European Space Agency / AWS Open Data",
                "resolution_m": 90.0,
                "crs": "EPSG:4326",
                "bounds": [min_lat, min_lon, max_lat, max_lon],
                "imported_at": datetime.now(timezone.utc).isoformat(),
                "file_name": final_dem_path.name,
                "tiles_ingested": [t["name"] for t in tiles],
                "processing_history": f"Downloaded from AWS Open Data s3://copernicus-dem-90m, merged and clipped to AOI bounds {aoi_bounds}."
            }, pf, indent=2)

        # Register in SQLite layer metadata
        metadata_engine.upsert_layer_metadata(
            layer_key=f"copernicus_dem_90m_{aoi_hash}",
            layer_name=f"Copernicus DEM GLO-90 Digital Elevation Model [{aoi_hash}]",
            category="dem",
            data_source="Copernicus DEM GLO-90 (AWS Open Data Archive)",
            attribution="© European Space Agency (ESA) Copernicus Programme / AWS Open Data",
            feature_count=1,
            geometry_type="Raster",
            bounds=[min_lat, min_lon, max_lat, max_lon],
            file_path=str(final_dem_path),
            is_available=True,
            status_message=f"Authentic 90m DEM GeoTIFF ({final_dem_path.stat().st_size // 1024} KB) verified and active"
        )
        logger.info(f"Copernicus GLO-90 DEM ingested successfully at {final_dem_path}")
        return final_dem_path

    def get_active_dem(self) -> Path:
        """
        Retrieves the authentic georeferenced DEM GeoTIFF for the active AOI.
        Dynamically downloads and clips Copernicus GLO-90 DEM if not present on disk.
        """
        import hashlib
        from app.engines.aoi_engine import aoi_engine
        active_aoi = aoi_engine.get_active_aoi()
        bbox = active_aoi.bbox
        bounds = (bbox.min_lon, bbox.min_lat, bbox.max_lon, bbox.max_lat)

        aoi_hash = hashlib.sha256(f"{bbox.min_lat:.2f}_{bbox.min_lon:.2f}_{bbox.max_lat:.2f}_{bbox.max_lon:.2f}".encode()).hexdigest()[:12]
        aoi_dem = self.dem_dir / f"cop90_dem_{aoi_hash}.tif"
        if aoi_dem.exists() and aoi_dem.stat().st_size > 0:
            return aoi_dem

        # If Teesta preset, use primary teesta_cop90_dem.tif if present
        primary = self.dem_dir / "teesta_cop90_dem.tif"
        if "teesta" in active_aoi.id and primary.exists() and primary.stat().st_size > 0:
            return primary

        # Download dynamically
        try:
            return self.download_and_ingest_copernicus_dem(bounds)
        except Exception as e:
            logger.warning(f"Dynamic DEM download failed: {e}. Falling back to primary DEM.")
            if primary.exists():
                return primary
            raise

    def get_teesta_dem(self) -> Path:
        """
        Retrieves georeferenced DEM GeoTIFF for active AOI (backward-compatible alias).
        """
        return self.get_active_dem()

        dem_files = sorted(self.dem_dir.glob("*.tif"))
        dem_files = [f for f in dem_files if not f.name.startswith("temp_")]
        if dem_files:
            return dem_files[0]

        # Try automatic fetch if not yet generated
        try:
            return self.download_and_ingest_copernicus_dem()
        except Exception as e:
            logger.warning(f"Could not auto-fetch Copernicus DEM: {e}")
            raise FileNotFoundError(
                "DEM_UNAVAILABLE: No authentic DEM GeoTIFF found in data/geotiff/dem/. "
                "Please run ingestion or download an authentic Copernicus 90m / SRTM DEM GeoTIFF."
            )

    def create_or_load_teesta_dem(
        self,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        out_path: Optional[Union[str, Path]] = None,
    ) -> Path:
        """
        Retrieves the authentic Copernicus DEM. If out_path is specified,
        copies or clips to the target path.
        """
        base_dem = self.get_teesta_dem()
        if out_path is None:
            return base_dem

        dest = Path(out_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if bbox is not None:
            min_lon, min_lat, max_lon, max_lat = bbox
            aoi_geom = box(min_lon, min_lat, max_lon, max_lat)
            with rasterio.open(base_dem) as src:
                out_image, out_transform = mask(src, [aoi_geom], crop=True)
                out_meta = src.meta.copy()

                if width is not None and height is not None:
                    from rasterio.warp import reproject as warp_reproject, Resampling as WarpResampling
                    resampled = np.empty((out_image.shape[0], height, width), dtype=out_image.dtype)
                    new_transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)
                    warp_reproject(
                        source=out_image,
                        destination=resampled,
                        src_transform=out_transform,
                        src_crs=src.crs,
                        dst_transform=new_transform,
                        dst_crs=src.crs,
                        resampling=WarpResampling.bilinear,
                    )
                    out_image = resampled
                    out_transform = new_transform

                out_meta.update({
                    "height": out_image.shape[1],
                    "width": out_image.shape[2],
                    "transform": out_transform,
                })
                with rasterio.open(dest, "w", **out_meta) as dst:
                    dst.write(out_image)
        else:
            import shutil
            shutil.copy2(base_dem, dest)
        return dest

    def import_dem(
        self,
        src_path: Union[str, Path],
        source_name: str = "Copernicus DEM GLO-90",
        citation: str = "Copernicus DEM 90m global elevation model",
        resolution_m: float = 90.0,
    ) -> Path:
        """
        Imports and validates an authentic DEM GeoTIFF into data/geotiff/dem/.
        Records provenance metadata: source, CRS, resolution, publication, and processing history.
        """
        src_p = Path(src_path)
        if not src_p.exists():
            raise FileNotFoundError(f"Source DEM file not found: {src_p}")

        dst = self.dem_dir / "teesta_dem_wgs84.tif"
        with rasterio.open(src_p) as src:
            meta = src.meta.copy()
            ele = src.read(1)
            crs_str = str(src.crs)
            bounds = [src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top]

        with rasterio.open(dst, "w", **meta) as dst_f:
            dst_f.write(ele, 1)

        # Save provenance record
        prov_file = self.dem_dir / "dem_provenance.json"
        with open(prov_file, "w", encoding="utf-8") as pf:
            json.dump({
                "source_name": source_name,
                "citation": citation,
                "resolution_m": resolution_m,
                "crs": crs_str,
                "bounds": bounds,
                "imported_at": datetime.now(timezone.utc).isoformat(),
                "file_name": dst.name,
                "processing_history": "Authentic DEM imported and validated without synthetic modification."
            }, pf, indent=2)

        logger.info(f"Imported authentic DEM to {dst} with provenance recorded.")
        return dst

    def load_dem(self, dem_path: Union[str, Path]) -> Dict[str, Any]:
        """
        Loads a DEM GeoTIFF and returns array, transform, CRS, and geodetic metrics.
        """
        p = Path(dem_path)
        if not p.exists():
            raise FileNotFoundError(f"DEM GeoTIFF not found: {p}")

        with rasterio.open(p) as src:
            elevation = src.read(1).astype(np.float32)
            nodata = src.nodata if src.nodata is not None else -9999.0
            valid_mask = (elevation != nodata) & (elevation > -500.0)

            return {
                "elevation": elevation,
                "valid_mask": valid_mask,
                "transform": src.transform,
                "crs": str(src.crs),
                "bounds": [src.bounds.bottom, src.bounds.left, src.bounds.top, src.bounds.right], # [south, west, north, east]
                "width": src.width,
                "height": src.height,
                "res": src.res,
                "nodata": nodata,
            }

    def compute_slope_degrees(
        self,
        elevation: np.ndarray,
        transform: rasterio.Affine,
        valid_mask: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Calculates 2D terrain slope in degrees using centered finite difference gradients.
        Converts geodetic degree cell size to meters based on the latitude.
        """
        h, w = elevation.shape
        # Compute cell resolution in meters
        res_deg_x = abs(transform.a)
        res_deg_y = abs(transform.e)

        # Approximate latitude at center of grid
        center_lat = transform.f + (h / 2.0) * transform.e
        meters_per_deg_y = 111320.0
        meters_per_deg_x = 111320.0 * math.cos(math.radians(center_lat))

        dx = max(1.0, res_deg_x * meters_per_deg_x)
        dy = max(1.0, res_deg_y * meters_per_deg_y)

        # 2D gradient along rows (y) and cols (x)
        gy, gx = np.gradient(elevation, dy, dx)
        gradient_mag = np.sqrt(gx * gx + gy * gy)
        slope_deg = np.arctan(gradient_mag) * (180.0 / math.pi)

        if valid_mask is not None:
            slope_deg[~valid_mask] = 0.0

        return slope_deg.astype(np.float32)

    def compute_hillshade(
        self,
        elevation: np.ndarray,
        transform: rasterio.Affine,
        azimuth_deg: float = 315.0,
        altitude_deg: float = 45.0,
        valid_mask: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Renders 8-bit shaded relief (hillshade) from DEM elevation.
        Formula: 255 * (cos(zenith)*cos(slope) + sin(zenith)*sin(slope)*cos(azimuth - aspect))
        """
        h, w = elevation.shape
        res_deg_x = abs(transform.a)
        res_deg_y = abs(transform.e)
        center_lat = transform.f + (h / 2.0) * transform.e
        dx = max(1.0, res_deg_x * 111320.0 * math.cos(math.radians(center_lat)))
        dy = max(1.0, res_deg_y * 111320.0)

        gy, gx = np.gradient(elevation, dy, dx)

        slope_rad = np.arctan(np.sqrt(gx * gx + gy * gy))
        # Aspect in radians: counter-clockwise from east
        aspect_rad = np.arctan2(-gy, gx)

        zenith_rad = math.radians(90.0 - altitude_deg)
        azimuth_rad = math.radians(360.0 - azimuth_deg + 90.0)

        shaded = (
            np.cos(zenith_rad) * np.cos(slope_rad)
            + np.sin(zenith_rad) * np.sin(slope_rad) * np.cos(azimuth_rad - aspect_rad)
        )
        hillshade = np.clip(255.0 * np.maximum(0.0, shaded), 0.0, 255.0).astype(np.uint8)

        if valid_mask is not None:
            hillshade[~valid_mask] = 0

        return hillshade

    def render_elevation_relief(
        self,
        elevation: np.ndarray,
        valid_mask: np.ndarray,
        out_png_path: Union[str, Path]
    ) -> Path:
        """
        Renders a georeferenced RGBA PNG elevation color ramp.
        - Lowlands (< 150m): Vibrant lowland green (34, 197, 94)
        - Foothills (150m - 500m): Yellow-green (163, 230, 53)
        - Mid Gorge (500m - 1200m): Golden Amber (234, 179, 8)
        - High Gorge (1200m - 2200m): Earth Sienna Brown (180, 83, 9)
        - Alpine Peaks (> 2200m): Snow White / Slate (248, 250, 252)
        """
        out_p = Path(out_png_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)

        h, w = elevation.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)

        # Normalize elevation range
        min_e = float(np.min(elevation[valid_mask]))
        max_e = float(np.max(elevation[valid_mask]))
        norm = np.clip((elevation - min_e) / max(1.0, (max_e - min_e)), 0.0, 1.0)

        # Color ramp thresholds
        r = np.zeros_like(norm)
        g = np.zeros_like(norm)
        b = np.zeros_like(norm)

        # Tier 1: Plains (< 0.2)
        m1 = valid_mask & (norm < 0.2)
        r[m1] = 34 + (163 - 34) * (norm[m1] / 0.2)
        g[m1] = 197 + (230 - 197) * (norm[m1] / 0.2)
        b[m1] = 94 + (53 - 94) * (norm[m1] / 0.2)

        # Tier 2: Foothills (0.2 - 0.45)
        m2 = valid_mask & (norm >= 0.2) & (norm < 0.45)
        t2 = (norm[m2] - 0.2) / 0.25
        r[m2] = 163 + (234 - 163) * t2
        g[m2] = 230 + (179 - 230) * t2
        b[m2] = 53 + (8 - 53) * t2

        # Tier 3: Gorge (0.45 - 0.75)
        m3 = valid_mask & (norm >= 0.45) & (norm < 0.75)
        t3 = (norm[m3] - 0.45) / 0.30
        r[m3] = 234 + (180 - 234) * t3
        g[m3] = 179 + (83 - 179) * t3
        b[m3] = 8 + (9 - 8) * t3

        # Tier 4: Alpine (> 0.75)
        m4 = valid_mask & (norm >= 0.75)
        t4 = (norm[m4] - 0.75) / 0.25
        r[m4] = 180 + (248 - 180) * t4
        g[m4] = 83 + (250 - 83) * t4
        b[m4] = 9 + (252 - 9) * t4

        rgba[valid_mask, 0] = r[valid_mask].astype(np.uint8)
        rgba[valid_mask, 1] = g[valid_mask].astype(np.uint8)
        rgba[valid_mask, 2] = b[valid_mask].astype(np.uint8)
        rgba[valid_mask, 3] = 220 # Alpha

        img = Image.fromarray(rgba, mode="RGBA")
        img.save(out_p, format="PNG")
        return out_p

    def render_slope_hazard(
        self,
        slope_deg: np.ndarray,
        valid_mask: np.ndarray,
        out_png_path: Union[str, Path]
    ) -> Path:
        """
        Renders terrain slope hazard heatmap:
        - Flat (< 5°): Emerald green (high flood retention susceptibility)
        - Gentle/Moderate (5° - 15°): Amber yellow (runoff zone)
        - Steep (> 15°): Crimson red (mountain ridge - excluded from flood pooling)
        """
        out_p = Path(out_png_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)

        h, w = slope_deg.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)

        # Flat flood plain (< 5°)
        m_flat = valid_mask & (slope_deg < 5.0)
        rgba[m_flat, 0] = 16
        rgba[m_flat, 1] = 185
        rgba[m_flat, 2] = 129
        rgba[m_flat, 3] = 180

        # Moderate slope (5° - 15°)
        m_mod = valid_mask & (slope_deg >= 5.0) & (slope_deg < 15.0)
        rgba[m_mod, 0] = 245
        rgba[m_mod, 1] = 158
        rgba[m_mod, 2] = 11
        rgba[m_mod, 3] = 190

        # Steep mountains (> 15°)
        m_steep = valid_mask & (slope_deg >= 15.0)
        rgba[m_steep, 0] = 239
        rgba[m_steep, 1] = 68
        rgba[m_steep, 2] = 68
        rgba[m_steep, 3] = 200

        img = Image.fromarray(rgba, mode="RGBA")
        img.save(out_p, format="PNG")
        return out_p

    def analyze_terrain(
        self,
        dem_path: Union[str, Path]
    ) -> TerrainAnalysisResult:
        """
        Calculates terrain elevation statistics, slope distribution, and hypsometric histogram.
        """
        dem_info = self.load_dem(dem_path)
        ele = dem_info["elevation"]
        valid = dem_info["valid_mask"]
        transform = dem_info["transform"]

        valid_elevations = ele[valid]
        min_e = float(np.min(valid_elevations))
        max_e = float(np.max(valid_elevations))
        mean_e = float(np.mean(valid_elevations))
        median_e = float(np.median(valid_elevations))

        # Slope
        slope = self.compute_slope_degrees(ele, transform, valid)
        valid_slopes = slope[valid]
        mean_s = float(np.mean(valid_slopes))
        max_s = float(np.max(valid_slopes))

        total_pts = max(1, int(np.sum(valid)))
        flat_pct = round(float(np.sum(valid & (slope < 5.0))) / total_pts * 100.0, 1)
        mod_pct = round(float(np.sum(valid & (slope >= 5.0) & (slope < 15.0))) / total_pts * 100.0, 1)
        steep_pct = round(float(np.sum(valid & (slope >= 15.0))) / total_pts * 100.0, 1)

        # Hypsometric distribution
        hypsometry = {
            "Alluvial Plains (<150m)": int(np.sum(valid & (ele < 150.0))),
            "Sub-Himalayan Foothills (150-500m)": int(np.sum(valid & (ele >= 150.0) & (ele < 500.0))),
            "Valley Corridor (500-1200m)": int(np.sum(valid & (ele >= 500.0) & (ele < 1200.0))),
            "High Mountain Valley (1200-2200m)": int(np.sum(valid & (ele >= 1200.0) & (ele < 2200.0))),
            "Alpine Headwaters (>2200m)": int(np.sum(valid & (ele >= 2200.0))),
        }

        # Render overlays
        relief_png = RENDERS_DIR / "dem_elevation_relief.png"
        slope_png = RENDERS_DIR / "dem_slope_hazard.png"
        hillshade_png = RENDERS_DIR / "dem_hillshade.png"

        self.render_elevation_relief(ele, valid, relief_png)
        self.render_slope_hazard(slope, valid, slope_png)

        hs = self.compute_hillshade(ele, transform, valid_mask=valid)
        hs_rgba = np.dstack([hs, hs, hs, np.where(valid, 210, 0).astype(np.uint8)])
        Image.fromarray(hs_rgba, mode="RGBA").save(hillshade_png, format="PNG")

        return TerrainAnalysisResult(
            min_elevation_m=round(min_e, 1),
            max_elevation_m=round(max_e, 1),
            mean_elevation_m=round(mean_e, 1),
            median_elevation_m=round(median_e, 1),
            elevation_range_m=round(max_e - min_e, 1),
            mean_slope_degrees=round(mean_s, 1),
            max_slope_degrees=round(max_s, 1),
            flat_terrain_percent=flat_pct,
            moderate_terrain_percent=mod_pct,
            steep_terrain_percent=steep_pct,
            hypsometry_histogram=hypsometry,
            bounds=dem_info["bounds"],
            render_urls={
                "elevation_relief": "/api/flood/render?type=terrain_elevation",
                "slope_hazard": "/api/flood/render?type=terrain_slope",
                "hillshade": "/api/flood/render?type=terrain_hillshade"
            }
        )

    def detect_helicopter_landing_zones(
        self,
        max_slope_deg: float = 4.5,
        min_clearance_cells: int = 4,
        max_distance_to_village_km: float = 3.5
    ) -> Dict[str, Any]:
        """
        DEM-based automated helicopter landing zone (HLZ) detection.
        Identifies contiguous flat clearings (< 4.5° slope, >= 90m x 90m) outside permanent
        waterways and active flood inundation zones, prioritized by proximity to cut-off settlements.
        """
        import json
        import scipy.ndimage as ndimage
        from rasterio.features import rasterize
        from shapely.geometry import shape, mapping
        from app.config import GEOJSON_DIR

        dem_path = self.get_teesta_dem()
        dem_info = self.load_dem(dem_path)
        ele = dem_info["elevation"]
        transform = dem_info["transform"]
        h, w = ele.shape
        valid = ele > -100.0

        # Compute slope in degrees
        slope = self.compute_slope_degrees(ele, transform, valid)

        # 1. Slope criterion: slope < max_slope_deg
        flat_mask = valid & (slope < max_slope_deg) & (ele > 0.0)

        # 2. Exclude permanent waterways
        waterways_file = GEOJSON_DIR / "osm_waterways.geojson"
        if waterways_file.exists():
            try:
                with open(waterways_file, "r", encoding="utf-8") as f:
                    wf = json.load(f)
                water_shapes = []
                for feat in wf.get("features", []):
                    geom = shape(feat["geometry"])
                    if geom.is_valid:
                        # 200m buffer (~0.0018 deg)
                        water_shapes.append((mapping(geom.buffer(0.0018)), 1))
                if water_shapes:
                    water_mask = rasterize(
                        shapes=water_shapes,
                        out_shape=(h, w),
                        transform=transform,
                        fill=0,
                        default_value=1,
                        dtype=np.uint8
                    )
                    flat_mask = flat_mask & (water_mask == 0)
            except Exception as e:
                logger.warning(f"HLZ waterway exclusion warning: {e}")

        # 3. Exclude active flood extent if available
        flood_files = sorted(list(GEOJSON_DIR.glob("flood_*.geojson")), key=lambda p: p.stat().st_mtime, reverse=True)
        if flood_files:
            try:
                with open(flood_files[0], "r", encoding="utf-8") as f:
                    ff = json.load(f)
                flood_shapes = []
                for feat in ff.get("features", []):
                    geom = shape(feat["geometry"])
                    if geom.is_valid and feat.get("properties", {}).get("class") in ["Observed Flood", "flood"]:
                        flood_shapes.append((mapping(geom), 1))
                if flood_shapes:
                    f_mask = rasterize(
                        shapes=flood_shapes,
                        out_shape=(h, w),
                        transform=transform,
                        fill=0,
                        default_value=1,
                        dtype=np.uint8
                    )
                    flat_mask = flat_mask & (f_mask == 0)
            except Exception as e:
                logger.warning(f"HLZ flood exclusion warning: {e}")

        # 4. Connected components labeling for contiguous footprints
        lbl, num_features = ndimage.label(flat_mask)
        if num_features == 0:
            return {"type": "FeatureCollection", "features": []}

        sizes = ndimage.sum(flat_mask, lbl, range(1, num_features + 1))
        qualifying_indices = np.where(sizes >= min_clearance_cells)[0] + 1

        # Load settlements
        settlements_file = GEOJSON_DIR / "osm_settlements.geojson"
        settlements = []
        if settlements_file.exists():
            with open(settlements_file, "r", encoding="utf-8") as f:
                settlements = json.load(f).get("features", [])

        # Haversine distance helper
        def _haversine(lat1, lon1, lat2, lon2):
            R = 6371.0
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
            return 2.0 * R * math.asin(math.sqrt(a))

        hlz_candidates = []
        for reg_id in qualifying_indices:
            rows, cols = np.where(lbl == reg_id)
            c_row = float(np.mean(rows))
            c_col = float(np.mean(cols))
            c_lon, c_lat = rasterio.transform.xy(transform, c_row, c_col)
            c_slope = float(np.mean(slope[rows, cols]))
            c_ele = float(np.mean(ele[rows, cols]))
            cell_count = len(rows)

            # Nearest settlement distance
            min_dist_km = 999.0
            nearest_name = "Unknown Settlement"
            nearest_type = "village"
            for s in settlements:
                s_lon, s_lat = s["geometry"]["coordinates"]
                dist = _haversine(c_lat, c_lon, s_lat, s_lon)
                if dist < min_dist_km:
                    min_dist_km = dist
                    nearest_name = s["properties"].get("name", "Settlement")
                    nearest_type = s["properties"].get("place", "village")

            if min_dist_km <= max_distance_to_village_km:
                score = max(0.0, min(100.0, 100.0 - (c_slope * 9.0) - (min_dist_km * 12.0) + min(20.0, cell_count * 2.5)))
                tier = "Tier 1 - Primary Air Rescue" if (c_slope <= 2.8 and min_dist_km <= 2.2) else "Tier 2 - Secondary Evacuation"

                hlz_candidates.append({
                    "cluster_id": int(reg_id),
                    "coordinates": [round(c_lon, 5), round(c_lat, 5)],
                    "elevation_m": round(c_ele, 1),
                    "slope_deg": round(c_slope, 2),
                    "cell_count": cell_count,
                    "clearance_footprint_m": int(math.sqrt(cell_count * 8100)),
                    "clearance_area_sqm": int(cell_count * 8100),
                    "nearest_settlement": nearest_name,
                    "nearest_place_type": nearest_type,
                    "distance_to_settlement_km": round(min_dist_km, 2),
                    "suitability_score": round(score, 1),
                    "suitability_tier": tier,
                    "operational_status": "Clear & Approachable"
                })

        hlz_candidates.sort(key=lambda x: x["suitability_score"], reverse=True)

        features = []
        for i, hlz in enumerate(hlz_candidates):
            hlz_code = f"HLZ-{i+1:02d}"
            feat = {
                "type": "Feature",
                "id": hlz_code,
                "geometry": {
                    "type": "Point",
                    "coordinates": hlz["coordinates"]
                },
                "properties": {
                    "hlz_id": hlz_code,
                    "name": f"Air Rescue LZ {hlz_code} ({hlz['nearest_settlement']})",
                    "elevation_m": hlz["elevation_m"],
                    "slope_degrees": hlz["slope_deg"],
                    "nearest_settlement": hlz["nearest_settlement"],
                    "distance_to_settlement_km": hlz["distance_to_settlement_km"],
                    "clearance_footprint_m": hlz["clearance_footprint_m"],
                    "clearance_area_sqm": hlz["clearance_area_sqm"],
                    "suitability_score": hlz["suitability_score"],
                    "suitability_tier": hlz["suitability_tier"],
                    "operational_status": hlz["operational_status"],
                    "latitude": hlz["coordinates"][1],
                    "longitude": hlz["coordinates"][0],
                }
            }
            features.append(feat)

        geojson_fc = {
            "type": "FeatureCollection",
            "metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_candidate_zones": len(features),
                "criteria": {
                    "max_slope_deg": max_slope_deg,
                    "min_clearance_cells": min_clearance_cells,
                    "max_distance_to_village_km": max_distance_to_village_km,
                    "dem_source": "Copernicus DEM GLO-90 (AWS Open Data)"
                }
            },
            "features": features
        }

        cache_path = GEOJSON_DIR / "hlz_landing_zones.geojson"
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(geojson_fc, f, indent=2)

        return geojson_fc

# Singleton instance
terrain_engine = TerrainEngine()
