"""
JATAYU AI - Automated Test Fixtures ONLY
Synthetic GeoTIFF and HDF5 generation strictly for automated unit/integration tests.
NEVER imported or invoked by production application code.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import rasterio
from rasterio.transform import from_bounds
import h5py

def create_sample_sentinel_scene(
    output_geotiff_path: Union[str, Path],
    mission: str = "Sentinel-2",
    crs_epsg: int = 4326,
    bbox: Tuple[float, float, float, float] = (88.40, 26.85, 88.55, 27.05),
    width: int = 256,
    height: int = 256,
) -> Dict[str, Any]:
    """
    Creates a georeferenced GeoTIFF for automated test execution without external network calls.
    Restricted exclusively to tests.
    """
    out_p = Path(output_geotiff_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    min_lon, min_lat, max_lon, max_lat = bbox
    transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)

    if mission.lower() in ["sentinel-2", "s2"]:
        count = 4
        dtype = "uint16"
        lons = np.linspace(min_lon, max_lon, width)
        lats = np.linspace(max_lat, min_lat, height)
        lon_grid, lat_grid = np.meshgrid(lons, lats)

        river_path = 88.46 + 0.02 * np.sin((lat_grid - 26.85) * 30.0)
        is_river = np.abs(lon_grid - river_path) < 0.008
        is_cloud = (lon_grid > 88.50) & (lat_grid > 26.98)

        r = np.full((height, width), 600, dtype=np.uint16)
        r[is_river] = 200
        r[is_cloud] = 4500

        g = np.full((height, width), 900, dtype=np.uint16)
        g[is_river] = 400
        g[is_cloud] = 4800

        b = np.full((height, width), 500, dtype=np.uint16)
        b[is_river] = 500
        b[is_cloud] = 5000

        nir = np.full((height, width), 3500, dtype=np.uint16)
        nir[is_river] = 100
        nir[is_cloud] = 4500

        bands_data = [r, g, b, nir]
    else:
        count = 1
        dtype = "uint16"
        lons = np.linspace(min_lon, max_lon, width)
        lats = np.linspace(max_lat, min_lat, height)
        lon_grid, lat_grid = np.meshgrid(lons, lats)

        river_path = 88.46 + 0.02 * np.sin((lat_grid - 26.85) * 30.0)
        is_river = np.abs(lon_grid - river_path) < 0.008
        is_flood = (np.abs(lon_grid - river_path) < 0.018) & (lat_grid < 26.92)
        is_shadow = (lat_grid > 26.98) & (lon_grid > 88.48)

        sar = np.random.normal(loc=1200, scale=120, size=(height, width)).astype(np.float32)
        sar[is_river] = np.random.normal(loc=120, scale=20, size=np.sum(is_river))
        sar[is_flood] = np.random.normal(loc=180, scale=30, size=np.sum(is_flood))
        sar[is_shadow] = np.random.normal(loc=80, scale=15, size=np.sum(is_shadow))

        bands_data = [np.clip(sar, 1, 65535).astype(np.uint16)]

    meta = {
        "driver": "GTiff",
        "dtype": dtype,
        "nodata": 0,
        "width": width,
        "height": height,
        "count": count,
        "crs": f"EPSG:{crs_epsg}",
        "transform": transform,
    }

    with rasterio.open(out_p, "w", **meta) as dst:
        for idx, band_arr in enumerate(bands_data, start=1):
            dst.write(band_arr, idx)

    return {
        "file_path": str(out_p),
        "mission": mission,
        "crs": f"EPSG:{crs_epsg}",
        "bounds": [min_lon, min_lat, max_lon, max_lat],
        "width": width,
        "height": height,
        "count": count,
    }

def create_sample_vnp46a2_hdf5(
    h5_path: Path,
    date_str: str,
    julian_str: str,
    label: str,
    is_cloudy: bool,
    bounds: Tuple[float, float, float, float] = (26.75, 88.35, 27.05, 88.65)
):
    """Creates a sample VNP46A2 HDF5 file strictly for unit test verification."""
    h5_path = Path(h5_path)
    h5_path.parent.mkdir(parents=True, exist_ok=True)
    h, w = 72, 72
    lats = np.linspace(bounds[2], bounds[0], h)
    lons = np.linspace(bounds[1], bounds[3], w)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    radiance = np.full((h, w), 15.0, dtype=np.float32)
    quality_flag = np.zeros((h, w), dtype=np.uint8)

    if is_cloudy:
        quality_flag[:, :] = 255
        radiance[:, :] = 0.0
    elif label == "post_flood_clear":
        radiance[:36, :36] *= 0.25  # reduction cluster for testing

    dn = np.round(np.clip(radiance * 10.0, 0, 65530)).astype(np.uint16)
    if is_cloudy:
        dn[:, :] = 65535

    with h5py.File(h5_path, "w") as f:
        grid_group = f.create_group("HDFEOS/GRIDS/VNP_Grid_DNB/Data Fields")
        ds_ntl = grid_group.create_dataset("DNB_BRDF-Corrected_NTL", data=dn, compression="gzip")
        ds_ntl.attrs["scale_factor"] = 0.1
        ds_ntl.attrs["_FillValue"] = np.uint16(65535)
        ds_ntl.attrs["units"] = "nW cm-2 sr-1"

        ds_qf = grid_group.create_dataset("Mandatory_Quality_Flag", data=quality_flag, compression="gzip")
        ds_qf.attrs["_FillValue"] = np.uint8(255)

        grid_group.create_dataset("Snow_Flag", data=np.zeros((h, w), dtype=np.uint8))
        grid_group.create_dataset("Cloud_Mask_Quality", data=np.zeros((h, w), dtype=np.uint16))

        f.attrs["WestBoundingCoord"] = bounds[1]
        f.attrs["EastBoundingCoord"] = bounds[3]
        f.attrs["NorthBoundingCoord"] = bounds[2]
        f.attrs["SouthBoundingCoord"] = bounds[0]
        f.attrs["PixelSize"] = 15.0 / 3600.0
        f.attrs["SpatialResolution"] = "15 arc-seconds (~500m)"
        f.attrs["Platform"] = "Suomi-NPP"
        f.attrs["Sensor"] = "VIIRS"
        f.attrs["Product"] = "VNP46A2"
        f.attrs["ObservationDate"] = date_str
        f.attrs["JulianDay"] = julian_str
