# JATAYU AI — Setup and Run Guide
## Phase 1 Through 7: Complete System Integration

Follow these instructions to start the backend and frontend applications, execute the full automated GIS and remote-sensing test suite, and run real flood and terrain analysis for the Teesta River Basin.

---

### Prerequisites
- Python 3.10+ (Tested on Python 3.12)
- Node.js 18+ & npm (Tested on Node v24.12.0 and npm 11.6.2)
- Operating System: Windows, Linux, or macOS

---

### 1. Backend Setup & Startup

1. **Navigate to the backend directory and activate the virtual environment**:
   ```bash
   cd "backend"
   # On Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source .venv/bin/activate
   ```

2. **Verify installed GIS and remote sensing dependencies**:
   ```bash
   python -c "import rasterio, shapely, geopandas, networkx, pyproj, PIL, matplotlib; print('All GIS & Remote Sensing engines operational!')"
   ```

3. **Start the FastAPI backend server**:
   ```bash
   python run.py
   # Or using uvicorn directly:
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   - API Root: `http://127.0.0.1:8000`
   - Interactive Swagger Docs: `http://127.0.0.1:8000/docs`
   - Healthcheck: `http://127.0.0.1:8000/health`
   - Real Flood & Terrain APIs:
     - Run Flood Classification: `POST /api/flood/analyze`
     - Latest Flood Extent: `GET /api/flood/latest`
     - Terrain & Slope Metrics: `GET /api/flood/terrain`
     - Water Level Scenario Simulation: `POST /api/flood/scenario`
     - Stream RGBA Overlays: `GET /api/flood/render?type=flood_extent|terrain_elevation|terrain_slope|terrain_hillshade`
     - Export GeoTIFF: `GET /api/flood/export/geotiff`
     - Export GeoJSON: `GET /api/flood/export/geojson`
     - Inundation Intersections: `GET /api/flood/intersections`
   - Road Isolation & Accessibility APIs (Phase 4):
     - Run Road Accessibility Analysis: `POST /api/isolation/analyze`
     - Latest Accessibility Result: `GET /api/isolation/latest`
     - Emergency Medical & Relief Facilities: `GET /api/isolation/facilities`
     - Export Isolation GeoJSON: `GET /api/isolation/export/geojson`
   - NASA VIIRS Night-Light Detection APIs (Phase 5):
     - Run Night-Light Analysis: `POST /api/nightlight/analyze`
     - Latest Night-Light Result: `GET /api/nightlight/latest`
     - VIIRS Observation Telemetry: `GET /api/nightlight/observations`
     - Stream Night-Light RGBA Overlay: `GET /api/nightlight/render`
     - Export GeoTIFF: `GET /api/nightlight/export/geotiff`
     - Export GeoJSON: `GET /api/nightlight/export/geojson`

---

### 2. Frontend Setup & Startup

1. **Navigate to the frontend directory**:
   ```bash
   cd "frontend"
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Build test**:
   ```bash
   npm run build
   ```

4. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   - Frontend application will be available at: `http://localhost:3000` (or `http://localhost:5173`)
   - The Vite dev server automatically proxies `/api` requests to `http://127.0.0.1:8000`.

---

### 3. Running Backend Automated Tests

From the backend directory:
```bash
cd backend
.\.venv\Scripts\pytest.exe -v
```

This executes all **49 automated unit and GIS tests**:
- **AOI Tests** (5 tests): coordinate validation, bounding boxes, overpass formatting, presets.
- **API Tests** (8 tests): root, health, AOI, ingestion statuses, metadata catalogs, layers, raster routes, and flood/terrain routes.
- **GIS Engine Tests** (3 tests): geodetic distance, NetworkX road topology, settlement isolation.
- **Isolation Engine Tests** (8 tests):
  1. `test_routable_graph_building_and_components`: Routable graph construction from OSM roads with geodetic lengths, speed calculations, and connected components.
  2. `test_disconnected_graph_components_detection`: Explicit verification of graph partitioning into disconnected components upon road/bridge severance.
  3. `test_route_recalculation_and_detour`: Alternative detour path discovery on damaged networks with precise detour delay computation ($\Delta t$).
  4. `test_unreachable_destinations_isolation`: Complete destination unreachability handling and classification as `CRITICALLY_ISOLATED`.
  5. `test_bridge_clearance_preservation`: Verification that high-clearance bridges (e.g. Coronation Bridge) are preserved and NOT falsely closed.
  6. `test_configurable_exposure_parameters`: Verification that higher wading clearance (0.60m for 4x4 rescue fleet) reduces road closures and improves village reachability.
  7. `test_facilities_and_settlements_loading`: Verification of real emergency medical/relief facilities and settlement points with coordinates and capacities.
  8. `test_isolation_api_handlers`: Verification of FastAPI isolation route handlers.
- **Night-Light Engine Tests (Phase 5)** (8 tests):
  1. `test_vnp46a2_hdf5_structure_and_radiance_extraction`: HDF-EOS5 schema, `DNB_BRDF-Corrected_NTL`, scale factor (0.1), and quality flags.
  2. `test_mandatory_quality_flag_and_cloud_filtering`: Strict filtering of clouds (QF 255), fill (65535), and poor quality (QF 2).
  3. `test_multi_temporal_baseline_calculation`: Multi-temporal baseline compositing requiring $\ge 2$ valid cloud-free observations per pixel.
  4. `test_zero_baseline_and_unlit_background_handling`: Clean categorization of dark unlit forest background ($< 1.0\text{ nW}$) preventing division-by-zero artifacts.
  5. `test_cloudy_post_observation_not_classified_as_blackout`: Verification that cloudy post-observations are classified as cloud obscuration (Class 254) and NEVER as blackouts (0 false blackout clusters).
  6. `test_percentage_radiance_reduction_and_spatial_clustering`: Percentage radiance loss calculation and connected component spatial clustering (scipy.ndimage) filtering isolated single-pixel noise.
  7. `test_spatial_resolution_500m_and_scientific_disclaimer`: Enforcement of 15 arc-sec (~500m) spatial resolution notice and causal disclaimer (radiance drop != automatic grid blackout).
  8. `test_nightlight_api_handlers`: Verification of FastAPI night-light route handlers.
- **Raster Engine Tests** (8 tests): GeoTIFF inspection, UTM-to-WGS84 reprojection, AOI clipping, Sentinel-2 RGB contrast stretching, NDWI water index, cloud masking, Sentinel-1 radar calibration, SQLite registry lifecycle.
- **Flood Engine Tests** (6 tests):
  1. `test_dem_creation_and_crs_consistency`: DEM creation with valid EPSG:4326 geotransform and elevation values.
  2. `test_slope_and_hillshade_computation`: 2D finite difference slope degrees and 8-bit shaded relief.
  3. `test_raster_alignment_and_dimensions`: SAR and DEM grid alignment verification.
  4. `test_flood_classification_and_shadow_exclusion`: Multi-criteria flood detection screening out mountain radar shadows and permanent rivers.
  5. `test_spatial_intersection_villages_and_roads`: Vector intersection identifying inundated settlements and severed road segments (including NH10).
  6. `test_scenario_analysis_tool`: Hypothetical stage rise simulation ($\Delta h$), verifying `extent_type == MODELLED_SCENARIO` and mandatory hydraulic disclaimer.
- **Service Integration Tests** (3 tests): 7 modular services registration, attributions, and non-fabricated status verification.

---

### 4. Application Workflows Across All Phases

1. **Observed Flood Analysis**:
   - Select post-event and optional pre-event Sentinel-1 SAR scenes.
   - Configure radar water threshold $\sigma^0$ (dB), change drop threshold $\Delta \sigma^0$ (dB), max slope limit, and elevation cutoff.
   - Screen out radar mountain shadows and permanent waterways.
   - View classified inundation on the interactive Leaflet map with adjustable opacity.
   - Inspect affected settlement points and severed transport arteries (e.g. NH10 cuts).
   - Export classified GeoTIFF raster and GeoJSON polygons.
2. **Terrain & Slope Engine**:
   - Inspect DEM elevation relief, slope hazard maps (<5° flat floodplain, 5°–15° runoff, >15° steep cliffs), and hillshade.
   - Analyze hypsometric distribution across the river basin.
3. **Scenario Analysis Tool**:
   - Adjust hypothetical river stage rise slider ($\Delta h = +0.5\text{m}$ to $+10.0\text{m}$).
   - Run topographic stage simulation to model low-lying elevation capacity.
   - Inspect potential village inundation and severed road segments.
   - Review prominent scientific disclaimer distinguishing static DEM holding capacity from 2D dynamic hydrodynamic wave propagation.
4. **Road Network Isolation & Emergency Accessibility (Phase 4)**:
   - Navigate to the **Village Isolation** page (`/isolation`).
   - Inspect real-time accessibility status for all verified settlements across the Teesta River Basin.
   - View closed road breaches highlighted in glowing red with exact structural failure mechanisms (water depth exceeding vehicle wading limit, or steep slope debris flow hazard).
   - Click any village in the table or on the map to visualize its **Baseline Direct Route** (cyan dashed) vs **Post-Disaster Alternative Detour Route** (orange solid).
   - Tune exposure rules: adjust water depth threshold ($0.15\text{m} - 1.50\text{m}$), bridge clearance bonus ($1.0\text{m} - 10.0\text{m}$), and toggle **4x4 High-Clearance Rescue Fleet** ($0.60\text{m}$ wading limit) to observe dynamic route re-opening.
   - Download complete isolation and detour results as GeoJSON for GIS field dispatch.
5. **Satellite Night-Light Intelligence (Phase 5)**:
   - Navigate to the **Night-Light Intelligence** page (`/nightlight`).
   - Inspect NASA VIIRS Black Marble VNP46A2 BRDF-corrected nighttime radiance at 15 arc-seconds (~500m) resolution.
   - Select pre-disaster baseline dates and post-event observation dates.
   - Compare post-event clear observation (`2023-10-05`) with cloudy peak observation (`2023-10-04`) to observe how `Mandatory_Quality_Flag` screening prevents false blackout declarations.
   - View significant spatial disruption clusters with percentage radiance reduction ($\ge 40\%$) and area ($\text{km}^2$).
   - Review prominent scientific attribution notice stating surface luminance loss does not automatically prove electrical grid failure.
   - Export classified 500m GeoTIFF raster and spatial disruption cluster GeoJSON polygons.

7. **Complete Unified System Workflow (Phase 7)**:
   - **Executive Command Overview**:
     - View the 6 primary disaster KPIs: Total Settlements (11), Flood-Exposed (10), Potentially Isolated (4), Light Disruption Areas (2 clusters, 78.3 km²), Population Exposure (7,980), and P1 Critical Priorities (3).
     - Inspect the **Top 5 Priority Settlements Spotlight** with rank badges, composite scores, confidence ratings, and quick-jump links.
     - Review infrastructure telemetry: Total road network (324.5 km), closed road breaches, operational medical facilities, and Teesta river discharge (840 m³/s).
     - Monitor the status of all 7 independent modular data pipelines.
   - **Unified Live Geographic Map**:
     - Switch seamlessly between 4 basemap tile providers (Esri Satellite, CartoDB Dark Matter, OpenTopoMap, OSM Standard).
     - Toggle and adjust opacity for the calibrated **Sentinel-1 SAR Flood Inundation Extent** and **Sentinel-1/2 Satellite Raster Imagery**.
     - Conduct **Before/After Split Comparison** with interactive divider slider (0-100%) or instant toggle mode.
     - View all OSM roads (NH10 highlighted), river channels, and **Emergency Relief Hubs** with bed capacity and trauma centre tags.
     - Locate settlements rendered as color-coded **Priority Pins** with concentric pulsing rings on Top 5 settlements.
     - Follow alternative **Evacuation Corridor Routes** (dashed orange for detours, solid blue for open corridors).
     - Use the **Quick Settlement Search** to instantly locate and focus on any settlement.
   - **Full Export Suite**:
     - Download complete crisis data across GeoJSON FeatureCollections and CSV spreadsheets for GIS dispatch.
