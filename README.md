# JATAYU AI — Phase 1: Real Data Foundation

**JATAYU AI** is an advanced, real-data-driven disaster intelligence platform designed for the **Teesta River Corridor, Sikkim and North Bengal, India**.

Phase 1 establishes the real Earth observation and geospatial data foundation. **No fabricated or synthetic data is generated or displayed anywhere in the platform.**

---

## Technical Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4 (Sleek dark disaster intelligence UI)
- **Mapping**: Leaflet + React Leaflet with dynamic multi-basemap switching
- **Charts**: Recharts (GloFAS river streamflow & hypsometric DEM valley profiles)
- **Icons**: Lucide React

### Backend
- **Framework**: Python 3.12 + FastAPI + Pydantic v2
- **GIS Engine**: GeoPandas, Rasterio, Shapely, NetworkX, OSMnx, PyProj
- **Storage**: GeoJSON vectors, GeoTIFF rasters, JSON telemetry, SQLite persistence

---

## 8 Application Modules

1. **Overview**: Project mission, real-time KPI metrics, active AOI banner, and ingestion triggers for all 7 modular services.
2. **Live Geographic Map**: Leaflet interactive map with tile switcher (Satellite, OSM, Dark, Topo), OSM road network (amber/blue), settlements (green circle markers), Teesta waterways (cyan), active AOI polygon, and feature inspection popups.
3. **Satellite Imagery**: Copernicus Sentinel-1 C-SAR radar granules and Sentinel-2 optical scenes with cloud coverage filters, footprints, and thumbnails.
4. **Flood Analysis**: Real Copernicus GloFAS river discharge time series and SRTM elevation hypsometry profile along the Teesta valley.
5. **Village Isolation**: NetworkX road topology graph statistics, settlement isolation table, and isolation tier distribution chart.
6. **Night-Light Intelligence**: NASA VIIRS Day/Night Band telemetry, sensor pass schedules, real-time astronomical lunar illumination computation, and Earthdata authentication details.
7. **Emergency Priorities**: Multi-criteria ranking framework sorting settlements by road distance, river proximity, and topography.
8. **Data Sources & Methodology**: Exhaustive documentation of all data sources, citations, API endpoints, licensing, and zero-fabrication guarantees.

---

## Quick Start Guide

### 1. Backend Server
```bash
# In Windows PowerShell:
$env:PYTHONPATH="backend"
backend\.venv\Scripts\python.exe backend/run.py
```
- API Endpoint: `http://127.0.0.1:8000`
- Interactive API Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

### 2. Frontend Application
```bash
cd frontend
npm run dev
```
- Application UI: `http://localhost:3000`

### 3. Run Test Suite
```bash
$env:PYTHONPATH="backend"
backend\.venv\Scripts\pytest.exe backend/tests -v
```

### 4. Real Data Ingestion CLI
```bash
# Ingest all services:
$env:PYTHONPATH="backend"
backend\.venv\Scripts\python.exe backend/ingest_teesta.py --service all --preset teesta_middle

# Targeted OSM ingestion:
$env:PYTHONPATH="backend"
backend\.venv\Scripts\python.exe backend/ingest_real_teesta.py
```
