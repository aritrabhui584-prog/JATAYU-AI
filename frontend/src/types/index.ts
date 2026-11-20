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





