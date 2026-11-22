# JATAYU AI — Unified Real-Data Disaster Intelligence Platform
## Project Overview, System Architecture, Implemented Work, and Gemini Prompting Guide

> **Target Audience / Purpose:** Feed this document directly to **Google Gemini** (or any AI assistant) to provide complete context on the project's vision, architecture, implemented modules, strict data authenticity requirements, and next-phase roadmap prompts.

---

## 1. Executive Summary & Problem Statement

**JATAYU AI** is an operational, real-data-backed disaster intelligence and emergency logistics platform designed for mountainous river basins vulnerable to Glacial Lake Outburst Floods (GLOF), heavy monsoon cloudbursts, flash floods, and debris-flow dam breaches.

### The Real-World Scenario
In October 2023, the South Lhonak glacial lake in Sikkim experienced a sudden GLOF, resulting in the breach of the Teesta-III dam at Chungthang. A catastrophic surge of water and debris propagated downstream along the Teesta River corridor through Sikkim and North Bengal (Sevoke, Teesta Bazar, Kalimpong, Jalpaiguri). The flood obliterated National Highway 10 (NH10), submerged bridges, severed power grids, and cut off dozens of mountain settlements from emergency medical hubs and relief centres.

### The Objective
Traditional disaster dashboards rely on static hazard maps or delayed manual reports. JATAYU AI unifies multi-sensor satellite data, digital elevation models, and topological road networks to deliver:
1. **Real-time flood extent extraction** from Copernicus Sentinel-1 SAR imagery.
2. **Graph-theoretic road isolation analysis**, detecting severed mountain roads, isolated villages, and calculating shortest alternative rescue routes to operational hospitals.
3. **Multi-temporal night-light reduction analysis** using NASA VIIRS Black Marble VNP46A2 to detect potential infrastructure outages without conflating clouds with blackouts.
4. **Deterministic multi-criteria emergency triage**, calculating explainable 0–100 risk priority ranks and separating observational confidence from risk.

---

## 2. Strict Engineering & Scientific Grounding Rules

A strict software audit has been performed on this codebase to enforce complete scientific integrity:
- **Zero Fabricated Satellite Data:** No synthetic GeoTIFFs, fake Gaussian radiance rasters, or artificial flood masks are generated in production.
- **Zero Invented Coordinates or Statistics:** No hardcoded village populations, river discharge values, road breach counts, or fake hospital coordinates.
- **Honest Statuses:** If external NASA Earthdata or Copernicus Sentinel data is not yet downloaded, endpoints return `DATA_UNAVAILABLE` or HTTP 404 rather than silently serving mock data.
- **Separation of Confidence from Risk:** Cloud cover or missing satellite passes never increase the emergency risk score; they penalize observational confidence.
- **Resolution Transparency:** VIIRS ~500m pixel resolution is explicitly declared to prevent misleading individual-household claims.

---

## 3. Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.12) with Pydantic v2 schemas and Uvicorn ASGI.
- **Spatial Analysis & GIS:** GeoPandas, Shapely 2.0, Rasterio, PyProj (WGS84 ellipsoidal geodesy).
- **Network Routing:** NetworkX, OSMnx 2.0 (Overpass API integration).
- **Scientific Computing:** NumPy, SciPy (multidimensional image processing, distance transforms, connected component clustering).
- **Satellite & Scientific Formats:** HDF5 / HDF-EOS5 (`h5py`), GeoTIFF (`rasterio`).
- **Database & Metadata:** SQLite (`jatayu.db`) for tracking ingestion states, layer metadata, and data attribution.

### Frontend
- **Framework:** React 19 + TypeScript.
- **Build Tool:** Vite 8 (Rolldown engine).
- **Styling:** Tailwind CSS v4 with custom dark emergency operations UI.
- **Mapping:** Leaflet & React-Leaflet with OpenStreetMap / CartoDB tiles and GeoJSON overlays.
- **Data Visualization:** Recharts (hypsometric elevation profiles, discharge hydrographs, priority distribution).
- **Icons:** Lucide React.

---

## 4. The 6 Implemented Core Engines

### Engine 1: Geographic Data Engine (`backend/app/engines/gis_engine.py`, `osm_service.py`)
- Ingests real vector data directly from OpenStreetMap via OSMnx/Overpass for the Teesta Basin AOI (`26.80°N–27.15°N, 88.35°E–88.65°E`).
- Loads verified settlements (villages, towns, hamlets) with true OSM node IDs.
- Builds a routable highway network from primary, secondary, tertiary, and trunk ways (NH10).
- Extracts genuine waterways (Teesta River and tributaries).
- Manages 26 verified medical and relief facilities (e.g., Kalimpong District Hospital, Latpanchar Hospital, Sevoke PHC) with genuine tags (`amenity: hospital/clinic`, `operator`, `emergency`).

### Engine 2: Satellite Imagery Engine (`backend/app/engines/raster_engine.py`, `copernicus_service.py`)
- Interfaces with Copernicus Data Space Ecosystem (CDSE) and Planetary Computer / Earth Search STAC APIs.
- Handles Sentinel-1 SAR (IW mode, GRD, dual-pol VV+VH) and Sentinel-2 MSI multispectral imagery.
- Verifies real GeoTIFF metadata: CRS (WGS84 / UTM 45N), transform, resolution, acquisition timestamp, orbit, polarization.

### Engine 3: Flood Analysis Engine (`backend/app/engines/flood_engine.py`, `terrain_engine.py`)
- Implements Sentinel-1 SAR water delineation using Lee speckle filtering and Otsu automated thresholding on backscatter $\sigma^0$ (dB).
- Differentiates permanent water channels from transient flood inundation using genuine OSM waterway masks and distance transforms (`scipy.ndimage.distance_transform_edt`).
- Supports hydraulic stage-height scenario analysis (+1m to +5m river rise) overlaid on Copernicus 90m / SRTM DEM.

### Engine 4: Road Isolation Engine (`backend/app/engines/isolation_engine.py`)
- Builds an interconnected NetworkX graph from OSM road vectors.
- Calculates slope-adjusted traversal speed using the **Tobler Hiking Function** ($e^{-3.5 \cdot |\tan(\text{slope}) + 0.05|}$) and mountain road base speeds (NH10: 50 km/h, secondary: 35 km/h, tracks: 18 km/h).
- Detects road intersections with flood polygons; applies configurable exposure rules (critical depth threshold 0.35m, bridge vertical clearance bonus +3.5m).
- Identifies severed edges, recalculates graph components, detects isolated villages, and finds shortest Dijkstra detour routes to the nearest operational hospital.

### Engine 5: Night-Light Detection Engine (`backend/app/engines/nightlight_engine.py`)
- Processes NASA VIIRS Black Marble VNP46A2 daily HDF5 granules.
- Extracts `DNB_BRDF-Corrected_NTL` with scale factor 0.1 ($\text{nW}\cdot\text{cm}^{-2}\cdot\text{sr}^{-1}$).
- Applies strict quality filtering: masks pixels where `Mandatory_Quality_Flag != 0` (cloud, stray light, fill).
- Constructs a multi-temporal baseline across clear pre-event nights (Oct 1–3, 2023).
- Calculates percentage radiance reduction on post-event nights (Oct 5, 2023).
- Applies `scipy.ndimage.label` spatial clustering to identify significant light drop clusters while discarding single-pixel noise.
- Includes mandatory scientific disclaimers: drops $\neq$ confirmed structural damage or blackouts.

### Engine 6: Emergency Priority Engine (`backend/app/engines/priority_engine.py`)
- Deterministic multi-criteria scoring model with operator-configurable weights:
  $$\text{Priority Score} = w_{\text{iso}} \cdot S_{\text{iso}} + w_{\text{ntl}} \cdot S_{\text{ntl}} + w_{\text{pop}} \cdot S_{\text{pop}} + w_{\text{acc}} \cdot S_{\text{acc}}$$
  - Default weights: Isolation 35%, Night-light 30%, Population 20%, Accessibility 15%.
- Normalizes all features to $[0, 100]$.
- Separates independent **Confidence Score (0–100%)** from Risk (clouds penalize confidence by 30–50%).
- Automatically ranks all settlements, extracts Top 5 P1-Critical priorities, and generates human-readable limiting factor explanations.

---

## 5. Current File Hierarchy

```
JATAYU AI/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── aoi.py               # AOI selection & boundaries
│   │   │   ├── flood.py             # Flood extent & SAR raster APIs
│   │   │   ├── gis.py               # OSM vector data endpoints
│   │   │   ├── isolation.py         # Road network isolation & detours
│   │   │   ├── nightlight.py        # NASA VIIRS radiance & clusters
│   │   │   ├── overview.py          # Unified disaster command metrics
│   │   │   ├── priority.py          # Priority ranking & scoring weights
│   │   │   ├── raster.py            # GeoTIFF raster inspection & tiles
│   │   │   └── services.py          # External service ingestion triggers
│   │   ├── engines/
│   │   │   ├── flood_engine.py      # SAR flood delineation & scenarios
│   │   │   ├── gis_engine.py        # Spatial indexing & GeoDataFrame ops
│   │   │   ├── isolation_engine.py  # NetworkX road graph & Dijkstra routing
│   │   │   ├── metadata_engine.py   # SQLite provenance & attribution DB
│   │   │   ├── nightlight_engine.py # NASA VIIRS VNP46A2 HDF5 processor
│   │   │   ├── priority_engine.py   # Deterministic multi-criteria triage
│   │   │   ├── raster_engine.py     # GDAL/Rasterio GeoTIFF processing
│   │   │   └── terrain_engine.py    # DEM slope, aspect, hillshade, hypsometry
│   │   ├── models/                  # Pydantic v2 schemas for all engines
│   │   ├── services/                # External data connectors (OSM, CDSE, Meteo)
│   │   └── main.py                  # FastAPI app assembly & CORS
│   ├── data/
│   │   ├── geojson/                 # Genuine OSM settlements, roads, facilities
│   │   ├── geotiff/                 # Authentic Sentinel-1/2 rasters & DEMs
│   │   ├── viirs/                   # Authentic NASA VNP46A2 HDF5 files
│   │   └── sqlite/jatayu.db         # Service status & layer metadata database
│   └── tests/                       # Unit & integration test suites
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── MapViewer.tsx        # Interactive Leaflet map with layer toggles
    │   │   ├── LayerControl.tsx     # Vector & raster layer switcher
    │   │   ├── Navbar.tsx           # Global navigation & live system health
    │   │   └── RouteViewer.tsx      # Detour route polyline inspection
    │   ├── pages/
    │   │   ├── OverviewPage.tsx     # Executive command dashboard & Top 5
    │   │   ├── LiveMapPage.tsx      # Fullscreen GIS map analysis
    │   │   ├── FloodAnalysisPage.tsx# SAR water delineation & stage rise
    │   │   ├── RoadIsolationPage.tsx# Road breaches & alternative routes
    │   │   ├── NightlightPage.tsx   # VIIRS brightness reduction & clusters
    │   │   ├── EmergencyPrioritiesPage.tsx # Multi-criteria triage table & weights
    │   │   └── SatellitePage.tsx    # Sentinel-1/2 scene catalog & metadata
    │   └── services/api.ts          # Axios/fetch backend API client
    ├── package.json
    └── vite.config.ts
```

---

## 6. How to Run the Application

### Backend:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### Frontend:
```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
- Dashboard: `http://localhost:5173`

---

## 7. Next-Phase Roadmap & Feature Ideas

When working with Gemini on subsequent features, you can prompt it for any of the following high-impact additions:

1. **Automated Situation Report (SITREP) PDF Generator:**
   - Compile current flood extent, isolated villages list, Top 5 priority triage table, and hospital detours into a downloadable NDMA / NDRF-compliant emergency SITREP PDF using Python `reportlab` or `weasyprint`.
2. **Automated Copernicus / NASA STAC Downloader CLI:**
   - Build a background worker script that authenticates with CDSE (`dataspace.copernicus.eu`) or NASA Earthdata using `.env` credentials, checks for new orbits over AOI, and downloads tiles directly into `data/`.
3. **Multi-Vehicle Evacuation Dispatch Planner:**
   - Calculate fuel requirements, 4x4 vs regular ambulance passability, and helicopter landing zone (LZ) identification using flat, non-flooded open fields extracted from OSM landuse + DEM slope $< 3^\circ$.
4. **Offline Mobile PWA / Field Worker Mode:**
   - Service worker caching for the Leaflet map and GeoJSON layers so first responders in remote areas can access road networks without active internet connectivity.
5. **Real-Time GloFAS / CWC River Gauge Ingestion:**
   - Connect live WebSocket or cron polling to Central Water Commission (CWC) or Open-Meteo flood discharge APIs to dynamically alert operators when discharge crosses dangerous thresholds (e.g., $> 2,000\,\text{m}^3/\text{s}$).

---

## 8. Ready-to-Use Prompts to Give to Gemini

Copy and paste any of these prompts into Gemini to continue building on this codebase:

### Prompt 1: Context Primer (Send This First to Initialize Gemini)
```text
I am developing JATAYU AI, a disaster intelligence platform for flash floods, GLOF events, and road isolation in the Teesta River Basin (Sikkim & North Bengal).
The stack is FastAPI (Python 3.12, GeoPandas, NetworkX, OSMnx, Rasterio, SciPy) and React 19 + Vite + Tailwind CSS + Leaflet.
All 6 core engines are implemented:
1. Geographic Data Engine (genuine OSM settlements, roads, waterways, facilities).
2. Satellite Imagery Engine (Sentinel-1 SAR / Sentinel-2 STAC).
3. Flood Analysis Engine (Otsu binarization, distance transform, stage-height scenarios).
4. Road Isolation Engine (Tobler slope impedance, bridge clearance bonus, flooded edge severance, Dijkstra rerouting).
5. Night-Light Detection Engine (NASA VIIRS VNP46A2 HDF5, quality masking, multi-temporal baseline).
6. Emergency Priority Engine (deterministic multi-criteria scoring, confidence separation, Top 5 ranking).

Strict constraint: Never fabricate or generate synthetic satellite, terrain, or coordinate data. If data is absent, return honest unavailable statuses.
I have attached the complete project brief. Please confirm you understand the architecture, then await my next task.
```

### Prompt 2: Generate an NDRF Situation Report (SITREP) PDF Exporter
```text
In JATAYU AI, create a backend endpoint `GET /api/priority/export/sitrep.pdf` and a frontend "Download Official SITREP" button.
Requirements:
1. Use Python `reportlab` in the backend.
2. The PDF must look like an official National Disaster Response Force (NDRF) / State Disaster Management Authority (SDMA) operational briefing.
3. Include: Header with active AOI name and ISO timestamp, executive disaster KPIs (exposed villages, isolated nodes, severed road length), Top 5 priority settlements table with scores and limiting factors, nearest operational medical hubs, and data source citations (Copernicus Sentinel-1, NASA VIIRS, OpenStreetMap, ODbL).
4. Provide the exact code for the backend endpoint and the frontend download handler.
```

### Prompt 3: Add Helicopter Landing Zone (HLZ) Identification to Terrain Engine
```text
In `backend/app/engines/terrain_engine.py`, implement an algorithm to detect suitable Helicopter Landing Zones (HLZs) for air-evacuation of isolated settlements.
Requirements:
1. Criteria for HLZ: Terrain slope < 4 degrees, elevation within acceptable flight envelope, minimum contiguous circular flat area of 35m radius, located outside flooded polygons and permanent waterways, and within 3 km of isolated settlements.
2. Use Rasterio and SciPy ndimage on the authentic DEM array.
3. Return results as GeoJSON polygons with centroid coordinates, elevation, slope, and nearest settlement distance.
4. Add an API endpoint `GET /api/terrain/landing-zones` and a toggle layer on the React Leaflet map.
```

### Prompt 4: Add Real-Time CWC / Open-Meteo River Gauge Alerting
```text
In `backend/app/services/meteo_service.py`, improve the real-time river discharge monitoring:
1. Query Open-Meteo Flood API for the Teesta coordinate (`26.90°N, 88.45°E`).
2. Implement 3 flood stage thresholds: Normal (< 600 m³/s), Warning Level (600 - 1500 m³/s), Danger Level (> 1500 m³/s).
3. If Danger Level is exceeded, trigger an automated scenario update with an estimated river stage rise.
4. Expose this via a SSE (Server-Sent Events) or WebSocket stream to the React frontend to display a live warning banner across the dashboard.
```
