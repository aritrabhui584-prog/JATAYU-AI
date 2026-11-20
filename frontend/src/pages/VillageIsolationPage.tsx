import React, { useState, useEffect } from 'react';
import {
  RoadNetworkStats,
  SettlementIsolationResponse,
  RoadIsolationAnalysisResult,
  RoadExposureParams,
  VillageAccessibility,
  ClosedRoadSegment,
  EmergencyFacility,
  RouteAlternative,
  AOIConfig,
} from '../types';
import * as api from '../api/client';
import {
  Network,
  AlertTriangle,
  Route,
  Search,
  Filter,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  Sliders,
  Download,
  Hospital,
  RefreshCw,
  Compass,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Truck,
  Layers,
  Activity,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  Tooltip as LeafletTooltip,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

interface VillageIsolationPageProps {
  isolationData?: SettlementIsolationResponse | null;
  roadStats?: RoadNetworkStats | null;
  onRefreshIsolation?: () => Promise<void>;
  isLoading?: boolean;
  activeAOI?: AOIConfig | null;
}

// Controller to pan/zoom when a village or route is selected
const RouteFocusController: React.FC<{
  selectedVillage: VillageAccessibility | null;
}> = ({ selectedVillage }) => {
  const map = useMap();
  useEffect(() => {
    if (!selectedVillage) return;

    const route = selectedVillage.best_route;
    if (route && route.alternative_path && route.alternative_path.length > 0) {
      const latlngs = route.alternative_path.map((c) => [c[1], c[0]] as [number, number]);
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
    } else if (route && route.baseline_path && route.baseline_path.length > 0) {
      const latlngs = route.baseline_path.map((c) => [c[1], c[0]] as [number, number]);
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
    } else {
      map.setView([selectedVillage.latitude, selectedVillage.longitude], 12, { animate: true });
    }
  }, [selectedVillage, map]);

  return null;
};

export const VillageIsolationPage: React.FC<VillageIsolationPageProps> = ({
  isLoading: isParentLoading,
}) => {
  // Phase 4 Engine State
  const [analysisResult, setAnalysisResult] = useState<RoadIsolationAnalysisResult | null>(null);
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active UI tab
  const [activeTab, setActiveTab] = useState<'console' | 'rules' | 'facilities'>('console');

  // Interactive Selection
  const [selectedVillage, setSelectedVillage] = useState<VillageAccessibility | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Configurable Exposure Parameters
  const [exposureParams, setExposureParams] = useState<RoadExposureParams>({
    critical_water_depth_m: 0.35,
    bridge_clearance_bonus_m: 3.5,
    min_submerged_length_m: 25.0,
    allow_4x4_high_clearance: false,
    slope_debris_hazard_degrees: 18.0,
  });

  // Initial Data Fetch
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const [analysis, facs] = await Promise.all([
        api.fetchLatestIsolationAnalysis(),
        api.fetchEmergencyFacilities(),
      ]);
      setAnalysisResult(analysis);
      setFacilities(facs);
      // Auto-select first isolated village if available
      if (analysis.isolated_villages.length > 0) {
        setSelectedVillage(analysis.isolated_villages[0]);
      } else if (analysis.accessible_villages.length > 0) {
        setSelectedVillage(analysis.accessible_villages[0]);
      }
    } catch (err: any) {
      console.error('Failed to load isolation analysis:', err);
      setErrorMsg(err.message || 'Failed loading road isolation data');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const updated = await api.runIsolationAnalysis(exposureParams);
      setAnalysisResult(updated);
      if (updated.isolated_villages.length > 0) {
        setSelectedVillage(updated.isolated_villages[0]);
      } else if (updated.accessible_villages.length > 0) {
        setSelectedVillage(updated.accessible_villages[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Analysis calculation failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Combine all settlements for filtering
  const allVillages: VillageAccessibility[] = [
    ...(analysisResult?.isolated_villages || []),
    ...(analysisResult?.potentially_isolated_villages || []),
    ...(analysisResult?.accessible_villages || []),
  ];

  const filteredVillages = allVillages.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === 'ALL' || v.status === filterLevel;
    return matchesSearch && matchesLevel;
  });

  // Chart data
  const chartData = [
    {
      name: 'Critically Isolated',
      count: analysisResult?.isolated_villages_count ?? 0,
      color: '#ef4444',
    },
    {
      name: 'Potentially Isolated',
      count: analysisResult?.potentially_isolated_count ?? 0,
      color: '#f97316',
    },
    {
      name: 'Accessible (Direct)',
      count: analysisResult?.accessible_villages_count ?? 0,
      color: '#10b981',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <span>Village Road-Network Isolation Analytics</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                  Phase 4 Engine
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Topological network accessibility computed with OSMnx & NetworkX from real Teesta road vectors, DEM terrain slope, and Sentinel-1 flood extents.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <a
            href={api.getIsolationExportGeoJSONUrl(analysisResult?.id)}
            download
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export GeoJSON</span>
          </a>

          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-cyan-950/50 disabled:opacity-50 cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Recalculating...' : 'Recalculate Routes'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-slate-400 hover:text-rose-300 text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
            Road Network
          </span>
          <div className="text-xl font-bold text-slate-100 font-mono">
            {analysisResult?.total_road_network_km ?? '--'} <span className="text-xs text-slate-400 font-normal">km</span>
          </div>
          <span className="text-[10px] text-slate-400 block">
            {analysisResult?.total_segments_count ?? '--'} routable edges
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-rose-400 block font-semibold flex items-center justify-between">
            <span>Closed Breaches</span>
            {analysisResult?.severed_arteries_count ? (
              <span className="px-1.5 py-0.2 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[9px] font-bold">
                {analysisResult.severed_arteries_count} NH10 Cuts
              </span>
            ) : null}
          </span>
          <div className="text-xl font-bold text-rose-400 font-mono">
            {analysisResult?.closed_road_segments_count ?? '--'}
          </div>
          <span className="text-[10px] text-rose-400/80 block">
            {analysisResult?.closed_road_km ?? '--'} km submerged
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-emerald-400 block font-semibold">
            Accessible
          </span>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {analysisResult?.accessible_villages_count ?? '--'}
          </div>
          <span className="text-[10px] text-emerald-500/80 block">
            Direct & low-delay paths
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-amber-400 block font-semibold">
            Potential Detours
          </span>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {analysisResult?.potentially_isolated_count ?? '--'}
          </div>
          <span className="text-[10px] text-amber-500/80 block">
            High detour delay (&gt;40m)
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-red-400 block font-semibold">
            Critically Cut Off
          </span>
          <div className="text-xl font-bold text-red-500 font-mono flex items-center space-x-1.5">
            <span>{analysisResult?.isolated_villages_count ?? '--'}</span>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
          </div>
          <span className="text-[10px] text-red-400/80 block">
            Zero road access
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-orange-400 block font-semibold">
            Isolated Population
          </span>
          <div className="text-xl font-bold text-orange-400 font-mono">
            {analysisResult?.isolated_population_estimate ? analysisResult.isolated_population_estimate.toLocaleString() : '--'}
          </div>
          <span className="text-[10px] text-orange-400/80 block">
            Persons at severe risk
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'console'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Accessibility Console & Interactive Map</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'rules'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Configurable Exposure Rules & Assumptions</span>
        </button>

        <button
          onClick={() => setActiveTab('facilities')}
          className={`px-4 py-2 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'facilities'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hospital className="w-3.5 h-3.5" />
          <span>Emergency Facilities & Relief Network ({facilities.length})</span>
        </button>
      </div>

      {/* TAB 1: ACCESSIBILITY CONSOLE & MAP */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* Main Map & Detail Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Map Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl relative">
                {/* Map Control Bar */}
                <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Routable Accessibility Map</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Click any village or road cut to inspect
                    </span>
                  </div>

                  {/* Legend badges */}
                  <div className="flex items-center space-x-3 text-[10px]">
                    <span className="flex items-center space-x-1 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                      <span>Isolated</span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      <span>Detour</span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span>Accessible</span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block" />
                      <span>Facility</span>
                    </span>
                    <span className="flex items-center space-x-1 text-slate-300">
                      <span className="w-3 h-0.5 bg-rose-500 inline-block" />
                      <span>Breach</span>
                    </span>
                  </div>
                </div>

                {/* Leaflet Map Container */}
                <div className="h-[520px] w-full relative">
                  <MapContainer
                    center={[26.92, 88.48]}
                    zoom={11}
                    scrollWheelZoom={true}
                    className="h-full w-full bg-slate-950"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://carto.com/">CartoDB</a> Dark Matter'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    <ScaleControl position="bottomleft" />
                    <RouteFocusController selectedVillage={selectedVillage} />

                    {/* Closed Road Breaches (Red lines) */}
                    {analysisResult?.closed_road_segments.map((seg, idx) => {
                      if (!seg.coordinates || seg.coordinates.length < 2) return null;
                      const latlngs = seg.coordinates.map((c) => [c[1], c[0]] as [number, number]);
                      return (
                        <Polyline
                          key={`closed-${seg.osm_id}-${idx}`}
                          positions={latlngs}
                          pathOptions={{
                            color: '#ef4444',
                            weight: seg.is_trunk_artery ? 5 : 3.5,
                            opacity: 0.9,
                            dashArray: '6, 6',
                          }}
                        >
                          <Popup>
                            <div className="text-xs p-1 space-y-1 text-slate-900">
                              <div className="font-bold text-rose-600 flex items-center space-x-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>CLOSED ROAD BREACH</span>
                              </div>
                              <div className="font-semibold">{seg.name} ({seg.highway})</div>
                              <div><strong>Failure:</strong> {seg.closure_reason}</div>
                              <div><strong>Submerged:</strong> {seg.submerged_length_km} km / {seg.total_length_km} km</div>
                              {seg.estimated_water_depth_m && (
                                <div><strong>Estimated Depth:</strong> ~{seg.estimated_water_depth_m} m</div>
                              )}
                            </div>
                          </Popup>
                        </Polyline>
                      );
                    })}

                    {/* Selected Village Alternative Detour Route (Orange solid) */}
                    {selectedVillage?.best_route?.alternative_path && selectedVillage.best_route.alternative_path.length > 0 && (
                      <Polyline
                        positions={selectedVillage.best_route.alternative_path.map((c) => [c[1], c[0]] as [number, number])}
                        pathOptions={{
                          color: '#f97316',
                          weight: 4,
                          opacity: 0.95,
                        }}
                      >
                        <LeafletTooltip permanent={false}>
                          Alternative Detour Route to {selectedVillage.best_route.destination_facility} ({selectedVillage.best_route.post_disaster_travel_time_min} min)
                        </LeafletTooltip>
                      </Polyline>
                    )}

                    {/* Selected Village Baseline Direct Route (Cyan dashed) */}
                    {selectedVillage?.best_route?.baseline_path && selectedVillage.best_route.baseline_path.length > 0 && (
                      <Polyline
                        positions={selectedVillage.best_route.baseline_path.map((c) => [c[1], c[0]] as [number, number])}
                        pathOptions={{
                          color: '#06b6d4',
                          weight: 2.5,
                          opacity: 0.6,
                          dashArray: '4, 8',
                        }}
                      >
                        <LeafletTooltip permanent={false}>
                          Pre-Disaster Baseline Route ({selectedVillage.best_route.baseline_travel_time_min} min)
                        </LeafletTooltip>
                      </Polyline>
                    )}

                    {/* Emergency Facilities Markers */}
                    {facilities.map((fac) => (
                      <CircleMarker
                        key={`fac-${fac.facility_id}`}
                        center={[fac.latitude, fac.longitude]}
                        radius={7}
                        pathOptions={{
                          color: '#06b6d4',
                          fillColor: '#0891b2',
                          fillOpacity: 0.9,
                          weight: 2,
                        }}
                      >
                        <Popup>
                          <div className="text-xs p-1 space-y-1 text-slate-900">
                            <div className="font-bold text-cyan-700 flex items-center space-x-1">
                              <Hospital className="w-3.5 h-3.5" />
                              <span>{fac.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-600">{fac.emergency_level}</div>
                            <div><strong>Beds:</strong> {fac.capacity_beds} | <strong>Trauma:</strong> {fac.trauma_centre ? 'Yes' : 'No'}</div>
                            {fac.address && <div className="text-[10px] text-slate-500">{fac.address}</div>}
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}

                    {/* Settlements Markers */}
                    {allVillages.map((v) => {
                      const isSelected = selectedVillage?.osm_id === v.osm_id;
                      const fillColor =
                        v.status === 'CRITICALLY_ISOLATED'
                          ? '#ef4444'
                          : v.status === 'POTENTIALLY_ISOLATED'
                          ? '#f97316'
                          : '#10b981';

                      return (
                        <CircleMarker
                          key={`village-${v.osm_id}`}
                          center={[v.latitude, v.longitude]}
                          radius={isSelected ? 10 : 6}
                          pathOptions={{
                            color: isSelected ? '#ffffff' : fillColor,
                            fillColor: fillColor,
                            fillOpacity: 0.95,
                            weight: isSelected ? 3 : 1.5,
                          }}
                          eventHandlers={{
                            click: () => setSelectedVillage(v),
                          }}
                        >
                          <Popup>
                            <div className="text-xs p-1 space-y-1 text-slate-900">
                              <div className="font-bold" style={{ color: fillColor }}>
                                {v.name} ({v.status})
                              </div>
                              <div><strong>Population:</strong> {v.population?.toLocaleString() ?? 'Unknown'}</div>
                              <div><strong>Elevation:</strong> {v.elevation_m} m</div>
                              {v.status === 'CRITICALLY_ISOLATED' ? (
                                <div className="text-rose-600 font-semibold text-[11px]">
                                  CUT OFF: No surface road access to emergency facilities
                                </div>
                              ) : (
                                <>
                                  <div><strong>Nearest Facility:</strong> {v.nearest_facility_name}</div>
                                  <div><strong>Travel Time:</strong> {v.travel_time_min} min (Detour Delay: +{v.detour_delay_min ?? 0} min)</div>
                                </>
                              )}
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>

              {/* Selected Route Callout Banner */}
              {selectedVillage && (
                <div className={`p-4 rounded-xl border transition-all ${
                  selectedVillage.status === 'CRITICALLY_ISOLATED'
                    ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                    : selectedVillage.status === 'POTENTIALLY_ISOLATED'
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className={`p-2 rounded-lg ${
                        selectedVillage.status === 'CRITICALLY_ISOLATED'
                          ? 'bg-rose-900/60 text-rose-300'
                          : selectedVillage.status === 'POTENTIALLY_ISOLATED'
                          ? 'bg-amber-900/60 text-amber-300'
                          : 'bg-emerald-900/60 text-emerald-300'
                      }`}>
                        {selectedVillage.status === 'CRITICALLY_ISOLATED' ? (
                          <ShieldAlert className="w-5 h-5" />
                        ) : (
                          <Route className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center space-x-2">
                          <span>{selectedVillage.name}</span>
                          <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                            selectedVillage.status === 'CRITICALLY_ISOLATED'
                              ? 'bg-rose-900 text-rose-200'
                              : selectedVillage.status === 'POTENTIALLY_ISOLATED'
                              ? 'bg-amber-900 text-amber-200'
                              : 'bg-emerald-900 text-emerald-200'
                          }`}>
                            {selectedVillage.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs opacity-90 mt-0.5">{selectedVillage.explanation}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-xs font-mono">
                      {selectedVillage.status !== 'CRITICALLY_ISOLATED' && (
                        <>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">Baseline</span>
                            <span>{selectedVillage.baseline_travel_time_min ?? '--'} min</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">Post-Disaster</span>
                            <span className="font-bold">{selectedVillage.travel_time_min ?? '--'} min</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-400 block">Detour Delay</span>
                            <span className="text-amber-400 font-bold">+{selectedVillage.detour_delay_min ?? 0} min</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Isolation Breakdown Chart & Filters */}
            <div className="space-y-4">
              {/* Chart Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                  Settlement Accessibility Distribution
                </span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#94a3b8"
                        tick={{ fontSize: 9 }}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Assumptions Collapsible Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <button
                  onClick={() => setShowAssumptions(!showAssumptions)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-200 cursor-pointer"
                >
                  <span className="flex items-center space-x-1.5">
                    <HelpCircle className="w-4 h-4 text-cyan-400" />
                    <span>Active Exposure Rules & Assumptions</span>
                  </span>
                  {showAssumptions ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showAssumptions && (
                  <div className="pt-2 text-xs space-y-1.5 text-slate-300 border-t border-slate-800">
                    {analysisResult?.exposure_assumptions.map((asm, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-slate-950/70 border border-slate-800/60 text-[11px] leading-relaxed">
                        {asm}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Facility Staging Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider flex items-center space-x-1.5">
                  <Hospital className="w-4 h-4 text-cyan-400" />
                  <span>Nearest Relief Facilities ({facilities.length})</span>
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {facilities.map((fac) => (
                    <div
                      key={fac.facility_id}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200 text-[11px]">{fac.name}</div>
                        <div className="text-[10px] text-slate-400">{fac.emergency_level}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-[10px] font-bold">
                        {fac.capacity_beds} Beds
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Settlement Accessibility Data Table */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <span>Settlement Accessibility & Evacuation Routing</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                    {filteredVillages.length} Villages
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real OpenStreetMap settlements sorted by topological connectivity and detour penalty.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search village name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 w-44"
                  />
                </div>

                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CRITICALLY_ISOLATED">Critically Isolated</option>
                  <option value="POTENTIALLY_ISOLATED">Potentially Isolated</option>
                  <option value="ACCESSIBLE">Accessible</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Village Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Population</th>
                    <th className="py-2.5 px-3">Elevation</th>
                    <th className="py-2.5 px-3">Nearest Facility</th>
                    <th className="py-2.5 px-3">Normal Time</th>
                    <th className="py-2.5 px-3">Post-Disaster</th>
                    <th className="py-2.5 px-3">Detour Delay</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredVillages.map((v) => {
                    const isSelected = selectedVillage?.osm_id === v.osm_id;
                    return (
                      <tr
                        key={v.osm_id}
                        onClick={() => setSelectedVillage(v)}
                        className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          isSelected ? 'bg-cyan-950/30 border-l-2 border-cyan-400' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">
                          {v.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 capitalize">{v.place_type}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {v.population ? v.population.toLocaleString() : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{v.elevation_m} m</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">
                          {v.nearest_facility_name || 'None Reachable'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {v.baseline_travel_time_min ? `${v.baseline_travel_time_min}m` : '--'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-200">
                          {v.travel_time_min ? `${v.travel_time_min}m` : '--'}
                        </td>
                        <td className="py-2.5 px-3">
                          {v.detour_delay_min && v.detour_delay_min > 0 ? (
                            <span className="text-amber-400 font-bold">+{v.detour_delay_min}m</span>
                          ) : (
                            <span className="text-slate-500">0m</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.status === 'CRITICALLY_ISOLATED'
                                ? 'bg-red-950/80 border border-red-800 text-red-300'
                                : v.status === 'POTENTIALLY_ISOLATED'
                                ? 'bg-amber-950/80 border border-amber-800 text-amber-300'
                                : 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                            }`}
                          >
                            {v.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVillage(v);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-900/60 hover:text-cyan-300 text-slate-300 text-[10px] font-sans font-semibold transition-all cursor-pointer"
                          >
                            Inspect Route
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Closed Road Breaches Table */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Closed Road Breaches & Structural Severance ({analysisResult?.closed_road_segments_count ?? 0})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Road segments marked unavailable under current flood scenario and exposure rules.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Road Name</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Total Length</th>
                    <th className="py-2.5 px-3">Submerged Length</th>
                    <th className="py-2.5 px-3">Water Depth</th>
                    <th className="py-2.5 px-3">Elevation</th>
                    <th className="py-2.5 px-3">Structural Failure Mechanism</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {analysisResult?.closed_road_segments.map((seg, idx) => (
                    <tr key={`${seg.osm_id}-${idx}`} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">
                        {seg.name} {seg.is_trunk_artery && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[9px] font-bold">
                            TRUNK ARTERY
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 capitalize">{seg.highway}</td>
                      <td className="py-2.5 px-3 text-slate-300">{seg.total_length_km} km</td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">{seg.submerged_length_km} km</td>
                      <td className="py-2.5 px-3 text-cyan-300">
                        {seg.estimated_water_depth_m ? `~${seg.estimated_water_depth_m}m` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{seg.elevation_m} m</td>
                      <td className="py-2.5 px-3 font-sans text-rose-300 text-[11px]">
                        {seg.closure_reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONFIGURABLE EXPOSURE RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 max-w-4xl">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>Configurable Road Exposure & Destruction Rules</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Calibrate engineering exposure rules rather than blindly assuming every road intersecting water is severed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Critical Water Depth Slider */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200">Critical Water Depth Threshold</label>
                  <span className="font-mono text-cyan-400 font-bold">
                    {exposureParams.critical_water_depth_m?.toFixed(2)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="1.50"
                  step="0.05"
                  value={exposureParams.critical_water_depth_m}
                  onChange={(e) =>
                    setExposureParams({
                      ...exposureParams,
                      critical_water_depth_m: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Water depth at which standard emergency vehicles cannot cross due to engine air intake submersion and vehicle buoyancy.
                </p>
              </div>

              {/* Bridge Deck Clearance Slider */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200">Bridge Clearance Bonus</label>
                  <span className="font-mono text-cyan-400 font-bold">
                    +{exposureParams.bridge_clearance_bonus_m?.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="10.0"
                  step="0.5"
                  value={exposureParams.bridge_clearance_bonus_m}
                  onChange={(e) =>
                    setExposureParams({
                      ...exposureParams,
                      bridge_clearance_bonus_m: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  High-level bridges (e.g. Coronation Bridge) clear flood waters and remain passable unless flood stage exceeds deck clearance.
                </p>
              </div>

              {/* Min Submerged Length Slider */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200">Min Submerged Length Tolerance</label>
                  <span className="font-mono text-cyan-400 font-bold">
                    {exposureParams.min_submerged_length_m?.toFixed(0)} m
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={exposureParams.min_submerged_length_m}
                  onChange={(e) =>
                    setExposureParams({
                      ...exposureParams,
                      min_submerged_length_m: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Fringe roadside clips below this contiguous length are treated as shallow edge puddles rather than road breaches.
                </p>
              </div>

              {/* Steep Slope Hazard Slider */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-200">Slope Landslide Risk Threshold</label>
                  <span className="font-mono text-cyan-400 font-bold">
                    {exposureParams.slope_debris_hazard_degrees?.toFixed(0)}°
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="35"
                  step="1"
                  value={exposureParams.slope_debris_hazard_degrees}
                  onChange={(e) =>
                    setExposureParams({
                      ...exposureParams,
                      slope_debris_hazard_degrees: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Roads cut into steep mountain slopes exceeding this gradient face debris flows and rockfall collapses when undercut by water.
                </p>
              </div>
            </div>

            {/* 4x4 High-Clearance Rescue Fleet Toggle */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <span>High-Clearance 4x4 Rescue Vehicle Fleet</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Enables heavy 4x4 rescue trucks capable of wading up to 0.60m depth with snorkel intake.
                </p>
              </div>
              <button
                onClick={() =>
                  setExposureParams({
                    ...exposureParams,
                    allow_4x4_high_clearance: !exposureParams.allow_4x4_high_clearance,
                  })
                }
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  exposureParams.allow_4x4_high_clearance ? 'bg-cyan-600 justify-end' : 'bg-slate-800 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>Apply Exposure Rules & Recalculate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EMERGENCY FACILITIES */}
      {activeTab === 'facilities' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Hospital className="w-4 h-4 text-cyan-400" />
                <span>Verified Emergency Facilities & Disaster Staging Bases</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real OpenStreetMap healthcare nodes mapped as destinations for shortest alternative detour routing.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Facility Name</th>
                    <th className="py-2.5 px-3">Facility Type</th>
                    <th className="py-2.5 px-3">Tier / Emergency Level</th>
                    <th className="py-2.5 px-3">Beds</th>
                    <th className="py-2.5 px-3">Trauma Centre</th>
                    <th className="py-2.5 px-3">ICU</th>
                    <th className="py-2.5 px-3">Location Coordinates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {facilities.map((fac) => (
                    <tr key={fac.facility_id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">
                        {fac.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 capitalize">{fac.facility_type.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3 text-cyan-300 font-sans">{fac.emergency_level}</td>
                      <td className="py-2.5 px-3 text-slate-200 font-bold">{fac.capacity_beds}</td>
                      <td className="py-2.5 px-3 font-sans">
                        {fac.trauma_centre ? (
                          <span className="text-emerald-400 font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Yes</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {fac.icu_available ? (
                          <span className="text-emerald-400 font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Yes</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">No</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        [{fac.longitude.toFixed(4)}, {fac.latitude.toFixed(4)}]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
