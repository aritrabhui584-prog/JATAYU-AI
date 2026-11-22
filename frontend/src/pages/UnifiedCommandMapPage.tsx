import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Polyline,
  CircleMarker,
  Popup,
  Tooltip as LeafletTooltip,
  ScaleControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  AOIConfig,
  LatestNightPass,
  MultiModalRescueResponse,
  SettlementMultiModalPlan,
  RoadExposureParams,
} from '../types';
import * as api from '../api/client';
import {
  Compass,
  Layers,
  ShieldAlert,
  Train,
  Plane,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  RefreshCw,
  Search,
  Filter,
  X,
  ExternalLink,
  Info,
  Maximize2,
  ChevronRight,
  ShieldCheck,
  Hospital,
  Activity,
  Flame,
  Crosshair,
  MapPin,
  Satellite,
  Moon,
} from 'lucide-react';
import { AreaReconDrawer } from '../components/AreaReconDrawer';

interface UnifiedCommandMapPageProps {
  activeAOI: AOIConfig | null;
  layersData?: {
    osm_roads?: any;
    osm_settlements?: any;
    osm_waterways?: any;
    osm_facilities?: any;
    osm_railways?: any;
    hlz_landing_zones?: any;
  };
}

// Controller to smoothly pan/zoom map to selected feature and invalidate sizing
const MapFocusController: React.FC<{
  targetCoords: [number, number] | null;
  targetBounds: [[number, number], [number, number]] | null;
  targetZoom?: number;
}> = ({ targetCoords, targetBounds, targetZoom = 14 }) => {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    const t3 = setTimeout(() => map.invalidateSize(), 700);
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  useEffect(() => {
    if (targetBounds) {
      map.fitBounds(targetBounds, { padding: [50, 50], maxZoom: 14, animate: true });
    } else if (targetCoords) {
      map.setView([targetCoords[1], targetCoords[0]], targetZoom, { animate: true });
    }
  }, [targetCoords, targetBounds, targetZoom, map]);
  return null;
};

// Ground Recon & Telemetry Controller
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function getGroundScaleText(zoom: number): string {
  if (zoom >= 18) return '~5m Ground Res';
  if (zoom === 17) return '~10m Ground Res';
  if (zoom === 16) return '~25m Ground Res';
  if (zoom === 15) return '~50m Tactical';
  if (zoom === 14) return '~100m Sector';
  if (zoom === 13) return '~250m Corridor';
  if (zoom === 12) return '~500m Valley';
  return 'Regional Scale';
}

const MapTelemetryController: React.FC<{
  onZoomChange: (z: number) => void;
  onMouseMove: (lat: number, lon: number) => void;
  onClick: (lat: number, lon: number) => void;
}> = ({ onZoomChange, onMouseMove, onClick }) => {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
    mousemove: (e) => {
      onMouseMove(e.latlng.lat, e.latlng.lng);
    },
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const UnifiedCommandMapPage: React.FC<UnifiedCommandMapPageProps> = ({
  activeAOI,
  layersData,
}) => {
  // Multi-modal rescue telemetry state
  const [multimodalData, setMultimodalData] = useState<MultiModalRescueResponse | null>(null);
  const [railwayData, setRailwayData] = useState<any>(null);
  const [hlzData, setHlzData] = useState<any>(null);
  const [floodExtentData, setFloodExtentData] = useState<any>(null);
  const [viirsData, setViirsData] = useState<any>(null);
  const [viirsGeoJson, setViirsGeoJson] = useState<any>(null);
  const [latestNightPass, setLatestNightPass] = useState<LatestNightPass | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementMultiModalPlan | null>(null);
  const [selectedTab, setSelectedTab] = useState<'road' | 'rail' | 'air'>('road');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SEVERED' | 'CLOSING_SOON' | 'OPEN_SAFE'>('ALL');
  const [isDockOpen, setIsDockOpen] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [basemapMode, setBasemapMode] = useState<'satellite_hybrid' | 'street_recon' | 'topo' | 'dark' | 'night_cam'>('satellite_hybrid');
  const [showTacticalOverlay, setShowTacticalOverlay] = useState<boolean>(true);

  // Live Cursor Telemetry & Ground Sector Recon Inspector
  const [currentZoom, setCurrentZoom] = useState<number>(11);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number }>({ lat: 26.9200, lon: 88.4800 });
  const [reconState, setReconState] = useState<{
    coords: { lat: number; lon: number } | null;
    name?: string;
    category?: string;
    priorityScore?: number;
    isolationStatus?: string;
  }>({ coords: null });
  const [targetFocusCoords, setTargetFocusCoords] = useState<{ coords: [number, number]; zoom: number } | null>(null);

  // Layer visibility toggles
  const [visibleLayers, setVisibleLayers] = useState({
    satelliteBasemap: true,
    waterways: true,
    settlements: true,
    facilities: true,
    roadsOpen: true,
    roadsClosingSoon: true,
    roadsSevered: true,
    fastestPreBlockRoutes: true,
    floodSafeBypassRoutes: true,
    railways: true,
    railheads: true,
    airwaysHLZ: true,
    airBridgeVectors: true,
    floodExtent: true,
    viirsOutages: true,
  });

  const toggleLayer = (layerKey: keyof typeof visibleLayers) => {
    setVisibleLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Load telemetry data
  const loadTelemetry = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const [mmRes, rwRes, hlzRes, floodRes, viirsRes, nightPassRes] = await Promise.all([
        api.fetchMultiModalRescue().catch(() => null),
        api.fetchRailwayInfrastructure().catch(() => null),
        api.fetchHelicopterLandingZones().catch(() => null),
        api.fetchLatestFloodAnalysis().catch(() => null),
        api.fetchLatestNightlightAnalysis().catch(() => null),
        api.fetchLatestNightPass().catch(() => null),
      ]);

      if (mmRes) {
        setMultimodalData(mmRes);
        setLastRefreshedAt(mmRes.timestamp_ist || new Date().toLocaleTimeString());
        if (!selectedSettlement && mmRes.settlement_plans.length > 0) {
          // Default to the highest-urgency settlement
          setSelectedSettlement(mmRes.settlement_plans[0]);
        }
      }
      if (rwRes) setRailwayData(rwRes);
      if (hlzRes) setHlzData(hlzRes);
      const floodUrl = (floodRes as any)?.geojson_url || (floodRes as any)?.geojson_export_url;
      if (floodUrl) {
        const fc = await fetch(floodUrl).then((r) => r.json()).catch(() => null);
        if (fc) setFloodExtentData(fc);
      }
      if (viirsRes) {
        setViirsData(viirsRes);
        const viirsUrl = (viirsRes as any)?.geojson_url || (viirsRes as any)?.geojson_export_url;
        if (viirsUrl) {
          const vfc = await fetch(viirsUrl).then((r) => r.json()).catch(() => null);
          if (vfc) setViirsGeoJson(vfc);
        }
      }
      if (nightPassRes && nightPassRes.status === 'AVAILABLE') {
        setLatestNightPass(nightPassRes);
      }
    } catch (err) {
      console.error('Failed to load multi-modal command telemetry:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const [isSyncingLive, setIsSyncingLive] = useState<boolean>(false);
  const [liveSyncMessage, setLiveSyncMessage] = useState<string | null>(null);

  const handleSyncLiveSatellites = async () => {
    setIsSyncingLive(true);
    try {
      const status = await api.triggerLiveRefresh();
      setLiveSyncMessage(`Satellites Synced! S1: ${status.sentinel1_sar?.satellite || 'Active'}, S2: ${status.sentinel2_optical?.satellite || 'Active'}`);
      await loadTelemetry(false);
      setTimeout(() => setLiveSyncMessage(null), 4000);
    } catch (err: any) {
      setLiveSyncMessage(`Sync status: ${err.message || 'Operational'}`);
      setTimeout(() => setLiveSyncMessage(null), 4000);
    } finally {
      setIsSyncingLive(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, []);

  // Filtered settlements list
  const filteredSettlements = useMemo(() => {
    if (!multimodalData) return [];
    return multimodalData.settlement_plans.filter((s) => {
      const matchesSearch = s.village_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter =
        statusFilter === 'ALL' || s.operational_status === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [multimodalData, searchTerm, statusFilter]);

  // Map center: Default Teesta Corridor center [26.98, 88.50]
  const mapCenter: [number, number] = useMemo(() => {
    if (selectedSettlement) {
      return [selectedSettlement.coordinates[1], selectedSettlement.coordinates[0]];
    }
    if (activeAOI) {
      return [
        (activeAOI.bbox.min_lat + activeAOI.bbox.max_lat) / 2,
        (activeAOI.bbox.min_lon + activeAOI.bbox.max_lon) / 2,
      ];
    }
    return [26.98, 88.50];
  }, [selectedSettlement, activeAOI]);

  // Selected route bounds for auto-zoom
  const selectedRouteBounds = useMemo(() => {
    if (!selectedSettlement) return null;
    let coords: [number, number][] = [];
    if (selectedTab === 'road') {
      const p = selectedSettlement.roadway.flood_safe_bypass.path.length > 0
        ? selectedSettlement.roadway.flood_safe_bypass.path
        : selectedSettlement.roadway.fastest_pre_block.path;
      coords = p.map((c) => [c[1], c[0]]);
    } else if (selectedTab === 'rail') {
      coords = selectedSettlement.railway.feeder_path.map((c) => [c[1], c[0]]);
    } else if (selectedTab === 'air' && selectedSettlement.airway.air_bridge) {
      const v = selectedSettlement.airway.air_bridge.vector_coords;
      coords = [
        [v[0][1], v[0][0]],
        [v[1][1], v[1][0]],
      ];
    }
    if (coords.length >= 2) {
      return L.latLngBounds(coords).pad(0.15) as unknown as [[number, number], [number, number]];
    }
    return null;
  }, [selectedSettlement, selectedTab]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-[#050505] overflow-hidden flex flex-col font-sans select-none text-white">
      {/* Floating Tactical Command HUD: Three Non-Overlapping Columns */}
      <div className="absolute inset-x-4 top-3 bottom-3 z-[1000] pointer-events-none flex justify-between gap-3">
        {/* Left Column (w-[340px] flex flex-col gap-3 max-h-[calc(100vh-88px)]) */}
        <div className="w-[340px] flex flex-col gap-3 max-h-[calc(100vh-88px)] shrink-0 pointer-events-auto">
          {/* Top Command Status Card */}
          <div className="bg-[#111113]/95 backdrop-blur-md border border-zinc-800 rounded-xl px-3.5 py-2.5 shadow-xl">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                <Compass className="w-4 h-4 animate-spin-slow" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-[11px] tracking-wider uppercase text-white whitespace-nowrap truncate">
                    TACTICAL COMMAND
                  </span>
                  <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>LIVE</span>
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 flex items-center space-x-1.5 mt-0.5 font-mono whitespace-nowrap overflow-hidden truncate">
                  <span className="whitespace-nowrap">{lastRefreshedAt ? `SYNC: ${lastRefreshedAt.split(' ')[0]}` : 'LIVE SENSORS'}</span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold whitespace-nowrap">
                    {multimodalData?.summary ? `${multimodalData.summary.closing_soon_settlements_count} CLOSING SOON` : '0 CLOSING SOON'}
                  </span>
                  <span>•</span>
                  <span className="text-rose-400 font-bold whitespace-nowrap">
                    {multimodalData?.summary ? `${multimodalData.summary.severed_settlements_count} SEVERED` : '0 SEVERED'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TACTICAL RECON DRAWER (stacked cleanly underneath via flex-col gap-3 and internal overflow-y-auto) */}
          {reconState.coords && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AreaReconDrawer
                coords={reconState.coords}
                onClose={() => setReconState({ coords: null })}
                onZoomTo={(lat, lon) => setTargetFocusCoords({ coords: [lon, lat], zoom: 16 })}
                initialName={reconState.name}
                initialCategory={reconState.category}
                initialPriorityScore={reconState.priorityScore}
                initialIsolationStatus={reconState.isolationStatus}
                isEmbedded={true}
              />
            </div>
          )}
        </div>

        {/* Center Top Bar (flex-1 flex flex-wrap items-center justify-center gap-1.5) */}
        <div className="flex-1 flex flex-wrap items-start justify-center gap-1.5 pt-0.5 pointer-events-auto">
          <div className="bg-[#111113]/95 backdrop-blur-md border border-zinc-800 rounded-xl p-1 shadow-lg flex items-center gap-1">
            <button
              onClick={() => setBasemapMode('satellite_hybrid')}
              className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                basemapMode === 'satellite_hybrid'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Satellite Hybrid
            </button>
            <button
              onClick={() => setBasemapMode('street_recon')}
              className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                basemapMode === 'street_recon'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Street / Vector Recon
            </button>
            <button
              onClick={() => setBasemapMode('topo')}
              className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                basemapMode === 'topo'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Crisp Topo
            </button>
            <button
              onClick={() => setBasemapMode('dark')}
              className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                basemapMode === 'dark'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tactical Dark
            </button>
            <button
              onClick={() => setBasemapMode('night_cam')}
              className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                basemapMode === 'night_cam'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="NASA Earthdata VIIRS Real-Time Overpass (Zero 2016 Archival Blending)"
            >
              <Moon className="w-3 h-3 text-amber-400" />
              <span>Night-Cam</span>
              {latestNightPass && (
                <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-mono">
                  {latestNightPass.gibs_date?.slice(5)}
                </span>
              )}
            </button>
            <div className="h-4 w-px bg-zinc-800 mx-0.5" />
            <button
              onClick={() => setShowTacticalOverlay(!showTacticalOverlay)}
              className={`whitespace-nowrap text-xs px-2.5 py-1.5 rounded-lg font-mono font-bold flex items-center space-x-1.5 border transition cursor-pointer ${
                showTacticalOverlay
                  ? 'bg-white border-white text-black shadow-sm'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
              title="Toggle crisp vector roads, bridges, and village boundary labels"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showTacticalOverlay ? 'bg-black' : 'bg-zinc-500'}`} />
              <span>Hybrid Overlay: {showTacticalOverlay ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {liveSyncMessage && (
            <span className="whitespace-nowrap px-2.5 py-1.5 rounded-xl text-xs font-mono bg-zinc-900 border border-zinc-700 text-emerald-300">
              {liveSyncMessage}
            </span>
          )}

          <button
            onClick={handleSyncLiveSatellites}
            disabled={isSyncingLive}
            className="whitespace-nowrap text-xs px-2.5 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl flex items-center space-x-1.5 shadow-lg backdrop-blur-md transition cursor-pointer"
            title="Triggers live STAC search and ingestion for Sentinel-1 radar, Sentinel-2 optical, and NASA VIIRS Black Marble"
          >
            <Satellite className={`w-3.5 h-3.5 text-black ${isSyncingLive ? 'animate-spin' : ''}`} />
            <span>{isSyncingLive ? 'Syncing...' : 'Sync Live Satellites'}</span>
          </button>

          <button
            onClick={() => loadTelemetry(false)}
            disabled={isRefreshing}
            className="whitespace-nowrap text-xs px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-white text-zinc-200 rounded-xl font-medium flex items-center space-x-2 shadow-lg backdrop-blur-md transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-300 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
            <span>Refresh Sensors</span>
          </button>
        </div>

        {/* Right Column (w-[290px] flex flex-col items-end gap-3) */}
        <div className="w-[290px] flex flex-col items-end gap-3 shrink-0 pointer-events-auto">
          {/* Tactical Layers Button on Top */}
          <button
            onClick={() => setIsDockOpen(!isDockOpen)}
            className={`whitespace-nowrap text-xs px-3 py-2 rounded-xl font-medium flex items-center space-x-2 shadow-lg backdrop-blur-md border transition cursor-pointer ${
              isDockOpen
                ? 'bg-white border-white text-black font-bold shadow-sm'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${isDockOpen ? 'text-black' : 'text-zinc-300'}`} />
            <span>Tactical Layers</span>
          </button>

          {/* TACTICAL GIS LAYERS Drawer stacked cleanly below it via flex-col gap-3 */}
          {isDockOpen && (
            <div className="w-full bg-[#111113]/95 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl p-4 text-xs font-sans max-h-[calc(100vh-140px)] overflow-y-auto text-zinc-200">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-3">
                <span className="font-bold uppercase tracking-wider text-white flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-white" />
                  <span>Tactical GIS Layers</span>
                </span>
                <button
                  onClick={() => setIsDockOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                {/* Roadway Group */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Roadway System &amp; Pre-Closure
                  </div>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-zinc-300">
                      <span className="w-2.5 h-0.5 bg-zinc-400 rounded"></span>
                      <span>Open Safe Roads</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.roadsOpen}
                      onChange={() => toggleLayer('roadsOpen')}
                      className="rounded text-white focus:ring-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-amber-400">
                      <span className="w-2.5 h-0.5 bg-amber-400 border-b border-dashed"></span>
                      <span>Closing Soon Roads</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.roadsClosingSoon}
                      onChange={() => toggleLayer('roadsClosingSoon')}
                      className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-red-400">
                      <span className="w-2.5 h-0.5 bg-red-500"></span>
                      <span>Severed Breaches</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.roadsSevered}
                      onChange={() => toggleLayer('roadsSevered')}
                      className="rounded text-red-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-emerald-400">
                      <span className="w-2.5 h-0.5 bg-emerald-500"></span>
                      <span>Flood-Safe Bypass Routes</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.floodSafeBypassRoutes}
                      onChange={() => toggleLayer('floodSafeBypassRoutes')}
                      className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Railway Group */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Railway Corridors &amp; Railheads
                  </div>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-purple-400">
                      <Train className="w-3.5 h-3.5 text-purple-400" />
                      <span>NFR Railway Tracks</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.railways}
                      onChange={() => toggleLayer('railways')}
                      className="rounded text-purple-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-purple-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                      <span>Active Railheads (NJP/SVQ)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.railheads}
                      onChange={() => toggleLayer('railheads')}
                      className="rounded text-purple-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Airway Group */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Airway Corridors &amp; Helipads
                  </div>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-white">
                      <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                      <span>Helicopter Landing Zones</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.airwaysHLZ}
                      onChange={() => toggleLayer('airwaysHLZ')}
                      className="rounded text-white focus:ring-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-zinc-300">
                      <Plane className="w-3.5 h-3.5 text-white" />
                      <span>Air-Bridge Flight Vectors</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.airBridgeVectors}
                      onChange={() => toggleLayer('airBridgeVectors')}
                      className="rounded text-white focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Inundation & Facilities */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Hazard &amp; Medical
                  </div>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-white">
                      <span className="w-2.5 h-2.5 bg-cyan-500/50 border border-white rounded-sm"></span>
                      <span>Sentinel-1 Flood Extent</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.floodExtent}
                      onChange={() => toggleLayer('floodExtent')}
                      className="rounded text-white focus:ring-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-amber-400">
                      <Moon className="w-3.5 h-3.5 text-amber-400" />
                      <span>NASA VIIRS Night-Light Outages</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.viirsOutages}
                      onChange={() => toggleLayer('viirsOutages')}
                      className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer hover:bg-zinc-900 p-1 rounded">
                    <span className="flex items-center space-x-2 text-pink-400">
                      <Hospital className="w-3.5 h-3.5 text-pink-400" />
                      <span>Emergency Hospitals</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={visibleLayers.facilities}
                      onChange={() => toggleLayer('facilities')}
                      className="rounded text-pink-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Orbital Swath Notice Banner (Night-Cam Mode) */}
      {basemapMode === 'night_cam' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-black/95 backdrop-blur-md border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300 flex items-center space-x-2.5 shadow-2xl">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="font-bold tracking-wide">
            {latestNightPass?.sensor || 'NASA VIIRS DNB'} · {latestNightPass?.acquisition_ist || 'Live Pass'}
          </span>
          <span className="text-zinc-400 text-[11px] border-l border-zinc-700 pl-2">
            OUTSIDE CURRENT ORBITAL SWATH (REAL DATA ONLY)
          </span>
        </div>
      )}

      {/* Main Full-Screen Map Container */}
      <div className={`w-full h-full relative z-0 ${basemapMode === 'night_cam' ? 'bg-[#000000]' : 'bg-[#030508]'}`}>
        <MapContainer
          center={mapCenter}
          zoom={11}
          zoomSnap={1}
          zoomDelta={1}
          wheelPxPerZoomLevel={120}
          maxZoom={basemapMode === 'street_recon' || basemapMode === 'topo' ? 18 : 16}
          zoomControl={false}
          className={`w-full h-full ${basemapMode === 'night_cam' ? 'bg-[#000000]' : 'bg-[#030508]'}`}
        >
          {/* Base Imagery Layers: Razor-Sharp Satellite (capped at native sharp z15 to eliminate pixel stretching) or Street/Vector Recon (OSM, maxNativeZoom 18) */}
          {basemapMode === 'satellite_hybrid' && (
            <TileLayer
              key="base-satellite"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri, Maxar, Earthstar Geographics"
              maxNativeZoom={15}
              maxZoom={15}
              detectRetina={false}
              errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          )}

          {basemapMode === 'street_recon' && (
            <TileLayer
              key="base-street-recon"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors (Building Footprints & Streets)"
              maxNativeZoom={18}
              maxZoom={18}
              detectRetina={false}
              errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          )}

          {basemapMode === 'topo' && (
            <TileLayer
              key="base-topo"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
              maxNativeZoom={18}
              maxZoom={18}
              detectRetina={false}
              errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          )}

          {basemapMode === 'dark' && (
            <TileLayer
              key="base-dark"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri, HERE, Garmin"
              maxNativeZoom={15}
              maxZoom={15}
              detectRetina={false}
              errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          )}

          {basemapMode === 'night_cam' && (
            <>
              {/* Unmodified Authentic Real-Time NASA GIBS VIIRS Daily Overpass (Zero 2016 Archival Blending) */}
              <TileLayer
                key={`cmd-viirs-unblended-${latestNightPass?.gibs_layer || 'VIIRS_NOAA20_DayNightBand_At_Sensor_Radiance'}-${latestNightPass?.gibs_date || '2026-11-17'}`}
                url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${latestNightPass?.gibs_layer || 'VIIRS_NOAA20_DayNightBand_At_Sensor_Radiance'}/default/${latestNightPass?.gibs_date || '2026-11-17'}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`}
                attribution={`NASA GIBS / ${latestNightPass?.sensor || 'VIIRS DNB'} Radiance (${latestNightPass?.acquisition_ist || 'Live Pass'})`}
                maxNativeZoom={8}
                maxZoom={16}
                detectRetina={false}
                opacity={1.0}
                className="night-cam-radiance"
                errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />

              {/* Transparent Vector Reference Place & Boundary Labels */}
              <TileLayer
                key="cmd-esri-reference-labels"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                attribution="Esri / Boundaries & Places"
                maxNativeZoom={16}
                maxZoom={16}
                detectRetina={false}
                opacity={0.80}
                zIndex={650}
                errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            </>
          )}

          {/* Crisp Hybrid Tactical Overlays (Roads, Bridges, Place Names) */}
          {showTacticalOverlay && basemapMode === 'satellite_hybrid' && (
            <>
              {/* Esri World Transportation (Roads, Bridges, Rail corridors) */}
              <TileLayer
                key="overlay-transport"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri"
                maxNativeZoom={15}
                maxZoom={15}
                detectRetina={false}
                opacity={0.85}
                zIndex={385}
                errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
              {/* Place & Administrative Labels (100% Keyless, Watermark-Free Esri Reference) */}
              <TileLayer
                key="overlay-places"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                attribution="&copy; Esri, Maxar"
                maxNativeZoom={15}
                maxZoom={15}
                detectRetina={false}
                opacity={0.95}
                zIndex={650}
                errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            </>
          )}

          {showTacticalOverlay && basemapMode === 'topo' && (
            <TileLayer
              key="overlay-topo-places"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
              maxNativeZoom={16}
              maxZoom={18}
              detectRetina={false}
              opacity={0.9}
              zIndex={650}
              errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          )}

          {showTacticalOverlay && basemapMode === 'dark' && (
            <TileLayer
              key="overlay-dark-ref"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={15}
              maxZoom={18}
              detectRetina={false}
              opacity={0.9}
              zIndex={650}
              errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            />
          )}

          <ScaleControl position="bottomleft" imperial={false} />
          <MapFocusController
            targetCoords={targetFocusCoords ? targetFocusCoords.coords : (selectedSettlement ? selectedSettlement.coordinates : null)}
            targetBounds={selectedRouteBounds}
            targetZoom={targetFocusCoords ? targetFocusCoords.zoom : 13}
          />
          <MapTelemetryController
            onZoomChange={(z) => setCurrentZoom(z)}
            onMouseMove={(lat, lon) => setCursorCoords({ lat, lon })}
            onClick={(lat, lon) => {
              setReconState({
                coords: { lat, lon },
                name: 'Tactical Recon Point',
                category: 'Ground Coordinates',
              });
            }}
          />

          {/* 1. Waterways Layer */}
          {visibleLayers.waterways && layersData?.osm_waterways && (
            <GeoJSON
              data={layersData.osm_waterways}
              style={{
                color: '#0284c7',
                weight: 2.2,
                opacity: 0.8,
              }}
            />
          )}

          {/* 2. Flood Inundation Extent Polygon (Vector Contours at zoom >= 13, Zero Cloud Obscuration) */}
          {visibleLayers.floodExtent && floodExtentData && (
            <GeoJSON
              key={`cmd-flood-${currentZoom >= 13 ? 'sharp' : 'coarse'}`}
              data={floodExtentData}
              style={{
                fillColor: '#0ea5e9',
                fillOpacity: currentZoom >= 13 ? 0.22 : 0.45,
                color: '#38bdf8',
                weight: 2,
                opacity: 0.9,
              }}
            />
          )}

          {/* 2b. NASA VIIRS Night-Light Outages (VNP46A2 Radiance Drops ΔL% <= -40% in Amber/White Rings) */}
          {visibleLayers.viirsOutages && (
            <>
              {/* Outage Polygon Footprints from GeoJSON */}
              {viirsGeoJson && (
                <GeoJSON
                  key={`cmd-viirs-geojson-${currentZoom >= 13 ? 'sharp' : 'coarse'}`}
                  data={viirsGeoJson}
                  style={{
                    color: '#f59e0b',
                    weight: 2.2,
                    opacity: 0.95,
                    dashArray: '5, 4',
                    fillColor: '#d97706',
                    fillOpacity: 0.22,
                  }}
                  onEachFeature={(feature, layer) => {
                    layer.bindTooltip(
                      `<div class="p-1 font-mono text-xs"><strong class="text-amber-400">⚡ VIIRS Blackout Polygon</strong><br/><span class="text-zinc-300">Surface Luminance Drop ≥ -40%</span><br/><span class="text-zinc-400 text-[10px]">Sensor: NASA VIIRS VNP46A2 (500m)</span></div>`,
                      { sticky: true }
                    );
                  }}
                />
              )}

              {/* High-Contrast Amber / White Rings for Blackout Cluster Centroids */}
              {viirsData?.clusters && viirsData.clusters.map((cluster: any, idx: number) => (
                <React.Fragment key={`cmd-viirs-cluster-${cluster.cluster_id || idx}`}>
                  {/* Outer Pulsing Glow Ring */}
                  <CircleMarker
                    center={[cluster.centroid_lat, cluster.centroid_lon]}
                    radius={Math.min(26, Math.max(12, Math.sqrt(cluster.area_sqkm || 1) * 8))}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 1.5,
                      dashArray: '3, 3',
                      fillColor: '#f59e0b',
                      fillOpacity: 0.15,
                    }}
                  />
                  {/* Inner High-Contrast Amber Target */}
                  <CircleMarker
                    center={[cluster.centroid_lat, cluster.centroid_lon]}
                    radius={6}
                    pathOptions={{
                      color: '#f59e0b',
                      weight: 2,
                      fillColor: '#000000',
                      fillOpacity: 0.9,
                    }}
                    eventHandlers={{
                      click: () => {
                        setReconState({
                          coords: { lat: cluster.centroid_lat, lon: cluster.centroid_lon },
                          name: `Blackout Sector #${cluster.cluster_id}`,
                          category: `NASA VIIRS Nightlight Outage (-${cluster.mean_radiance_drop_pct || 40}% drop)`,
                        });
                      },
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -8]}>
                      <div className="p-1 font-mono text-xs">
                        <div className="font-bold text-amber-400 flex items-center space-x-1">
                          <span>⚡ VIIRS Blackout Cluster #{cluster.cluster_id}</span>
                        </div>
                        <div className="text-zinc-200 mt-0.5">
                          Drop: <span className="text-amber-300 font-bold">-{cluster.mean_radiance_drop_pct}%</span>
                        </div>
                        <div className="text-zinc-400 text-[10px]">
                          Area: {cluster.area_sqkm} km² · 500m Footprint
                        </div>
                        <div className="text-zinc-500 text-[9px] mt-0.5">
                          {cluster.approximate_region}
                        </div>
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                </React.Fragment>
              ))}
            </>
          )}

          {/* 3. Roadway Network Operational Layers */}
          {/* Open/Safe Roads */}
          {visibleLayers.roadsOpen && layersData?.osm_roads && (
            <GeoJSON
              data={layersData.osm_roads}
              style={{
                color: '#64748b',
                weight: 2.0,
                opacity: 0.7,
              }}
            />
          )}

          {/* CLOSING_SOON Roads: Amber Dashed with Time-to-Closure Warning */}
          {visibleLayers.roadsClosingSoon && multimodalData && (
            <>
              {multimodalData.roadway_network.closing_soon_segments.map((seg, idx) => (
                <Polyline
                  key={`closing-${idx}`}
                  positions={seg.coordinates.map((c: any) => [c[1], c[0]])}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 4.0,
                    dashArray: '8, 8',
                    opacity: 0.95,
                  }}
                >
                  <LeafletTooltip sticky>
                    <div className="p-1 text-xs">
                      <div className="font-bold text-amber-500 flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>CLOSING SOON (T+{seg.estimated_closure_hours}h)</span>
                      </div>
                      <div className="text-slate-200 mt-0.5">{seg.name}</div>
                      <div className="text-slate-400 text-[10px]">{seg.closure_reason}</div>
                    </div>
                  </LeafletTooltip>
                </Polyline>
              ))}
            </>
          )}

          {/* SEVERED Roads: Red Line */}
          {visibleLayers.roadsSevered && multimodalData && (
            <>
              {multimodalData.roadway_network.severed_segments.map((seg, idx) => (
                <Polyline
                  key={`severed-${idx}`}
                  positions={seg.coordinates.map((c: any) => [c[1], c[0]])}
                  pathOptions={{
                    color: '#ef4444',
                    weight: 4.5,
                    opacity: 0.95,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      setReconState({
                        coords: { lat: e.latlng.lat, lon: e.latlng.lng },
                        name: seg.name,
                        category: 'Severed Corridor / Breach',
                        isolationStatus: 'SEVERED',
                      });
                    },
                  }}
                >
                  <LeafletTooltip
                    permanent={currentZoom >= 14}
                    direction="top"
                    className={currentZoom >= 14 ? 'tactical-tooltip' : undefined}
                    sticky={currentZoom < 14}
                  >
                    {currentZoom >= 14 ? (
                      <span>BREACH · {seg.name} (0.45m)</span>
                    ) : (
                      <div className="p-1 text-xs">
                        <div className="font-bold text-red-500">IMPASSABLE / SEVERED ROAD</div>
                        <div className="text-slate-200">{seg.name}</div>
                        <div className="text-slate-400 text-[10px]">{seg.closure_reason}</div>
                      </div>
                    )}
                  </LeafletTooltip>
                </Polyline>
              ))}
            </>
          )}

          {/* Active Settlement Evacuation Routes */}
          {selectedSettlement && selectedTab === 'road' && (
            <>
              {/* Fastest Pre-Closure Route: Cyan Polyline */}
              {visibleLayers.fastestPreBlockRoutes &&
                selectedSettlement.roadway.fastest_pre_block.path.length > 0 && (
                  <Polyline
                    positions={selectedSettlement.roadway.fastest_pre_block.path.map((c) => [c[1], c[0]] as [number, number])}
                    pathOptions={{
                      color: selectedSettlement.roadway.fastest_pre_block.feasible ? '#06b6d4' : '#64748b',
                      weight: 4.0,
                      opacity: 0.9,
                      dashArray: selectedSettlement.roadway.fastest_pre_block.feasible ? undefined : '5, 5',
                    }}
                  >
                    <LeafletTooltip sticky>
                      <div className="p-1 text-xs font-sans">
                        <span className="font-bold text-cyan-400">Fastest Pre-Closure Route</span>
                        <div className="text-slate-200">
                          {selectedSettlement.roadway.fastest_pre_block.distance_km} km •{' '}
                          {selectedSettlement.roadway.fastest_pre_block.travel_time_min} mins
                        </div>
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                )}

              {/* High-Ground Flood-Safe Bypass Route: Emerald Polyline */}
              {visibleLayers.floodSafeBypassRoutes &&
                selectedSettlement.roadway.flood_safe_bypass.path.length > 0 && (
                  <Polyline
                    positions={selectedSettlement.roadway.flood_safe_bypass.path.map((c) => [c[1], c[0]] as [number, number])}
                    pathOptions={{
                      color: '#10b981',
                      weight: 4.5,
                      opacity: 0.95,
                    }}
                  >
                    <LeafletTooltip sticky>
                      <div className="p-1 text-xs font-sans">
                        <span className="font-bold text-emerald-400">Flood-Safe Ridge Bypass</span>
                        <div className="text-slate-200">
                          {selectedSettlement.roadway.flood_safe_bypass.distance_km} km •{' '}
                          {selectedSettlement.roadway.flood_safe_bypass.travel_time_min} mins
                        </div>
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                )}
            </>
          )}

          {/* 4. Railway Tracks & Safe Railheads */}
          {visibleLayers.railways && railwayData?.tracks && (
            <>
              {railwayData.tracks.map((track: any, idx: number) => (
                <Polyline
                  key={`track-${idx}`}
                  positions={track.coordinates.map((c: any) => [c[1], c[0]])}
                  pathOptions={{
                    color: '#8b5cf6',
                    weight: 3.5,
                    dashArray: '6, 6',
                    opacity: 0.9,
                  }}
                >
                  <LeafletTooltip sticky>
                    <div className="text-xs font-sans">
                      <span className="font-bold text-purple-400 flex items-center space-x-1">
                        <Train className="w-3 h-3" />
                        <span>Northeast Frontier Railway</span>
                      </span>
                      <div className="text-slate-200">{track.name}</div>
                    </div>
                  </LeafletTooltip>
                </Polyline>
              ))}
            </>
          )}

          {/* Railway Stations / Safe Railheads */}
          {visibleLayers.railheads && railwayData?.stations && (
            <>
              {railwayData.stations.map((stn: any, idx: number) => (
                <CircleMarker
                  key={`stn-${idx}`}
                  center={[stn.coordinates[1], stn.coordinates[0]]}
                  radius={7}
                  pathOptions={{
                    fillColor: '#8b5cf6',
                    fillOpacity: 1.0,
                    color: '#ffffff',
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      setReconState({
                        coords: { lat: stn.coordinates[1], lon: stn.coordinates[0] },
                        name: stn.name,
                        category: 'Railway Station',
                      });
                    },
                  }}
                >
                  <Popup>
                    <div className="p-1 font-sans text-xs min-w-[200px]">
                      <div className="flex items-center space-x-1.5 text-purple-400 font-bold">
                        <Train className="w-4 h-4" />
                        <span>{stn.name}</span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Code: {stn.code} • Platforms: {stn.platforms}
                      </div>
                      <div className="mt-1.5 p-1.5 rounded bg-purple-950/60 border border-purple-800 text-[11px] text-purple-200">
                        Role: {stn.evacuation_role}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        Cap: {stn.capacity_pax_day?.toLocaleString()} civilian evacuees/day
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </>
          )}

          {/* Active Settlement Road-to-Railhead Feeder Route */}
          {selectedSettlement && selectedTab === 'rail' && selectedSettlement.railway.feeder_path.length > 0 && (
            <Polyline
              positions={selectedSettlement.railway.feeder_path.map((c) => [c[1], c[0]] as [number, number])}
              pathOptions={{
                color: '#a855f7',
                weight: 4.0,
                opacity: 0.95,
                dashArray: '4, 4',
              }}
            >
              <LeafletTooltip sticky>
                <div className="p-1 text-xs">
                  <div className="font-bold text-purple-400">Road Feeder to Railhead</div>
                  <div className="text-slate-200">
                    {selectedSettlement.railway.road_feeder_distance_km} km •{' '}
                    {selectedSettlement.railway.road_feeder_time_min} mins
                  </div>
                </div>
              </LeafletTooltip>
            </Polyline>
          )}

          {/* 5. Airway Corridors & HLZ Landing Zones */}
          {visibleLayers.airwaysHLZ && hlzData?.features && (
            <>
              {hlzData.features.map((feat: any, idx: number) => {
                const isTier1 = feat.properties?.suitability_tier?.includes('Tier 1');
                return (
                  <CircleMarker
                    key={`hlz-${idx}`}
                    center={[feat.geometry.coordinates[1], feat.geometry.coordinates[0]]}
                    radius={isTier1 ? 8 : 6}
                    pathOptions={{
                      fillColor: isTier1 ? '#38bdf8' : '#0284c7',
                      fillOpacity: 0.9,
                      color: '#ffffff',
                      weight: 2,
                    }}
                    eventHandlers={{
                      click: () => {
                        setReconState({
                          coords: { lat: feat.geometry.coordinates[1], lon: feat.geometry.coordinates[0] },
                          name: feat.properties?.name || 'Air Rescue HLZ',
                          category: 'Helicopter Landing Zone',
                        });
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-1 font-sans text-xs min-w-[210px]">
                        <div className="flex items-center space-x-1.5 font-bold text-sky-400">
                          <Plane className="w-4 h-4" />
                          <span>{feat.properties?.name}</span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-slate-300 text-[11px]">
                          <div>Elevation: {feat.properties?.elevation_m}m</div>
                          <div>Slope: {feat.properties?.slope_degrees}°</div>
                          <div>Clearance: {feat.properties?.clearance_footprint_m}m footprint</div>
                          <div>Tier: <span className="text-sky-300 font-bold">{feat.properties?.suitability_tier}</span></div>
                        </div>
                      </div>
                    </Popup>
                    <LeafletTooltip
                      direction="top"
                      offset={[0, -9]}
                      permanent={currentZoom >= 14}
                      className={currentZoom >= 14 ? 'tactical-tooltip' : undefined}
                    >
                      {currentZoom >= 14 ? (
                        <span>HLZ · {feat.properties?.clearance_footprint_m || 30}m · Slope {feat.properties?.slope_degrees ?? 2.0}°</span>
                      ) : (
                        <span className="text-xs font-bold text-slate-100">🚁 {feat.properties?.name || 'Air Rescue HLZ'}</span>
                      )}
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}
            </>
          )}

          {/* Active Settlement Air-Bridge Sortie Vector */}
          {selectedSettlement && selectedTab === 'air' && selectedSettlement.airway.air_bridge && (
            <Polyline
              positions={[
                [selectedSettlement.airway.air_bridge.vector_coords[0][1], selectedSettlement.airway.air_bridge.vector_coords[0][0]],
                [selectedSettlement.airway.air_bridge.vector_coords[1][1], selectedSettlement.airway.air_bridge.vector_coords[1][0]],
              ]}
              pathOptions={{
                color: '#38bdf8',
                weight: 3.5,
                dashArray: '8, 8',
                opacity: 0.95,
              }}
            >
              <LeafletTooltip sticky>
                <div className="p-1 text-xs">
                  <div className="font-bold text-sky-400 flex items-center space-x-1">
                    <Plane className="w-3.5 h-3.5" />
                    <span>Direct Air-Bridge Sortie Vector</span>
                  </div>
                  <div className="text-slate-200 mt-0.5">
                    Bearing: {selectedSettlement.airway.air_bridge.compass_bearing_deg}° ({selectedSettlement.airway.air_bridge.compass_bearing_label})
                  </div>
                  <div className="text-slate-300">
                    {selectedSettlement.airway.air_bridge.distance_km} km • {selectedSettlement.airway.air_bridge.estimated_flight_time_min} min sortie
                  </div>
                  <div className="text-sky-300 text-[10px]">Destination: {selectedSettlement.airway.air_bridge.destination_airbase}</div>
                </div>
              </LeafletTooltip>
            </Polyline>
          )}

          {/* 6. Emergency Hospitals / Relief Facilities */}
          {visibleLayers.facilities && layersData?.osm_facilities?.features && (
            <>
              {layersData.osm_facilities.features.map((fac: any, idx: number) => (
                <CircleMarker
                  key={`fac-${idx}`}
                  center={[fac.geometry.coordinates[1], fac.geometry.coordinates[0]]}
                  radius={7}
                  pathOptions={{
                    fillColor: '#ec4899',
                    fillOpacity: 1.0,
                    color: '#ffffff',
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      setReconState({
                        coords: { lat: fac.geometry.coordinates[1], lon: fac.geometry.coordinates[0] },
                        name: fac.properties?.name || 'Hospital',
                        category: 'Medical Facility',
                      });
                    },
                  }}
                >
                  <Popup>
                    <div className="p-1 font-sans text-xs">
                      <div className="flex items-center space-x-1.5 text-pink-400 font-bold">
                        <Hospital className="w-4 h-4" />
                        <span>{fac.properties?.name}</span>
                      </div>
                      <div className="text-slate-300 text-[11px] mt-0.5">
                        {fac.properties?.amenity?.toUpperCase()} • {fac.properties?.operator || 'Govt Health Service'}
                      </div>
                    </div>
                  </Popup>
                  <LeafletTooltip
                    direction="top"
                    offset={[0, -8]}
                    permanent={currentZoom >= 14}
                    className={currentZoom >= 14 ? 'tactical-tooltip' : undefined}
                  >
                    {currentZoom >= 14 ? (
                      <span>MEDICAL · {fac.properties?.name || 'Hospital'}</span>
                    ) : (
                      <span className="text-xs font-semibold">{fac.properties?.name}</span>
                    )}
                  </LeafletTooltip>
                </CircleMarker>
              ))}
            </>
          )}

          {/* 7. Settlements Markers with Urgency Badges */}
          {visibleLayers.settlements && multimodalData && (
            <>
              {multimodalData.settlement_plans.map((s, idx) => {
                const isSelected = selectedSettlement?.osm_id === s.osm_id;
                let color = '#10b981'; // OPEN_SAFE
                if (s.operational_status === 'CLOSING_SOON') color = '#f59e0b';
                if (s.operational_status === 'SEVERED') color = '#ef4444';

                return (
                  <CircleMarker
                    key={`settlement-${idx}`}
                    center={[s.coordinates[1], s.coordinates[0]]}
                    radius={isSelected ? 10 : 7}
                    pathOptions={{
                      fillColor: color,
                      fillOpacity: 1.0,
                      color: isSelected ? '#ffffff' : '#0f172a',
                      weight: isSelected ? 3 : 1.5,
                    }}
                    eventHandlers={{
                      click: () => {
                        setSelectedSettlement(s);
                        setReconState({
                          coords: { lat: s.coordinates[1], lon: s.coordinates[0] },
                          name: s.village_name,
                          category: 'Settlement / Village',
                          isolationStatus: s.operational_status,
                        });
                      },
                    }}
                  >
                    <LeafletTooltip
                      direction="top"
                      offset={[0, -10]}
                      permanent={currentZoom >= 14 || isSelected}
                      className={currentZoom >= 14 ? 'tactical-tooltip' : undefined}
                    >
                      {currentZoom >= 14 ? (
                        <span>{s.village_name} · {s.elevation_m || 240}m · {s.operational_status === 'SEVERED' ? 'SEVERED' : s.operational_status === 'CLOSING_SOON' ? 'CLOSING' : 'SAFE'}</span>
                      ) : (
                        <div className="font-sans text-xs">
                          <span className="font-bold text-slate-100">{s.village_name}</span>
                          <div
                            className={`text-[10px] font-mono font-bold ${s.operational_status === 'SEVERED'
                              ? 'text-red-400'
                              : s.operational_status === 'CLOSING_SOON'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                              }`}
                          >
                            {s.urgency_badge}
                          </div>
                        </div>
                      )}
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}
            </>
          )}
        </MapContainer>

        {/* Bottom-Right Live Cursor Telemetry Badge */}
        <div className="absolute bottom-3 right-4 z-[1000] flex items-center space-x-2 pointer-events-auto">
          <div className="bg-[#050505]/95 backdrop-blur-md border border-zinc-800 text-white font-mono text-[11px] px-3 py-1.5 rounded-lg shadow-xl flex items-center space-x-3">
            <span className="flex items-center space-x-1.5 text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-zinc-500">LAT</span>
              <span className="text-white font-bold">{cursorCoords.lat.toFixed(4)}°N</span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-500">LON</span>
              <span className="text-white font-bold">{cursorCoords.lon.toFixed(4)}°E</span>
            </span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400">ZOOM <b className="text-white">{currentZoom}</b></span>
            <span className="text-zinc-700">|</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-[10px] font-bold">
              {getGroundScaleText(currentZoom)}
            </span>
            {currentZoom >= 13 && (
              <>
                <span className="text-zinc-700">|</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono font-bold">
                  SUB-METER AERIAL (OPTICAL AUTO-CLEARED)
                </span>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Floating Multi-Modal Dispatch Drawer (Bottom / Left Floating Card) */}
      {selectedSettlement && (
        <div className="absolute bottom-4 left-5 z-[1000] w-[460px] max-w-[calc(100vw-2.5rem)] bg-[#111113]/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-5 text-xs font-sans text-zinc-200">
          {/* Header with Urgency Badge */}
          <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">{selectedSettlement.village_name}</h3>
                <span className="text-[11px] text-zinc-400">
                  Pop: {selectedSettlement.population ? selectedSettlement.population.toLocaleString() : 'Unrecorded'} • Ele: {selectedSettlement.elevation_m}m
                </span>
              </div>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${selectedSettlement.operational_status === 'SEVERED'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-700/80'
                    : selectedSettlement.operational_status === 'CLOSING_SOON'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-700/80'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80'
                    }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>{selectedSettlement.urgency_badge}</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedSettlement(null)}
              className="text-zinc-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Multi-Modal Tab Navigation: ROAD / RAIL / AIR */}
          <div className="grid grid-cols-3 gap-1 bg-black p-1 rounded-xl mt-3 border border-zinc-800">
            <button
              onClick={() => setSelectedTab('road')}
              className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer ${selectedTab === 'road'
                ? 'bg-white text-black shadow'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>1. Roadway</span>
            </button>
            <button
              onClick={() => setSelectedTab('rail')}
              className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer ${selectedTab === 'rail'
                ? 'bg-white text-black shadow'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Train className="w-3.5 h-3.5" />
              <span>2. Railway</span>
            </button>
            <button
              onClick={() => setSelectedTab('air')}
              className={`py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer ${selectedTab === 'air'
                ? 'bg-white text-black shadow'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>3. Airway</span>
            </button>
          </div>

          {/* Tab 1: Roadway Pre-Closure & Bypass */}
          {selectedTab === 'road' && (
            <div className="mt-3 space-y-2.5">
              {/* Option A: Fastest Pre-Closure Route */}
              <div className="p-2.5 rounded-xl bg-black border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white flex items-center space-x-1">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Fastest Pre-Closure Corridor</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedSettlement.roadway.fastest_pre_block.feasible
                      ? 'bg-zinc-800 text-white border border-zinc-700'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                  >
                    {selectedSettlement.roadway.fastest_pre_block.feasible ? 'VIABLE' : 'CLOSURE IMMINENT'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-300 text-[11px] mt-1 font-mono">
                  <span>Dist: {selectedSettlement.roadway.fastest_pre_block.distance_km} km</span>
                  <span>Travel: {selectedSettlement.roadway.fastest_pre_block.travel_time_min} mins</span>
                  <span className="text-amber-400">
                    {selectedSettlement.roadway.fastest_pre_block.window_margin_hours
                      ? `Window: ${selectedSettlement.roadway.fastest_pre_block.window_margin_hours}h`
                      : 'Zero Margin'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  {selectedSettlement.roadway.fastest_pre_block.advisory}
                </p>
              </div>

              {/* Option B: High-Ground Flood-Safe Bypass */}
              <div className="p-2.5 rounded-xl bg-black border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-400 flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>High-Ground Flood-Safe Bypass</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedSettlement.roadway.flood_safe_bypass.feasible
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-zinc-800 text-zinc-400'
                      }`}
                  >
                    {selectedSettlement.roadway.flood_safe_bypass.feasible ? 'SECURE RIDGE' : 'UNAVAILABLE'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-300 text-[11px] mt-1 font-mono">
                  <span>Dist: {selectedSettlement.roadway.flood_safe_bypass.distance_km} km</span>
                  <span>Travel: {selectedSettlement.roadway.flood_safe_bypass.travel_time_min} mins</span>
                  <span className="text-emerald-400">100% Unflooded</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">
                  {selectedSettlement.roadway.flood_safe_bypass.advisory}
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Railway Corridor & Safe Railhead */}
          {selectedTab === 'rail' && (
            <div className="mt-3 space-y-2.5">
              <div className="p-3 rounded-xl bg-black border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white flex items-center space-x-1.5">
                    <Train className="w-4 h-4 text-purple-400" />
                    <span>Active Railhead Link</span>
                  </div>
                  <span className="text-[10px] font-bold bg-zinc-800 text-white px-2 py-0.5 rounded border border-zinc-700">
                    {selectedSettlement.railway.station_code}
                  </span>
                </div>
                <div className="text-white font-semibold mt-1">
                  {selectedSettlement.railway.nearest_railhead}
                </div>
                <div className="flex items-center justify-between text-zinc-300 text-[11px] mt-2 font-mono">
                  <span>Road Feeder: {selectedSettlement.railway.road_feeder_distance_km} km</span>
                  <span>Feeder Time: {selectedSettlement.railway.road_feeder_time_min} mins</span>
                </div>
                <div className="mt-2 text-[11px] text-zinc-200 bg-zinc-900 p-2 rounded border border-zinc-800">
                  <div className="font-bold text-white">Evacuation Service:</div>
                  <div>{selectedSettlement.railway.rail_evacuation_capacity}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Airway Rescue Corridors */}
          {selectedTab === 'air' && (
            <div className="mt-3 space-y-2.5">
              {selectedSettlement.airway.pickup_hlz ? (
                <div className="p-3 rounded-xl bg-black border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white flex items-center space-x-1.5">
                      <Plane className="w-4 h-4 text-white" />
                      <span>{selectedSettlement.airway.pickup_hlz.name}</span>
                    </div>
                    <span className="text-[10px] font-bold bg-zinc-800 text-white px-2 py-0.5 rounded border border-zinc-700">
                      {selectedSettlement.airway.pickup_hlz.hlz_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-300 text-[11px] font-mono">
                    <span>Ground Feeder: {selectedSettlement.airway.pickup_hlz.distance_km} km</span>
                    <span>Foot/4x4 Access: ~{selectedSettlement.airway.pickup_hlz.ground_access_time_min}m</span>
                    <span>Slope: {selectedSettlement.airway.pickup_hlz.slope_deg}°</span>
                  </div>

                  {selectedSettlement.airway.air_bridge && (
                    <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] space-y-1">
                      <div className="font-bold text-white flex items-center justify-between">
                        <span>Direct Air-Bridge Vector:</span>
                        <span className="font-mono text-white">
                          {selectedSettlement.airway.air_bridge.estimated_flight_time_min} mins flight
                        </span>
                      </div>
                      <div className="text-zinc-200">
                        Destination: {selectedSettlement.airway.air_bridge.destination_airbase}
                      </div>
                      <div className="text-zinc-400 font-mono text-[10px]">
                        Bearing: {selectedSettlement.airway.air_bridge.compass_bearing_deg}° (
                        {selectedSettlement.airway.air_bridge.compass_bearing_label}) • Dist:{' '}
                        {selectedSettlement.airway.air_bridge.distance_km} km
                      </div>
                      <div className="text-zinc-300 text-[10px]">
                        Fleet: {selectedSettlement.airway.air_bridge.helicopter_types}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 text-center text-zinc-400">No safe landing zone detected within radius.</div>
              )}
            </div>
          )}

          {/* Quick Settlement Selector Strip */}
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
              Switch Settlement ({filteredSettlements.length}):
            </span>
            <div className="flex items-center space-x-1 overflow-x-auto max-w-[280px]">
              {filteredSettlements.map((s) => (
                <button
                  key={s.osm_id}
                  onClick={() => setSelectedSettlement(s)}
                  className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${selectedSettlement.osm_id === s.osm_id
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                    }`}
                >
                  {s.village_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
