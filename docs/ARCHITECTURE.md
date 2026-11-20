# JATAYU AI — System Architecture Document
## Phase 1 Through 7: Complete System Integration

### 1. Executive Summary
JATAYU AI is a real-data-driven disaster intelligence platform designed to eliminate synthetic data hallucinations during Himalayan flood and cloudburst crises along the **Teesta River corridor (Sikkim and North Bengal, India)**.

- **Phase 1: Real Data Foundation**: Ingestion of real OpenStreetMap vector geometries (roads, settlements, waterways), Copernicus Sentinel-1 and Sentinel-2 catalogs, GloFAS streamflow and ECMWF weather, Copernicus 90m DEM elevation, and WorldPop census grids.
- **Phase 2: Real Satellite Imagery**: Copernicus STAC discovery, GeoTIFF reprojection and AOI clipping, multi-spectral True-Color RGB, NDWI, cloud masking, calibrated SAR backscatter, and interactive Leaflet map overlays with before/after event scene comparison.
- **Phase 3: Real Flood and Terrain Engine**:
  - Full Digital Elevation Model (DEM) topographic processing: slope derivation, 8-bit hillshade shaded relief, and hypsometric profiling.
  - Multi-criteria flood classification combining Sentinel-1 pre-event and post-event calibrated radar backscatter ($\Delta \sigma^0$), terrain slope limits, elevation cutoffs, and permanent riverbed exclusion.
  - Mountain radar shadow screening: explicitly separating steep mountain shadows ($>15^\circ$ slope / $>1100\text{m}$ elevation) from water accumulation to prevent false positives.
  - Classified flood extent GeoTIFF and vectorized GeoJSON polygon export.
  - Spatial intersection analytics: identifying directly submerged villages, flood depth proxies, severed transport routes, and critical NH10 arterial cuts.
  - Hypothetical water level scenario analysis tool ($\Delta h$ river stage rise) with strict scientific distinction between *Observed Historical*, *Modelled Scenario*, and *Predicted Future* flood extents.

---

### 2. High-Level System Architecture

```
[ FRONTEND - React 19 + TypeScript + Vite + Leaflet + Recharts ]
       │
       ▼ (REST API /api)
[ BACKEND - FastAPI + Pydantic v2 ]
       │
       ├── AOI Engine (WGS84 EPSG:4326 Validation & Corridor Bounding Box)
       ├── GIS Engine (NetworkX Graph Topology, Shapely Geodesy, PyProj)
       ├── Metadata Engine (SQLite Audit Trail & Satellite Scenes Registry)
       ├── Raster Engine (Rasterio, GDAL Reprojection, Clipping, NDWI, SAR Calibration)
       ├── Terrain Engine (DEM Ingestion, Slope Degrees, Hillshade, Hypsometry)
       ├── Flood Engine (Multi-Criteria Inundation, Change Detection, Spatial Intersections)
       │
       ▼ Modular Services Layer
       ├── OSM Service         ──> OpenStreetMap / Overpass / OSMnx
       ├── STAC Search Service ──> AWS Earth Search / Element84 STAC Catalog
       ├── Sentinel-1 Service  ──> Copernicus C-SAR GRD (Radar)
       ├── Sentinel-2 Service  ──> Copernicus MSI L2A (Optical Surface Reflectance)
       ├── SRTM Service        ──> Copernicus 90m DEM / Open-Elevation API
       ├── Meteo Service       ──> Copernicus GloFAS Flood API & ECMWF Forecast
       ├── WorldPop Service    ──> WorldPop REST API (India 100m Gridded Census)
       └── VIIRS Service       ──> NASA Earthdata ESDIS & NOAA DNB Telemetry
```

---

### 3. Real Flood & Terrain Engine Architecture (Phase 3)

#### 3.1 Digital Elevation Model (DEM) & Slope Derivation
- **DEM Source**: Copernicus DEM GLO-90 / NASA SRTM.
- **Slope Derivation**: Calculated in degrees using centered 2D finite difference gradients:
  $$\frac{dz}{dx} = \frac{z_{i, j+1} - z_{i, j-1}}{2 \Delta x}, \quad \frac{dz}{dy} = \frac{z_{i+1, j} - z_{i-1, j}}{2 \Delta y}$$
  $$\text{Slope}^\circ = \arctan\left(\sqrt{\left(\frac{dz}{dx}\right)^2 + \left(\frac{dz}{dy}\right)^2}\right) \times \frac{180}{\pi}$$
  - Flat Floodplains ($< 5^\circ$): High flood accumulation susceptibility.
  - Moderate Slopes ($5^\circ - 15^\circ$): Intermediate runoff zone.
  - Steep Slopes ($> 15^\circ$): High mountain cliffs where standing water cannot physically accumulate.
- **Hillshade Shaded Relief**:
  $$\text{Hillshade} = 255 \times \left( \cos(\theta_{zenith}) \cos(\theta_{slope}) + \sin(\theta_{zenith}) \sin(\theta_{slope}) \cos(\phi_{azimuth} - \phi_{aspect}) \right)$$

#### 3.2 Sentinel-1 SAR Backscatter & Change Detection
- **Radiometric Calibration**:
  $$\sigma^0_{dB} = 10 \cdot \log_{10}(DN^2 + 10^{-6}) - 83.0$$
- **Speckle Suppression**: 3×3 moving-window filter on power intensity.
- **Bi-Temporal Change Detection**:
  $$\Delta \sigma^0 = \sigma^0_{post} - \sigma^0_{pre}$$
  - Candidate water is detected where $\sigma^0_{post} \le -16.0$ dB OR $\Delta \sigma^0 \le -3.0$ dB.

#### 3.3 Multi-Criteria Filtering & False-Positive Elimination
1. **Slope Cutoff**: $\text{Slope} \le 8.0^\circ$ (water cannot pool on mountain hillsides).
2. **Elevation Limit**: $\text{Elevation} \le 1200\text{m}$ (floodplain accumulation zone).
3. **Mountain Radar Shadow Screening**:
   - Steep slopes facing away from the radar look direction produce extreme low backscatter ($\sigma^0 < -20$ dB). These are mountain ridges ($>1100\text{m}$ elevation / $>15^\circ$ slope), **not water**. Flagged as `TERRAIN_SHADOW` and explicitly excluded.
4. **Permanent Riverbed Masking**:
   - Actual OSM Teesta riverbed and tributary channels buffered and rasterized.
   - Normal river water is separated from anomalous flood inundation on dry land.

#### 3.4 Spatial Intersections with Infrastructure
- **Inundated Settlements**: Verified OSM villages intersecting or within 250m of flood polygons. Computes flood depth proxy ($\max(0.5, 2.5 - \text{dist}/100)$), elevation, and isolation severity (`CRITICAL`, `HIGH`, `MODERATE`).
- **Submerged Road Segments**: Intersects OSM road LineStrings with flood polygons, computing exact submerged length ($km$). Identifies severed transport arteries (e.g., NH10 arterial breach!).

#### 3.5 Hypothetical Stage Rise Scenario Analysis Tool
- Simulates low-lying elevation stage capacity for hypothetical river water rises $\Delta h \in [0.5\text{m}, 10.0\text{m}]$ above normal channel baseline.
- **MANDATORY SCIENTIFIC TAXONOMY & DISCLAIMER**:
  1. **Observed Historical Flood Extent**: Real satellite radar/optical observations.
  2. **Modelled Scenario Extent**: Static topographic stage capacity from DEM ($\Delta h$).
  3. **Predicted Future Flood Extent**: Hydro-meteorological forecast from GloFAS discharge / ECMWF models.
  - *Explicit Warning*: A terrain-only model is NOT a 2D dynamic hydrodynamic wave propagation forecast.

---

### 4. REST API Endpoints (Phase 3 additions)

- `POST /api/flood/analyze`: Execute multi-criteria flood classification on satellite scenes.
- `GET /api/flood/latest`: Retrieve most recent flood analysis result and metrics.
- `POST /api/flood/scenario`: Run hypothetical water level stage simulation ($\Delta h$).
- `GET /api/flood/terrain`: Retrieve DEM hypsometric histogram and slope hazard statistics.
- `GET /api/flood/render`: Stream georeferenced RGBA overlays (`flood_extent`, `terrain_elevation`, `terrain_slope`, `terrain_hillshade`).
- `GET /api/flood/export/geotiff`: Download classified flood GeoTIFF (`.tif`).
- `GET /api/flood/export/geojson`: Download vectorized flood extent GeoJSON (`.geojson`).
- `GET /api/flood/intersections`: Detailed list of inundated settlements and severed road segments.

---

### 5. Real Road-Network Accessibility & Isolation Engine Architecture (Phase 4)

#### 5.1 Graph-Theoretic Road Routing ($G_{base}$ & $G_{damaged}$)
- Built using **OSMnx** and **NetworkX** from verified OpenStreetMap road vectors for the Teesta River Basin corridor (NH10, Coronation Bridge, Mongpu Road, Takdah Road, Sevoke Road).
- **Nodes**: Exact geodetic coordinates $(lon, lat)$ with endpoint snapping threshold ($50\text{m}$) unifying multi-part ways into contiguous routable corridors.
- **Edges**: Real geodetic lengths ($meters$) calculated via WGS84 ellipsoid geodetic equations (`pyproj.Geod`).
- **Terrain DEM Impedance (Tobler's Mountain Vehicular Law)**:
  - Base speeds by highway classification:
    - Trunk (NH10 Mountain Corridor): $50.0\text{ km/h}$
    - Motorway: $55.0\text{ km/h}$
    - Primary: $42.0\text{ km/h}$
    - Secondary: $35.0\text{ km/h}$
    - Tertiary: $25.0\text{ km/h}$
    - Unclassified / Track: $18.0\text{ km/h}$
  - Slope reduction: If terrain slope $S > 6.0^\circ$, travel speed is reduced by $3\%$ per degree above $6^\circ$, bounded to a minimum floor of $8.0\text{ km/h}$.
  - Edge traversal weight ($T_{sec}$):
    $$T_{sec} = \frac{\text{length\_m}}{(\text{speed\_kmh} \times 1000 / 3600)}$$

#### 5.2 Emergency Medical & Relief Facility Mapping
- Real verified healthcare facilities mapped directly into the graph:
  - **Kalimpong District Hospital**: Tier 2 Secondary & Surgical (250 beds, Trauma/ICU).
  - **Sevoke Primary Health Sub-Centre**: Tier 3 First-Aid & Triage (20 beds).
  - **Oodlabari Rural Hospital (BPHC)**: Tier 3 Block Primary Emergency (60 beds).
  - **Mongpu Primary Health Centre**: Tier 3 Hill Block Clinic (35 beds).
  - **Teesta Valley Emergency Relief Staging Camp (NDRF / SSB)**: Base & Helipad (500 person capacity).
  - **North Bengal Medical College & Hospital (NBMCH)**: Tier 1 Apex Trauma Referral (850 beds).

#### 5.3 Configurable Exposure Rules & Structural Assumptions
Rather than assuming every road crossing a broad flood polygon is destroyed, the engine applies five configurable engineering rules:
1. **Bridge Deck Elevation Exception**:
   - Bridges spanning the Teesta gorge (e.g., **Coronation Bridge** cantilever arch) clear flood waters with a configurable clearance bonus ($+3.5\text{m}$) and remain OPEN unless extreme overtopping occurs.
2. **Critical Wading Depth Threshold**:
   - Compares road DEM elevation with local flood depth.
   - Standard emergency fleet cannot safely traverse water depths exceeding $0.35\text{m}$ due to hydrostatic buoyancy and engine air intake flooding.
3. **High-Clearance 4x4 Rescue Fleet Mode**:
   - When enabled, raises the wading threshold to $0.60\text{m}$ for heavy snorkel-equipped rescue trucks, preserving marginal links.
4. **Flood Fringe Tolerance**:
   - Road intersections under $25\text{m}$ contiguous submerged length are classified as passable roadside puddle contact rather than structural cuts.
5. **Steep Slope Landslide & Debris Flow Scour**:
   - Mountain roads along steep slopes ($> 18^\circ$) adjoining the flood extent are marked CLOSED due to catastrophic rockfall and river undercutting washouts.

#### 5.4 Graph Partitioning & Shortest Alternative Detour Recalculation
- $G_{damaged} = G_{base} \setminus E_{closed}$.
- Evaluates connected components and runs **Dijkstra's Shortest Path Algorithm** on $G_{base}$ (baseline) and $G_{damaged}$ (post-disaster) from every settlement to all operational facilities:
  - **Critically Isolated**: No surface path exists to ANY emergency facility ($\text{has\_path} = \text{False}$, isolation score $= 1.0$).
  - **Potentially Isolated**: Path exists, but emergency detour delay $\Delta t > 40.0\text{ minutes}$ or detour distance $\Delta d > 18.0\text{ km}$ via circuitous mountain tracks.
  - **Accessible**: Direct or minor detour route operational ($\Delta t \le 40\text{ minutes}$).

#### 5.5 Phase 4 REST API Endpoints
- `POST /api/isolation/analyze`: Run graph accessibility engine with configurable exposure parameters.
- `GET /api/isolation/latest`: Retrieve most recent accessibility results, isolated villages, and closed breaches.
- `GET /api/isolation/facilities`: Retrieve verified emergency medical & relief facilities.
- `GET /api/isolation/export/geojson`: Export closed road breaches, isolated villages, and alternative routes as GeoJSON.

---

### 6. NASA VIIRS Black Marble Night-Light Engine Architecture (Phase 5)

#### 6.1 NASA VNP46A2 HDF-EOS5 Dataset Processing
- **Sensor**: VIIRS Day/Night Band (DNB) on Suomi-NPP / NOAA-20 / NOAA-21.
- **Product**: NASA Black Marble Daily Moonlight-adjusted Day/Night Band (DNB) BRDF-Corrected NTL (`VNP46A2`).
- **SDS Datasets Extracted**:
  - `HDFEOS/GRIDS/VNP_Grid_DNB/Data Fields/DNB_BRDF-Corrected_NTL`: Stored as uint16 with `scale_factor = 0.1` and `_FillValue = 65535`. Converted to calibrated radiance in $nW \cdot cm^{-2} \cdot sr^{-1}$.
  - `HDFEOS/GRIDS/VNP_Grid_DNB/Data Fields/Mandatory_Quality_Flag`: uint8 flag (0: High Quality, 1: Good, 2: Poor, 255: Cloud/Fill).
- **Spatial Resolution & Grid**:
  - Global Equal-Angle geographic projection (EPSG:4326), $15\text{ arc-seconds} \approx 500\text{m}$ resolution ($0.22\text{ km}^2$ footprint per cell).
  - Explicit enforcement of spatial resolution boundaries: individual village house pinpointing is prevented as physically unsupported by the $500\text{m}$ sensor.

#### 6.2 Cloud & Quality Flag Filtering (Zero False Blackouts)
- **Mandatory Quality Filtering**:
  $$\text{Valid Mask} = (\text{QF} == 0) \lor (\text{QF} == 1)$$
  $$\text{Cloud Mask} = (\text{QF} == 255) \lor (\text{DN} == 65535)$$
  $$\text{Poor Quality Mask} = (\text{QF} == 2)$$
- **Strict Rule**: Any pixel obscured by clouds or poor-quality stray light is categorized as `CLOUD_OBSCURATION` (Class 254) and is **never declared a blackout**.

#### 6.3 Multi-Temporal Baseline Composite
- For pre-event dates $T_1, T_2, \dots, T_k$, pixels must have $\ge \text{min\_valid\_baseline\_obs}$ (default 2) cloud-free observations.
- Baseline radiance $R_{pre} = \text{Median}(R_{T_1}, R_{T_2}, \dots, R_{T_k})$.
- Pixels with insufficient valid pre-event observations are tagged as `INSUFFICIENT_BASELINE_DATA` ($\text{NaN}$), never assumed to be zero.

#### 6.4 Radiance Reduction & Spatial Cluster Detection
- Unlit natural background ($R_{pre} < 1.0\text{ nW}\cdot\text{cm}^{-2}\cdot\text{sr}^{-1}$) is separated to avoid division-by-zero artifacts.
- For lit baseline pixels ($R_{pre} \ge 1.0$):
  $$\Delta R_{abs} = R_{pre} - R_{post}, \quad \Delta R_\% = \left(\frac{R_{pre} - R_{post}}{R_{pre}}\right) \times 100\%$$
- Candidate anomaly pixels require $\Delta R_\% \ge 40\%$ and $\Delta R_{abs} \ge 2.5\text{ nW}\cdot\text{cm}^{-2}\cdot\text{sr}^{-1}$.
- **Connected Spatial Clustering (`scipy.ndimage.label`)**:
  - Connected 8-neighborhood clustering aggregates candidate pixels.
  - Clusters with $\ge 3$ contiguous $500\text{m}$ pixels ($\ge 0.65\text{ km}^2$) are flagged as **Significant Spatial Light Reduction Clusters**.
  - Isolated 1-2 pixel fluctuations are filtered out as sensor noise.

#### 6.5 Scientific Attribution & Power Outage Warning
- Radiance reduction indicates **surface luminance drop**, which can result from electrical grid failure, but also mandatory evacuation curfews, commercial business shutdowns, floodwater surface light quenching, or atmospheric aerosol attenuation.
- JATAYU AI enforces a scientific disclaimer across all outputs, avoiding unsupported claims that radiance drop alone proves an electrical blackout.

#### 6.6 Phase 5 REST API Endpoints
- `POST /api/nightlight/analyze`: Execute VNP46A2 night-light analysis with multi-temporal baseline and cluster detection.
- `GET /api/nightlight/latest`: Retrieve most recent night-light analysis result and spatial clusters.
- `GET /api/nightlight/observations`: List all available VNP46A2 HDF5 files with quality and cloud telemetry.
- `GET /api/nightlight/render`: Stream georeferenced RGBA map overlay PNG.
- `GET /api/nightlight/export/geotiff`: Download classified 500m night-light GeoTIFF (`.tif`).
- `GET /api/nightlight/export/geojson`: Download spatial reduction cluster polygons (`.geojson`).

---

### 7. Emergency Priority Engine Architecture (Phase 6)

#### 7.1 Deterministic Multi-Criteria Decision Model
Phase 6 synthesizes telemetry from all preceding engines into a mathematically deterministic prioritization index for emergency logistics and relief resupply.

- **Inputs Integrated**:
  1. **Road Network Isolation ($I_{\text{norm}}$)**: Topological graph severance from NetworkX routing, Tobler slope impedance, and detour delay $\Delta t$.
  2. **VIIRS Night-Light Disruption ($N_{\text{norm}}$)**: NASA Black Marble VNP46A2 BRDF radiance percentage reduction ($\Delta R_\%$) within significant spatial clusters ($\ge 500\text{m}$ resolution).
  3. **Demographic Exposure ($P_{\text{norm}}$)**: Log-normalized resident population $P$ from verified OSM tags and census records.
  4. **Healthcare Inaccessibility ($A_{\text{norm}}$)**: Terrestrial transit distance, travel delay to reachable trauma facilities, and dead-end mountain cul-de-sac spur penalties.

- **Component Normalization ($0 - 100$ Scale)**:
  - **Isolation**:
    - Severed / Unreachable: $100.0$
    - Detour Delay $\Delta t$: $\min(95.0, \max(45.0, 45.0 + 0.55 \cdot \Delta t))$
    - Open Corridor: $\min(35.0, \max(0.0, 0.35 \cdot t_{\text{direct}}))$
  - **Night-Light Evidence**:
    - Cluster Drop: $\Delta R_{\text{cluster}}\% \in [0, 100]$
    - Cloud-Obscured: $0.0$ (never fabricated as blackout; penalized in confidence index)
    - Normal / Unlit Background: $0.0$
  - **Population Exposure**:
    $$P_{\text{norm}} = \min\left(100.0, \max\left(5.0, \frac{\log_{10}(\text{pop}) - 2.0}{4.0 - 2.0} \times 100\right)\right)$$
  - **Accessibility**:
    $$A_{\text{norm}} = \min(90.0, \max(5.0, d_{\text{hospital\_pts}} + t_{\text{transit\_pts}} + \text{spur\_penalty}))$$

- **Dynamic Weight Calibration**:
  - Baseline default weights:
    - Road Isolation ($w_{\text{iso}}$): $35\%$ ($0.35$)
    - Night-Light Evidence ($w_{\text{ntl}}$): $30\%$ ($0.30$)
    - Population Exposure ($w_{\text{pop}}$): $20\%$ ($0.20$)
    - Healthcare Inaccessibility ($w_{\text{acc}}$): $15\%$ ($0.15$)
  - Operator weights are normalized dynamically: $w'_i = w_i / \sum w_k$.
  - Composite Priority Score:
    $$\text{Score} = \text{round}\left(w'_{\text{iso}} \cdot I_{\text{norm}} + w'_{\text{ntl}} \cdot N_{\text{norm}} + w'_{\text{pop}} \cdot P_{\text{norm}} + w'_{\text{acc}} \cdot A_{\text{norm}}, 1\right)$$

- **Priority Tier Classification**:
  - **P1 Critical (Score $\ge 70.0$)**: Urgent logistics, direct helicopter/off-road reconnaissance required.
  - **P2 High Watch (Score $45.0 - 69.9$)**: Priority resupply and alternative corridor monitoring.
  - **P3 Moderate (Score $25.0 - 44.9$)**: Monitored secondary concern.
  - **P4 Low Advisory (Score $< 25.0$)**: Standard situational monitoring.

#### 7.2 Independent Confidence Scoring ($0 - 100\%$)
Confidence is calculated independently from priority score based on observational quality:
- NASA VIIRS Observation: $+30\%$ for clear-sky quality ($+0\%$ if cloudy, penalizing confidence without hallucinating outages).
- Copernicus Sentinel-1 SAR: $+30\%$ for calibrated radar backscatter verification.
- OSM Topological Road Graph: $+20\%$ for routable NetworkX graph structure.
- Demographic Census: $+20\%$ for verified population tags.

#### 7.3 Transparent Explanations & Reporting
- Every settlement receives a generated natural language explanation detailing:
  - Exact score, tier, and ranking.
  - Component point contributions and active weight percentages.
  - Limiting factors (e.g. NH10 breach, VIIRS Cluster #1 disruption, dead-end mountain spur).
  - Reachable emergency medical facility and detour time.
- Top 5 settlements highlighted prominently with route geometries and comparative bar charts.
- GeoJSON FeatureCollection and CSV spreadsheet export capabilities.

#### 7.4 Phase 6 REST API Endpoints
- `POST /api/priority/rank`: Calculate multi-criteria priority ranking with configurable weights and filters.
- `GET /api/priority/latest`: Retrieve latest priority ranking result and summary statistics.
- `GET /api/priority/top5`: Retrieve top 5 priority settlements.
- `GET /api/priority/export/geojson`: Download priority ranking matrix as GeoJSON (`.geojson`).
- `GET /api/priority/export/csv`: Download priority ranking matrix as CSV spreadsheet (`.csv`).




---

### 8. Complete System Integration Architecture (Phase 7)

#### 8.1 Unified End-to-End Engine Architecture
Phase 7 unifies all 6 independent domain engines into a production-grade disaster intelligence platform:

`
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        JATAYU AI COMPLETE UNIFIED SYSTEM                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
       │                                                                  │
       ▼                                                                  ▼
 [ 1. GEOGRAPHIC DATA ENGINE ]                                  [ 2. SATELLITE IMAGERY ENGINE ]
 - OpenStreetMap Vector Ingestion (Overpass API)                - Copernicus STAC Scene Discovery (Element84)
 - Teesta Basin Bounding Box (EPSG:4326)                        - GeoTIFF Reprojection & AOI Clipping
 - Verified Settlement Nodes & Waterways                        - Sentinel-1 SAR Calibration (σ⁰ dB)
 - Tobler Mountain Road Network Graph                           - Sentinel-2 True-Color RGB & NDWI
       │                                                                  │
       ├───────────────────────────────┬──────────────────────────────────┤
       │                               │                                  │
       ▼                               ▼                                  ▼
 [ 3. FLOOD ANALYSIS ENGINE ]   [ 4. ROAD ISOLATION ENGINE ]   [ 5. NIGHT-LIGHT ENGINE ]
 - DEM Slope & Shaded Relief    - OSMnx/NetworkX Routable Graph - NASA VIIRS VNP46A2 HDF-EOS5
 - SAR Backscatter Drop (Δσ⁰)   - Bridge Elevation Clearances   - Mandatory_Quality_Flag Cloud Mask
 - Permanent Riverbed Masking   - Vehicle Wading Limits (4x4)   - Multi-Temporal Baseline Median
 - Radar Shadow Ridge Screening - Closed Road Breaches          - Spatial Radiance Drop Clusters
 - Water Level Scenarios (Δh)   - Detour Delays & Re-routing    - 500m Sensor Spatial Footprint
       │                               │                                  │
       └───────────────────────────────┼──────────────────────────────────┘
                                       │
                                       ▼
                       [ 6. EMERGENCY PRIORITY ENGINE ]
                       - Deterministic Multi-Criteria Index (0-100)
                       - Configurable Normalized Weights (35/30/20/15)
                       - Independent Confidence Scoring (0-100%)
                       - Transparent Natural-Language Explanations
                       - Top 5 Critical Settlement Spotlight
                                       │
                                       ▼
                       [ 7. UNIFIED DASHBOARD & MAP ]
                       - Executive Disaster KPIs (Settlements, Flood, Isolation, Blackout)
                       - 7-Layer Interactive Leaflet Map with Basemaps & Overlays
                       - Before/After Satellite Comparison Split Slider
                       - Interoperable GeoJSON & CSV Export Endpoints
`

#### 8.2 Unified System Overview Endpoint (GET /api/overview/summary)
Provides an aggregated disaster situation response in a single call:
- **Active Area of Interest**: Teesta River Corridor coordinates, area, and center.
- **Executive Metrics**:
  - 	otal_mapped_settlements: Total verified settlements ($).
  - lood_exposed_settlements: Settlements within flood hazard zones.
  - potentially_isolated_settlements: Settlements cut off or requiring detour delays.
  - critically_isolated_settlements: Settlements with zero open road access to hospitals.
  - possible_blackout_areas_count: Significant VIIRS radiance drop clusters ($).
  - lackout_affected_area_sqkm: Total square kilometers of light reduction (.3	ext{ km}^2$).
  - population_exposure_total: Total population in hazard/isolated zones (,980$).
  - high_confidence_assessments_count: Multi-sensor verified settlement assessments ($).
- **Top 5 Priorities Spotlight**: Pre-sorted roster with composite scores, priority tiers, confidence scores, and limiting factors.
- **Infrastructure Health**: Total road network (.5	ext{ km}$), closed road length, operational hospitals, and GloFAS discharge (	ext{ m}^3/	ext{s}$).
- **Interoperable Export Links**: Direct endpoints for GeoJSON and CSV downloads.

#### 8.3 7-Layer Unified Tactical Leaflet Map
The unified map combines all operational layers:
1. **Basemaps**: Satellite (Esri World Imagery), Dark Matter (CartoDB), Topographic (OpenTopoMap/SRTM), and OSM Standard.
2. **Satellite Raster Overlay**: Calibrated Sentinel-1 SAR backscatter ($\sigma^0	ext{ dB}$) and Sentinel-2 True-Color / NDWI.
3. **Event Comparison**: Side-by-side split divider slider ( - 100\%$) and instantaneous before/after toggle.
4. **Flood Inundation Extent**: Calibrated water extent excluding permanent riverbed and mountain radar shadows.
5. **OSM Road Network**: Class-coded highways (NH10 trunk in amber, secondary valley roads in blue).
6. **OSM Waterways**: Teesta River main stem and mountain tributaries in cyan.
7. **Settlements & Priority Markers**: Color-coded P1-P4 priority markers with concentric pulsing rings on Top 5 settlements.
8. **Relief Centers & Hospitals**: Green medical pins indicating bed capacity, ICU availability, and Level-1 Trauma status.
9. **Emergency Evacuation Routes**: Real-time calculated detour paths to operational facilities.
