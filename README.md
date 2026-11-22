# JATAYU AI — Intelligent Disaster Prediction & National Emergency Response System

> **Motto:** *"Predict Before Disaster. Respond Before It's Too Late. Save Lives."*  
> **Operational Status:** Authorized Command & Control Disaster Operations Platform  
> **Deployment Target:** National Disaster Management Authority (NDMA), State Disaster Management Authorities (SDMA / Sikkim & West Bengal), National Disaster Response Force (NDRF), and District Emergency Operation Centers (DEOC).

---

## 1. Operational Overview

**JATAYU AI** is an operational, mission-critical disaster command and control platform engineered specifically for complex mountain river corridors subject to Glacial Lake Outburst Floods (GLOF), cloudbursts, severe monsoonal flash floods, and landslide dam failures.

Its primary operational theater is the **Teesta River Basin Corridor** spanning **Sikkim and North Bengal, India** (Chungthang, Mangan, Dikchu, Singtam, Rangpo, Melli, Teesta Bazar, Kalimpong, Sevoke, and Jalpaiguri).

### Core Operational Principle: Multi-Source Intelligence Fusion
Rather than relying on isolated sensors or slow manual reports, JATAYU AI unifies multi-source intelligence fusion across 6 independent real-data pipelines:
1. **Radar Earth Observation:** Copernicus Sentinel-1 C-SAR backscatter ($\sigma^0$ in dB) for all-weather day/night floodwater classification.
2. **Optical Earth Observation:** Copernicus Sentinel-2 MSI multispectral imagery for cloud-screened NDWI/MNDWI water extraction.
3. **Hydrometeorological Forecasts:** Copernicus GloFAS streamflow telemetry and ECMWF weather models.
4. **Digital Elevation Topography:** Authentic **Copernicus DEM GLO-90 (90m global elevation model)** from AWS Open Data for slope hazards, radar shadow screening, and hydraulic stage-rise simulations (+0.5m to +5.0m).
5. **Topological Highway Networks:** OpenStreetMap routable road vectors (NH10, secondary, tertiary) processed through a Tobler hiking slope-impedance network graph.
6. **Night-Light Radiance Telemetry:** NASA VIIRS Black Marble VNP46A2 BRDF-corrected nighttime radiance to detect power and infrastructure outage clusters.

---

## 2. Strict Scientific Grounding & Zero-Fabrication Mandate

In national disaster response, fabricated data costs human lives. JATAYU AI enforces an uncompromising data integrity protocol:
- **Zero Hallucinated Satellite Data:** Missing satellite granules return explicit `DATA_UNAVAILABLE` or HTTP 404 rather than synthetic rasters.
- **Zero Invented Elevations or Boundaries:** Elevation data originates strictly from authentic Copernicus DEM GLO-90 COG tiles.
- **Separation of Confidence from Risk:** Cloud cover or missing sensor observations penalize observational confidence ($0\text{–}100\%$) and are never classified as blackouts or confirmed emergencies.
- **Spatial Resolution Honesty:** VIIRS ~500m footprint is reported transparently without false individual-building claims.

---

## 3. Architecture & Tech Stack

```
                          JATAYU AI PLATFORM
       ┌────────────────────────────────────────────────────────┐
       │                REACT 19 + TYPESCRIPT UI                │
       │   Leaflet GIS Maps • Command KPIs • Priority Matrix    │
       └───────────────────────────▲────────────────────────────┘
                                   │ HTTP / JSON API
       ┌───────────────────────────▼────────────────────────────┐
       │                FASTAPI BACKEND (PY 3.12)               │
       ├────────────────────────────────────────────────────────┤
       │  GIS Engine        Flood Engine       Isolation Engine │
       │  (OSMnx/Shapely)   (Rasterio/SciPy)   (NetworkX/Tobler)│
       ├────────────────────────────────────────────────────────┤
       │  Terrain Engine    Night-Light Engine Priority Engine  │
       │  (Copernicus 90m)  (NASA VIIRS HDF5)  (Deterministic)  │
       └───────────────────────────▲────────────────────────────┘
                                   │
      ┌────────────────────────────┴───────────────────────────┐
      │               AUTHENTIC EXTERNAL DATASETS              │
      │  • Copernicus DEM GLO-90 (AWS Open Data)               │
      │  • OpenStreetMap Roads, Settlements, Waterways (ODbL)  │
      │  • NASA VIIRS Black Marble VNP46A2 (Earthdata)         │
      │  • Copernicus Sentinel-1 & Sentinel-2 (CDSE / STAC)    │
      │  • Copernicus GloFAS River Gauges (Open-Meteo)         │
      └────────────────────────────────────────────────────────┘
```

### Backend
- **Framework:** FastAPI (Python 3.12), Pydantic v2 schemas, Uvicorn ASGI.
- **Geospatial & Vector:** GeoPandas, Shapely 2.0, PyProj (WGS84 ellipsoidal geodesy).
- **Rasters & Remote Sensing:** Rasterio (GDAL), NumPy, SciPy (multidimensional image processing, distance transforms).
- **Network Routing:** NetworkX, OSMnx 2.0.
- **Scientific Formats:** HDF5 (`h5py`), Cloud-Optimized GeoTIFF (`rasterio`).
- **Persistence & Attribution:** SQLite (`backend/data/sqlite/jatayu.db`).

### Frontend
- **Framework:** React 19, TypeScript.
- **Build Engine:** Vite 8 (Rolldown).
- **Styling:** Tailwind CSS v4 with dark command-and-control operations theme.
- **Mapping:** Leaflet & React-Leaflet with live tile layer controls.
- **Analytics Charts:** Recharts (hypsometric elevation distribution & streamflow hydrographs).
- **Icons:** Lucide React.

---

## 4. Key Engines & Capabilities

| Engine | Primary Function | Source Data |
| :--- | :--- | :--- |
| **Geographic Data Engine** | Verifies settlements, road vectors, waterways, and 26 healthcare nodes | OpenStreetMap Overpass API |
| **Terrain Engine** | Slope calculation, hillshade, hypsometry, radar shadow masking | Copernicus DEM GLO-90 (AWS Open Data) |
| **Flood Analysis Engine** | SAR backscatter thresholding ($\sigma^0 < -16\,\text{dB}$), water distance transforms, and stage rise (+0.5m to +5m) | Copernicus Sentinel-1 C-SAR & GLO-90 DEM |
| **Road Isolation Engine** | Detects submerged bridges and cut corridors (NH10), finds shortest hospital detours | NetworkX topological graph & Tobler speed model |
| **Night-Light Engine** | Multi-temporal baseline, cloud-screened radiance drop, spatial clustering | NASA VIIRS Black Marble VNP46A2 HDF5 |
| **Emergency Priority Engine** | Multi-criteria triage model ($w_{\text{iso}}=0.35, w_{\text{ntl}}=0.30, w_{\text{pop}}=0.20, w_{\text{acc}}=0.15$) | Fused Engine Pipeline |

---

## 5. Quick Start & Execution

### 1. One-Command Unified Launch (Port 8000 — Recommended)
JATAYU AI serves both the React Command & Control frontend and the FastAPI backend on a single unified port (`8000`):

**Windows PowerShell:**
```powershell
.\start_jatayu.ps1
```

**Linux / macOS:**
```bash
chmod +x start_jatayu.sh
./start_jatayu.sh
```

* **Command & Control Operations Dashboard:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
* **Interactive Swagger API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Backend Health Check:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
* **Direct SITREP PDF Export:** [http://127.0.0.1:8000/api/priority/export/sitrep.pdf](http://127.0.0.1:8000/api/priority/export/sitrep.pdf)

---

### 2. Docker / Container Deployment (Single Port 8000)
```bash
docker compose up --build
```
The multi-stage container automatically builds the React SPA and serves the application on `http://localhost:8000`.

---

### 3. Development Mode with Vite HMR (Split Ports)
If developing UI components with hot-module reloading:
1. **Backend:** `cd backend && .\.venv\Scripts\Activate.ps1 && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
2. **Frontend:** `cd frontend && npm run dev -- --host 127.0.0.1 --port 5173` (proxies `/api` -> `http://127.0.0.1:8000`)

---

### 4. Ingest Authentic Copernicus DEM GLO-90
To manually download and mosaic the authentic Copernicus DEM 90m tiles for the Teesta Basin from AWS Open Data:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python ingest_teesta.py --service dem --preset teesta_middle
```

---

### 5. Run Automated Test Suite
```powershell
cd backend
pytest tests -v
```

---

## 6. Official Data Attribution & Licensing

- **Copernicus Earth Observation:** European Space Agency (ESA) Copernicus Programme (Free open-access under Copernicus license).
- **Copernicus DEM 90m:** AWS Open Data Registry (`s3://copernicus-dem-90m`).
- **OpenStreetMap:** © OpenStreetMap contributors (ODbL 1.0).
- **NASA Black Marble:** NASA EOSDIS Land Processes DAAC (LP DAAC) / NASA Earth Science Data.
- **River Streamflow:** Copernicus Global Flood Awareness System (GloFAS) via Open-Meteo API.
