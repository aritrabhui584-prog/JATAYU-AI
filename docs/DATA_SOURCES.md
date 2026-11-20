# JATAYU AI — Data Sources & Methodology Reference
## Real Earth Observation and Geospatial Data Services

JATAYU AI strictly adheres to a **Zero-Fabrication Mandate**. Under no circumstance are synthetic villages, fictitious roads, fabricated satellite scenes, or simulated flood polygons displayed.

---

### 1. OpenStreetMap (OSM)
- **Primary Function**: Vector basemap for all settlements (nodes), motorable road networks (ways), and river channels (ways & relations).
- **Provider**: OpenStreetMap Foundation and global volunteer contributors.
- **Access Protocol**: Overpass API (`https://overpass-api.de/api/interpreter`) & OSMnx library.
- **License**: Open Database License (ODbL) 1.0.
- **Attribution**: "© OpenStreetMap contributors".
- **Real Features Extracted**:
  - Settlements: `node["place"~"city|town|village|hamlet|isolated_dwelling"]`
  - Roads: `way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified"]`
  - Waterways: `way["waterway"~"river|stream"]`

---

### 2. Copernicus Sentinel-1 Synthetic Aperture Radar (SAR)
- **Primary Function**: All-weather, day-and-night radar imaging penetrating cloud cover, dense monsoon rainfall, and mist.
- **Instrument**: C-SAR (5.405 GHz, ~5.6 cm wavelength), Level-1 Ground Range Detected (GRD) in Interferometric Wide Swath (IW) mode.
- **Provider**: European Space Agency (ESA) & European Commission Copernicus Programme.
- **Access Protocol**: SpatioTemporal Asset Catalog (STAC) Earth Search API (`https://earth-search.aws.element84.com/v1`).
- **License**: Copernicus Open Access (Creative Commons CC-BY-SA 3.0 IGO).
- **Physical Detection Mechanism**: Open water specular reflection causes radar pulses to bounce away from the receiver, generating a characteristic low backscatter intensity ($\sigma^0 < -16$ dB in VV polarization) against rough vegetation/terrain.

---

### 3. Copernicus Sentinel-2 Multi-Spectral Instrument (MSI)
- **Primary Function**: High-resolution optical imagery for post-event infrastructure inspection and land use verification.
- **Instrument**: MSI Level-2A Bottom-of-Atmosphere (BOA) surface reflectance (13 spectral bands, 10m-60m resolution).
- **Provider**: European Space Agency (ESA) / Copernicus Programme.
- **Access Protocol**: STAC API via Element84 / Microsoft Planetary Computer.
- **License**: Copernicus Open Access.
- **Telemetry Monitored**: Granule ID, sensing timestamp, cloud coverage percentage, tile ID (e.g. 45RVK, 45RWK covering Sikkim/Darjeeling).

---

### 4. NASA VIIRS Day/Night Band (DNB)
- **Primary Function**: Nocturnal low-light radiance measurement to detect widespread power grid failure and blackouts following flood events.
- **Instrument**: Visible Infrared Imaging Radiometer Suite (VIIRS) on Suomi-NPP and NOAA-20/21.
- **Spatial Resolution**: 750m nominal (Black Marble VNP46A2 resampled to 500m).
- **Provider**: NASA Earth Science Data and Information System (ESDIS) & NOAA.
- **Authentication**: Raw HDF5/GeoTIFF raster tiles require a registered NASA Earthdata token (`urs.earthdata.nasa.gov`).
- **Astronomical Physics Calibration**: Real-time lunar phase and illumination fraction are calculated using synodic lunar orbital mechanics. Lunar illumination $>60\%$ triggers a Glare Contamination Warning to prevent false-positive anomaly detection on reflective floodwaters.

---

### 5. Copernicus GloFAS & Open-Meteo Flood/Weather API
- **Primary Function**: Real-time and forecasted river discharge ($m^3/s$) and meteorological observations (rainfall, temperature, pressure).
- **Model**: Global Flood Awareness System (GloFAS) coupled with ECMWF Integrated Forecasting System (IFS).
- **Provider**: European Centre for Medium-Range Weather Forecasts (ECMWF) & Open-Meteo GmbH.
- **Access Protocol**: Open-Meteo Flood API (`https://flood-api.open-meteo.com/v1/flood`) and Forecast API (`https://api.open-meteo.com/v1/forecast`).
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Teesta Stations**: Monitoring coordinates at Chungthang/Mangan, Singtam/Rangpo, Sevoke Coronation Bridge, and Jalpaiguri.

---

### 6. SRTM / Copernicus DEM GLO-90
- **Primary Function**: Digital elevation model for hypsometric valley profiling, slope calculation, and settlement elevation validation.
- **Provider**: European Space Agency (Copernicus DEM) & NASA JPL (Shuttle Radar Topography Mission).
- **Access Protocol**: Open-Meteo Global Elevation API (based on Copernicus 90m global elevation model).
- **License**: Public Domain / Copernicus Open Access.
- **Teesta Range**: Validates terrain drop from $>2500$m in North Sikkim to $\sim 100$m in the North Bengal plains.

---

### 7. WorldPop High-Resolution Demographics
- **Primary Function**: 100m spatial resolution gridded population census estimates.
- **Provider**: WorldPop Research Group, University of Southampton, UK.
- **Access Protocol**: WorldPop REST API (`https://www.worldpop.org/rest/data/pop/wpgp?iso3=IND`).
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Dataset**: India UN-Adjusted Population Counts (Constrained Building Footprints model).
