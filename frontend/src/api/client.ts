import {
  AOIConfig,
  AOIPreset,
  BeforeAfterComparison,
  BoundingBox,
  LayerMetadata,
  RasterImportRequest,
  RasterRenderMode,
  RasterSceneRecord,
  RoadNetworkStats,
  SatelliteSearchQuery,
  ServiceStatus,
  SettlementIsolationResponse,
  FloodAnalysisParams,
  FloodAnalysisResult,
  ScenarioAnalysisParams,
  TerrainAnalysisResult,
  EmergencyFacility,
  RoadExposureParams,
  RoadIsolationAnalysisResult,
  VIIRSObservationMetadata,
  NightlightAnalysisParams,
  NightlightAnalysisResult,
  EmergencyPriorityResult,
  PriorityRankingParams,
  VillagePriorityItem,
  UnifiedSystemOverview,
  HLZFeatureCollection,
  GloFASEarlyWarningResponse,
  MultiModalRescueResponse,
  ScoutRegionRequest,
  ScoutRegionResult,
  SurveillanceDates,
  LiveSatelliteSyncStatus,
  PlaceReconData,
  HistoricalBestGranule,
  LatestNightPass,
} from '../types';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;

export async function fetchActiveAOI(): Promise<AOIConfig> {
  const res = await fetch(`${API_BASE}/aoi/active`);
  if (!res.ok) throw new Error('Failed to fetch active AOI');
  return res.json();
}

export async function fetchAOIPresets(): Promise<AOIPreset[]> {
  const res = await fetch(`${API_BASE}/aoi/presets`);
  if (!res.ok) throw new Error('Failed to fetch AOI presets');
  return res.json();
}

export async function selectAOIPreset(presetId: string): Promise<AOIConfig> {
  const res = await fetch(`${API_BASE}/aoi/select-preset/${presetId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to select AOI preset');
  return res.json();
}

export async function setCustomAOI(bbox: BoundingBox, name: string): Promise<AOIConfig> {
  const res = await fetch(`${API_BASE}/aoi/custom?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bbox),
  });
  if (!res.ok) throw new Error('Failed to set custom AOI');
  return res.json();
}

export async function fetchLayers(): Promise<LayerMetadata[]> {
  const res = await fetch(`${API_BASE}/layers`);
  if (!res.ok) throw new Error('Failed to fetch layers metadata');
  return res.json();
}

export async function fetchLayerGeoJSON(layerKey: string): Promise<any> {
  const res = await fetch(`${API_BASE}/layers/${layerKey}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch layer GeoJSON' }));
    throw new Error(err.detail || 'Layer data not available');
  }
  return res.json();
}

export async function fetchServicesStatus(): Promise<ServiceStatus[]> {
  const res = await fetch(`${API_BASE}/ingestion/status`);
  if (!res.ok) throw new Error('Failed to fetch services status');
  return res.json();
}

export async function triggerIngestion(serviceId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/ingestion/trigger/${serviceId}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ingestion failed' }));
    throw new Error(err.detail || 'Ingestion failed');
  }
  return res.json();
}

export async function triggerAllIngestions(): Promise<any> {
  const res = await fetch(`${API_BASE}/ingestion/trigger-all`, { method: 'POST' });
  if (!res.ok) throw new Error('Ingestion sequence failed');
  return res.json();
}

export async function clearServiceCache(serviceId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/ingestion/clear/${serviceId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear cache');
  return res.json();
}

export async function fetchRoadNetworkStats(): Promise<RoadNetworkStats> {
  const res = await fetch(`${API_BASE}/gis/network-stats`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network stats unavailable' }));
    throw new Error(err.detail || 'OSM roads not ingested');
  }
  return res.json();
}

export async function fetchSettlementIsolation(): Promise<SettlementIsolationResponse> {
  const res = await fetch(`${API_BASE}/gis/settlement-isolation`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Isolation data unavailable' }));
    throw new Error(err.detail || 'OSM data not ingested');
  }
  return res.json();
}

export async function fetchElevationProfile(): Promise<any> {
  const res = await fetch(`${API_BASE}/gis/elevation-profile`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Elevation profile not ingested' }));
    throw new Error(err.detail || 'DEM data unavailable');
  }
  return res.json();
}

export async function fetchSentinel1Scenes(): Promise<any> {
  const res = await fetch(`${API_BASE}/satellite/sentinel1`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Sentinel-1 data unavailable' }));
    throw new Error(err.detail || 'Sentinel-1 not yet queried');
  }
  return res.json();
}

export async function fetchSentinel2Scenes(): Promise<any> {
  const res = await fetch(`${API_BASE}/satellite/sentinel2`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Sentinel-2 data unavailable' }));
    throw new Error(err.detail || 'Sentinel-2 not yet queried');
  }
  return res.json();
}

export async function fetchVIIRSStatus(): Promise<any> {
  const res = await fetch(`${API_BASE}/satellite/viirs`);
  if (!res.ok) throw new Error('Failed to fetch VIIRS telemetry');
  return res.json();
}

export async function fetchMeteoObservations(): Promise<any> {
  const res = await fetch(`${API_BASE}/meteo/observations`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Meteorological data unavailable' }));
    throw new Error(err.detail || 'Open-Meteo observations not yet queried');
  }
  return res.json();
}

export async function fetchDataSourcesCatalog(): Promise<any> {
  const res = await fetch(`${API_BASE}/metadata/data-sources`);
  if (!res.ok) throw new Error('Failed to fetch data sources metadata');
  return res.json();
}

// ----------------------------------------------------
// Phase 2: Satellite Raster Processing & Discovery APIs
// ----------------------------------------------------

export async function searchSatelliteScenes(query: SatelliteSearchQuery): Promise<{
  success: boolean;
  count: number;
  scenes: RasterSceneRecord[];
  source: string;
  errors?: string[];
}> {
  const res = await fetch(`${API_BASE}/raster/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'STAC search failed' }));
    throw new Error(err.detail || 'Satellite search request failed');
  }
  return res.json();
}

export async function fetchRegisteredScenes(
  mission?: string,
  status?: string,
  limit: number = 50
): Promise<{ total: number; scenes: RasterSceneRecord[] }> {
  const params = new URLSearchParams();
  if (mission && mission !== 'all') params.append('mission', mission);
  if (status) params.append('status', status);
  params.append('limit', limit.toString());

  const res = await fetch(`${API_BASE}/raster/scenes?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch satellite scenes');
  return res.json();
}

export async function fetchSceneRecord(sceneId: string): Promise<RasterSceneRecord> {
  const res = await fetch(`${API_BASE}/raster/scenes/${encodeURIComponent(sceneId)}`);
  if (!res.ok) throw new Error(`Failed to fetch scene ${sceneId}`);
  return res.json();
}

export async function importGeoTIFF(req: RasterImportRequest): Promise<any> {
  const res = await fetch(`${API_BASE}/raster/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Import failed' }));
    throw new Error(err.detail || 'GeoTIFF import failed');
  }
  return res.json();
}

export async function processSatelliteScene(sceneId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/raster/scenes/${encodeURIComponent(sceneId)}/process`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Processing failed' }));
    throw new Error(err.detail || 'Scene processing failed');
  }
  return res.json();
}

export async function fetchSceneBounds(sceneId: string): Promise<{
  scene_id: string;
  bounds: number[];
  leaflet_bounds: [[number, number], [number, number]];
}> {
  const res = await fetch(`${API_BASE}/raster/scenes/${encodeURIComponent(sceneId)}/bounds`);
  if (!res.ok) throw new Error('Failed to fetch scene bounds');
  return res.json();
}

export async function compareScenes(
  beforeSceneId: string,
  afterSceneId: string,
  mode: RasterRenderMode = 'true_color'
): Promise<BeforeAfterComparison> {
  const params = new URLSearchParams({
    before_scene_id: beforeSceneId,
    after_scene_id: afterSceneId,
    mode,
  });
  const res = await fetch(`${API_BASE}/raster/compare?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Comparison failed' }));
    throw new Error(err.detail || 'Scene comparison failed');
  }
  return res.json();
}

export function getRasterRenderUrl(sceneId: string, mode: RasterRenderMode = 'true_color'): string {
  return `${API_BASE}/raster/scenes/${encodeURIComponent(sceneId)}/render?mode=${mode}`;
}

// ----------------------------------------------------
// Phase 3: Flood & Terrain Engine APIs
// ----------------------------------------------------

export async function runFloodAnalysis(params: FloodAnalysisParams): Promise<FloodAnalysisResult> {
  const res = await fetch(`${API_BASE}/flood/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Flood analysis failed' }));
    throw new Error(err.detail || 'Flood analysis request failed');
  }
  return res.json();
}

export async function fetchLatestFloodAnalysis(): Promise<FloodAnalysisResult> {
  const res = await fetch(`${API_BASE}/flood/latest`);
  if (!res.ok) throw new Error('Failed to fetch latest flood analysis');
  return res.json();
}

export async function runScenarioAnalysis(params: ScenarioAnalysisParams): Promise<FloodAnalysisResult> {
  const res = await fetch(`${API_BASE}/flood/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Scenario analysis failed' }));
    throw new Error(err.detail || 'Scenario simulation request failed');
  }
  return res.json();
}

export async function fetchTerrainAnalysis(): Promise<TerrainAnalysisResult> {
  const res = await fetch(`${API_BASE}/flood/terrain`);
  if (!res.ok) throw new Error('Failed to fetch DEM terrain analysis');
  return res.json();
}

export function getFloodRenderUrl(type: string = 'flood_extent', id?: string): string {
  const params = new URLSearchParams({ type });
  if (id) params.append('id', id);
  return `${API_BASE}/flood/render?${params.toString()}`;
}

export function getFloodExportGeoTIFFUrl(id?: string): string {
  return id ? `${API_BASE}/flood/export/geotiff?id=${encodeURIComponent(id)}` : `${API_BASE}/flood/export/geotiff`;
}

export function getFloodExportGeoJSONUrl(id?: string): string {
  return id ? `${API_BASE}/flood/export/geojson?id=${encodeURIComponent(id)}` : `${API_BASE}/flood/export/geojson`;
}

// ----------------------------------------------------
// Phase 4: Road Isolation Engine & Accessibility APIs
// ----------------------------------------------------

export async function runIsolationAnalysis(params?: RoadExposureParams): Promise<RoadIsolationAnalysisResult> {
  const res = await fetch(`${API_BASE}/isolation/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Isolation analysis failed' }));
    throw new Error(err.detail || 'Road accessibility calculation failed');
  }
  return res.json();
}

export async function fetchLatestIsolationAnalysis(): Promise<RoadIsolationAnalysisResult> {
  const res = await fetch(`${API_BASE}/isolation/latest`);
  if (!res.ok) throw new Error('Failed to fetch latest road isolation analysis');
  return res.json();
}

export async function fetchEmergencyFacilities(): Promise<EmergencyFacility[]> {
  const res = await fetch(`${API_BASE}/isolation/facilities`);
  if (!res.ok) throw new Error('Failed to fetch emergency facilities');
  return res.json();
}

export function getIsolationExportGeoJSONUrl(analysisId?: string): string {
  return analysisId
    ? `${API_BASE}/isolation/export/geojson?analysis_id=${encodeURIComponent(analysisId)}`
    : `${API_BASE}/isolation/export/geojson`;
}

// ----------------------------------------------------
// Phase 5: NASA VIIRS Night-Light Intelligence APIs
// ----------------------------------------------------

export async function runNightlightAnalysis(params?: NightlightAnalysisParams): Promise<NightlightAnalysisResult> {
  const res = await fetch(`${API_BASE}/nightlight/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Nightlight analysis failed' }));
    throw new Error(err.detail || 'Nightlight analysis request failed');
  }
  return res.json();
}

export async function fetchLatestNightlightAnalysis(): Promise<NightlightAnalysisResult> {
  const res = await fetch(`${API_BASE}/nightlight/latest`);
  if (!res.ok) throw new Error('Failed to fetch latest nightlight analysis');
  return res.json();
}

export async function fetchVIIRSObservations(): Promise<VIIRSObservationMetadata[]> {
  const res = await fetch(`${API_BASE}/nightlight/observations`);
  if (!res.ok) throw new Error('Failed to fetch VIIRS observations');
  return res.json();
}

export function getNightlightRenderUrl(id?: string): string {
  return id ? `${API_BASE}/nightlight/render?id=${encodeURIComponent(id)}` : `${API_BASE}/nightlight/render`;
}

export function getNightlightExportGeoTIFFUrl(id?: string): string {
  return id ? `${API_BASE}/nightlight/export/geotiff?id=${encodeURIComponent(id)}` : `${API_BASE}/nightlight/export/geotiff`;
}

export function getNightlightExportGeoJSONUrl(id?: string): string {
  return id ? `${API_BASE}/nightlight/export/geojson?id=${encodeURIComponent(id)}` : `${API_BASE}/nightlight/export/geojson`;
}

// ----------------------------------------------------
// Phase 6: Emergency Priority Engine APIs
// ----------------------------------------------------

export async function runPriorityRanking(params?: PriorityRankingParams): Promise<EmergencyPriorityResult> {
  const res = await fetch(`${API_BASE}/priority/rank`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Priority ranking calculation failed' }));
    throw new Error(err.detail || 'Priority ranking calculation failed');
  }
  return res.json();
}

export async function fetchLatestPriorityRanking(): Promise<EmergencyPriorityResult> {
  const res = await fetch(`${API_BASE}/priority/latest`);
  if (!res.ok) throw new Error('Failed to fetch latest priority ranking');
  return res.json();
}

export async function fetchTop5Priorities(): Promise<VillagePriorityItem[]> {
  const res = await fetch(`${API_BASE}/priority/top5`);
  if (!res.ok) throw new Error('Failed to fetch top 5 priority settlements');
  return res.json();
}

export function getPriorityExportGeoJSONUrl(runId?: string): string {
  return runId ? `${API_BASE}/priority/export/geojson?run_id=${encodeURIComponent(runId)}` : `${API_BASE}/priority/export/geojson`;
}

export function getPriorityExportCSVUrl(runId?: string): string {
  return runId ? `${API_BASE}/priority/export/csv?run_id=${encodeURIComponent(runId)}` : `${API_BASE}/priority/export/csv`;
}

export function getPriorityExportSitrepPdfUrl(runId?: string): string {
  return runId ? `${API_BASE}/priority/export/sitrep.pdf?run_id=${encodeURIComponent(runId)}` : `${API_BASE}/priority/export/sitrep.pdf`;
}

// ----------------------------------------------------
// Phase 7: Unified System Overview APIs
// ----------------------------------------------------

export async function fetchSystemOverview(): Promise<UnifiedSystemOverview> {
  const res = await fetch(`${API_BASE}/overview/summary`);
  if (!res.ok) throw new Error('Failed to fetch unified system overview');
  return res.json();
}

// ----------------------------------------------------
// Operational Extensions: HLZ & GloFAS Early Warning
// ----------------------------------------------------

export async function fetchHelicopterLandingZones(
  maxSlope: number = 4.5,
  minCells: number = 4,
  maxDistanceKm: number = 3.5
): Promise<HLZFeatureCollection> {
  const params = new URLSearchParams({
    max_slope_deg: maxSlope.toString(),
    min_clearance_cells: minCells.toString(),
    max_distance_to_village_km: maxDistanceKm.toString(),
  });
  const res = await fetch(`${API_BASE}/terrain/landing-zones?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch helicopter landing zones');
  return res.json();
}

export async function fetchEarlyWarningTelemetry(): Promise<GloFASEarlyWarningResponse> {
  const res = await fetch(`${API_BASE}/overview/early-warning`);
  if (!res.ok) throw new Error('Failed to fetch GloFAS early warning telemetry');
  return res.json();
}

// ----------------------------------------------------
// Multi-Modal Pre-Disaster Rescue Routing APIs
// ----------------------------------------------------

export async function fetchMultiModalRescue(params?: RoadExposureParams): Promise<MultiModalRescueResponse> {
  const res = await fetch(`${API_BASE}/isolation/multimodal-rescue`);
  if (!res.ok) throw new Error('Failed to fetch multi-modal rescue plans');
  return res.json();
}

export async function runMultiModalRescueAnalysis(params?: RoadExposureParams): Promise<MultiModalRescueResponse> {
  const res = await fetch(`${API_BASE}/isolation/multimodal-rescue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Multi-modal rescue calculation failed' }));
    throw new Error(err.detail || 'Multi-modal rescue calculation failed');
  }
  return res.json();
}

export async function fetchRailwayInfrastructure(): Promise<any> {
  const res = await fetch(`${API_BASE}/isolation/railways`);
  if (!res.ok) throw new Error('Failed to fetch railway infrastructure');
  return res.json();
}

// ----------------------------------------------------
// All-India Dynamic Basin Scouting & Surveillance APIs
// ----------------------------------------------------

export async function scoutRegion(req: ScoutRegionRequest): Promise<ScoutRegionResult> {
  const res = await fetch(`${API_BASE}/aoi/scout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Scout query failed' }));
    throw new Error(err.detail || 'Scout query failed');
  }
  return res.json();
}

export async function fetchSurveillanceDates(anchorDate?: string): Promise<SurveillanceDates> {
  const q = anchorDate ? `?anchor_date=${encodeURIComponent(anchorDate)}` : '';
  const res = await fetch(`${API_BASE}/aoi/surveillance-dates${q}`);
  if (!res.ok) throw new Error('Failed to fetch temporal surveillance dates');
  return res.json();
}

export async function fetchLiveSyncStatus(): Promise<LiveSatelliteSyncStatus> {
  const res = await fetch(`${API_BASE}/overview/live-sync`);
  if (!res.ok) throw new Error('Failed to fetch live satellite sync telemetry');
  return res.json();
}

export async function triggerLiveRefresh(): Promise<LiveSatelliteSyncStatus> {
  const res = await fetch(`${API_BASE}/system/refresh-live`, { method: 'POST' });
  if (!res.ok) {
    // fallback to overview refresh
    const fb = await fetch(`${API_BASE}/overview/refresh-live`, { method: 'POST' });
    if (!fb.ok) throw new Error('Live satellite refresh failed');
    return fb.json();
  }
  return res.json();
}

export async function fetchPlaceRecon(lat: number, lon: number): Promise<PlaceReconData> {
  const res = await fetch(`${API_BASE}/terrain/place-recon?lat=${lat}&lon=${lon}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Place recon lookup failed' }));
    throw new Error(err.detail || 'Place recon lookup failed');
  }
  return res.json();
}

export async function fetchHistoricalBest(params: {
  year: number;
  date?: string;
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  mission?: string;
  max_cloud?: number;
}): Promise<HistoricalBestGranule> {
  const query = new URLSearchParams();
  query.set('year', params.year.toString());
  if (params.date) query.set('date', params.date);
  if (params.west !== undefined) query.set('west', params.west.toString());
  if (params.south !== undefined) query.set('south', params.south.toString());
  if (params.east !== undefined) query.set('east', params.east.toString());
  if (params.north !== undefined) query.set('north', params.north.toString());
  if (params.mission) query.set('mission', params.mission);
  if (params.max_cloud !== undefined) query.set('max_cloud', params.max_cloud.toString());

  const res = await fetch(`${API_BASE}/raster/historical-best?${query.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch historical best granule' }));
    throw new Error(err.detail || 'Failed to fetch historical best granule');
  }
  return res.json();
}

export async function fetchLatestNightPass(params?: {
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  date?: string;
}): Promise<LatestNightPass> {
  const query = new URLSearchParams();
  if (params?.west !== undefined) query.set('west', params.west.toString());
  if (params?.south !== undefined) query.set('south', params.south.toString());
  if (params?.east !== undefined) query.set('east', params.east.toString());
  if (params?.north !== undefined) query.set('north', params.north.toString());
  if (params?.date) query.set('date', params.date);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE}/raster/latest-night-pass${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch latest night pass' }));
    throw new Error(err.detail || 'Failed to fetch latest night pass');
  }
  return res.json();
}







