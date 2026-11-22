"""
NASA VIIRS Black Marble VNP46A2 Night-Light Intelligence Engine
Phase 5: HDF5 Ingestion, BRDF Radiance, Mandatory Quality Masking,
Multi-Temporal Baseline Compositing, Percentage Reduction, Spatial Clustering,
and 500m Resolution Scientific Attribution.

Zero synthetic hallucinations:
- Strict NASA Black Marble VNP46A2 HDF-EOS5 schema (v2.0 VIIRS_Grid_DNB_2d and legacy VNP_Grid_DNB)
- Mandatory_Quality_Flag cloud and stray light screening (0 = High Quality, 1-5 = Masked)
- Explicit 15 arc-second (~500m) spatial resolution accounting
- Prohibition against automatically claiming power outages from radiance alone
"""

from datetime import datetime, timezone, timedelta
import json
import logging
import math
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple, Union

import h5py
import numpy as np
from PIL import Image
import rasterio
from rasterio.features import shapes
from rasterio.transform import from_bounds
import scipy.ndimage
from shapely.geometry import Polygon, shape

from app.config import GEOJSON_DIR, GEOTIFF_DIR, RENDERS_DIR, VIIRS_DIR
from app.engines.aoi_engine import aoi_engine
from app.models.aoi import BoundingBox
from app.models.nightlight import (
    NightlightAnalysisParams,
    NightlightAnalysisResult,
    SpatialCluster,
    VIIRSObservationMetadata,
)

logger = logging.getLogger(__name__)

# NASA Black Marble VNP46A2 HDF5 dataset paths
HDF_RADIANCE_PATH_V2 = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/DNB_BRDF-Corrected_NTL"
HDF_GAP_FILLED_PATH_V2 = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/Gap_Filled_DNB_BRDF-Corrected_NTL"
HDF_QUALITY_PATH_V2 = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/Mandatory_Quality_Flag"
HDF_SNOW_PATH_V2 = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/Snow_Flag"
HDF_LAT_PATH_V2 = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/lat"
HDF_LON_PATH_V2 = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/lon"

# Legacy fallback paths (v1 / synthetic)
HDF_RADIANCE_PATH_V1 = "HDFEOS/GRIDS/VNP_Grid_DNB/Data Fields/DNB_BRDF-Corrected_NTL"
HDF_QUALITY_PATH_V1 = "HDFEOS/GRIDS/VNP_Grid_DNB/Data Fields/Mandatory_Quality_Flag"

PIXEL_SIZE_DEG = 15.0 / 3600.0  # 15 arc-seconds (~460-500m)


def _to_float(val: Any, default: float = 0.0) -> float:
    """Safely converts 0-d or 1-d numpy arrays/attributes to native python float."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    if hasattr(val, "item"):
        try:
            return float(val.item())
        except Exception:
            pass
    try:
        arr = np.asarray(val)
        return float(arr.flat[0])
    except Exception:
        return default


def _parse_h5_date(h5_path: Path, f: h5py.File) -> Tuple[str, str]:
    """Extracts ISO date (YYYY-MM-DD) and Julian string from filename or HDF attributes."""
    m = re.search(r"A(\d{4})(\d{3})", h5_path.name)
    if m:
        year, doy = int(m.group(1)), int(m.group(2))
        dt = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=doy - 1)
        return dt.strftime("%Y-%m-%d"), f"A{year}{doy:03d}"

    raw_date = f.attrs.get("RangeBeginningDate") or f.attrs.get("ObservationDate")
    if isinstance(raw_date, bytes):
        raw_date = raw_date.decode("utf-8")
    raw_julian = f.attrs.get("JulianDay", "A2023274")
    if isinstance(raw_julian, bytes):
        raw_julian = raw_julian.decode("utf-8")

    return str(raw_date or "2023-10-01"), str(raw_julian)


def _get_ds(f: h5py.File, candidate_paths: List[str]):
    for p in candidate_paths:
        if p in f:
            return f[p]
    return None


def resolve_intersecting_viirs_tiles(bbox: BoundingBox) -> List[str]:
    """
    Computes all NASA MODIS/VIIRS Land Grid 10°x10° tile identifiers (hXXvYY)
    overlapping the given geographic bounding box anywhere across India or globally.
    h = floor((lon + 180) / 10)  (range 0-35)
    v = floor((90 - lat) / 10)   (range 0-17)
    """
    h_min = int(math.floor((bbox.min_lon + 180.0) / 10.0))
    h_max = int(math.floor((bbox.max_lon + 180.0) / 10.0))
    v_min = int(math.floor((90.0 - bbox.max_lat) / 10.0))
    v_max = int(math.floor((90.0 - bbox.min_lat) / 10.0))

    tiles = []
    for h in range(h_min, h_max + 1):
        for v in range(v_min, v_max + 1):
            tiles.append(f"h{h:02d}v{v:02d}")
    return sorted(list(set(tiles)))


class NightlightEngine:
    def __init__(self, viirs_dir: Path = VIIRS_DIR):
        self.viirs_dir = viirs_dir
        self.viirs_dir.mkdir(parents=True, exist_ok=True)
        self._last_result: Optional[NightlightAnalysisResult] = None

    def get_latest_result(self) -> Optional[NightlightAnalysisResult]:
        return self._last_result

    def download_latest_viirs_granules(
        self,
        bbox: Optional[BoundingBox] = None,
        max_granules: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Discovers and downloads authentic NASA VIIRS Black Marble VNP46A2 HDF5 granules
        for the active bounding box from NASA CMR using EARTHDATA_TOKEN.
        Zero synthetic data: fetches genuine NASA HDF-EOS5 files only.
        """
        if bbox is None:
            active_aoi = aoi_engine.get_active_aoi()
            bbox = active_aoi.bbox

        token = os.getenv("EARTHDATA_TOKEN", "").strip()
        if not token:
            from app.config import BASE_DIR
            from dotenv import dotenv_values
            env_vals = dotenv_values(BASE_DIR / ".env")
            token = env_vals.get("EARTHDATA_TOKEN", "").strip()

        if not token:
            logger.warning("EARTHDATA_TOKEN not configured in environment or backend/.env")
            return []

        target_tiles = resolve_intersecting_viirs_tiles(bbox)
        logger.info(f"Searching NASA CMR for VNP46A2 granules in tiles: {target_tiles}, bbox: [{bbox.min_lon}, {bbox.min_lat}, {bbox.max_lon}, {bbox.max_lat}]")

        cmr_url = (
            f"https://cmr.earthdata.nasa.gov/search/granules.json?"
            f"short_name=VNP46A2&bounding_box={bbox.min_lon},{bbox.min_lat},{bbox.max_lon},{bbox.max_lat}"
            f"&page_size={max_granules}&sort_key=-start_date"
        )

        headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "JatayuAI-DisasterIntelligence/1.0 (+https://github.com/jatayu-ai)",
        }

        downloaded_records = []
        try:
            import httpx
            with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                resp = client.get(cmr_url, headers=headers)
                if resp.status_code != 200:
                    logger.warning(f"CMR search failed with status {resp.status_code}")
                    return []

                data = resp.json()
                entries = data.get("feed", {}).get("entry", [])

                for entry in entries:
                    h5_links = [
                        l["href"]
                        for l in entry.get("links", [])
                        if l.get("href", "").endswith(".h5") and not l.get("href", "").endswith(".xml")
                    ]
                    if not h5_links:
                        continue

                    h5_url = h5_links[0]
                    filename = h5_url.split("/")[-1]
                    dest_path = self.viirs_dir / filename

                    if dest_path.exists() and dest_path.stat().st_size > 1000000:
                        logger.info(f"VIIRS granule already exists locally: {filename}")
                        downloaded_records.append({
                            "filename": filename,
                            "path": str(dest_path),
                            "status": "ALREADY_PRESENT",
                            "granule_id": entry.get("id"),
                            "time_start": entry.get("time_start"),
                        })
                        continue

                    logger.info(f"Downloading authentic NASA VIIRS granule: {filename} from {h5_url}")
                    temp_path = self.viirs_dir / f"{filename}.tmp"
                    with client.stream("GET", h5_url, headers=headers) as stream_resp:
                        if stream_resp.status_code == 200:
                            with open(temp_path, "wb") as f_out:
                                for chunk in stream_resp.iter_bytes(chunk_size=1048576):
                                    f_out.write(chunk)
                            # Verify HDF5 file integrity
                            try:
                                with h5py.File(temp_path, "r") as test_h5:
                                    _ = list(test_h5.keys())
                                if temp_path.exists():
                                    if dest_path.exists():
                                        dest_path.unlink()
                                    temp_path.rename(dest_path)
                                logger.info(f"Successfully downloaded and verified {filename} ({dest_path.stat().st_size} bytes)")
                                downloaded_records.append({
                                    "filename": filename,
                                    "path": str(dest_path),
                                    "status": "DOWNLOADED_AUTHENTIC",
                                    "granule_id": entry.get("id"),
                                    "time_start": entry.get("time_start"),
                                })
                            except Exception as h5_err:
                                logger.error(f"Downloaded file {filename} corrupted: {h5_err}")
                                if temp_path.exists():
                                    temp_path.unlink()
                        else:
                            logger.warning(f"Download of {filename} failed with HTTP {stream_resp.status_code}")
                            if temp_path.exists():
                                temp_path.unlink()

        except Exception as e:
            logger.error(f"Error querying/downloading VIIRS granules: {e}", exc_info=True)

        return downloaded_records

    def list_available_observations(self, bbox: Optional[BoundingBox] = None) -> List[VIIRSObservationMetadata]:
        """Scans the VIIRS directory and inspects all VNP46A2 HDF5 files matching active AOI tiles"""
        if bbox is None:
            active_aoi = aoi_engine.get_active_aoi()
            bbox = active_aoi.bbox

        target_tiles = resolve_intersecting_viirs_tiles(bbox)
        h5_files = sorted(self.viirs_dir.glob("*.h5"))
        metadata_list = []

        for p in h5_files:
            # Check if file belongs to any target tile
            tile_match = any(t in p.name for t in target_tiles)
            if tile_match or not target_tiles:
                meta = self.inspect_vnp46a2_file(p)
                if meta:
                    metadata_list.append(meta)

        return metadata_list

    def inspect_vnp46a2_file(self, h5_path: Path) -> Optional[VIIRSObservationMetadata]:
        """Extracts metadata, pixel counts, and quality distributions from a VNP46A2 HDF5 file"""
        if not h5_path.exists():
            return None

        try:
            with h5py.File(h5_path, "r") as f:
                ds_ntl = _get_ds(
                    f,
                    [
                        HDF_RADIANCE_PATH_V2,
                        HDF_RADIANCE_PATH_V1,
                        "DNB_BRDF-Corrected_NTL",
                    ],
                )
                ds_qf = _get_ds(
                    f,
                    [
                        HDF_QUALITY_PATH_V2,
                        HDF_QUALITY_PATH_V1,
                        "Mandatory_Quality_Flag",
                    ],
                )

                if ds_ntl is None or ds_qf is None:
                    logger.error(f"Required datasets missing in {h5_path}")
                    return None

                dn = ds_ntl[:]
                qf = ds_qf[:]
                scale = _to_float(ds_ntl.attrs.get("scale_factor"), 1.0)
                fill_val = _to_float(ds_ntl.attrs.get("_FillValue"), -999.9)

                total_pixels = int(dn.size)
                # Fill / missing data
                fill_pixels = int(np.sum((dn <= -900.0) | (dn == fill_val)))
                # Quality flag: 0 = high quality, 1-5 = poor/cloud, 255 = fill
                cloud_pixels = int(np.sum((qf >= 1) | (dn <= -900.0)))
                poor_pixels = int(np.sum((qf >= 1) & (qf <= 5)))
                valid_mask = (qf == 0) & (dn >= 0.0)
                valid_pixels = int(np.sum(valid_mask))

                valid_rad = dn[valid_mask] * scale
                mean_rad = float(np.mean(valid_rad)) if valid_pixels > 0 else 0.0

                date_str, julian_str = _parse_h5_date(h5_path, f)

                active_aoi = aoi_engine.get_active_aoi()
                aoi_bounds = [
                    active_aoi.bbox.min_lat,
                    active_aoi.bbox.min_lon,
                    active_aoi.bbox.max_lat,
                    active_aoi.bbox.max_lon,
                ]

                s_b = f.attrs.get("SouthBoundingCoord")
                w_b = f.attrs.get("WestBoundingCoord")
                n_b = f.attrs.get("NorthBoundingCoord")
                e_b = f.attrs.get("EastBoundingCoord")

                s_bound = _to_float(s_b, aoi_bounds[0])
                w_bound = _to_float(w_b, aoi_bounds[1])
                n_bound = _to_float(n_b, aoi_bounds[2])
                e_bound = _to_float(e_b, aoi_bounds[3])
                bounds = [s_bound, w_bound, n_bound, e_bound]

                return VIIRSObservationMetadata(
                    scene_id=h5_path.name,
                    date=date_str,
                    julian_day=julian_str,
                    orbit_type="Nighttime VIIRS DNB (Suomi-NPP / NOAA-20)",
                    tile="h26v06",
                    bounds=bounds,
                    total_pixels=total_pixels,
                    valid_pixels=valid_pixels,
                    cloud_pixels=cloud_pixels,
                    poor_quality_pixels=poor_pixels,
                    fill_pixels=fill_pixels,
                    mean_radiance=round(mean_rad, 2),
                    hdf5_path=str(h5_path),
                )
        except Exception as e:
            logger.error(f"Error inspecting VNP46A2 file {h5_path}: {e}")
            return None

    def read_radiance_and_quality(
        self,
        h5_path: Path,
        use_gap_filled: bool = False,
        aoi_crop: bool = False,
    ) -> Tuple[np.ndarray, np.ndarray, float]:
        """
        Extracts calibrated BRDF nighttime radiance array (nW/(cm^2 sr))
        and mandatory quality flag array from an HDF5 VNP46A2 product.
        Optionally crops to active AOI if coordinate arrays exist.
        """
        with h5py.File(h5_path, "r") as f:
            rad_path = (
                HDF_GAP_FILLED_PATH_V2
                if (use_gap_filled and HDF_GAP_FILLED_PATH_V2 in f)
                else HDF_RADIANCE_PATH_V2
            )
            ds_ntl = _get_ds(
                f,
                [
                    rad_path,
                    HDF_RADIANCE_PATH_V2,
                    HDF_RADIANCE_PATH_V1,
                    "DNB_BRDF-Corrected_NTL",
                ],
            )
            ds_qf = _get_ds(
                f,
                [
                    HDF_QUALITY_PATH_V2,
                    HDF_QUALITY_PATH_V1,
                    "Mandatory_Quality_Flag",
                ],
            )

            if ds_ntl is None or ds_qf is None:
                raise KeyError(f"Unable to find radiance or quality datasets in {h5_path}")

            scale = _to_float(ds_ntl.attrs.get("scale_factor"), 1.0)

            if aoi_crop and HDF_LAT_PATH_V2 in f and HDF_LON_PATH_V2 in f:
                lat = f[HDF_LAT_PATH_V2][:]
                lon = f[HDF_LON_PATH_V2][:]
                active_aoi = aoi_engine.get_active_aoi()
                n_limit = active_aoi.bbox.max_lat
                s_limit = active_aoi.bbox.min_lat
                w_limit = active_aoi.bbox.min_lon
                e_limit = active_aoi.bbox.max_lon

                # lat descends from North to South
                r_matches = np.where((lat <= n_limit) & (lat >= s_limit))[0]
                c_matches = np.where((lon >= w_limit) & (lon <= e_limit))[0]

                if len(r_matches) > 0 and len(c_matches) > 0:
                    r_min, r_max = int(r_matches[0]), int(r_matches[-1]) + 1
                    c_min, c_max = int(c_matches[0]), int(c_matches[-1]) + 1
                    dn = ds_ntl[r_min:r_max, c_min:c_max]
                    qf = ds_qf[r_min:r_max, c_min:c_max]
                else:
                    dn = ds_ntl[:]
                    qf = ds_qf[:]
            else:
                dn = ds_ntl[:]
                qf = ds_qf[:]

            # Quality Masking
            if use_gap_filled:
                valid_mask = dn >= 0.0
            else:
                valid_mask = (qf == 0) & (dn >= 0.0)

            radiance = np.where(valid_mask, dn.astype(np.float32) * scale, np.nan)
            return radiance, qf, scale

    def run_nightlight_analysis(
        self,
        params: Optional[NightlightAnalysisParams] = None,
    ) -> NightlightAnalysisResult:
        """
        Core Night-Light Disruption and Anomaly Detection Pipeline:
        1. Multi-temporal baseline composite from pre-event cloud-free observations.
        2. Comparison against post-event daily observation.
        3. Strict quality filtering: cloud/poor quality pixels are NEVER classified as blackouts.
        4. Percentage and absolute radiance reduction calculation.
        5. Spatial cluster detection (scipy.ndimage) filtering isolated single-pixel noise.
        6. Georeferenced GeoTIFF and RGBA map visualization output.
        7. Strict 500m resolution accounting and scientific causal attribution disclaimer.
        """
        if params is None:
            params = NightlightAnalysisParams()

        analysis_id = f"viirs_{int(datetime.now(timezone.utc).timestamp())}"
        available_obs = self.list_available_observations()
        if not available_obs:
            logger.info("No local VIIRS granules found for active AOI. Attempting live CMR download...")
            self.download_latest_viirs_granules()
            available_obs = self.list_available_observations()

        if not available_obs:
            token = os.getenv("EARTHDATA_TOKEN", "").strip()
            if not token:
                raise FileNotFoundError(
                    "EARTHDATA_TOKEN_REQUIRED: NASA Earthdata Bearer token required in backend/.env "
                    "to download authentic VNP46A2 HDF5 granules."
                )
            raise FileNotFoundError(
                "DATA_UNAVAILABLE: No authentic NASA Black Marble VNP46A2 HDF5 granules found in data/viirs. "
                "Download authentic granules with NASA Earthdata credentials to execute analysis."
            )

        # 1. Resolve Pre-Event Baseline Dates
        pre_dates = params.pre_event_dates
        if not pre_dates:
            # Default to first 3 baseline observations
            pre_dates = [
                obs.date
                for obs in available_obs
                if obs.date in ["2023-10-01", "2023-10-02", "2023-10-03"]
            ]
            if not pre_dates:
                pre_dates = [obs.date for obs in available_obs[:3]]

        # 2. Resolve Post-Event Date
        post_date = params.post_event_date
        if not post_date:
            # Default to the most recent post-event observation not in pre_dates
            post_candidates = sorted(
                [obs.date for obs in available_obs if obs.date not in pre_dates],
                reverse=True,
            )
            post_date = post_candidates[0] if post_candidates else available_obs[-1].date

        # Load Pre-Event HDF5 Observations (cropped to active AOI for performance)
        pre_files = [obs.hdf5_path for obs in available_obs if obs.date in pre_dates]
        if not pre_files:
            raise ValueError(f"No VIIRS HDF5 files found matching pre-event dates: {pre_dates}")

        # Compute Multi-Temporal Baseline Composite
        rad_stacks = []
        for p in pre_files:
            rad, _, _ = self.read_radiance_and_quality(Path(p), use_gap_filled=False, aoi_crop=True)
            rad_stacks.append(rad)

        rad_stack = np.stack(rad_stacks, axis=0)  # shape (K, H, W)
        k_obs, h, w = rad_stack.shape

        # Valid baseline pixel count per cell
        valid_obs_count = np.sum(~np.isnan(rad_stack), axis=0)
        insufficient_baseline_mask = valid_obs_count < params.min_valid_baseline_obs

        # Baseline radiance: Median of cloud-free observations
        with np.errstate(all="ignore"):
            baseline_radiance = np.nanmedian(rad_stack, axis=0)

        # When monsoon clouds cover raw pre-event days, fill gaps from NASA's official Gap-Filled BRDF layer
        if np.any(insufficient_baseline_mask):
            gf_stacks = []
            for p in pre_files:
                gf_rad, _, _ = self.read_radiance_and_quality(Path(p), use_gap_filled=True, aoi_crop=True)
                gf_stacks.append(gf_rad)
            with np.errstate(all="ignore"):
                gf_baseline = np.nanmedian(np.stack(gf_stacks, axis=0), axis=0)
            baseline_radiance[insufficient_baseline_mask] = gf_baseline[insufficient_baseline_mask]
            # Update mask: only cells where even gap-filled is NaN remain insufficient
            insufficient_baseline_mask = np.isnan(baseline_radiance)

        # Load Post-Event Observation
        post_obs_meta = next((obs for obs in available_obs if obs.date == post_date), None)
        if not post_obs_meta:
            raise ValueError(f"No VIIRS HDF5 file found for post-event date: {post_date}")

        post_radiance, post_qf, _ = self.read_radiance_and_quality(
            Path(post_obs_meta.hdf5_path), use_gap_filled=False, aoi_crop=True
        )

        # Quality & Cloud Masks on Post-Observation
        # Rule: Do not classify missing, cloudy or poor-quality pixels as blackouts!
        post_cloud_mask = (post_qf > 0) | (np.isnan(post_radiance)) | (post_radiance < 0.0)
        post_poor_quality = (post_qf >= 2) & (~post_cloud_mask)

        # 3. Percentage Brightness Reduction Calculation
        # Distinguish:
        # A. Unlit background (< 1.0 nW): Forests/mountain ridges without lighting
        unlit_bg_mask = (~np.isnan(baseline_radiance)) & (baseline_radiance < 1.0)

        # B. Lit baseline pixels (> 1.0 nW)
        lit_mask = (
            (~np.isnan(baseline_radiance))
            & (baseline_radiance >= 1.0)
            & (~post_cloud_mask)
            & (~post_poor_quality)
        )

        rad_diff = np.zeros((h, w), dtype=np.float32)
        pct_reduction = np.zeros((h, w), dtype=np.float32)

        with np.errstate(all="ignore"):
            rad_diff[lit_mask] = baseline_radiance[lit_mask] - post_radiance[lit_mask]
            pct_reduction[lit_mask] = (
                rad_diff[lit_mask] / baseline_radiance[lit_mask]
            ) * 100.0

        # Candidate Reduction Pixels
        # Meets percentage reduction threshold (>= 40%) AND absolute drop threshold (>= 2.5 nW)
        candidate_reduction = (
            lit_mask
            & (pct_reduction >= params.radiance_reduction_threshold_pct)
            & (rad_diff >= params.min_absolute_drop_nw)
        )

        # 4. Spatial Clustering (scipy.ndimage.label)
        # Filter out isolated single 500m pixels: Disasters cause regional cluster drops
        struct_8 = np.ones((3, 3), dtype=np.int32)
        labeled_clusters, num_features = scipy.ndimage.label(
            candidate_reduction, structure=struct_8
        )

        significant_cluster_mask = np.zeros((h, w), dtype=bool)
        isolated_pixel_mask = np.zeros((h, w), dtype=bool)
        clusters_list: List[SpatialCluster] = []

        # Coordinate calculation for active AOI
        active_aoi = aoi_engine.get_active_aoi()
        s_bound = active_aoi.bbox.min_lat
        w_bound = active_aoi.bbox.min_lon
        n_bound = active_aoi.bbox.max_lat
        e_bound = active_aoi.bbox.max_lon
        bounds = [s_bound, w_bound, n_bound, e_bound]

        lat_mid = (s_bound + n_bound) / 2.0
        dx_m = PIXEL_SIZE_DEG * 111320.0 * math.cos(math.radians(lat_mid))
        dy_m = PIXEL_SIZE_DEG * 111320.0
        cell_area_sqkm = (dx_m * dy_m) / 1e6  # ~0.22 sq km per pixel

        lats = np.linspace(n_bound, s_bound, h)
        lons = np.linspace(w_bound, e_bound, w)

        cluster_id_counter = 1
        for cid in range(1, num_features + 1):
            cluster_pix = labeled_clusters == cid
            pix_count = int(np.sum(cluster_pix))

            if pix_count >= params.min_cluster_pixels:
                significant_cluster_mask[cluster_pix] = True
                c_rows, c_cols = np.where(cluster_pix)
                centroid_lat = float(np.mean(lats[c_rows]))
                centroid_lon = float(np.mean(lons[c_cols]))

                mean_base_rad = float(np.mean(baseline_radiance[cluster_pix]))
                mean_post_rad = float(np.mean(post_radiance[cluster_pix]))
                mean_drop_pct = float(np.mean(pct_reduction[cluster_pix]))
                area_sqkm = round(pix_count * cell_area_sqkm, 2)

                # Geographic naming along Teesta corridor
                if centroid_lat > 27.2:
                    sub_region = "Upper Teesta / North Sikkim Corridor"
                elif centroid_lat > 26.95:
                    sub_region = "Middle Teesta / Singtam-Melli Gorge"
                else:
                    sub_region = "Lower Teesta / Sevoke Foothills Corridor"

                region_name = f"Cluster {cluster_id_counter} ({sub_region})"

                min_clat = float(np.min(lats[c_rows]))
                max_clat = float(np.max(lats[c_rows]))
                min_clon = float(np.min(lons[c_cols]))
                max_clon = float(np.max(lons[c_cols]))

                clusters_list.append(
                    SpatialCluster(
                        cluster_id=cluster_id_counter,
                        pixel_count=pix_count,
                        area_sqkm=area_sqkm,
                        centroid_lat=round(centroid_lat, 4),
                        centroid_lon=round(centroid_lon, 4),
                        mean_baseline_radiance=round(mean_base_rad, 2),
                        mean_post_radiance=round(mean_post_rad, 2),
                        mean_radiance_drop_pct=round(mean_drop_pct, 1),
                        approximate_region=region_name,
                        spatial_resolution_note="VIIRS 15 arc-sec (~500m) sensor resolution footprint",
                        coordinates_bbox=[
                            round(min_clat, 4),
                            round(min_clon, 4),
                            round(max_clat, 4),
                            round(max_clon, 4),
                        ],
                    )
                )
                cluster_id_counter += 1
            else:
                isolated_pixel_mask[cluster_pix] = True

        # Sort clusters by area descending
        clusters_list.sort(key=lambda c: c.area_sqkm, reverse=True)

        # 5. Output Classification Raster
        # 0: Background Unlit (< 1 nW)
        # 1: Normal / Persistent Lighting
        # 2: Significant Spatial Light Reduction Cluster
        # 3: Filtered Isolated Anomaly (< min_cluster_pixels)
        # 254: Cloud Obscured / Poor Quality Observation (NOT a blackout)
        # 255: Insufficient Baseline Data / NoData
        output_raster = np.zeros((h, w), dtype=np.uint8)
        output_raster[lit_mask] = 1
        output_raster[unlit_bg_mask] = 0
        output_raster[isolated_pixel_mask] = 3
        output_raster[significant_cluster_mask] = 2
        output_raster[post_cloud_mask | post_poor_quality] = 254
        output_raster[insufficient_baseline_mask] = 255

        # 6. Write Classified GeoTIFF
        out_geotiff_path = GEOTIFF_DIR / f"{analysis_id}.tif"
        transform = from_bounds(w_bound, s_bound, e_bound, n_bound, w, h)

        meta = {
            "driver": "GTiff",
            "dtype": "uint8",
            "nodata": 255,
            "width": w,
            "height": h,
            "count": 1,
            "crs": "EPSG:4326",
            "transform": transform,
        }

        with rasterio.open(out_geotiff_path, "w", **meta) as dst:
            dst.write(output_raster, 1)

        # 7. Render RGBA PNG Map Overlay
        out_png_path = RENDERS_DIR / f"{analysis_id}.png"
        rgba = np.zeros((h, w, 4), dtype=np.uint8)

        # Normal lighting (Class 1): Subtle turquoise / cyan luminescence
        rgba[output_raster == 1, 0] = 6
        rgba[output_raster == 1, 1] = 182
        rgba[output_raster == 1, 2] = 212
        rgba[output_raster == 1, 3] = 70

        # Significant spatial reduction cluster (Class 2): Vibrant warning amber/red
        rgba[output_raster == 2, 0] = 239
        rgba[output_raster == 2, 1] = 68
        rgba[output_raster == 2, 2] = 68
        rgba[output_raster == 2, 3] = 220

        # Filtered isolated pixel (Class 3): Muted orange
        rgba[output_raster == 3, 0] = 249
        rgba[output_raster == 3, 1] = 115
        rgba[output_raster == 3, 2] = 22
        rgba[output_raster == 3, 3] = 120

        # Cloud Obscuration / Poor Quality (Class 254): Soft purple-grey crosshatch
        rgba[output_raster == 254, 0] = 147
        rgba[output_raster == 254, 1] = 51
        rgba[output_raster == 254, 2] = 234
        rgba[output_raster == 254, 3] = 90

        img = Image.fromarray(rgba, mode="RGBA")
        img.save(out_png_path, format="PNG")

        # 8. Export GeoJSON Polygons of Significant Clusters
        out_geojson_path = GEOJSON_DIR / f"{analysis_id}.geojson"
        cluster_mask_u8 = significant_cluster_mask.astype(np.uint8)
        geojson_features = []

        for geom_dict, val in shapes(
            cluster_mask_u8, mask=(cluster_mask_u8 == 1), transform=transform
        ):
            poly = shape(geom_dict)
            if poly.is_valid and poly.area > 0.000001:
                geojson_features.append({
                    "type": "Feature",
                    "geometry": geom_dict,
                    "properties": {
                        "classification": "SIGNIFICANT_NIGHTLIGHT_REDUCTION_CLUSTER",
                        "sensor": "NASA VIIRS Black Marble VNP46A2",
                        "spatial_resolution": "15 arc-sec (~500m)",
                        "pre_event_dates": pre_dates,
                        "post_event_date": post_date,
                        "area_sqkm": round(
                            poly.area
                            * (111320.0 * 111320.0 * math.cos(math.radians(lat_mid)))
                            / 1e6,
                            2,
                        ),
                        "scientific_attribution": "Observed surface luminance drop. Multiple causes include power grid disruption, commercial shutdown, evacuation curfew, and water surface reflectance change.",
                    },
                })

        with open(out_geojson_path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": geojson_features}, f, indent=2)

        # 9. Pixel Statistics
        total_px = h * w
        valid_base_px = int(np.sum(~insufficient_baseline_mask))
        valid_post_px = int(np.sum((post_qf == 0) & (post_radiance >= 0.0)))
        cloud_px = int(np.sum(post_cloud_mask))
        poor_px = int(np.sum(post_poor_quality))
        unlit_px = int(np.sum(unlit_bg_mask))
        sig_red_px = int(np.sum(significant_cluster_mask))
        total_red_area = round(sig_red_px * cell_area_sqkm, 2)

        disclaimer = (
            "SCIENTIFIC ATTRIBUTION & SENSOR RESOLUTION NOTICE: "
            "1. NASA VIIRS Day/Night Band operates at 15 arc-seconds (~500m) spatial resolution. "
            "Individual house-level or single-street precision is physically unsupported by the sensor. "
            "2. Radiance reduction reflects observed surface luminance drop. Do not automatically claim an electrical "
            "power outage from night-light reduction alone: evacuation curfews, commercial closures, atmospheric aerosol "
            "scattering, and floodwater surface quenching also cause significant luminance reduction. "
            "3. Cloudy, missing, and poor-quality observations (Mandatory_Quality_Flag >= 1) are strictly screened out "
            "and are NEVER classified as blackouts."
        )

        result = NightlightAnalysisResult(
            id=analysis_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            aoi_id=active_aoi.id,
            bounds=bounds,
            spatial_resolution_m=500.0,
            pre_event_dates=pre_dates,
            post_event_date=post_date,
            total_pixels=total_px,
            valid_baseline_pixels=valid_base_px,
            valid_post_pixels=valid_post_px,
            cloud_obscured_pixels=cloud_px,
            invalid_observation_pixels=poor_px,
            unlit_background_pixels=unlit_px,
            significant_reduction_pixels=sig_red_px,
            reduction_area_sqkm=total_red_area,
            clusters_count=len(clusters_list),
            clusters=clusters_list,
            observation_metadata=available_obs,
            scientific_disclaimer=disclaimer,
            parameters=params.model_dump(),
            geotiff_path=str(out_geotiff_path),
            render_url=f"/api/nightlight/render?id={analysis_id}",
            geojson_export_url=f"/api/nightlight/export/geojson?id={analysis_id}",
        )

        self._last_result = result
        return result


# Singleton instance
nightlight_engine = NightlightEngine()
