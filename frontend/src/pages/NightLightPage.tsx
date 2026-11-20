import React, { useState, useEffect } from 'react';
import {
  Moon,
  AlertCircle,
  Info,
  ShieldAlert,
  Zap,
  Sliders,
  Download,
  RefreshCw,
  Layers,
  MapPin,
  Calendar,
  CloudOff,
  Cloud,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Eye,
  AlertTriangle,
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
  ImageOverlay,
  CircleMarker,
  Popup,
  Tooltip as LeafletTooltip,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  AOIConfig,
  NightlightAnalysisParams,
  NightlightAnalysisResult,
  SpatialCluster,
  VIIRSObservationMetadata,
} from '../types';
import * as api from '../api/client';

interface NightLightPageProps {
  viirsData?: any;
  onRefreshVIIRS?: () => Promise<void>;
  isLoading?: boolean;
  activeAOI?: AOIConfig | null;
}

// Controller to smoothly center or focus on a selected cluster
const MapClusterController: React.FC<{
  selectedCluster: SpatialCluster | null;
}> = ({ selectedCluster }) => {
  const map = useMap();
  useEffect(() => {
    if (!selectedCluster) return;
    map.setView([selectedCluster.centroid_lat, selectedCluster.centroid_lon], 12, { animate: true });
  }, [selectedCluster, map]);

  return null;
};

export const NightLightPage: React.FC<NightLightPageProps> = () => {
  // Phase 5 Analysis State
  const [analysisResult, setAnalysisResult] = useState<NightlightAnalysisResult | null>(null);
  const [observations, setObservations] = useState<VIIRSObservationMetadata[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active UI tab
  const [activeTab, setActiveTab] = useState<'console' | 'clusters' | 'telemetry'>('console');

  // Interactive Map Controls
  const [rasterOpacity, setRasterOpacity] = useState<number>(0.85);
  const [selectedCluster, setSelectedCluster] = useState<SpatialCluster | null>(null);
  const [showDisclaimerDetails, setShowDisclaimerDetails] = useState<boolean>(false);

  // Analysis Parameters
  const [params, setParams] = useState<NightlightAnalysisParams>({
    pre_event_dates: ['2023-10-01', '2023-10-02', '2023-10-03'],
    post_event_date: '2023-10-05',
    min_valid_baseline_obs: 2,
    radiance_reduction_threshold_pct: 40.0,
    min_absolute_drop_nw: 2.5,
    min_cluster_pixels: 3,
    exclude_cloud_pixels: true,
  });

  // Initial Data Fetch
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const [res, obs] = await Promise.all([
        api.fetchLatestNightlightAnalysis(),
        api.fetchVIIRSObservations(),
      ]);
      setAnalysisResult(res);
      setObservations(obs);
      if (res.clusters.length > 0) {
        setSelectedCluster(res.clusters[0]);
      }
    } catch (err: any) {
      console.error('Failed to load nightlight analysis:', err);
      setErrorMsg(err.message || 'Failed loading NASA VIIRS night-light intelligence');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const updated = await api.runNightlightAnalysis(params);
      setAnalysisResult(updated);
      if (updated.clusters.length > 0) {
        setSelectedCluster(updated.clusters[0]);
      } else {
        setSelectedCluster(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Night-light analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Bounds for Map Overlay: [south, west, north, east] -> Leaflet [[south, west], [north, east]]
  const overlayBounds: L.LatLngBoundsExpression = [
    [analysisResult?.bounds[0] ?? 26.75, analysisResult?.bounds[1] ?? 88.35],
    [analysisResult?.bounds[2] ?? 27.05, analysisResult?.bounds[3] ?? 88.65],
  ];

  // Chart data for clusters
  const clusterChartData = analysisResult?.clusters.map((c) => ({
    name: `C${c.cluster_id}: ${c.approximate_region.split('/')[0]}`,
    dropPct: c.mean_radiance_drop_pct,
    area: c.area_sqkm,
    pixels: c.pixel_count,
  })) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-800/60 text-purple-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <span>NASA VIIRS Black Marble VNP46A2 Night-Light Intelligence</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300">
                  Phase 5 Engine
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                BRDF-corrected nighttime radiance, Mandatory_Quality_Flag cloud screening, multi-temporal baseline comparison, and 500m resolution spatial clustering.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <a
            href={api.getNightlightExportGeoTIFFUrl(analysisResult?.id)}
            download
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export GeoTIFF</span>
          </a>

          <a
            href={api.getNightlightExportGeoJSONUrl(analysisResult?.id)}
            download
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export GeoJSON</span>
          </a>

          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-purple-950/50 disabled:opacity-50 cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'Processing HDF5...' : 'Run Night-Light Engine'}</span>
          </button>
        </div>
      </div>

      {/* Mandatory Scientific Attribution & 500m Resolution Banner */}
      <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/70 text-purple-200 text-xs space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-100 flex items-center space-x-2">
                <span>SCIENTIFIC CAUSAL ATTRIBUTION & SENSOR RESOLUTION NOTICE</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.2 rounded bg-purple-900 border border-purple-700 text-purple-200">
                  15 Arc-Sec (~500m) Resolution
                </span>
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                NASA VIIRS Day/Night Band operates at <strong>~500m pixel resolution</strong> (15 arc-seconds equal-angle grid). It cannot resolve individual village houses or pinpoint single streetlights. Night-light radiance reduction indicates <strong>surface luminance drop</strong>, which may stem from power grid severance, but also emergency evacuation curfews, commercial shutdowns, water surface reflectance changes, or aerosol scattering. Cloudy, missing, and poor-quality pixels (<code>Mandatory_Quality_Flag ≥ 2</code>) are strictly masked and <strong>never classified as blackouts</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDisclaimerDetails(!showDisclaimerDetails)}
            className="text-purple-300 hover:text-white text-xs underline cursor-pointer shrink-0 ml-3"
          >
            {showDisclaimerDetails ? 'Hide Details' : 'Read Methodology'}
          </button>
        </div>

        {showDisclaimerDetails && (
          <div className="pt-2 border-t border-purple-800/60 text-[11px] text-slate-300 space-y-1 font-mono">
            <div>• Sensor: VIIRS Day/Night Band on Suomi-NPP / NOAA-20</div>
            <div>• Product: NASA Black Marble Daily Moonlight-adjusted BRDF-Corrected NTL (VNP46A2)</div>
            <div>• Quality Control: Mandatory_Quality_Flag (0: High Quality, 1: Good, 2: Poor, 255: Cloud/Fill)</div>
            <div>• Spatial Cluster Filter: scipy.ndimage 8-connected component filter requiring ≥ 3 contiguous 500m pixels (~0.66 km²)</div>
          </div>
        )}
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

      {/* Telemetry KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
            Spatial Resolution
          </span>
          <div className="text-xl font-bold text-slate-100 font-mono">
            ~500 <span className="text-xs text-slate-400 font-normal">m</span>
          </div>
          <span className="text-[10px] text-slate-400 block font-mono">
            15 arc-sec / 0.22 km² px
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-purple-400 block font-semibold">
            Baseline Window
          </span>
          <div className="text-xl font-bold text-purple-400 font-mono">
            {analysisResult?.pre_event_dates.length ?? '--'} <span className="text-xs text-purple-300 font-normal">Days</span>
          </div>
          <span className="text-[10px] text-purple-400/80 block">
            Multi-temporal median
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-cyan-400 block font-semibold">
            Valid Post Pixels
          </span>
          <div className="text-xl font-bold text-cyan-400 font-mono">
            {analysisResult?.valid_post_pixels ? analysisResult.valid_post_pixels.toLocaleString() : '--'}
          </div>
          <span className="text-[10px] text-cyan-500/80 block">
            Cloud-free observations
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-indigo-400 block font-semibold">
            Cloud Filtered
          </span>
          <div className="text-xl font-bold text-indigo-400 font-mono">
            {analysisResult?.cloud_obscured_pixels ? analysisResult.cloud_obscured_pixels.toLocaleString() : '0'}
          </div>
          <span className="text-[10px] text-indigo-400/80 block">
            Excluded from blackouts
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-rose-400 block font-semibold">
            Significant Reduction
          </span>
          <div className="text-xl font-bold text-rose-400 font-mono flex items-center space-x-1">
            <span>{analysisResult?.reduction_area_sqkm ?? '--'}</span>
            <span className="text-xs font-normal text-rose-300">km²</span>
          </div>
          <span className="text-[10px] text-rose-400/80 block">
            {analysisResult?.significant_reduction_pixels ?? '--'} contiguous pixels
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-amber-400 block font-semibold">
            Spatial Clusters
          </span>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {analysisResult?.clusters_count ?? 0}
          </div>
          <span className="text-[10px] text-amber-500/80 block">
            Regional anomaly groups
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'console'
              ? 'border-purple-400 text-purple-300 bg-purple-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Interactive Map & Anomaly Detection</span>
        </button>

        <button
          onClick={() => setActiveTab('clusters')}
          className={`px-4 py-2 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'clusters'
              ? 'border-purple-400 text-purple-300 bg-purple-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Spatial Disruption Clusters ({analysisResult?.clusters.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'telemetry'
              ? 'border-purple-400 text-purple-300 bg-purple-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>VIIRS Observations Catalog & Quality Telemetry ({observations.length})</span>
        </button>
      </div>

      {/* TAB 1: INTERACTIVE MAP & DETECTION CONSOLE */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Map Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl relative">
                {/* Map Control Bar */}
                <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                      <Moon className="w-3.5 h-3.5 text-purple-400" />
                      <span>VIIRS VNP46A2 500m Raster Overlay</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Post-Event Date: {analysisResult?.post_event_date}
                    </span>
                  </div>

                  {/* Opacity Slider */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">Opacity:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={rasterOpacity}
                      onChange={(e) => setRasterOpacity(parseFloat(e.target.value))}
                      className="w-20 accent-purple-500 cursor-pointer"
                    />
                    <span className="font-mono text-[10px] text-purple-300 font-bold">
                      {Math.round(rasterOpacity * 100)}%
                    </span>
                  </div>
                </div>

                {/* Leaflet Map */}
                <div className="h-[520px] w-full relative">
                  <MapContainer
                    center={[26.90, 88.50]}
                    zoom={11}
                    scrollWheelZoom={true}
                    className="h-full w-full bg-slate-950"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://carto.com/">CartoDB</a> Dark Matter'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    <ScaleControl position="bottomleft" />
                    <MapClusterController selectedCluster={selectedCluster} />

                    {/* Nightlight RGBA Overlay */}
                    {analysisResult?.id && (
                      <ImageOverlay
                        url={api.getNightlightRenderUrl(analysisResult.id)}
                        bounds={overlayBounds}
                        opacity={rasterOpacity}
                      />
                    )}

                    {/* Significant Cluster Centroid Markers */}
                    {analysisResult?.clusters.map((c) => (
                      <CircleMarker
                        key={`cluster-marker-${c.cluster_id}`}
                        center={[c.centroid_lat, c.centroid_lon]}
                        radius={9}
                        pathOptions={{
                          color: '#f97316',
                          fillColor: '#ef4444',
                          fillOpacity: 0.9,
                          weight: 2,
                        }}
                        eventHandlers={{
                          click: () => setSelectedCluster(c),
                        }}
                      >
                        <Popup>
                          <div className="text-xs p-1 space-y-1 text-slate-900">
                            <div className="font-bold text-rose-600 flex items-center space-x-1">
                              <Zap className="w-3.5 h-3.5" />
                              <span>Cluster {c.cluster_id}: {c.approximate_region}</span>
                            </div>
                            <div><strong>Area:</strong> {c.area_sqkm} km² ({c.pixel_count} contiguous 500m px)</div>
                            <div><strong>Radiance Drop:</strong> <span className="text-rose-600 font-bold">{c.mean_radiance_drop_pct}%</span></div>
                            <div><strong>Baseline:</strong> {c.mean_baseline_radiance} nW → <strong>Post:</strong> {c.mean_post_radiance} nW</div>
                            <div className="text-[10px] text-slate-500 italic mt-1">
                              Notice: 500m footprint. May reflect grid outage, curfew, or floodwater quenching.
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>

                {/* Map Legend Bar */}
                <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-[10px] text-slate-300 gap-2">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" />
                      <span>Significant Light Reduction Cluster (&gt;40% drop, ≥3 px)</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded-sm bg-purple-600 inline-block" />
                      <span>Cloud Obscured / Poor Quality (Class 254 - NOT a blackout)</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded-sm bg-cyan-400 inline-block" />
                      <span>Normal Nocturnal Lighting</span>
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">
                    Grid: 15" Equal-Angle
                  </span>
                </div>
              </div>

              {/* Selected Cluster Detail Banner */}
              {selectedCluster && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                        <Zap className="w-4 h-4 text-rose-400" />
                        <span>Spatial Cluster {selectedCluster.cluster_id}: {selectedCluster.approximate_region}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Centroid: [{selectedCluster.centroid_lat}, {selectedCluster.centroid_lon}] | Bounding Area: {selectedCluster.area_sqkm} km²
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Baseline</span>
                        <span>{selectedCluster.mean_baseline_radiance} nW</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Post-Disaster</span>
                        <span className="font-bold">{selectedCluster.mean_post_radiance} nW</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Radiance Loss</span>
                        <span className="text-rose-400 font-bold">-{selectedCluster.mean_radiance_drop_pct}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Parameters & Cluster Bar Chart */}
            <div className="space-y-4">
              {/* Detection Parameter Sliders */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider flex items-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Detection Parameters</span>
                </span>

                {/* Post Event Date Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Post-Event Observation Date
                  </label>
                  <select
                    value={params.post_event_date}
                    onChange={(e) => setParams({ ...params, post_event_date: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-purple-500 font-mono"
                  >
                    <option value="2023-10-05">2023-10-05 (Cloud-Free Post-Flood Observation)</option>
                    <option value="2023-10-04">2023-10-04 (Cloudy Peak Storm — Cloud Screening Test)</option>
                  </select>
                </div>

                {/* Radiance Reduction Threshold Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">Min Radiance Reduction %</span>
                    <span className="font-mono text-purple-400 font-bold">{params.radiance_reduction_threshold_pct}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    step="5"
                    value={params.radiance_reduction_threshold_pct}
                    onChange={(e) => setParams({ ...params, radiance_reduction_threshold_pct: parseFloat(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                {/* Min Absolute Drop Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">Min Absolute Radiance Drop</span>
                    <span className="font-mono text-purple-400 font-bold">{params.min_absolute_drop_nw} nW</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={params.min_absolute_drop_nw}
                    onChange={(e) => setParams({ ...params, min_absolute_drop_nw: parseFloat(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Prevents dark forest flicker from triggering anomalies
                  </span>
                </div>

                {/* Min Cluster Size Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold">Min Spatial Cluster Size</span>
                    <span className="font-mono text-purple-400 font-bold">{params.min_cluster_pixels} px (~{(params.min_cluster_pixels ?? 3) * 0.22} km²)</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={params.min_cluster_pixels}
                    onChange={(e) => setParams({ ...params, min_cluster_pixels: parseInt(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Rejects isolated 500m noise pixels
                  </span>
                </div>

                <button
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>Update Detection Criteria</span>
                </button>
              </div>

              {/* Chart of Detected Clusters */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-200 block uppercase tracking-wider">
                  Cluster Disruption Severity (%)
                </span>
                {clusterChartData.length > 0 ? (
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={clusterChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                          }}
                        />
                        <Bar dataKey="dropPct" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 font-mono">
                    Zero disruption clusters detected under current parameters or heavy cloud cover.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SPATIAL DISRUPTION CLUSTERS */}
      {activeTab === 'clusters' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-rose-400" />
                <span>Statistically Significant Spatial Light Reduction Clusters</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Contiguous groups of 500m VIIRS DNB pixels experiencing severe luminance reduction relative to pre-disaster median baseline.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Cluster ID</th>
                    <th className="py-2.5 px-3">Regional Sector</th>
                    <th className="py-2.5 px-3">Area (km²)</th>
                    <th className="py-2.5 px-3">Pixel Count (~500m)</th>
                    <th className="py-2.5 px-3">Baseline Radiance</th>
                    <th className="py-2.5 px-3">Post Radiance</th>
                    <th className="py-2.5 px-3">Mean Reduction %</th>
                    <th className="py-2.5 px-3">Centroid [Lat, Lon]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {analysisResult?.clusters.map((c) => (
                    <tr
                      key={c.cluster_id}
                      onClick={() => {
                        setSelectedCluster(c);
                        setActiveTab('console');
                      }}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-200">
                        Cluster {c.cluster_id}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300 font-semibold">
                        {c.approximate_region}
                      </td>
                      <td className="py-2.5 px-3 text-rose-400 font-bold">{c.area_sqkm} km²</td>
                      <td className="py-2.5 px-3 text-slate-300">{c.pixel_count} px</td>
                      <td className="py-2.5 px-3 text-slate-400">{c.mean_baseline_radiance} nW</td>
                      <td className="py-2.5 px-3 text-slate-300">{c.mean_post_radiance} nW</td>
                      <td className="py-2.5 px-3 font-bold text-rose-400">
                        -{c.mean_radiance_drop_pct}%
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        [{c.centroid_lat}, {c.centroid_lon}]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: VIIRS OBSERVATIONS & QUALITY TELEMETRY */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>NASA Black Marble VNP46A2 HDF5 Product Catalog & Quality Telemetry</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact observation dates, Mandatory_Quality_Flag cloud screening, and valid-pixel distribution for the Teesta corridor.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Julian Scene ID</th>
                    <th className="py-2.5 px-3">Total Pixels</th>
                    <th className="py-2.5 px-3">Valid Pixels</th>
                    <th className="py-2.5 px-3">Cloud Masked</th>
                    <th className="py-2.5 px-3">Poor Quality</th>
                    <th className="py-2.5 px-3">Mean Radiance</th>
                    <th className="py-2.5 px-3">Quality Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {observations.map((obs) => (
                    <tr key={obs.scene_id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-200">
                        {obs.date}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{obs.scene_id}</td>
                      <td className="py-2.5 px-3 text-slate-400">{obs.total_pixels}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">
                        {obs.valid_pixels}
                      </td>
                      <td className="py-2.5 px-3 text-indigo-400 font-bold">
                        {obs.cloud_pixels}
                      </td>
                      <td className="py-2.5 px-3 text-amber-400">{obs.poor_quality_pixels}</td>
                      <td className="py-2.5 px-3 text-cyan-300 font-bold">
                        {obs.mean_radiance} nW
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        {obs.cloud_pixels > 1000 ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 text-[10px] font-bold">
                            Cloud Obscured
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold">
                            Clear / Valid
                          </span>
                        )}
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
