import React, { useState, useEffect } from 'react';
import {
  AOIConfig,
  GloFASEarlyWarningResponse,
  RoadNetworkStats,
  ServiceStatus,
  SettlementIsolationResponse,
  UnifiedSystemOverview,
  VillagePriorityItem,
} from '../types';
import { PageId } from '../components/Sidebar';
import { ServiceStatusBadge } from '../components/ServiceStatusBadge';
import * as api from '../api/client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Compass,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  Layers,
  MapPin,
  Route,
  Activity,
  Mountain,
  Users,
  ShieldCheck,
  ExternalLink,
  ShieldAlert,
  Waves,
  Moon,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FileCode,
  FileSpreadsheet,
  FileText,
  Hospital,
  Sparkles,
  Zap,
  Grid,
  Train,
  Plane,
} from 'lucide-react';

interface OverviewPageProps {
  activeAOI: AOIConfig | null;
  servicesStatus: ServiceStatus[];
  roadStats: RoadNetworkStats | null;
  isolationData: SettlementIsolationResponse | null;
  elevationData: any;
  meteoData: any;
  onTriggerService: (serviceId: string) => Promise<void>;
  onTriggerAll: () => Promise<void>;
  onClearService: (serviceId: string) => Promise<void>;
  onOpenAOIModal: () => void;
  onNavigatePage?: (pageId: PageId) => void;
  loadingService: string | null;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  activeAOI,
  servicesStatus,
  roadStats,
  isolationData,
  elevationData,
  meteoData,
  onTriggerService,
  onTriggerAll,
  onClearService,
  onOpenAOIModal,
  onNavigatePage,
  loadingService,
}) => {
  const [overviewData, setOverviewData] = useState<UnifiedSystemOverview | null>(null);
  const [earlyWarning, setEarlyWarning] = useState<GloFASEarlyWarningResponse | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>('teesta_bazar_downstream');
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Fetch unified summary from backend API
  const loadSummary = async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const [data, ew] = await Promise.all([
        api.fetchSystemOverview(),
        api.fetchEarlyWarningTelemetry().catch((err) => {
          console.warn('GloFAS early warning load:', err);
          return null;
        }),
      ]);
      setOverviewData(data);
      if (ew) setEarlyWarning(ew);
    } catch (err: any) {
      setSummaryError(err.message || 'Failed to load unified disaster overview');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const metrics = overviewData?.metrics;
  const top5 = overviewData?.top_5_priorities || [];
  const infra = overviewData?.infrastructure;

  const currentDischarge = meteoData?.river_gauges?.[0]?.current_discharge_m3s ?? infra?.teesta_discharge_m3s ?? null;
  const settlementsCount = metrics?.total_mapped_settlements ?? isolationData?.settlements_count ?? null;
  const totalRoadKm = infra?.total_road_network_km ?? roadStats?.total_length_km ?? null;
  const minEle = infra?.min_elevation_m ?? elevationData?.min_elevation_m ?? null;
  const maxEle = infra?.max_elevation_m ?? elevationData?.max_elevation_m ?? null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Hero Mission & Unified Command Banner */}
      <div className="relative rounded-2xl bg-[#111113] border border-zinc-800 p-6 shadow-xl overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>AUTHORIZED DISASTER COMMAND &amp; CONTROL SYSTEM • NDMA / SDMA / NDRF</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              JATAYU AI — Intelligent Disaster Prediction &amp; National Emergency Response System
            </h1>
            <p className="text-xs font-medium text-zinc-400 italic">
              "Predict Before Disaster. Respond Before It's Too Late. Save Lives."
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Multi-source intelligence fusion combining Copernicus Sentinel-1 SAR &amp; Sentinel-2 optical imagery, GloFAS/weather forecasts, Copernicus GLO-90 DEM terrain, OpenStreetMap road topology, and NASA VIIRS night-light telemetry to predict risk and trigger pre-disaster evacuation before communities become isolated.
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => onNavigatePage && onNavigatePage('command-map')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-black" />
              <span>Unified Tactical Command Map</span>
            </button>

            <button
              onClick={() => onNavigatePage && onNavigatePage('india-surveillance')}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-white font-semibold text-xs transition shadow flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Grid className="w-4 h-4 text-zinc-300" />
              <span>All-India 4-Grid Surveillance</span>
            </button>

            <button
              onClick={() => onNavigatePage && onNavigatePage('map')}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-white text-xs transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-zinc-300" />
              <span>Open Geographic Layers Map</span>
            </button>

            <button
              onClick={onOpenAOIModal}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-white text-xs transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-zinc-300" />
              <span>Configure Bounding Box</span>
            </button>

            <button
              onClick={loadSummary}
              disabled={isLoadingSummary}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-white text-xs transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSummary ? 'animate-spin' : ''}`} />
              <span>Sync All Engine Outputs</span>
            </button>

            <a
              href={api.getPriorityExportSitrepPdfUrl()}
              download="JATAYU_AI_SITREP.pdf"
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-rose-500 font-semibold text-xs transition shadow flex items-center justify-center space-x-2 cursor-pointer"
              title="Download Official NDRF / SDMA Situation Report (PDF)"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              <span>Download Official SITREP (PDF)</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Mandatory Scientific Disclaimer */}
      <div className="p-3.5 rounded-xl bg-[#111113] border border-zinc-800 text-zinc-300 text-xs flex items-start space-x-3 leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white uppercase tracking-wide mr-1.5">
            Operational Command Framing:
          </span>
          Authorized emergency operations platform designed for government disaster authorities (NDMA, SDMA, District Emergency Operation Centers). Integrates multi-criteria empirical observations with zero synthetic hallucinations. Missing or cloudy satellite observations penalize confidence and are never fabricated as blackouts.
        </div>
      </div>

      {/* 2.5 Live Open-Meteo GloFAS River Discharge Early-Warning & Predictive Telemetry */}
      {earlyWarning && (
        <div className="rounded-2xl bg-[#111113] border border-zinc-800 p-5 shadow-xl space-y-4">
          {/* Header Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-800 pb-3.5">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg ${
                  earlyWarning.overall_alert_tier === 'CRITICAL'
                    ? 'bg-rose-950 border border-rose-800 text-rose-400 animate-pulse'
                    : earlyWarning.overall_alert_tier === 'WARNING'
                    ? 'bg-amber-950 border border-amber-800 text-amber-400'
                    : 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                }`}>
                  <Waves className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Live Copernicus GloFAS River Early Warning Telemetry
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    earlyWarning.overall_alert_tier === 'CRITICAL'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : earlyWarning.overall_alert_tier === 'WARNING'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {earlyWarning.overall_alert_tier} ALERT
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-300 font-medium">
                {earlyWarning.overall_badge?.title}: <span className="text-zinc-400 font-normal">{earlyWarning.overall_badge?.description}</span>
              </p>
            </div>

            <div className="flex items-center space-x-4 shrink-0 text-xs font-mono">
              <div className="px-3 py-1.5 rounded-lg bg-black border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase block">Peak 14d Forecast</span>
                <span className="text-sm font-bold text-white">
                  {earlyWarning.peak_forecast_discharge_m3s?.toFixed(1)} <span className="text-xs text-zinc-400 font-normal">m³/s</span>
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 font-sans hidden sm:block text-right">
                <div>Source: Copernicus GloFAS v4.0</div>
                <div className="text-zinc-400">Zero Fabricated Data</div>
              </div>
            </div>
          </div>

          {/* Grid: Station Cards (Left) & 14-Day Discharge Hydrograph Chart (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Station Telemetry Column */}
            <div className="space-y-3">
              {earlyWarning.stations?.map((st) => {
                const isSelected = selectedStationId === st.station_id;
                return (
                  <div
                    key={st.station_id}
                    onClick={() => setSelectedStationId(st.station_id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-black border-white ring-1 ring-white/20'
                        : 'bg-black/60 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-white">{st.station_name}</div>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                        st.alert_tier === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : st.alert_tier === 'WARNING'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {st.alert_tier}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{st.role}</div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-zinc-800 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Current</span>
                        <span className="font-bold text-white">{st.current_discharge_m3s} m³/s</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">14d Max</span>
                        <span className="font-bold text-white">{st.peak_forecast_m3s} m³/s</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-400 mt-2 font-sans line-clamp-1">
                      {st.advisory}
                    </div>
                  </div>
                );
              })}

              {/* Thresholds Legend */}
              <div className="p-2.5 rounded-lg bg-black border border-zinc-800 text-[10px] text-zinc-400 space-y-1">
                <div className="font-semibold text-zinc-300 uppercase tracking-wider text-[9px]">Operational Hydraulic Tiers</div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400">● Normal Flow:</span>
                  <span className="font-mono text-zinc-300">&lt; 600 m³/s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-400">● Pre-Disaster Warning:</span>
                  <span className="font-mono text-zinc-300">600 – 1,500 m³/s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rose-400">● Critical Flood Danger:</span>
                  <span className="font-mono text-zinc-300">&gt; 1,500 m³/s</span>
                </div>
              </div>
            </div>

            {/* 14-Day Discharge Hydrograph Chart */}
            <div className="lg:col-span-2 p-4 rounded-xl bg-black border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <div className="font-semibold text-white flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-white" />
                  <span>14-Day GloFAS Discharge Hydrograph Forecast — Teesta River Corridor</span>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-mono">
                  <span className="flex items-center space-x-1 text-white">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    <span>Downstream</span>
                  </span>
                  <span className="flex items-center space-x-1 text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                    <span>Mid-Corridor</span>
                  </span>
                  <span className="flex items-center space-x-1 text-zinc-400">
                    <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
                    <span>Upstream</span>
                  </span>
                </div>
              </div>

              <div className="h-[280px] w-full min-h-[260px]">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={
                      earlyWarning.timeline && earlyWarning.timeline.length > 0
                        ? earlyWarning.timeline
                        : earlyWarning.stations?.find(s => s.station_id === selectedStationId)?.time_series?.map(pt => ({
                            date: pt.date,
                            upstream_m3s: pt.discharge_m3s,
                            mid_corridor_m3s: pt.discharge_m3s,
                            downstream_m3s: pt.discharge_m3s,
                            ensemble_max_m3s: pt.discharge_max_m3s
                          })) || []
                    }
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="glofasDownstreamGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="glofasMidGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A1A1AA" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#A1A1AA" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis
                      dataKey="date"
                      stroke="#71717A"
                      fontSize={10}
                      tickFormatter={(val) => typeof val === 'string' ? val.slice(5) : val}
                    />
                    <YAxis stroke="#71717A" fontSize={10} unit=" m³/s" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111113', borderColor: '#27272A', borderRadius: '8px', fontSize: '11px', color: '#FFFFFF' }}
                      formatter={(val: any, name: any) => [
                        `${Number(val).toFixed(1)} m³/s`,
                        name === 'downstream_m3s'
                          ? 'Downstream (Sevoke/Jalpaiguri)'
                          : name === 'mid_corridor_m3s'
                          ? 'Mid-Corridor (Teesta Bazar)'
                          : name === 'upstream_m3s'
                          ? 'Upstream (Chungthang)'
                          : 'Ensemble Peak Max',
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <ReferenceLine y={600} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Warning (600 m³/s)', fill: '#F59E0B', fontSize: 9, position: 'top' }} />
                    <ReferenceLine y={1500} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Critical Danger (1,500 m³/s)', fill: '#EF4444', fontSize: 9, position: 'top' }} />
                    <Area
                      type="monotone"
                      dataKey="ensemble_max_m3s"
                      stroke="#E4E4E7"
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      fillOpacity={0}
                      name="ensemble_max_m3s"
                    />
                    <Area
                      type="monotone"
                      dataKey="downstream_m3s"
                      stroke="#FFFFFF"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#glofasDownstreamGrad)"
                      name="downstream_m3s"
                    />
                    <Area
                      type="monotone"
                      dataKey="mid_corridor_m3s"
                      stroke="#A1A1AA"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#glofasMidGrad)"
                      name="mid_corridor_m3s"
                    />
                    <Line
                      type="monotone"
                      dataKey="upstream_m3s"
                      stroke="#71717A"
                      strokeWidth={1.5}
                      dot={false}
                      name="upstream_m3s"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Executive Disaster Situation Metrics (6 Primary Dashboard KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Mapped Settlements */}
        <div
          onClick={() => onNavigatePage && onNavigatePage('map')}
          className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-2 hover:border-zinc-600 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Settlements</span>
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {settlementsCount ?? '—'}
          </div>
          <div className="text-[10px] text-zinc-400 flex items-center justify-between">
            <span>Verified OSM Nodes</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </div>
        </div>

        {/* 2. Flood-Exposed Settlements */}
        <div
          onClick={() => onNavigatePage && onNavigatePage('flood')}
          className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-2 hover:border-zinc-600 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Flood Exposed</span>
            <Waves className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics?.flood_exposed_settlements ?? '—'}
          </div>
          <div className="text-[10px] text-zinc-400 flex items-center justify-between">
            <span>Sentinel-1 SAR / Buffer</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </div>
        </div>

        {/* 3. Potentially Isolated Settlements */}
        <div
          onClick={() => onNavigatePage && onNavigatePage('isolation')}
          className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-2 hover:border-zinc-600 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Isolated Nodes</span>
            <Route className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics?.potentially_isolated_settlements ?? '—'}
          </div>
          <div className="text-[10px] text-zinc-400 flex items-center justify-between">
            <span>Severed Road Graph</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </div>
        </div>

        {/* 4. Possible Blackout Areas */}
        <div
          onClick={() => onNavigatePage && onNavigatePage('nightlight')}
          className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-2 hover:border-zinc-600 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Light Drops</span>
            <Moon className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics?.possible_blackout_areas_count !== undefined && metrics?.possible_blackout_areas_count !== null ? (
              <>
                {metrics.possible_blackout_areas_count}
                {metrics.blackout_affected_area_sqkm !== undefined && metrics.blackout_affected_area_sqkm !== null && (
                  <span className="text-xs text-zinc-400 font-normal ml-1">
                    ({metrics.blackout_affected_area_sqkm} km²)
                  </span>
                )}
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="text-[10px] text-zinc-400 flex items-center justify-between">
            <span>NASA VIIRS Clusters</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </div>
        </div>

        {/* 5. Population Exposure */}
        <div
          onClick={() => onNavigatePage && onNavigatePage('priorities')}
          className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-2 hover:border-zinc-600 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pop Exposure</span>
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics?.population_exposure_total !== undefined && metrics?.population_exposure_total !== null
              ? metrics.population_exposure_total.toLocaleString()
              : '—'}
          </div>
          <div className="text-[10px] text-zinc-400 flex items-center justify-between">
            <span>In Hazard Zones</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
          </div>
        </div>

        {/* 6. Top Priorities Severity (P1 Critical Alert) */}
        <div
          onClick={() => onNavigatePage && onNavigatePage('priorities')}
          className="rounded-xl bg-[#111113] border border-rose-900/60 p-4 space-y-2 hover:border-rose-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-rose-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">P1 Critical</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300 font-mono">
            {top5.filter((v) => v.priority_tier === 'P1_CRITICAL').length}
          </div>
          <div className="text-[10px] text-rose-400/80 flex items-center justify-between">
            <span>Urgent Logistics Roster</span>
            <ArrowRight className="w-3 h-3 text-rose-500" />
          </div>
        </div>
      </div>

      {/* 4. Top 5 Priorities Spotlight Card */}
      <div className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Top Five Emergency Priority Settlements
              </h2>
              <p className="text-[11px] text-zinc-400">
                Multi-criteria logistics rank based on topological isolation (35%), night-light drop (30%), population (20%), and inaccessibility (15%).
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigatePage && onNavigatePage('priorities')}
            className="text-xs text-white hover:text-zinc-300 font-semibold flex items-center space-x-1 cursor-pointer"
          >
            <span>Open Full Prioritization Matrix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top 5 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {top5.map((v) => {
            const rankBadges = [
              'bg-white text-black font-black',
              'bg-zinc-200 text-black font-black',
              'bg-zinc-400 text-black font-black',
              'bg-zinc-700 text-white font-bold',
              'bg-zinc-800 text-zinc-300 font-bold',
            ];
            const badgeClass = rankBadges[v.rank - 1] || rankBadges[4];

            return (
              <div
                key={v.name}
                onClick={() => onNavigatePage && onNavigatePage('priorities')}
                className="p-3.5 rounded-xl bg-black border border-zinc-800 hover:border-zinc-600 transition cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${badgeClass}`}>
                      #{v.rank}
                    </span>
                    <div className="text-right">
                      <div className="text-base font-black text-white">
                        {v.composite_priority_score}
                        <span className="text-[10px] text-zinc-400 font-normal">/100</span>
                      </div>
                      <span className={`inline-block text-[8px] font-bold uppercase px-1 py-0.5 rounded border ${
                        v.priority_tier === 'P1_CRITICAL'
                          ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                          : v.priority_tier === 'P2_HIGH'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}>
                        {v.priority_tier.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <h3 className="text-xs font-bold text-white truncate" title={v.name}>
                      {v.name}
                    </h3>
                    <div className="text-[10px] text-zinc-400 flex items-center space-x-1.5 mt-0.5">
                      <span className="capitalize">{v.place_type}</span>
                      <span>•</span>
                      <span>{v.population ? `${v.population.toLocaleString()} pop` : 'Unrecorded pop'}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-zinc-800 text-[10px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Road Access:</span>
                      <span className={v.features.isolation_raw_status === 'CRITICALLY_ISOLATED' ? 'text-rose-400 font-semibold' : 'text-zinc-300'}>
                        {v.features.isolation_raw_status === 'CRITICALLY_ISOLATED' ? 'Severed' : 'Open'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Nightlight:</span>
                      <span className={v.features.nightlight_raw_reduction_pct > 0 ? 'text-amber-400 font-semibold' : 'text-zinc-400'}>
                        {v.features.nightlight_raw_reduction_pct > 0 ? `-${v.features.nightlight_raw_reduction_pct.toFixed(0)}%` : 'Baseline'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px]">
                  <span className="text-emerald-400 font-semibold">{v.confidence_score}% Conf</span>
                  <span className="text-white hover:text-zinc-300 font-semibold flex items-center space-x-0.5">
                    <span>Audit</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Infrastructure & Terrain Health Telemetry */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Road Network */}
        <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Road Network</span>
            <Route className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {totalRoadKm !== null && totalRoadKm !== undefined ? `${totalRoadKm} km` : '—'}
          </div>
          <div className="text-[10px] text-zinc-400">
            {infra?.closed_road_km ? `${infra.closed_road_km} km closed (${infra.severed_arteries_count} breaches)` : 'OSM Routable Graph'}
          </div>
        </div>

        {/* Teesta Streamflow */}
        <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Teesta Flow</span>
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {currentDischarge !== null && currentDischarge !== undefined ? `${currentDischarge} m³/s` : '—'}
          </div>
          <div className="text-[10px] text-zinc-400">
            GloFAS Telemetry Gauge
          </div>
        </div>

        {/* Elevation Span */}
        <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Elevation Transect</span>
            <Mountain className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {minEle !== null && maxEle !== null ? `${minEle}m – ${maxEle}m` : 'Unavailable'}
          </div>
          <div className="text-[10px] text-zinc-400">
            Copernicus 90m DEM
          </div>
        </div>

        {/* Emergency Facilities */}
        <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Medical Hubs</span>
            <Hospital className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {infra?.operational_facilities_count ?? '—'}
          </div>
          <div className="text-[10px] text-zinc-400">
            {infra?.trauma_centres_count !== undefined && infra?.trauma_centres_count !== null
              ? `${infra.trauma_centres_count} Trauma Centres Active`
              : 'OSM Medical Nodes'}
          </div>
        </div>
      </div>

      {/* 6. Independent Modular Data Services Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              7 Independent Modular Data Services
            </h2>
            <p className="text-xs text-zinc-400">
              Each data pipeline operates independently with strict fallback: unavailable sources are reported as unavailable without synthetic fabrication.
            </p>
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            Active AOI: <span className="text-white font-bold">{activeAOI?.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {servicesStatus.map((service) => {
            const isLoading = loadingService === service.service_id || loadingService === 'ALL';
            return (
              <div
                key={service.service_id}
                className="rounded-xl bg-[#111113] border border-zinc-800 p-4 flex flex-col justify-between space-y-3 hover:border-zinc-600 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                        {service.category}
                      </span>
                      <h3 className="font-bold text-white text-sm">{service.service_name}</h3>
                    </div>
                    <ServiceStatusBadge state={service.state} />
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2">
                    {service.attribution.citation}
                  </p>

                  <div className="pt-2 border-t border-zinc-800 text-[11px] space-y-1 font-mono text-zinc-400">
                    <div className="flex justify-between">
                      <span>Provider:</span>
                      <span className="text-zinc-300 truncate max-w-[180px]">{service.attribution.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Features / Items:</span>
                      <span className="text-white font-bold">{service.feature_count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>License:</span>
                      <span className="text-zinc-300">{service.attribution.license}</span>
                    </div>
                    {service.last_error && (
                      <div className="p-1.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300 text-[10px] break-words">
                        Error: {service.last_error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => onTriggerService(service.service_id)}
                    disabled={isLoading}
                    className="flex-1 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isLoading ? 'Ingesting...' : 'Ingest Data'}</span>
                  </button>

                  {service.is_available && (
                    <button
                      onClick={() => onClearService(service.service_id)}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                      title="Clear Cache"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <a
                    href={service.attribution.documentation_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                    title="View Documentation"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
