export type IngestionState =
  | 'IDLE'
  | 'FETCHING'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'ERROR'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED';

export interface BoundingBox {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

export interface AOIPreset {
  id: string;
  name: string;
  description: string;
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

export interface AOIConfig {
  id: string;
  name: string;
  bbox: BoundingBox;
  description?: string;
  created_at?: string;
}

export interface DataAttribution {
  service_id: string;
  service_name: string;
  provider: string;
  citation: string;
  license: string;
  license_url: string;
  documentation_url: string;
  terms_of_use: string;
}

export interface ServiceStatus {
  service_id: string;
  service_name: string;
  category: string;
  state: IngestionState;
  is_available: boolean;
  feature_count: number;
  last_fetched_at?: string;
  last_error?: string;
  attribution: DataAttribution;
  metadata: Record<string, any>;
  api_endpoint: string;
  requires_auth: boolean;
}

export interface LayerMetadata {
  layer_key: string;
  layer_name: string;
  category: string;
  data_source: string;
  attribution: string;
  feature_count: number;
  geometry_type?: string;
  bounds?: number[];
  file_path?: string;
  updated_at?: string;
  is_available: boolean;
  status_message: string;
}

export interface RoadNetworkStats {
  node_count: number;
  edge_count: number;
  total_length_km: number;
  connected_components_count: number;
  highway_breakdown: Record<string, number>;
}

export interface SettlementIsolation {
  osm_id?: string | number;
  name: string;
  place_type: string;
  latitude: number;
  longitude: number;
  elevation_m?: number;
  population?: number;
  nearest_road_name: string;
  nearest_highway_type: string;
  nearest_road_distance_m?: number;
  nearest_waterway_name?: string;
  nearest_waterway_distance_m?: number;
  isolation_level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  data_source: string;
}

export interface SettlementIsolationResponse {
  settlements_count: number;
  critical_isolation_count: number;
  high_isolation_count: number;
  moderate_isolation_count: number;
  low_isolation_count: number;
  settlements: SettlementIsolation[];
}

export interface SentinelScene {
  id: string;
  constellation: string;
  platform: string;
  instrument: string;
  acquisition_date: string;
  cloud_coverage_percent?: number;
  orbit_direction?: string;
  relative_orbit?: number;
  polarization?: string[];
  tile_id?: string;
  bounds: number[];
  footprint_geojson?: any;
  thumbnail_url?: string;
  stac_item_url?: string;
  source_catalog: string;
}

export interface ElevationProfilePoint {
  latitude: number;
  longitude: number;
  elevation_m?: number;
  section: string;
}

export interface RiverGaugePoint {
  station_name: string;
  river_name: string;
  latitude: number;
  longitude: number;
  current_discharge_m3s?: number;
  discharge_series?: Array<{
    date: string;
    discharge_m3s?: number;
    mean_m3s?: number;
  }>;
}

export interface WeatherObservation {
  station_name: string;
  latitude: number;
  longitude: number;
  elevation_m?: number;
  temperature_c?: number;
  relative_humidity_pct?: number;
  precipitation_mm?: number;
  surface_pressure_hpa?: number;
  wind_speed_kmh?: number;
  timestamp: string;
}

// ----------------------------------------------------
// Phase 2: Satellite Imagery & Raster Processing Types
// ----------------------------------------------------

export type SceneProcessingStatus = 'Discovered' | 'Downloaded' | 'Processed' | 'Failed';

export type RasterRenderMode =
  | 'true_color'
  | 'ndwi'
  | 'cloud_mask'
  | 'sar_calibrated'
  | 'sar_water_mask';

export interface SatelliteSearchQuery {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  start_date: string;
  end_date: string;
  mission?: 'all' | 'Sentinel-1' | 'Sentinel-2';
  max_cloud_cover?: number;
  limit?: number;
}

export interface RasterSceneRecord {
  id: string;
  mission: 'Sentinel-1' | 'Sentinel-2';
  platform: string;
  instrument: string;
  product_id: string;
  acquisition_date: string;
  cloud_cover?: number;
  orbit_direction?: string;
  relative_orbit?: number;
  polarization?: string[];
  tile_id?: string;
  bounds: number[]; // [south, west, north, east]
  status: SceneProcessingStatus;
  status_message?: string;
  crs?: string;
  resolution_m?: number;
  geotiff_path?: string;
  thumbnail_url?: string;
  has_local_raster?: boolean;
  assets?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface RasterImportRequest {
  mission: 'Sentinel-1' | 'Sentinel-2';
  file_path: string;
  product_id?: string;
  acquisition_date?: string;
  cloud_cover?: number;
}

export interface BeforeAfterComparison {
  before: {
    scene_id: string;
    mission: string;
    acquisition_date: string;
    cloud_cover?: number;
    bounds: number[];
    render_url: string;
  };
  after: {
    scene_id: string;
    mission: string;
    acquisition_date: string;
    cloud_cover?: number;
    bounds: number[];
    render_url: string;
  };
  mode: RasterRenderMode;
}

// ----------------------------------------------------
// Phase 3: Flood Analysis & Terrain Engine Types
// ----------------------------------------------------

export type FloodExtentType = 'Observed Historical' | 'Modelled Scenario' | 'Predicted Future';

export interface FloodAnalysisParams {
  post_event_scene_id: string;
  pre_event_scene_id?: string;
  backscatter_threshold_db?: number;
  change_threshold_db?: number;
  slope_max_degrees?: number;
  elevation_max_m?: number;
  min_patch_pixels?: number;
}

export interface ScenarioAnalysisParams {
  stage_rise_m: number;
  aoi_id?: string;
}

export interface InundatedSettlement {
  name: string;
  place_type: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  population?: number;
  water_proximity_m: number;
  is_directly_flooded: boolean;
  flood_depth_proxy_m?: number;
  isolation_level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
}

export interface SubmergedRoadSegment {
  osm_id: string;
  name: string;
  highway: string;
  submerged_length_km: number;
  total_length_km: number;
  submerged_fraction: number;
  is_trunk_artery: boolean;
  coordinates: number[][];
}

export interface TerrainAnalysisResult {
  min_elevation_m: number;
  max_elevation_m: number;
  mean_elevation_m: number;
  median_elevation_m: number;
  elevation_range_m: number;
  mean_slope_degrees: number;
  max_slope_degrees: number;
  flat_terrain_percent: number;
  moderate_terrain_percent: number;
  steep_terrain_percent: number;
  hypsometry_histogram: Record<string, number>;
  bounds: number[];
  render_urls: Record<string, string>;
}

export interface FloodAnalysisResult {
  id: string;
  extent_type: FloodExtentType;
  timestamp: string;
  aoi_id: string;
  bounds: number[];
  total_aoi_area_sqkm: number;
  permanent_water_area_sqkm: number;
  flood_inundation_area_sqkm: number;
  terrain_shadow_area_sqkm: number;
  inundated_settlements_count: number;
  submerged_roads_length_km: number;
  affected_population_estimate: number;
  severed_arteries_count: number;
  disclaimer: string;
  parameters: Record<string, any>;
  inundated_settlements: InundatedSettlement[];
  submerged_roads: SubmergedRoadSegment[];
  geotiff_path?: string;
  geojson_path?: string;
  render_url: string;
}

// --- Phase 4: Road Isolation Engine Types ---

export interface EmergencyFacility {
  facility_id: string;
  name: string;
  facility_type: string;
  emergency_level: string;
  capacity_beds: number;
  latitude: number;
  longitude: number;
  elevation_m?: number;
  icu_available: boolean;
  trauma_centre: boolean;
  address?: string;
  operational_status: 'OPERATIONAL' | 'SUBMERGED' | 'ACCESSIBLE_BY_AIR_ONLY';
  nearest_graph_node?: number[];
}

export interface RoadExposureParams {
  critical_water_depth_m?: number;
  bridge_clearance_bonus_m?: number;
  min_submerged_length_m?: number;
  allow_4x4_high_clearance?: boolean;
  slope_debris_hazard_degrees?: number;
  scenario_id?: string;
}

export interface ClosedRoadSegment {
  osm_id: string;
  name: string;
  highway: string;
  total_length_km: number;
  submerged_length_km: number;
  is_bridge: boolean;
  is_trunk_artery: boolean;
  elevation_m?: number;
  estimated_water_depth_m?: number;
  closure_reason: string;
  coordinates: number[][];
}

export interface RouteAlternative {
  origin_village: string;
  origin_coords: number[];
  destination_facility: string;
  destination_coords: number[];
  baseline_distance_km: number;
  baseline_travel_time_min: number;
  post_disaster_distance_km?: number;
  post_disaster_travel_time_min?: number;
  detour_distance_km?: number;
  detour_delay_min?: number;
  status: 'OPTIMAL' | 'DETOUR_REQUIRED' | 'SEVERED_UNREACHABLE';
  baseline_path: number[][];
  alternative_path: number[][];
}

export interface VillageAccessibility {
  osm_id: string | number;
  name: string;
  place_type: string;
  latitude: number;
  longitude: number;
  elevation_m?: number;
  population?: number;
  status: 'ACCESSIBLE' | 'POTENTIALLY_ISOLATED' | 'CRITICALLY_ISOLATED';
  isolation_score: number;
  nearest_facility_name?: string;
  nearest_facility_type?: string;
  distance_km?: number;
  travel_time_min?: number;
  baseline_travel_time_min?: number;
  detour_delay_min?: number;
  route_status: string;
  explanation: string;
  best_route?: RouteAlternative;
}

export interface RoadIsolationAnalysisResult {
  id: string;
  timestamp: string;
  flood_source: string;
  total_road_network_km: number;
  total_segments_count: number;
  closed_road_segments_count: number;
  closed_road_km: number;
  severed_arteries_count: number;
  total_settlements_count: number;
  accessible_villages_count: number;
  potentially_isolated_count: number;
  isolated_villages_count: number;
  isolated_population_estimate: number;
  facilities_count: number;
  accessible_facilities_count: number;
  parameters: Record<string, any>;
  exposure_assumptions: string[];
  accessible_villages: VillageAccessibility[];
  potentially_isolated_villages: VillageAccessibility[];
  isolated_villages: VillageAccessibility[];
  closed_road_segments: ClosedRoadSegment[];
  facilities: EmergencyFacility[];
  geojson_export_url?: string;
}

// --- Phase 5: NASA VIIRS Night-Light Intelligence Types ---

export interface VIIRSObservationMetadata {
  scene_id: string;
  date: string;
  julian_day: string;
  orbit_type: string;
  tile: string;
  bounds: number[];
  total_pixels: number;
  valid_pixels: number;
  cloud_pixels: number;
  poor_quality_pixels: number;
  fill_pixels: number;
  mean_radiance: number;
  hdf5_path: string;
}

export interface NightlightAnalysisParams {
  pre_event_dates?: string[];
  post_event_date?: string;
  min_valid_baseline_obs?: number;
  radiance_reduction_threshold_pct?: number;
  min_absolute_drop_nw?: number;
  min_cluster_pixels?: number;
  exclude_cloud_pixels?: boolean;
}

export interface SpatialCluster {
  cluster_id: number;
  pixel_count: number;
  area_sqkm: number;
  centroid_lat: number;
  centroid_lon: number;
  mean_baseline_radiance: number;
  mean_post_radiance: number;
  mean_radiance_drop_pct: number;
  approximate_region: string;
  spatial_resolution_note: string;
  coordinates_bbox: number[];
}

export interface NightlightAnalysisResult {
  id: string;
  timestamp: string;
  aoi_id: string;
  bounds: number[];
  spatial_resolution_m: number;
  pre_event_dates: string[];
  post_event_date: string;
  total_pixels: number;
  valid_baseline_pixels: number;
  valid_post_pixels: number;
  cloud_obscured_pixels: number;
  invalid_observation_pixels: number;
  unlit_background_pixels: number;
  significant_reduction_pixels: number;
  reduction_area_sqkm: number;
  clusters_count: number;
  clusters: SpatialCluster[];
  observation_metadata: VIIRSObservationMetadata[];
  scientific_disclaimer: string;
  parameters: Record<string, any>;
  geotiff_path?: string;
  render_url: string;
  geojson_export_url: string;
}

// --- Phase 6: Emergency Prioritization Types ---

export type PriorityTier = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MODERATE' | 'P4_LOW';
export type ConfidenceTier = 'HIGH' | 'MODERATE' | 'LOW';

export interface ScoringWeights {
  isolation: number;
  nightlight: number;
  population: number;
  accessibility: number;
}

export interface FeatureComponents {
  isolation_raw_status: string;
  isolation_raw_detour_min?: number | null;
  isolation_norm: number;
  isolation_weight: number;
  isolation_score_contribution: number;

  nightlight_raw_reduction_pct: number;
  nightlight_norm: number;
  nightlight_weight: number;
  nightlight_score_contribution: number;
  nightlight_cluster_id?: number | null;
  nightlight_cloud_obscured: boolean;

  population_raw: number;
  population_norm: number;
  population_weight: number;
  population_score_contribution: number;

  accessibility_raw_travel_time_min: number;
  accessibility_raw_distance_km: number;
  accessibility_norm: number;
  accessibility_weight: number;
  accessibility_score_contribution: number;

  direct_flood_inundation: boolean;
  flood_water_proximity_m: number;
}

export interface ConfidenceBreakdown {
  overall_confidence: number;
  confidence_tier: ConfidenceTier;
  viirs_nightlight_quality: string;
  viirs_confidence_pts: number;
  sentinel_flood_quality: string;
  sentinel_confidence_pts: number;
  road_network_quality: string;
  road_confidence_pts: number;
  census_population_quality: string;
  census_confidence_pts: number;
  missing_observations: string[];
}

export interface VillagePriorityItem {
  rank: number;
  osm_id: string | number;
  name: string;
  place_type: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  population: number;
  composite_priority_score: number;
  priority_tier: PriorityTier;
  priority_tier_label: string;
  priority_badge_color: string;
  confidence_score: number;
  confidence_tier: ConfidenceTier;
  features: FeatureComponents;
  confidence: ConfidenceBreakdown;
  nearest_facility_name?: string | null;
  nearest_facility_type?: string | null;
  route_status: string;
  detour_delay_min?: number | null;
  reachable_travel_time_min?: number | null;
  route_coordinates: number[][];
  explanation: string;
  limiting_factors: string[];
}

export interface PrioritySummaryStats {
  total_settlements: number;
  p1_critical_count: number;
  p2_high_count: number;
  p3_moderate_count: number;
  p4_low_count: number;
  severed_isolation_count: number;
  nightlight_drop_cluster_count: number;
  high_confidence_count: number;
  moderate_confidence_count: number;
  low_confidence_count: number;
  mean_priority_score: number;
  max_priority_score: number;
}

export interface PriorityRankingParams {
  weights?: ScoringWeights;
  stage_rise_m?: number;
  severity_filter?: string;
  min_confidence?: number;
}

export interface EmergencyRoute {
  village_name: string;
  facility_name?: string;
  status: string;
  detour_delay_min?: number;
  travel_time_min?: number;
  path: number[][];
}

export interface EmergencyPriorityResult {
  id: string;
  timestamp: string;
  aoi_id: string;
  weights: ScoringWeights;
  effective_normalized_weights: Record<string, number>;
  top_5_villages: VillagePriorityItem[];
  villages: VillagePriorityItem[];
  summary_stats: PrioritySummaryStats;
  emergency_routes: EmergencyRoute[];
  scientific_disclaimer: string;
  geojson_export_url: string;
  csv_export_url: string;
}

// --- Phase 7: Unified System Overview Types ---

export interface ExecutiveDisasterMetrics {
  total_mapped_settlements: number;
  flood_exposed_settlements: number;
  potentially_isolated_settlements: number;
  critically_isolated_settlements: number;
  possible_blackout_areas_count: number;
  blackout_affected_area_sqkm: number;
  population_exposure_total: number;
  high_confidence_assessments_count: number;
}

export interface InfrastructureSummary {
  total_road_network_km: number;
  closed_road_km: number;
  severed_arteries_count: number;
  operational_facilities_count: number;
  trauma_centres_count: number;
  teesta_discharge_m3s?: number;
  min_elevation_m: number;
  max_elevation_m: number;
}

export interface UnifiedSystemOverview {
  timestamp: string;
  active_aoi: AOIConfig;
  metrics: ExecutiveDisasterMetrics;
  top_5_priorities: VillagePriorityItem[];
  infrastructure: InfrastructureSummary;
  data_services_online_count: number;
  data_services_total: number;
  scientific_disclaimer: string;
  export_links: Record<string, string>;
}

// --- Helicopter Landing Zones (HLZ) ---

export interface HLZProperties {
  hlz_id: string;
  name: string;
  elevation_m: number;
  slope_degrees: number;
  nearest_settlement: string;
  distance_to_settlement_km: number;
  clearance_footprint_m: number;
  clearance_area_sqm: number;
  suitability_score: number;
  suitability_tier: string;
  operational_status: string;
  latitude: number;
  longitude: number;
}

export interface HLZFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  properties: HLZProperties;
}

export interface HLZFeatureCollection {
  type: 'FeatureCollection';
  metadata: {
    generated_at: string;
    total_candidate_zones: number;
    criteria: Record<string, any>;
  };
  features: HLZFeature[];
}

// --- GloFAS Early-Warning Telemetry ---

export interface GloFASEarlyWarningPoint {
  date: string;
  discharge_m3s: number;
  discharge_mean_m3s: number;
  discharge_max_m3s: number;
  is_forecast: boolean;
}

export interface GloFASMonitoringStation {
  station_id: string;
  station_name: string;
  role: string;
  latitude: number;
  longitude: number;
  current_discharge_m3s: number;
  peak_forecast_m3s: number;
  alert_tier: 'NORMAL' | 'WARNING' | 'CRITICAL';
  badge_color: 'emerald' | 'amber' | 'red';
  advisory: string;
  thresholds: {
    normal_max: number;
    warning_max: number;
    critical_min: number;
  };
  time_series: GloFASEarlyWarningPoint[];
}

export interface GloFASTimelinePoint {
  date: string;
  upstream_m3s: number;
  mid_corridor_m3s: number;
  downstream_m3s: number;
  ensemble_max_m3s: number;
  is_forecast: boolean;
}

export interface GloFASEarlyWarningResponse {
  status: string;
  is_live: boolean;
  timestamp: string;
  source: string;
  overall_alert_tier: 'NORMAL' | 'WARNING' | 'CRITICAL';
  overall_badge: {
    title: string;
    color: 'emerald' | 'amber' | 'red';
    description: string;
  };
  peak_forecast_discharge_m3s: number;
  stations: GloFASMonitoringStation[];
  timeline?: GloFASTimelinePoint[];
  offline_notice?: string;
}

// ---------------------------------------------------------------------------
// Pre-Disaster Multi-Modal Rescue Routing Types (Roadway, Railway & Airway)
// ---------------------------------------------------------------------------

export interface RoadwayRouteOption {
  route_type: 'FASTEST_PRE_CLOSURE' | 'HIGH_GROUND_FLOOD_SAFE_BYPASS' | 'SHORTEST_BASELINE';
  feasible: boolean;
  route_name: string;
  travel_time_min: number;
  distance_km: number;
  window_margin_hours?: number;
  path: [number, number][]; // [lon, lat]
  advisory: string;
}

export interface RoadwaySettlementPlan {
  fastest_pre_block: RoadwayRouteOption;
  flood_safe_bypass: RoadwayRouteOption;
  baseline_shortest: RoadwayRouteOption;
}

export interface RailwaySettlementPlan {
  nearest_railhead: string;
  station_code: string;
  station_coords: [number, number];
  road_feeder_distance_km: number;
  road_feeder_time_min: number;
  feeder_path: [number, number][];
  feeder_status: string;
  rail_evacuation_capacity: string;
  is_station_safe: boolean;
}

export interface AirwayPickupHLZ {
  hlz_id: string;
  name: string;
  coords: [number, number];
  distance_km: number;
  ground_access_time_min: number;
  slope_deg: number;
  suitability_tier: string;
  elevation_m: number;
}

export interface AirwayAirBridge {
  destination_airbase: string;
  destination_coords: [number, number];
  distance_km: number;
  compass_bearing_deg: number;
  compass_bearing_label: string;
  estimated_flight_time_min: number;
  vector_coords: [[number, number], [number, number]];
  helicopter_types: string;
}

export interface AirwaySettlementPlan {
  pickup_hlz?: AirwayPickupHLZ;
  air_bridge?: AirwayAirBridge;
}

export interface SettlementMultiModalPlan {
  osm_id: number | string;
  village_name: string;
  population: number;
  coordinates: [number, number];
  elevation_m: number;
  operational_status: 'OPEN_SAFE' | 'CLOSING_SOON' | 'SEVERED';
  time_to_isolation_hours?: number;
  urgency_badge: string;
  urgency_color: 'emerald' | 'amber' | 'red';
  roadway: RoadwaySettlementPlan;
  railway: RailwaySettlementPlan;
  airway: AirwaySettlementPlan;
}

export interface MultiModalRescueResponse {
  status: string;
  timestamp_utc: string;
  timestamp_ist: string;
  summary: {
    total_settlements: number;
    severed_settlements_count: number;
    closing_soon_settlements_count: number;
    open_safe_settlements_count: number;
    active_railheads_count: number;
    operational_hlzs_count: number;
    total_road_network_km: number;
    open_safe_road_km: number;
    closing_soon_road_km: number;
    severed_road_km: number;
  };
  roadway_network: {
    open_safe_km: number;
    closing_soon_km: number;
    severed_km: number;
    closing_soon_segments: any[];
    severed_segments: any[];
  };
  railway_system: {
    active_railheads: any[];
    rail_corridors_count: number;
    evacuation_service: string;
  };
  airway_system: {
    strategic_airbase: {
      name: string;
      coordinates: [number, number];
      elevation_m: number;
      fleet: string[];
    };
    total_hlzs: number;
    flight_speed_kmh: number;
  };
  settlement_plans: SettlementMultiModalPlan[];
  zero_fabrication_guarantee: boolean;
}

// ---------------------------------------------------------------------------
// All-India Dynamic Basin Scouting & Surveillance Types
// ---------------------------------------------------------------------------

export interface ScoutRegionRequest {
  name?: string;
  latitude: number;
  longitude: number;
  min_lat?: number;
  min_lon?: number;
  max_lat?: number;
  max_lon?: number;
  radius_km?: number;
}

export interface ScoutHydrology {
  current_discharge_m3s: number;
  peak_forecast_m3s: number;
  warning_threshold_m3s: number;
  critical_threshold_m3s: number;
  discharge_timeline: Array<{ date: string; discharge_m3s: number }>;
  alert_tier: 'NORMAL' | 'WARNING' | 'CRITICAL';
  alert_color: 'emerald' | 'amber' | 'red';
  alert_title: string;
  alert_description: string;
  data_source: string;
}

export interface ScoutMeteorology {
  temperature_c: number;
  precipitation_current_mm: number;
  relative_humidity_pct: number;
  wind_speed_kmh: number;
  rain_7day_accumulated_mm: number;
  data_source: string;
}

export interface ScoutRegionResult {
  scout_id: string;
  region_name: string;
  coordinates: { latitude: number; longitude: number };
  bounding_box: number[];
  nearest_basin: string;
  state_jurisdiction: string;
  telemetry_timestamp_utc: string;
  telemetry_timestamp_ist: string;
  hydrology: ScoutHydrology;
  meteorology: ScoutMeteorology;
  operational_recommendations: string[];
  zero_fabrication_guarantee: boolean;
}

export interface SurveillanceDates {
  anchor_date: string;
  date_1y_ago: string;
  date_7d_ago: string;
  date_1d_ago: string;
  date_live: string;
  timestamp_utc: string;
  timestamp_ist: string;
}

export interface LiveSatelliteSyncStatus {
  status: string;
  system_time_utc: string;
  system_time_ist: string;
  sentinel1_sar: {
    satellite: string;
    instrument: string;
    acquisition_date_utc: string;
    acquisition_date_ist: string;
    orbit_mode: string;
    scene_id: string;
    status: string;
  };
  sentinel2_optical: {
    satellite: string;
    instrument: string;
    acquisition_date_utc: string;
    acquisition_date_ist: string;
    cloud_cover_percent: number;
    scene_id: string;
    status: string;
  };
  nasa_viirs_dnb: {
    satellite: string;
    product: string;
    observation_date: string;
    lunar_phase: string;
    lunar_illumination_percent: number;
    status: string;
  };
  open_meteo_glofas: {
    model: string;
    current_discharge_m3s: number | null;
    peak_forecast_14d_m3s: number | null;
    forecast_window: string;
    status: string;
  };
  zero_fabrication_verified: boolean;
}

export interface PlaceReconData {
  status: string;
  coordinates: { lat: number; lon: number };
  dem_elevation_m: number;
  nearest_settlement: {
    name: string;
    distance_km: number;
    elevation_m?: number;
    place_type?: string;
    population?: number;
    hazard_zone?: string;
    osm_id?: number;
  };
  nearest_hospital: {
    name: string;
    distance_km: number;
    facility_type: string;
    capacity_beds?: number;
    trauma_centre?: boolean;
  };
  nearest_hlz: {
    hlz_id?: string;
    name: string;
    distance_km: number;
    elevation_m?: number;
    slope_degrees?: number;
    clearance_m?: number;
    suitability_tier?: string;
    operational_status?: string;
  };
  nearest_railhead: {
    name: string;
    distance_km: number;
    code?: string;
    operator?: string;
    evacuation_role?: string;
  };
  ground_photo: {
    photo_url?: string;
    title: string;
    author?: string;
    license?: string;
    radius_searched_m?: number;
    distance_km?: number;
    landmark_title?: string;
    provenance?: string;
    pageid?: number;
    image_url?: string;
    thumb_url?: string;
    description_url?: string;
    attribution?: string;
    source?: string;
  } | null;
  aerial_tile_preview_url: string;
  timestamp_utc: string;
}

export interface HistoricalBestGranule {
  status: string;
  scene_id?: string;
  collection?: string;
  mission?: string;
  platform?: string;
  instrument?: string;
  year: number;
  target_date?: string | null;
  acquisition_date?: string;
  cloud_cover_percent?: number;
  tile_url_template?: string;
  preview_url?: string;
  bounds?: number[];
  bbox?: number[];
  resolution_m?: number;
  message?: string;
  zero_fabrication_verified?: boolean;
}

export interface LatestNightPass {
  status: string;
  granule_id?: string;
  dataset_id?: string;
  sensor?: string;
  gibs_layer?: string;
  gibs_date?: string;
  acquisition_utc?: string;
  acquisition_ist?: string;
  time_start?: string;
  time_end?: string;
  granule_size_mb?: number;
  tile_url_template?: string;
  bbox?: number[];
  zero_fabrication_verified?: boolean;
  data_policy?: string;
  swath_disclaimer?: string;
  message?: string;
}






