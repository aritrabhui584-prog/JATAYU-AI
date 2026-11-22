import React, { useState, useEffect } from 'react';
import {
  AOIConfig,
  FloodAnalysisParams,
  FloodAnalysisResult,
  GloFASEarlyWarningResponse,
  RasterSceneRecord,
  ScenarioAnalysisParams,
  TerrainAnalysisResult,
} from '../types';
import * as api from '../api/client';
import { MapViewer, RasterOverlayConfig } from '../components/MapViewer';
import {
  Waves,
  Mountain,
  Sliders,
  Download,
  Play,
  Info,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Layers,
  Compass,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Route,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface FloodAnalysisPageProps {
  activeAOI: AOIConfig | null;
  onOpenAOIModal: () => void;
}

export const FloodAnalysisPage: React.FC<FloodAnalysisPageProps> = ({
  activeAOI,
  onOpenAOIModal,
}) => {
  const [activeTab, setActiveTab] = useState<'observed' | 'terrain' | 'scenario'>('observed');

  // Registered Scenes
  const [scenes, setScenes] = useState<RasterSceneRecord[]>([]);

  // Observed Flood Analysis States
  const [postSceneId, setPostSceneId] = useState<string>('');
  const [preSceneId, setPreSceneId] = useState<string>('');
  const [backscatterThreshold, setBackscatterThreshold] = useState<number>(-16.0);
  const [changeThreshold, setChangeThreshold] = useState<number>(-3.0);
  const [maxSlope, setMaxSlope] = useState<number>(8.0);
  const [maxElevation, setMaxElevation] = useState<number>(1200.0);
  const [minPatchSize, setMinPatchSize] = useState<number>(5);

  const [floodResult, setFloodResult] = useState<FloodAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [floodOverlayOpacity, setFloodOverlayOpacity] = useState(0.85);

  // Terrain Analysis States
  const [terrainResult, setTerrainResult] = useState<TerrainAnalysisResult | null>(null);
  const [terrainMode, setTerrainMode] = useState<'terrain_elevation' | 'terrain_slope' | 'terrain_hillshade'>('terrain_elevation');
  const [terrainOpacity, setTerrainOpacity] = useState(0.8);
  const [isLoadingTerrain, setIsLoadingTerrain] = useState(false);

  // Scenario Analysis States
  const [scenarioStageRise, setScenarioStageRise] = useState<number>(3.0);
  const [scenarioResult, setScenarioResult] = useState<FloodAnalysisResult | null>(null);
  const [isSimulatingScenario, setIsSimulatingScenario] = useState(false);
  const [scenarioOpacity, setScenarioOpacity] = useState(0.85);
  const [earlyWarning, setEarlyWarning] = useState<GloFASEarlyWarningResponse | null>(null);

  // Load Scenes & Initial Data
  useEffect(() => {
    api.fetchRegisteredScenes()
      .then((res) => {
        setScenes(res.scenes);
        const s1Scenes = res.scenes.filter((s) => s.mission === 'Sentinel-1');
        if (s1Scenes.length > 0) {
          const post = s1Scenes.find((s) => s.id.includes('POST') || s.id.includes('20231010')) || s1Scenes[0];
          const pre = s1Scenes.find((s) => (s.id.includes('PRE') || s.id.includes('20230928')) && s.id !== post.id) || (s1Scenes.length > 1 ? s1Scenes.find((s) => s.id !== post.id) : null);
          setPostSceneId(post.id);
          if (pre) {
            setPreSceneId(pre.id);
          }
        }
      })
      .catch((err) => console.error('Failed to load scenes:', err));

    api.fetchEarlyWarningTelemetry()
      .then((ew) => setEarlyWarning(ew))
      .catch((err) => console.warn('GloFAS load error:', err));

    api.fetchLatestFloodAnalysis()
      .then((res) => setFloodResult(res))
      .catch((err) => console.error('Failed to fetch latest flood analysis:', err));

    setIsLoadingTerrain(true);
    api.fetchTerrainAnalysis()
      .then((res) => setTerrainResult(res))
      .catch((err) => console.error('Failed to load terrain analysis:', err))
      .finally(() => setIsLoadingTerrain(false));
  }, []);

  const handleRunFloodAnalysis = async () => {
    if (!postSceneId) return;
    setIsAnalyzing(true);
    try {
      const params: FloodAnalysisParams = {
        post_event_scene_id: postSceneId,
        pre_event_scene_id: preSceneId || undefined,
        backscatter_threshold_db: backscatterThreshold,
        change_threshold_db: changeThreshold,
        slope_max_degrees: maxSlope,
        elevation_max_m: maxElevation,
        min_patch_pixels: minPatchSize,
      };
      const res = await api.runFloodAnalysis(params);
      setFloodResult(res);
    } catch (err: any) {
      alert(`Flood analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunScenario = async () => {
    setIsSimulatingScenario(true);
    try {
      const params: ScenarioAnalysisParams = {
        stage_rise_m: scenarioStageRise,
        aoi_id: activeAOI?.id,
      };
      const res = await api.runScenarioAnalysis(params);
      setScenarioResult(res);
    } catch (err: any) {
      alert(`Scenario simulation failed: ${err.message}`);
    } finally {
      setIsSimulatingScenario(false);
    }
  };

  const currentBounds: [[number, number], [number, number]] =
    floodResult && floodResult.bounds.length === 4
      ? [
          [floodResult.bounds[0], floodResult.bounds[1]],
          [floodResult.bounds[2], floodResult.bounds[3]],
        ]
      : [
          [activeAOI?.bbox.min_lat || 26.5, activeAOI?.bbox.min_lon || 88.25],
          [activeAOI?.bbox.max_lat || 27.75, activeAOI?.bbox.max_lon || 88.85],
        ];

  const getActiveRasterOverlay = (): RasterOverlayConfig | null => {
    if (activeTab === 'observed' && floodResult) {
      return {
        url: api.getFloodRenderUrl('flood_extent', floodResult.id),
        bounds: currentBounds,
        opacity: floodOverlayOpacity,
        visible: true,
      };
    } else if (activeTab === 'terrain' && terrainResult) {
      return {
        url: api.getFloodRenderUrl(terrainMode),
        bounds: currentBounds,
        opacity: terrainOpacity,
        visible: true,
      };
    } else if (activeTab === 'scenario' && scenarioResult) {
      return {
        url: api.getFloodRenderUrl('flood_extent', scenarioResult.id),
        bounds: currentBounds,
        opacity: scenarioOpacity,
        visible: true,
      };
    }
    return null;
  };

  const hypsometryChartData = terrainResult
    ? Object.entries(terrainResult.hypsometry_histogram).map(([zone, count]) => ({
        zone,
        count,
      }))
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Waves className="w-5 h-5 text-white" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Teesta Basin Flood & Terrain Analysis Engine
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real GIS multi-criteria flood classification, DEM hypsometry, terrain slope hazards, and stage simulation.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 p-1 bg-[#111113] border border-zinc-800 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('observed')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'observed'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Observed Flood Extent</span>
          </button>

          <button
            onClick={() => setActiveTab('terrain')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'terrain'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Terrain & Slope Engine</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('scenario');
              if (!scenarioResult) handleRunScenario();
            }}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'scenario'
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Scenario Analysis Tool</span>
          </button>
        </div>
      </div>

      {/* SCIENTIFIC MODEL DISTINCTION BANNER */}
      <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-white font-bold uppercase tracking-wider">
            <Info className="w-4 h-4 text-zinc-300" />
            <span>Rigorous Disaster Intelligence Taxonomy</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            Zero Hallucination Protocol Active
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
            <div className="text-white font-bold flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>1. Observed Historical Extent</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Derived from genuine <b>Copernicus Sentinel-1 C-SAR radar backscatter</b> (&lt; -16 dB), optical indices, and DEM slopes. Reflects real satellite ground observations.
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
            <div className="text-amber-400 font-bold flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>2. Modelled Scenario Extent</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Static topographic stage simulation from DEM capacity ($\Delta h$). <i>Simulates low-lying holding capacity; not a 2D dynamic hydrodynamic wave propagation forecast.</i>
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
            <div className="text-zinc-200 font-bold flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              <span>3. Predicted Future Extent</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Hydrometeorological discharge projection driven by Copernicus GloFAS streamflow and ECMWF weather models.
            </p>
          </div>
        </div>
      </div>

      {/* GLOFAS EARLY-WARNING TELEMETRY BANNER & 14-DAY HYDROGRAPH */}
      {earlyWarning && (
        <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <Waves className="w-4 h-4 text-white" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Live Copernicus GloFAS River Discharge Telemetry
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                earlyWarning.overall_alert_tier === 'CRITICAL'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : earlyWarning.overall_alert_tier === 'WARNING'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {earlyWarning.overall_alert_tier} ALERT
              </span>
            </div>
            <div className="text-xs font-mono text-zinc-400">
              Peak Forecast: <b className="text-white">{earlyWarning.peak_forecast_discharge_m3s} m³/s</b>
            </div>
          </div>

          {/* 3-Reach Hydrometric Station Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {earlyWarning.stations?.map((st) => (
              <div key={st.station_id} className="p-3 rounded-lg bg-black border border-zinc-800 flex flex-col justify-between space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-white text-xs">{st.station_name}</div>
                    <div className="text-[10px] text-zinc-400">{st.role}</div>
                  </div>
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
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Current</span>
                    <span className="text-xs font-bold text-white">{st.current_discharge_m3s ?? 0} m³/s</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">14d Max</span>
                    <span className="text-xs font-bold text-white">{st.peak_forecast_m3s ?? 0} m³/s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 14-Day Discharge Hydrograph Forecast Chart */}
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div className="font-semibold text-white flex items-center space-x-2">
                <Activity className="w-3.5 h-3.5 text-white" />
                <span>14-Day GloFAS Discharge Hydrograph Forecast — Teesta Basin Multi-Reach</span>
              </div>
              <div className="flex items-center space-x-3 text-[10px] font-mono">
                <span className="flex items-center space-x-1 text-white">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  <span>Downstream</span>
                </span>
                <span className="flex items-center space-x-1 text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                  <span>Mid-Corridor</span>
                </span>
                <span className="flex items-center space-x-1 text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                  <span>Upstream</span>
                </span>
              </div>
            </div>

            <div className="h-[280px] w-full min-h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={earlyWarning.timeline || []}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="glofasFloodDownstreamGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="glofasFloodMidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A1A1AA" stopOpacity={0.25} />
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
                    fill="url(#glofasFloodDownstreamGrad)"
                    name="downstream_m3s"
                  />
                  <Area
                    type="monotone"
                    dataKey="mid_corridor_m3s"
                    stroke="#A1A1AA"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#glofasFloodMidGrad)"
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
      )}

      {/* TAB 1: OBSERVED FLOOD EXTENT */}
      {activeTab === 'observed' && (
        <div className="space-y-6">
          {/* Multi-Criteria Parameter Configuration */}
          <div className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-zinc-300" />
                  <span>Configurable Multi-Criteria Classification Parameters</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Filters out mountain radar shadows and permanent rivers while isolating flood inundation.
                </p>
              </div>

              <button
                onClick={handleRunFloodAnalysis}
                disabled={isAnalyzing || !postSceneId}
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center space-x-2 cursor-pointer disabled:opacity-50 shadow-md transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isAnalyzing ? 'Classifying GIS Layers...' : 'Run Flood Classification'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 text-xs">
              {/* Post-event Scene */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-zinc-400 uppercase">Post-Event SAR Scene</label>
                  {scenes.find((s) => s.id === postSceneId)?.geotiff_path ? (
                    <span className="text-[9px] text-emerald-400 font-mono">GeoTIFF Local</span>
                  ) : (
                    <span className="text-[9px] text-amber-400 font-mono">Catalog Only</span>
                  )}
                </div>
                <select
                  value={postSceneId}
                  onChange={(e) => setPostSceneId(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 text-xs focus:border-white focus:outline-none"
                >
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.mission}] {s.id.substring(0, 16)}... {s.geotiff_path ? '✓' : '(STAC)'}
                    </option>
                  ))}
                </select>
                {!scenes.find((s) => s.id === postSceneId)?.geotiff_path && (
                  <p className="text-[9px] text-amber-400/90 leading-tight">
                    * Granule not downloaded yet. Run Modelled Scenario tab below.
                  </p>
                )}
              </div>

              {/* Pre-event Scene (Optional) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-zinc-400 uppercase">Pre-Event Baseline (Optional)</label>
                  {preSceneId && (
                    scenes.find((s) => s.id === preSceneId)?.geotiff_path ? (
                      <span className="text-[9px] text-emerald-400 font-mono">GeoTIFF Local</span>
                    ) : (
                      <span className="text-[9px] text-amber-400 font-mono">Catalog Only</span>
                    )
                  )}
                </div>
                <select
                  value={preSceneId}
                  onChange={(e) => setPreSceneId(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 text-xs focus:border-white focus:outline-none"
                >
                  <option value="">None (Single Post-Event Analysis)</option>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.mission}] {s.id.substring(0, 16)}... {s.geotiff_path ? '✓' : '(STAC)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Water Backscatter Threshold */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>Water σ⁰ Threshold</span>
                  <span className="font-mono text-white">{backscatterThreshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-22"
                  max="-12"
                  step="0.5"
                  value={backscatterThreshold}
                  onChange={(e) => setBackscatterThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Max Slope Angle */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>Max Terrain Slope</span>
                  <span className="font-mono text-white">{maxSlope}°</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  step="0.5"
                  value={maxSlope}
                  onChange={(e) => setMaxSlope(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Max Elevation */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>Elevation Limit</span>
                  <span className="font-mono text-white">{maxElevation}m</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="2000"
                  step="50"
                  value={maxElevation}
                  onChange={(e) => setMaxElevation(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>
          </div>

          {/* Results Summary Cards */}
          {floodResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Flood Extent</div>
                <div className="text-lg font-bold text-white font-mono">
                  {floodResult.flood_inundation_area_sqkm} km²
                </div>
                <div className="text-[10px] text-zinc-500">Inundated Land</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Permanent River</div>
                <div className="text-lg font-bold text-zinc-300 font-mono">
                  {floodResult.permanent_water_area_sqkm} km²
                </div>
                <div className="text-[10px] text-zinc-500">Normal Channel</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Radar Shadows</div>
                <div className="text-lg font-bold text-zinc-400 font-mono">
                  {floodResult.terrain_shadow_area_sqkm} km²
                </div>
                <div className="text-[10px] text-zinc-500">Screened Out</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Submerged Roads</div>
                <div className="text-lg font-bold text-amber-400 font-mono">
                  {floodResult.submerged_roads_length_km} km
                </div>
                <div className="text-[10px] text-zinc-500">Severed Segments</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Inundated Villages</div>
                <div className="text-lg font-bold text-rose-400 font-mono">
                  {floodResult.inundated_settlements_count}
                </div>
                <div className="text-[10px] text-zinc-500">Directly Threatened</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Trunk Breaches</div>
                <div className="text-lg font-bold text-rose-500 font-mono">
                  {floodResult.severed_arteries_count}
                </div>
                <div className="text-[10px] text-zinc-500">NH10 Artery Cuts</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Affected Pop.</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  ~{floodResult.affected_population_estimate.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500">Census Model</div>
              </div>
            </div>
          )}

          {/* Interactive Map & Exports */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Map (8 Cols) */}
            <div className="lg:col-span-8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Waves className="w-4 h-4 text-white" />
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                    Observed Flood Inundation Overlay
                  </h2>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-[11px] text-zinc-400">Opacity:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={floodOverlayOpacity}
                    onChange={(e) => setFloodOverlayOpacity(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                  />
                  <span className="font-mono text-white text-xs">
                    {Math.round(floodOverlayOpacity * 100)}%
                  </span>
                </div>
              </div>

              <div className="relative w-full h-[460px] rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-[#050505]">
                <MapViewer
                  activeAOI={activeAOI}
                  activeBasemap="satellite"
                  layersData={{}}
                  visibleLayers={{ aoi_corridor: true }}
                  rasterOverlay={getActiveRasterOverlay()}
                />

                {/* Floating Map Legend */}
                <div className="absolute bottom-4 right-4 z-[1000] bg-[#111113]/95 backdrop-blur-md border border-zinc-800 rounded-lg p-2.5 space-y-1.5 text-[10px] text-zinc-300 shadow-lg">
                  <div className="font-bold text-white uppercase tracking-wider mb-1">
                    Map Classification
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-white" />
                    <span>Observed Inundation (Flooded Land)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-zinc-600" />
                    <span>Permanent Teesta River Channel</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded bg-zinc-800 border border-zinc-700" />
                    <span>Mountain Radar Shadow (Excluded)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Export & Actions Pane (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Geospatial Exports & Audit
              </h2>

              <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-3">
                <div className="text-xs font-bold text-white">Export Standard Products</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Export genuine georeferenced rasters and vector polygons for external GIS platforms (QGIS, ArcGIS, GDAL).
                </p>

                <div className="space-y-2 pt-1">
                  <a
                    href={api.getFloodExportGeoTIFFUrl(floodResult?.id)}
                    download
                    className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center justify-between cursor-pointer border border-zinc-700 hover:border-white transition"
                  >
                    <span className="flex items-center space-x-2">
                      <Download className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Download Classified GeoTIFF</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">.tif</span>
                  </a>

                  <a
                    href={api.getFloodExportGeoJSONUrl(floodResult?.id)}
                    download
                    className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center justify-between cursor-pointer border border-zinc-700 hover:border-white transition"
                  >
                    <span className="flex items-center space-x-2">
                      <FileCode className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Download Flood GeoJSON</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">.geojson</span>
                  </a>
                </div>

                <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-500 leading-tight">
                  CRS: EPSG:4326 (WGS84). Output values: 0=Dry Land, 1=Permanent Water, 2=Flood Inundation, 3=Radar Shadow.
                </div>
              </div>

              {/* Disclaimer card */}
              <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-1.5 text-xs">
                <div className="flex items-center space-x-1.5 text-zinc-200 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Quality Assurance Verification</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {floodResult?.disclaimer ||
                    'All processing uses real Copernicus Sentinel-1 radar telemetry and SRTM elevation models.'}
                </p>
              </div>
            </div>
          </div>

          {/* Spatial Intersections Tables */}
          {floodResult && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inundated Settlements */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <span>Inundated Settlements ({floodResult.inundated_settlements.length})</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#111113]">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-black border-b border-zinc-800 text-[10px] text-zinc-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Settlement</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Elevation</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Proximity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-[11px]">
                      {floodResult.inundated_settlements.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-zinc-500">
                            No verified settlement points intersect the active flood extent.
                          </td>
                        </tr>
                      ) : (
                        floodResult.inundated_settlements.map((s, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3 font-semibold text-white">{s.name}</td>
                            <td className="py-2.5 px-3 capitalize text-zinc-400">{s.place_type}</td>
                            <td className="py-2.5 px-3 font-mono">{s.elevation_m}m</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  s.isolation_level === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {s.is_directly_flooded ? 'SUBMERGED' : 'SURROUNDED'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-white">
                              {s.water_proximity_m}m
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Submerged Road Networks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
                    <Route className="w-4 h-4 text-amber-400" />
                    <span>Submerged Road Networks ({floodResult.submerged_roads.length})</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#111113]">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-black border-b border-zinc-800 text-[10px] text-zinc-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Road Name</th>
                        <th className="py-2.5 px-3">Class</th>
                        <th className="py-2.5 px-3">Submerged</th>
                        <th className="py-2.5 px-3">Total</th>
                        <th className="py-2.5 px-3 text-right">Artery Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-[11px]">
                      {floodResult.submerged_roads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-zinc-500">
                            No OSM road segments intersect the active flood extent.
                          </td>
                        </tr>
                      ) : (
                        floodResult.submerged_roads.map((r, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/40">
                            <td className="py-2.5 px-3 font-semibold text-white">{r.name}</td>
                            <td className="py-2.5 px-3 uppercase text-zinc-400 font-mono text-[10px]">
                              {r.highway}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-amber-400">
                              {r.submerged_length_km} km
                            </td>
                            <td className="py-2.5 px-3 font-mono text-zinc-400">
                              {r.total_length_km} km
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {r.is_trunk_artery ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  CRITICAL ARTERY CUT
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700">
                                  Local Segment
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TERRAIN & SLOPE ENGINE */}
      {activeTab === 'terrain' && terrainResult && (
        <div className="space-y-6">
          {/* Top Terrain Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase">Min Elevation</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {terrainResult.min_elevation_m}m
              </div>
              <div className="text-[10px] text-zinc-500">North Bengal Plains</div>
            </div>

            <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase">Max Elevation</div>
              <div className="text-lg font-bold text-white font-mono">
                {terrainResult.max_elevation_m}m
              </div>
              <div className="text-[10px] text-zinc-500">Himalayan Ridges</div>
            </div>

            <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase">Mean Slope</div>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {terrainResult.mean_slope_degrees}°
              </div>
              <div className="text-[10px] text-zinc-500">Average Incline</div>
            </div>

            <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase">Flat Floodplain</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {terrainResult.flat_terrain_percent}%
              </div>
              <div className="text-[10px] text-zinc-500">&lt; 5° Slope (Accumulation)</div>
            </div>

            <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase">Moderate Slope</div>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {terrainResult.moderate_terrain_percent}%
              </div>
              <div className="text-[10px] text-zinc-500">5°–15° Runoff Zone</div>
            </div>

            <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase">Steep Cliffs</div>
              <div className="text-lg font-bold text-rose-400 font-mono">
                {terrainResult.steep_terrain_percent}%
              </div>
              <div className="text-[10px] text-zinc-500">&gt; 15° (Radar Shadow Zone)</div>
            </div>
          </div>

          {/* Map Display & Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mountain className="w-4 h-4 text-white" />
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                    Terrain Visualizer: {terrainMode.replace('terrain_', '').toUpperCase()}
                  </h2>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-[11px] text-zinc-400">Opacity:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={terrainOpacity}
                    onChange={(e) => setTerrainOpacity(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                  />
                  <span className="font-mono text-white text-xs">
                    {Math.round(terrainOpacity * 100)}%
                  </span>
                </div>
              </div>

              <div className="relative w-full h-[460px] rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-[#050505]">
                <MapViewer
                  activeAOI={activeAOI}
                  activeBasemap="topo"
                  layersData={{}}
                  visibleLayers={{ aoi_corridor: true }}
                  rasterOverlay={getActiveRasterOverlay()}
                />

                {/* Layer Mode Switcher on Map */}
                <div className="absolute top-3 right-3 z-[1000] bg-[#111113]/95 backdrop-blur-md border border-zinc-800 rounded-lg p-2.5 space-y-1.5 text-xs shadow-xl">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    DEM Visualization
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setTerrainMode('terrain_elevation')}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition cursor-pointer ${
                        terrainMode === 'terrain_elevation'
                          ? 'bg-white text-black font-bold'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      Elevation Relief (Color Ramp)
                    </button>
                    <button
                      onClick={() => setTerrainMode('terrain_slope')}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition cursor-pointer ${
                        terrainMode === 'terrain_slope'
                          ? 'bg-white text-black font-bold'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      Slope Hazard Map (Degrees)
                    </button>
                    <button
                      onClick={() => setTerrainMode('terrain_hillshade')}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition cursor-pointer ${
                        terrainMode === 'terrain_hillshade'
                          ? 'bg-white text-black font-bold'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      Shaded Relief (Hillshade)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Hypsometric Histogram Chart (4 Cols) */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Teesta Basin Hypsometry
              </h2>

              <div className="rounded-xl bg-[#111113] border border-zinc-800 p-4 space-y-3">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Elevation distribution across the river basin. Elevation drops over 2,000 meters across a horizontal distance of ~70 km.
                </p>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hypsometryChartData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" horizontal={false} />
                      <XAxis type="number" stroke="#71717A" tick={{ fontSize: 10 }} />
                      <YAxis
                        dataKey="zone"
                        type="category"
                        stroke="#71717A"
                        tick={{ fontSize: 9 }}
                        width={110}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111113', borderColor: '#27272A', color: '#FFFFFF', fontSize: '11px' }}
                      />
                      <Bar dataKey="count" fill="#FFFFFF" radius={[0, 4, 4, 0]}>
                        {hypsometryChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? '#FFFFFF' : index === 1 ? '#D4D4D8' : index === 2 ? '#A1A1AA' : '#71717A'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
                  Data source: Copernicus DEM 90m (GLO-90) / NASA SRTM. Geodetic Datum: WGS84.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HYPOTHETICAL SCENARIO ANALYSIS TOOL */}
      {activeTab === 'scenario' && (
        <div className="space-y-6">
          {/* Scenario Simulation Controls */}
          <div className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span>Hypothetical River Stage Inundation Simulation</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Simulates low-lying terrain inundation for hypothetical water levels above the normal riverbed.
                </p>
              </div>

              <button
                onClick={handleRunScenario}
                disabled={isSimulatingScenario}
                className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center space-x-2 cursor-pointer disabled:opacity-50 shadow-md transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isSimulatingScenario ? 'Simulating Stage...' : 'Simulate Stage Rise'}</span>
              </button>
            </div>

            {/* Slider */}
            <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-300 font-semibold">
                  Hypothetical River Stage Rise ($\Delta h$ above normal river level):
                </span>
                <span className="text-base font-bold font-mono text-white">
                  +{scenarioStageRise} meters
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10.0"
                step="0.5"
                value={scenarioStageRise}
                onChange={(e) => setScenarioStageRise(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>+0.5m (Bankfull Flow)</span>
                <span>+3.0m (Moderate Overbank)</span>
                <span>+5.0m (Severe Flash Flood)</span>
                <span>+10.0m (GLOF / Catastrophic Cloudburst)</span>
              </div>
            </div>

            {/* MANDATORY DISCLAIMER */}
            <div className="p-3 rounded-lg bg-[#111113] border border-zinc-800 text-xs text-zinc-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-[11px] text-amber-400">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Hydraulic Model Classification & Limitations</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                This scenario analysis is a <b>static DEM elevation stage capacity model</b>. It calculates low-lying elevation contours contiguous to the river channel that would be inundated if water reached the specified stage. <b>It is NOT a 2D dynamic hydrodynamic wave propagation model</b> (such as HEC-RAS or Telemac-2D) and does not calculate velocity vectors or Manning roughness attenuation.
              </p>
            </div>
          </div>

          {/* Scenario Results Banner */}
          {scenarioResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Modelled Inundation</div>
                <div className="text-lg font-bold text-white font-mono">
                  {scenarioResult.flood_inundation_area_sqkm} km²
                </div>
                <div className="text-[10px] text-zinc-500">Stage +{scenarioStageRise}m Capacity</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Potentially Cut Roads</div>
                <div className="text-lg font-bold text-amber-400 font-mono">
                  {scenarioResult.submerged_roads_length_km} km
                </div>
                <div className="text-[10px] text-zinc-500">
                  {scenarioResult.severed_arteries_count > 0 ? 'NH10 Artery Cut' : 'Local Roads'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">Vulnerable Villages</div>
                <div className="text-lg font-bold text-rose-400 font-mono">
                  {scenarioResult.inundated_settlements_count}
                </div>
                <div className="text-[10px] text-zinc-500">Inundated or Surrounded</div>
              </div>

              <div className="p-3 rounded-xl bg-[#111113] border border-zinc-800 space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase">At-Risk Population</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  ~{scenarioResult.affected_population_estimate.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-500">Hypothetical Exposure</div>
              </div>
            </div>
          )}

          {/* Map Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-white" />
                <span>Modelled Scenario Inundation Map (+{scenarioStageRise}m Stage Rise)</span>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-[11px] text-zinc-400">Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={scenarioOpacity}
                  onChange={(e) => setScenarioOpacity(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                />
                <span className="font-mono text-white text-xs">
                  {Math.round(scenarioOpacity * 100)}%
                </span>
              </div>
            </div>

            <div className="relative w-full h-[460px] rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-[#050505]">
              <MapViewer
                activeAOI={activeAOI}
                activeBasemap="satellite"
                layersData={{}}
                visibleLayers={{ aoi_corridor: true }}
                rasterOverlay={getActiveRasterOverlay()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
