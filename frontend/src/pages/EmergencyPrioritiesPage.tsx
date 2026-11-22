import React, { useState, useEffect, useMemo } from 'react';
import {
  AOIConfig,
  EmergencyFacility,
  EmergencyPriorityResult,
  PriorityRankingParams,
  PriorityTier,
  ScoringWeights,
  SettlementIsolationResponse,
  VillagePriorityItem,
} from '../types';
import * as api from '../api/client';
import {
  AlertTriangle,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle,
  HelpCircle,
  MapPin,
  Route,
  Waves,
  Sliders,
  Download,
  RefreshCw,
  Hospital,
  Activity,
  Info,
  ChevronRight,
  Sparkles,
  Layers,
  Eye,
  Zap,
  Users,
  Compass,
  FileSpreadsheet,
  FileCode,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
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

interface EmergencyPrioritiesPageProps {
  activeAOI?: AOIConfig | null;
  isolationData?: SettlementIsolationResponse | null;
  onRefreshPriorities?: () => Promise<void>;
  isLoading?: boolean;
}

const MapFocusController: React.FC<{
  selectedVillage: VillagePriorityItem | null;
  villages: VillagePriorityItem[];
}> = ({ selectedVillage, villages }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedVillage) {
      if (selectedVillage.route_coordinates && selectedVillage.route_coordinates.length > 0) {
        const latlngs = selectedVillage.route_coordinates.map((c) => [c[1], c[0]] as [number, number]);
        latlngs.push([selectedVillage.latitude, selectedVillage.longitude]);
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
      } else {
        map.setView([selectedVillage.latitude, selectedVillage.longitude], 13, { animate: true });
      }
    } else if (villages.length > 0) {
      const latlngs = villages.map((v) => [v.latitude, v.longitude] as [number, number]);
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    }
  }, [selectedVillage, map]);

  return null;
};

const BASEMAP_TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 15,
    labelsMaxNativeZoom: 16,
    maxZoom: 18,
    name: 'Satellite Rescue View',
  },
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxNativeZoom: 15,
    labelsMaxNativeZoom: 15,
    maxZoom: 18,
    name: 'Tactical Dark',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    attribution: '&copy; OpenStreetMap contributors',
    maxNativeZoom: 18,
    maxZoom: 18,
    name: 'OpenStreetMap Street',
  },
};

export const EmergencyPrioritiesPage: React.FC<EmergencyPrioritiesPageProps> = ({
  activeAOI,
  isLoading: isParentLoading,
}) => {
  const [priorityResult, setPriorityResult] = useState<EmergencyPriorityResult | null>(null);
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<VillagePriorityItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<'satellite' | 'dark' | 'osm'>('satellite');

  const [weights, setWeights] = useState<ScoringWeights>({
    isolation: 0.35,
    nightlight: 0.30,
    population: 0.20,
    accessibility: 0.15,
  });
  const [showWeightsConfig, setShowWeightsConfig] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [showFacilities, setShowFacilities] = useState<boolean>(true);

  const loadPriorityData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [res, facList] = await Promise.all([
        api.fetchLatestPriorityRanking(),
        api.fetchEmergencyFacilities().catch(() => []),
      ]);
      setPriorityResult(res);
      setFacilities(facList);
      if (res.top_5_villages && res.top_5_villages.length > 0) {
        setSelectedVillage(res.top_5_villages[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load emergency priority rankings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPriorityData();
  }, []);

  const handleRecalculate = async (customWeights?: ScoringWeights) => {
    setIsRecalculating(true);
    setErrorMsg(null);
    try {
      const params: PriorityRankingParams = {
        weights: customWeights || weights,
        severity_filter: severityFilter,
        min_confidence: minConfidence,
      };
      const res = await api.runPriorityRanking(params);
      setPriorityResult(res);
      if (res.top_5_villages && res.top_5_villages.length > 0) {
        const exists = res.villages.find((v) => v.name === selectedVillage?.name);
        setSelectedVillage(exists || res.top_5_villages[0]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to recalculate priority rankings.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleResetWeights = () => {
    const defaultW: ScoringWeights = {
      isolation: 0.35,
      nightlight: 0.30,
      population: 0.20,
      accessibility: 0.15,
    };
    setWeights(defaultW);
    handleRecalculate(defaultW);
  };

  const totalWeight = weights.isolation + weights.nightlight + weights.population + weights.accessibility;
  const effectivePct = {
    isolation: totalWeight > 0 ? Math.round((weights.isolation / totalWeight) * 100) : 35,
    nightlight: totalWeight > 0 ? Math.round((weights.nightlight / totalWeight) * 100) : 30,
    population: totalWeight > 0 ? Math.round((weights.population / totalWeight) * 100) : 20,
    accessibility: totalWeight > 0 ? Math.round((weights.accessibility / totalWeight) * 100) : 15,
  };

  const settlements = priorityResult?.villages || [];
  const filteredSettlements = useMemo(() => {
    return settlements.filter((v) => {
      const matchSearch =
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.place_type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSeverity = severityFilter === 'ALL' || v.priority_tier === severityFilter;
      const matchConfidence = v.confidence_score >= minConfidence;
      return matchSearch && matchSeverity && matchConfidence;
    });
  }, [settlements, searchTerm, severityFilter, minConfidence]);

  const top5 = priorityResult?.top_5_villages || [];
  const stats = priorityResult?.summary_stats;

  const chartData = useMemo(() => {
    return top5.map((v) => ({
      name: v.name,
      Isolation: Number(v.features.isolation_score_contribution.toFixed(1)),
      Nightlight: Number(v.features.nightlight_score_contribution.toFixed(1)),
      Population: Number(v.features.population_score_contribution.toFixed(1)),
      Accessibility: Number(v.features.accessibility_score_contribution.toFixed(1)),
      Total: v.composite_priority_score,
    }));
  }, [top5]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Scientific Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-black border border-zinc-800 text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>Emergency Settlement Priority Ranking</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
                  Phase 6 Deterministic Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Multi-criteria logistics index: road isolation (35%), VIIRS night-light drop (30%), population (20%), and facility inaccessibility (15%).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowWeightsConfig(!showWeightsConfig)}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center space-x-2 cursor-pointer transition-colors ${
              showWeightsConfig
                ? 'bg-white text-black font-bold border-white'
                : 'bg-zinc-900 border-zinc-700 hover:border-white text-zinc-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configure Weights ({effectivePct.isolation}/{effectivePct.nightlight}/{effectivePct.population}/{effectivePct.accessibility})</span>
          </button>

          <a
            href={api.getPriorityExportGeoJSONUrl(priorityResult?.id)}
            download
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-300 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition"
            title="Download full prioritized settlements as GeoJSON FeatureCollection"
          >
            <FileCode className="w-3.5 h-3.5 text-zinc-300" />
            <span>GeoJSON</span>
          </a>

          <a
            href={api.getPriorityExportCSVUrl(priorityResult?.id)}
            download
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-300 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition"
            title="Download priority matrix as CSV spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-300" />
            <span>CSV</span>
          </a>

          <a
            href={api.getPriorityExportSitrepPdfUrl(priorityResult?.id)}
            download="JATAYU_AI_SITREP.pdf"
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-white text-white text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-sm transition"
            title="Download Official NDRF / SDMA Situation Report (PDF)"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-300" />
            <span>Official SITREP (PDF)</span>
          </a>

          <button
            onClick={() => handleRecalculate()}
            disabled={isLoading || isRecalculating}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center space-x-2 cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating || isLoading ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Calculating...' : 'Recalculate Priorities'}</span>
          </button>
        </div>
      </div>

      {/* 2. Mandatory Scientific Disclaimer Banner */}
      <div className="p-3.5 rounded-xl bg-[#111113] border border-zinc-800 text-zinc-300 text-xs flex items-start space-x-3 leading-relaxed">
        <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white uppercase tracking-wide mr-1.5">
            Scientific Decision Protocol:
          </span>
          Priority scores represent deterministic multi-criteria decision indices for emergency logistics, computed strictly from verified satellite observations (Sentinel-1 SAR, NASA VIIRS Black Marble VNP46A2), DEM topography, and OSM topological road networks. These scores quantify vulnerability, infrastructure severance, and accessibility impedance; they <strong className="text-rose-400 font-semibold">DO NOT represent confirmed casualties, localized ground-truth emergencies, or hydraulic forecasts</strong>. Missing satellite observations (e.g. cloudy VIIRS passes) are never fabricated as power outages and are penalized in the confidence index.
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Collapsible Operator Weight Configuration Drawer */}
      {showWeightsConfig && (
        <div className="p-5 rounded-xl bg-[#111113] border border-zinc-800 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-white" />
              <h3 className="text-sm font-bold text-white">
                Operator Multi-Criteria Weight Calibration
              </h3>
            </div>
            <button
              onClick={handleResetWeights}
              className="text-[11px] font-semibold text-zinc-400 hover:text-white underline cursor-pointer"
            >
              Reset to Scientific Baseline (35/30/20/15)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Isolation Weight */}
            <div className="space-y-1.5 bg-black p-3 rounded-lg border border-zinc-800">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300 flex items-center space-x-1">
                  <Route className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Road Isolation</span>
                </span>
                <span className="text-white font-mono font-bold">
                  {effectivePct.isolation}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.isolation}
                onChange={(e) => setWeights({ ...weights, isolation: parseFloat(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500 leading-tight">
                Topological graph severance & detour delays from OSMnx routing.
              </p>
            </div>

            {/* Nightlight Weight */}
            <div className="space-y-1.5 bg-black p-3 rounded-lg border border-zinc-800">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300 flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Night-Light Evidence</span>
                </span>
                <span className="text-white font-mono font-bold">
                  {effectivePct.nightlight}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.nightlight}
                onChange={(e) => setWeights({ ...weights, nightlight: parseFloat(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500 leading-tight">
                NASA VIIRS Black Marble VNP46A2 spatial radiance reduction clusters.
              </p>
            </div>

            {/* Population Weight */}
            <div className="space-y-1.5 bg-black p-3 rounded-lg border border-zinc-800">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300 flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Population Exposure</span>
                </span>
                <span className="text-white font-mono font-bold">
                  {effectivePct.population}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.population}
                onChange={(e) => setWeights({ ...weights, population: parseFloat(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500 leading-tight">
                Log-scaled demographic vulnerability from verified OSM & census tags.
              </p>
            </div>

            {/* Accessibility Weight */}
            <div className="space-y-1.5 bg-black p-3 rounded-lg border border-zinc-800">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-300 flex items-center space-x-1">
                  <Hospital className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Healthcare Inaccessibility</span>
                </span>
                <span className="text-white font-mono font-bold">
                  {effectivePct.accessibility}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={weights.accessibility}
                onChange={(e) => setWeights({ ...weights, accessibility: parseFloat(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
              <p className="text-[10px] text-zinc-500 leading-tight">
                Travel distance, transit delay to hospitals, and single mountain cul-de-sac spurs.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => handleRecalculate(weights)}
              disabled={isRecalculating}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold cursor-pointer transition-colors shadow-sm flex items-center space-x-2"
            >
              <span>Apply Calibrated Weights & Re-rank</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#111113] border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Settlements</div>
          <div className="text-2xl font-black text-white mt-1">{stats?.total_settlements ?? '—'}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Teesta Basin AOI</div>
        </div>

        <div className="bg-[#111113] border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>P1 Critical</span>
          </div>
          <div className="text-2xl font-black text-rose-300 mt-1">{stats?.p1_critical_count ?? '—'}</div>
          <div className="text-[10px] text-rose-400/70 mt-0.5">Urgent Logistics (Score ≥70)</div>
        </div>

        <div className="bg-[#111113] border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">P2 High Watch</div>
          <div className="text-2xl font-black text-amber-300 mt-1">{stats?.p2_high_count ?? '—'}</div>
          <div className="text-[10px] text-amber-400/70 mt-0.5">Priority Resupply (Score 45-69)</div>
        </div>

        <div className="bg-[#111113] border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Road Isolations</div>
          <div className="text-2xl font-black text-white mt-1">{stats?.severed_isolation_count ?? '—'}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Severed Graph Topology</div>
        </div>

        <div className="bg-[#111113] border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">VIIRS Drops</div>
          <div className="text-2xl font-black text-amber-300 mt-1">{stats?.nightlight_drop_cluster_count ?? '—'}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Regional Drop Clusters</div>
        </div>

        <div className="bg-[#111113] border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">High Confidence</div>
          <div className="text-2xl font-black text-emerald-300 mt-1">{stats?.high_confidence_count ?? '—'}</div>
          <div className="text-[10px] text-emerald-400/70 mt-0.5">Verified Multi-Sensor</div>
        </div>
      </div>

      {/* 5. Prominent Top 5 Priority Settlements Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-white" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Top 5 Priority Settlements (Emergency Logistics Roster)
            </h2>
          </div>
          <span className="text-[11px] text-zinc-400">
            Ranked deterministically by multi-criteria composite score
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {top5.map((v) => {
            const isSelected = selectedVillage?.name === v.name;
            const rankBadges = [
              'bg-white text-black font-black',
              'bg-zinc-200 text-black font-bold',
              'bg-zinc-300 text-black font-bold',
              'bg-zinc-800 text-white font-bold',
              'bg-zinc-800 text-zinc-300 font-bold',
            ];
            const badgeClass = rankBadges[v.rank - 1] || rankBadges[4];

            return (
              <div
                key={v.name}
                onClick={() => setSelectedVillage(v)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-zinc-900 border-white shadow-lg ring-1 ring-white/50'
                    : 'bg-[#111113] border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/60'
                }`}
              >
                <div>
                  {/* Top Bar: Rank & Score */}
                  <div className="flex items-start justify-between">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md ${badgeClass}`}
                    >
                      #{v.rank}
                    </span>
                    <div className="text-right">
                      <div className="text-xl font-black text-white leading-none">
                        {v.composite_priority_score}
                        <span className="text-xs text-zinc-400 font-normal">/100</span>
                      </div>
                      <span
                        className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 border ${
                          v.priority_tier === 'P1_CRITICAL'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                            : v.priority_tier === 'P2_HIGH'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        {v.priority_tier.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Village Name & Population */}
                  <div className="mt-3">
                    <h3 className="text-sm font-bold text-white truncate" title={v.name}>
                      {v.name}
                    </h3>
                    <div className="flex items-center space-x-2 text-[11px] text-zinc-400 mt-0.5">
                      <span className="capitalize">{v.place_type}</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3 text-zinc-400" />
                        <span>{v.population ? `${v.population.toLocaleString()} pop` : 'Unrecorded pop'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Component Breakdown Mini Bars */}
                  <div className="mt-3.5 space-y-1 pt-2.5 border-t border-zinc-800">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-400">Road Isolation</span>
                      <span className="font-mono text-white font-semibold">
                        {v.features.isolation_score_contribution.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-white h-full rounded-full"
                        style={{ width: `${v.features.isolation_norm}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] pt-0.5">
                      <span className="text-zinc-400">Nightlight Drop</span>
                      <span className="font-mono text-zinc-300 font-semibold">
                        {v.features.nightlight_score_contribution.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-300 h-full rounded-full"
                        style={{ width: `${v.features.nightlight_norm}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] pt-0.5">
                      <span className="text-zinc-400">Accessibility</span>
                      <span className="font-mono text-zinc-400 font-semibold">
                        {v.features.accessibility_score_contribution.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-400 h-full rounded-full"
                        style={{ width: `${v.features.accessibility_norm}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Bottom Footer: Confidence & Route */}
                <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{v.confidence_score}% Conf</span>
                  </span>
                  <span className="text-zinc-400 truncate max-w-[110px]" title={v.route_status}>
                    {v.features.isolation_raw_status === 'CRITICALLY_ISOLATED'
                      ? '⚠️ Severed Road'
                      : v.detour_delay_min
                      ? `+${v.detour_delay_min.toFixed(0)}m detour`
                      : 'Open corridor'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Interactive Map & Inspection Panel Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Col (7 cols): Leaflet Interactive Map */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Geographic Priority Map & Emergency Corridors
              </h3>
            </div>
            <div className="flex items-center space-x-2 text-[11px]">
              <label className="flex items-center space-x-1 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={showRoutes}
                  onChange={(e) => setShowRoutes(e.target.checked)}
                  className="rounded accent-white"
                />
                <span>Routes</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer text-zinc-300 ml-2">
                <input
                  type="checkbox"
                  checked={showFacilities}
                  onChange={(e) => setShowFacilities(e.target.checked)}
                  className="rounded accent-white"
                />
                <span>Hospitals</span>
              </label>

              {/* Quick Basemap Switcher */}
              <div className="flex items-center space-x-1 bg-black border border-zinc-800 rounded-lg p-0.5 ml-2">
                <button
                  type="button"
                  onClick={() => setActiveBasemap('satellite')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                    activeBasemap === 'satellite'
                      ? 'bg-white text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="High-Resolution Esri Satellite Imagery with Reference Labels"
                >
                  🛰️ Satellite
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBasemap('dark')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                    activeBasemap === 'dark'
                      ? 'bg-white text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Tactical Dark Gray Basemap (smoothly scaled above zoom 13)"
                >
                  🌑 Dark
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBasemap('osm')}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                    activeBasemap === 'osm'
                      ? 'bg-white text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Keyless OpenStreetMap Street Map"
                >
                  🗺️ OSM
                </button>
              </div>
            </div>
          </div>

          <div className="h-[520px] rounded-xl overflow-hidden border border-zinc-800 shadow-xl relative bg-[#050505]">
            <MapContainer
              center={[26.92, 88.48]}
              zoom={11}
              zoomSnap={1}
              zoomDelta={1}
              wheelPxPerZoomLevel={120}
              maxZoom={18}
              style={{ width: '100%', height: '100%', background: '#050505' }}
              zoomControl={false}
            >
              <TileLayer
                key={`prio-base-${activeBasemap}`}
                url={BASEMAP_TILES[activeBasemap].url}
                attribution={BASEMAP_TILES[activeBasemap].attribution}
                maxNativeZoom={BASEMAP_TILES[activeBasemap].maxNativeZoom}
                maxZoom={BASEMAP_TILES[activeBasemap].maxZoom}
                detectRetina={false}
                errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
              {BASEMAP_TILES[activeBasemap].labelsUrl && (
                <TileLayer
                  key={`prio-labels-${activeBasemap}`}
                  url={BASEMAP_TILES[activeBasemap].labelsUrl!}
                  attribution=""
                  maxNativeZoom={BASEMAP_TILES[activeBasemap].labelsMaxNativeZoom}
                  maxZoom={BASEMAP_TILES[activeBasemap].maxZoom}
                  detectRetina={false}
                  zIndex={650}
                  errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                />
              )}
              <ScaleControl position="bottomleft" imperial={false} />
              <MapFocusController selectedVillage={selectedVillage} villages={filteredSettlements} />

              {/* Emergency Routes */}
              {showRoutes &&
                priorityResult?.emergency_routes?.map((rt, idx) => {
                  const latlngs = rt.path.map((c) => [c[1], c[0]] as [number, number]);
                  const isSelectedRoute = selectedVillage?.name === rt.village_name;
                  return (
                    <Polyline
                      key={`route-${idx}`}
                      positions={latlngs}
                      pathOptions={{
                        color: isSelectedRoute ? '#ffffff' : '#A1A1AA',
                        weight: isSelectedRoute ? 4 : 2,
                        opacity: isSelectedRoute ? 0.95 : 0.45,
                        dashArray: rt.detour_delay_min ? '6, 6' : undefined,
                      }}
                    >
                      <Popup>
                        <div className="text-xs p-1">
                          <strong className="text-slate-900 block font-bold">{rt.village_name} Route</strong>
                          <span className="text-slate-600 block text-[10px]">Destination: {rt.facility_name}</span>
                          {rt.detour_delay_min && (
                            <span className="text-amber-700 font-semibold block text-[10px]">
                              Detour delay: +{rt.detour_delay_min.toFixed(1)} min
                            </span>
                          )}
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

              {/* Medical Facilities */}
              {showFacilities &&
                facilities.map((fac) => (
                  <CircleMarker
                    key={fac.facility_id}
                    center={[fac.latitude, fac.longitude]}
                    radius={6}
                    pathOptions={{
                      color: '#ffffff',
                      fillColor: '#ffffff',
                      fillOpacity: 0.9,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-xs p-1">
                        <strong className="text-slate-900 font-bold block">{fac.name}</strong>
                        <span className="text-emerald-700 font-semibold block text-[10px]">
                          {fac.facility_type} ({fac.capacity_beds} beds)
                        </span>
                        {fac.trauma_centre && (
                          <span className="text-rose-700 font-bold block text-[10px]">Emergency Trauma Centre</span>
                        )}
                      </div>
                    </Popup>
                    <LeafletTooltip direction="top" offset={[0, -6]}>
                      <span className="text-xs font-semibold">{fac.name}</span>
                    </LeafletTooltip>
                  </CircleMarker>
                ))}

              {/* Village Markers Color-Coded by Priority Score */}
              {filteredSettlements.map((v) => {
                const isSelected = selectedVillage?.name === v.name;
                const isTop5 = v.rank <= 5;
                const markerColor =
                  v.priority_tier === 'P1_CRITICAL'
                    ? '#ef4444'
                    : v.priority_tier === 'P2_HIGH'
                    ? '#f59e0b'
                    : '#FFFFFF';

                return (
                  <React.Fragment key={v.name}>
                    {isTop5 && (
                      <CircleMarker
                        center={[v.latitude, v.longitude]}
                        radius={isSelected ? 18 : 13}
                        pathOptions={{
                          color: markerColor,
                          fillColor: markerColor,
                          fillOpacity: 0.15,
                          weight: 1.5,
                          dashArray: '3, 4',
                        }}
                      />
                    )}

                    <CircleMarker
                      center={[v.latitude, v.longitude]}
                      radius={isSelected ? 9 : isTop5 ? 7 : 5}
                      pathOptions={{
                        color: isSelected ? '#ffffff' : markerColor,
                        fillColor: markerColor,
                        fillOpacity: 0.95,
                        weight: isSelected ? 3 : 1.5,
                      }}
                      eventHandlers={{
                        click: () => setSelectedVillage(v),
                      }}
                    >
                      <LeafletTooltip direction="top" offset={[0, -8]}>
                        <div className="text-xs">
                          <strong className="block font-bold">
                            #{v.rank} {v.name}
                          </strong>
                          <span className="text-rose-600 font-bold">
                            Score: {v.composite_priority_score} ({v.priority_tier.replace('_', ' ')})
                          </span>
                        </div>
                      </LeafletTooltip>
                    </CircleMarker>
                  </React.Fragment>
                );
              })}
            </MapContainer>

            {/* Map Floating Legend */}
            <div className="absolute bottom-3 right-3 z-[1000] bg-[#111113]/95 backdrop-blur-md p-2.5 rounded-lg border border-zinc-800 text-[10px] space-y-1.5 shadow-xl text-zinc-300 pointer-events-auto">
              <div className="font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-1">
                Priority Tier Legend
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
                <span>P1 Critical (Score ≥70)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>P2 High Watch (Score 45-69)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                <span>P3 Moderate (Score 25-44)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-zinc-500"></span>
                <span>Emergency Hospital</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col (5 cols): Inspection Detail Drawer */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-white" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Settlement Diagnostic & Score Explanation
              </h3>
            </div>
            {selectedVillage && (
              <span className="text-[11px] font-mono text-zinc-400">
                Rank #{selectedVillage.rank} of {settlements.length}
              </span>
            )}
          </div>

          {selectedVillage ? (
            <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5 space-y-4 shadow-xl">
              {/* Header Box */}
              <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-black text-white">{selectedVillage.name}</h2>
                    <span className="text-xs text-zinc-400 capitalize">({selectedVillage.place_type})</span>
                  </div>
                  <div className="flex items-center space-x-3 text-xs text-zinc-400 mt-1">
                    <span>{selectedVillage.population ? `${selectedVillage.population.toLocaleString()} Residents` : 'Population Unrecorded in OSM'}</span>
                    <span>•</span>
                    <span>{selectedVillage.elevation_m.toFixed(0)}m Elevation</span>
                    <span>•</span>
                    <span className="font-mono text-zinc-500">
                      [{selectedVillage.latitude.toFixed(4)}°N, {selectedVillage.longitude.toFixed(4)}°E]
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-white">
                    {selectedVillage.composite_priority_score}
                    <span className="text-xs text-zinc-400 font-normal">/100</span>
                  </div>
                  <span
                    className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 border ${
                      selectedVillage.priority_tier === 'P1_CRITICAL'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                        : selectedVillage.priority_tier === 'P2_HIGH'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {selectedVillage.priority_tier_label}
                  </span>
                </div>
              </div>

              {/* Natural Language Transparent Explanation */}
              <div className="p-3.5 rounded-lg bg-black border border-zinc-800 text-xs text-zinc-300 leading-relaxed space-y-1.5">
                <div className="font-bold text-white flex items-center space-x-1.5 uppercase tracking-wider text-[11px]">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Deterministic Audit Trail</span>
                </div>
                <p>{selectedVillage.explanation}</p>
              </div>

              {/* Exact Formula Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Component Sub-Scores & Weight Contributions</span>
                </div>

                <div className="space-y-2 bg-black p-3 rounded-lg border border-zinc-800 text-xs">
                  {/* Isolation */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-zinc-300 flex items-center space-x-1">
                        <Route className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Road Isolation ({effectivePct.isolation}%)</span>
                      </span>
                      <span className="font-mono text-white font-bold">
                        +{selectedVillage.features.isolation_score_contribution.toFixed(1)} pts
                        <span className="text-zinc-500 font-normal ml-1">
                          ({selectedVillage.features.isolation_norm.toFixed(0)}/100)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-white h-full rounded-full"
                        style={{ width: `${selectedVillage.features.isolation_norm}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Status: {selectedVillage.features.isolation_raw_status}
                      {selectedVillage.features.isolation_raw_detour_min &&
                        ` (+${selectedVillage.features.isolation_raw_detour_min.toFixed(1)} min detour)`}
                    </div>
                  </div>

                  {/* Night-light */}
                  <div className="pt-2 border-t border-zinc-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-zinc-300 flex items-center space-x-1">
                        <Zap className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Night-Light Evidence ({effectivePct.nightlight}%)</span>
                      </span>
                      <span className="font-mono text-white font-bold">
                        +{selectedVillage.features.nightlight_score_contribution.toFixed(1)} pts
                        <span className="text-zinc-500 font-normal ml-1">
                          ({selectedVillage.features.nightlight_norm.toFixed(0)}/100)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-300 h-full rounded-full"
                        style={{ width: `${selectedVillage.features.nightlight_norm}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      {selectedVillage.features.nightlight_cluster_id
                        ? `VIIRS Cluster #${selectedVillage.features.nightlight_cluster_id}: ${selectedVillage.features.nightlight_raw_reduction_pct.toFixed(1)}% radiance reduction`
                        : selectedVillage.features.nightlight_cloud_obscured
                        ? 'Cloud-obscured pixel (0 pts assigned; not a blackout)'
                        : 'Baseline lighting maintained'}
                    </div>
                  </div>

                  {/* Population */}
                  <div className="pt-2 border-t border-zinc-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-zinc-300 flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Demographic Exposure ({effectivePct.population}%)</span>
                      </span>
                      <span className="font-mono text-white font-bold">
                        +{selectedVillage.features.population_score_contribution.toFixed(1)} pts
                        <span className="text-zinc-500 font-normal ml-1">
                          ({selectedVillage.features.population_norm.toFixed(0)}/100)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-400 h-full rounded-full"
                        style={{ width: `${selectedVillage.features.population_norm}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Log-scale normalization: {selectedVillage.population ? `${selectedVillage.population.toLocaleString()} residents` : 'Unrecorded population baseline'}
                    </div>
                  </div>

                  {/* Inaccessibility */}
                  <div className="pt-2 border-t border-zinc-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-zinc-300 flex items-center space-x-1">
                        <Hospital className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Healthcare Remoteness ({effectivePct.accessibility}%)</span>
                      </span>
                      <span className="font-mono text-white font-bold">
                        +{selectedVillage.features.accessibility_score_contribution.toFixed(1)} pts
                        <span className="text-zinc-500 font-normal ml-1">
                          ({selectedVillage.features.accessibility_norm.toFixed(0)}/100)
                        </span>
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-500 h-full rounded-full"
                        style={{ width: `${selectedVillage.features.accessibility_norm}%` }}
                      ></div>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Nearest: {selectedVillage.nearest_facility_name || 'Emergency Centre'} (
                      {selectedVillage.features.accessibility_raw_travel_time_min.toFixed(0)} min,{' '}
                      {selectedVillage.features.accessibility_raw_distance_km.toFixed(1)} km)
                    </div>
                  </div>
                </div>
              </div>

              {/* Independent Confidence Assessment */}
              <div className="p-3 rounded-lg bg-black border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Independent Data Confidence</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {selectedVillage.confidence_score}% ({selectedVillage.confidence_tier})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
                  <div className="bg-[#111113] p-2 rounded border border-zinc-800">
                    <div className="text-zinc-500 text-[10px]">VIIRS Nightlight</div>
                    <div className="text-white font-semibold truncate">
                      {selectedVillage.confidence.viirs_nightlight_quality}
                    </div>
                  </div>
                  <div className="bg-[#111113] p-2 rounded border border-zinc-800">
                    <div className="text-zinc-500 text-[10px]">Sentinel-1 Flood</div>
                    <div className="text-white font-semibold truncate">
                      {selectedVillage.confidence.sentinel_flood_quality}
                    </div>
                  </div>
                  <div className="bg-[#111113] p-2 rounded border border-zinc-800">
                    <div className="text-zinc-500 text-[10px]">Road Graph</div>
                    <div className="text-white font-semibold truncate">
                      {selectedVillage.confidence.road_network_quality}
                    </div>
                  </div>
                  <div className="bg-[#111113] p-2 rounded border border-zinc-800">
                    <div className="text-zinc-500 text-[10px]">Demographic Data</div>
                    <div className="text-white font-semibold truncate">
                      {selectedVillage.confidence.census_population_quality}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[450px] rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
              <Compass className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-xs">Click on any village marker or table row to inspect full score components.</p>
            </div>
          )}
        </div>
      </div>

      {/* 7. Top 5 Factor Contribution Comparison Chart */}
      {top5.length > 0 && (
        <div className="bg-[#111113] border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Top 5 Settlement Multi-Criteria Component Comparison</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Stacked point contribution breakdown for each top priority settlement.
              </p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis dataKey="name" stroke="#71717A" tick={{ fontSize: 11 }} />
                <YAxis stroke="#71717A" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#111113',
                    borderColor: '#27272A',
                    borderRadius: '0.5rem',
                    fontSize: '11px',
                    color: '#FFFFFF',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Isolation" stackId="a" fill="#FFFFFF" />
                <Bar dataKey="Nightlight" stackId="a" fill="#D4D4D8" />
                <Bar dataKey="Population" stackId="a" fill="#A1A1AA" />
                <Bar dataKey="Accessibility" stackId="a" fill="#71717A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 8. Full Priority Settlement Roster Table & Search/Filter Controls */}
      <div className="bg-[#111113] border border-zinc-800 rounded-xl overflow-hidden shadow-xl space-y-3 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              Complete Settlement Priority Ranking Matrix
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Showing {filteredSettlements.length} of {settlements.length} monitored basin settlements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search village name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-black border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
              />
            </div>

            {/* Severity Filter Tabs */}
            <div className="flex items-center bg-black p-0.5 rounded-lg border border-zinc-800 text-xs">
              {['ALL', 'P1_CRITICAL', 'P2_HIGH', 'P3_MODERATE', 'P4_LOW'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSeverityFilter(tier)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                    severityFilter === tier
                      ? 'bg-white text-black font-bold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tier.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Settlement</th>
                <th className="py-2.5 px-3 text-center">Score</th>
                <th className="py-2.5 px-3">Tier</th>
                <th className="py-2.5 px-3">Road Status</th>
                <th className="py-2.5 px-3">VIIRS Drop</th>
                <th className="py-2.5 px-3">Population</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Reachable Facility</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {filteredSettlements.map((v) => {
                const isSelected = selectedVillage?.name === v.name;
                return (
                  <tr
                    key={v.name}
                    onClick={() => setSelectedVillage(v)}
                    className={`hover:bg-zinc-800/40 transition-colors cursor-pointer ${
                      isSelected ? 'bg-zinc-900 font-medium' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-white">#{v.rank}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{v.name}</div>
                      <div className="text-[10px] text-zinc-500 capitalize">{v.place_type}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-white text-sm">
                      {v.composite_priority_score}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                          v.priority_tier === 'P1_CRITICAL'
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                            : v.priority_tier === 'P2_HIGH'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        {v.priority_tier.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[11px] ${
                          v.features.isolation_raw_status === 'CRITICALLY_ISOLATED'
                            ? 'text-rose-400 font-semibold'
                            : v.detour_delay_min
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {v.features.isolation_raw_status === 'CRITICALLY_ISOLATED'
                          ? 'Severed (Isolated)'
                          : v.detour_delay_min
                          ? `Detour (+${v.detour_delay_min.toFixed(0)}m)`
                          : 'Open Highway'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {v.features.nightlight_raw_reduction_pct > 0 ? (
                        <span className="text-amber-400 font-semibold">
                          -{v.features.nightlight_raw_reduction_pct.toFixed(1)}%
                        </span>
                      ) : v.features.nightlight_cloud_obscured ? (
                        <span className="text-zinc-500 italic">Cloudy</span>
                      ) : (
                        <span className="text-zinc-500">0.0%</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{v.population ? v.population.toLocaleString() : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-400 font-mono text-[11px]">
                        {v.confidence_score}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 truncate max-w-[150px]" title={v.nearest_facility_name || 'None'}>
                      {v.nearest_facility_name || 'Hospital Cutoff'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVillage(v);
                        }}
                        className="text-[11px] font-semibold text-white hover:underline cursor-pointer flex items-center justify-end space-x-1"
                      >
                        <span>Audit</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
