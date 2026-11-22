# JATAYU AI

**Joint Aerial-Topographical Analysis & Yield Utility for Disaster Operations**

JATAYU AI is an open-source, operational emergency intelligence platform designed for rapid disaster reconnaissance, flood inundation modeling, isolated settlement rescue routing, and multi-sensor satellite surveillance.

---

## Architecture Overview

```
                                JATAYU AI PLATFORM
       +------------------------------------------------------------------+
       |               React 19 + TypeScript Command Interface            |
       |  - Unified Tactical Map      - 4-Grid Multi-Year Surveillance    |
       |  - Multi-Modal Rescue Paths  - Ground Reconnaissance Drawer      |
       +---------------------------------+--------------------------------+
                                         | HTTP / JSON API
       +---------------------------------v--------------------------------+
       |                  FastAPI Backend Service (Python 3.12)           |
       |  - Copernicus STAC Engine    - SAR Flood Mask Ingestion          |
       |  - NetworkX Rescue Router    - NASA VIIRS Night-Light Pipeline   |
       |  - GloFAS Early Warning      - Tactical SitRep PDF Generator     |
       +---------------------------------+--------------------------------+
                                         |
       +---------------------------------v--------------------------------+
       |                      Live Sensor & Spatial Data                  |
       |  - Copernicus Sentinel-1 SAR & Sentinel-2 L2A (Planetary Computer) |
       |  - NASA Earthdata VIIRS DNB Granules (LAADS DAAC / GIBS)          |
       |  - Copernicus GloFAS Hydrological Models (Open-Meteo API)        |
       |  - Copernicus DEM GLO-90 Elevation COGs                          |
       |  - OpenStreetMap Road Networks, Infrastructure & Facilities       |
       +------------------------------------------------------------------+
```

---

## Core Capabilities

### 1. Unified Tactical Command Map
- **Multi-Modal Rescue Planning**: Deterministic pathfinding combining primary highways, secondary bypasses, railway corridors, and designated Helicopter Landing Zones (HLZ).
- **Stage-Rise Flood Simulation**: Hydrological terrain models simulating floodwater inundation across river basins with contour increments.
- **Ground Reconnaissance Drawer**: Sector inspection providing distance-to-hazard measurements, nearest emergency facilities, hospital capacity metrics, and verified ground-level photography.

### 2. 4-Grid Multi-Year Surveillance Matrix
- **Synchronized Multi-Temporal View**: Four independent viewports for baseline, historical flood, recent optical pass, and live daily satellite surveillance.
- **Multi-Year Archive (2015–2026)**: Query clear Sentinel-2 optical and Sentinel-1 radar scenes across any historical year using automated cloud-cover filtering (<5%).
- **Authentic NASA Earthdata VIIRS Night-Cam**: Real-time Day/Night Band (DNB) orbital passes without synthetic blending or historical 2016 fallbacks.

### 3. Early Warning & Automated SITREP Reporting
- **Copernicus GloFAS Hydrographs**: Live 15-day river discharge forecasts with recurrence interval thresholding (2-year, 5-year, and 20-year flood levels).
- **Automated SitRep PDF Generator**: Generates formal incident situation reports with current evacuation routes, severed bridges, and triage priority lists.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12, FastAPI, Uvicorn, Pydantic v2, HTTPX |
| **Geospatial & Rasters** | Rasterio, GDAL, GeoPandas, Shapely, PyProj, h5py |
| **Network & Analysis** | NetworkX, SciPy, NumPy, OSMnx |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS |
| **Mapping & Charts** | Leaflet, React-Leaflet, Recharts, Lucide Icons |
| **Document Generation** | ReportLab (Vector PDF Generation) |

---

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+ and npm
- Git

### Unified Single-Port Execution (Recommended)

JATAYU AI can be launched on a single unified port (`8000`), serving both the FastAPI endpoints and the compiled React production application:

**Windows PowerShell:**
```powershell
.\start_jatayu.ps1
```

**Linux / macOS:**
```bash
chmod +x start_jatayu.sh
./start_jatayu.sh
```

- **Application Interface:** `http://localhost:8000/`
- **Interactive API Documentation:** `http://localhost:8000/docs`
- **Health Check Endpoint:** `http://localhost:8000/api/health`

---

### Docker Deployment

To launch the full containerized stack:

```bash
docker compose up --build
```

The container automatically builds the frontend assets and exposes the unified service on port `8000`.

---

### Development Setup (Split Ports)

For active frontend and backend development:

1. **Backend Service:**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Frontend Service:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## Environment Configuration

Copy the example configuration to set up your environment variables:

```bash
cp backend/.env.example backend/.env
```

| Variable | Description |
|---|---|
| `EARTHDATA_TOKEN` | NASA Earthdata bearer token for real-time VIIRS CMR queries |
| `GOOGLE_MAPS_API_KEY` | Optional API key for Google Maps aerial fallbacks |
| `COPERNICUS_CLIENT_ID` | Optional credentials for Copernicus Data Space Ecosystem |
| `COPERNICUS_CLIENT_SECRET` | Optional secret for Copernicus Data Space Ecosystem |
| `ENVIRONMENT` | Deployment environment (`development` or `production`) |
| `PORT` | Local hosting port (defaults to `8000`) |

---

## Testing

Run backend tests using `pytest`:

```bash
cd backend
pytest tests -v
```

---

## Data Attribution & Sources

- **Copernicus Earth Observation**: European Space Agency (ESA) Sentinel-1 & Sentinel-2 missions.
- **Topography**: Copernicus GLO-90 Digital Elevation Model.
- **Night Radiance**: NASA Earthdata LAADS DAAC VIIRS Day/Night Band imagery.
- **Base Geodata**: OpenStreetMap contributors.
- **Hydrological Forecasts**: Copernicus Global Flood Awareness System (GloFAS).
