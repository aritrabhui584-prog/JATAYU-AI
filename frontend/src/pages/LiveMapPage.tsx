import React, { useState, useEffect, useMemo } from 'react';
import {
  AOIConfig,
  EmergencyFacility,
  EmergencyPriorityResult,
  EmergencyRoute,
  LayerMetadata,
  RasterRenderMode,
  RasterSceneRecord,
  VillagePriorityItem,
} from '../types';
import {
  MapViewer,
  RasterOverlayConfig,
  CompareOverlayConfig,
  FloodOverlayConfig,
} from '../components/MapViewer';
import { LayerControlPanel, BasemapType } from '../components/LayerControlPanel';
import * as api from '../api/client';
import {
  Compass,
  Satellite,
  Sliders,
  Eye,
  Layers,
  ArrowRightLeft,
  Info,
  CheckCircle2,
  AlertCircle,
  Search,
  AlertTriangle,
  Hospital,
  Waves,
  RefreshCw,
  X,
  FileCode,
  Download,
} from 'lucide-react';

interface LiveMapPageProps {
  activeAOI: AOIConfig | null;
  layers: LayerMetadata[];
  layersData: {
    osm_roads?: any;
    osm_settlements?: any;
    osm_waterways?: any;
    aoi_corridor?: any;
    hlz_landing_zones?: any;
  };
  onDownloadLayer: (layerKey: string) => void;
  onOpenAOIModal: () => void;
  selectedRasterSceneId?: string | null;
}

export const LiveMapPage: React.FC<LiveMapPageProps> = ({
  activeAOI,
  layers,
  layersData,
  onDownloadLayer,
  onOpenAOIModal,
  selectedRasterSceneId,
}) => {
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('satellite');
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    aoi_corridor: true,
    osm_settlements: true,
    osm_roads: true,
    osm_waterways: true,
    flood_extent: true,
    relief_centers: true,
    priority_markers: true,
    emergency_routes: true,
    hlz_landing_zones: true,
  });

  // Satellite raster overlay states
  const [availableScenes, setAvailableScenes] = useState<RasterSceneRecord[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(selectedRasterSceneId || null);
  const [renderMode, setRenderMode] = useState<RasterRenderMode>('true_color');
  const [opacity, setOpacity] = useState<number>(0.85);
  const [isOverlayVisible, setIsOverlayVisible] = useState<boolean>(true);
  const [rasterOverlay, setRasterOverlay] = useState<RasterOverlayConfig | null>(null);

  // Flood Inundation Overlay
  const [floodOverlay, setFloodOverlay] = useState<FloodOverlayConfig | null>(null);
  const [floodOpacity, setFloodOpacity] = useState<number>(0.75);

  // Integrated Crisis & Intelligence Data
  const [reliefFacilities, setReliefFacilities] = useState<EmergencyFacility[]>([]);
  const [priorityVillages, setPriorityVillages] = useState<VillagePriorityItem[]>([]);
  const [emergencyRoutes, setEmergencyRoutes] = useState<EmergencyRoute[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<VillagePriorityItem | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Comparison states
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [beforeSceneId, setBeforeSceneId] = useState<string>('');
  const [afterSceneId, setAfterSceneId] = useState<string>('');
  const [compareSplit, setCompareSplit] = useState<number>(50);
  const [compareOverlay, setCompareOverlay] = useState<CompareOverlayConfig | null>(null);

  // Load registered scenes and crisis data on mount
  useEffect(() => {
    // 1. Satellite scenes
    api.fetchRegisteredScenes()
      .then((res) => {
        setAvailableScenes(res.scenes);
        if (!activeSceneId && res.scenes.length > 0) {
          const first = res.scenes[0];
          setActiveSceneId(first.id);
          if (first.mission === 'Sentinel-1') {
            setRenderMode('sar_calibrated');
          } else {
            setRenderMode('true_color');
          }
        }
      })
      .catch((err) => console.error('Failed to load registered scenes:', err));

    // 2. Relief Facilities (Hospitals)
    api.fetchEmergencyFacilities()
      .then((facs) => setReliefFacilities(facs))
      .catch((err) => console.error('Failed to load facilities:', err));

    // 3. Priority Roster & Emergency Routes
    api.fetchLatestPriorityRanking()
      .then((pRes) => {
        setPriorityVillages(pRes.villages);
        setEmergencyRoutes(pRes.emergency_routes);
      })
      .catch((err) => console.error('Failed to load priority roster:', err));
  }, []);

  // Update active scene if prop changes
  useEffect(() => {
    if (selectedRasterSceneId) {
      setActiveSceneId(selectedRasterSceneId);
    }
  }, [selectedRasterSceneId]);

  // Construct active satellite raster overlay config
  useEffect(() => {
    if (!activeSceneId || !isOverlayVisible || isCompareMode) {
      setRasterOverlay(null);
      return;
    }

    const scene = availableScenes.find((s) => s.id === activeSceneId);
    if (!scene) return;

    const b = scene.bounds;
    const leafletBounds: [[number, number], [number, number]] =
      b && b.length === 4
        ? [
            [b[0], b[1]],
            [b[2], b[3]],
          ]
        : [
            [activeAOI?.bbox.min_lat || 26.5, activeAOI?.bbox.min_lon || 88.25],
            [activeAOI?.bbox.max_lat || 27.75, activeAOI?.bbox.max_lon || 88.85],
          ];

    const url = api.getRasterRenderUrl(activeSceneId, renderMode);
    setRasterOverlay({
      url,
      bounds: leafletBounds,
      opacity,
      visible: isOverlayVisible,
      title: `${scene.mission} (${scene.acquisition_date.split('T')[0]})`,
      renderMode,
    });
  }, [activeSceneId, renderMode, opacity, isOverlayVisible, isCompareMode, availableScenes, activeAOI]);

  // Construct flood overlay config
  useEffect(() => {
    const b = activeAOI?.bbox;
    const leafletBounds: [[number, number], [number, number]] = [
      [b?.min_lat || 26.75, b?.min_lon || 88.35],
      [b?.max_lat || 27.05, b?.max_lon || 88.65],
    ];

    setFloodOverlay({
      url: '/api/flood/render?type=flood_extent',
      bounds: leafletBounds,
      opacity: floodOpacity,
      visible: visibleLayers['flood_extent'] !== false,
      title: 'Sentinel-1 SAR Calibrated Flood Extent',
    });
  }, [activeAOI, floodOpacity, visibleLayers['flood_extent']]);

  // Construct compare overlay config
  useEffect(() => {
    if (!isCompareMode || !beforeSceneId || !afterSceneId) {
      setCompareOverlay(null);
      return;
    }

    const beforeScene = availableScenes.find((s) => s.id === beforeSceneId);
    const afterScene = availableScenes.find((s) => s.id === afterSceneId);
    if (!beforeScene || !afterScene) return;

    const b = afterScene.bounds;
    const leafletBounds: [[number, number], [number, number]] =
      b && b.length === 4
        ? [
            [b[0], b[1]],
            [b[2], b[3]],
          ]
        : [
            [activeAOI?.bbox.min_lat || 26.5, activeAOI?.bbox.min_lon || 88.25],
            [activeAOI?.bbox.max_lat || 27.75, activeAOI?.bbox.max_lon || 88.85],
          ];

    const beforeUrl = api.getRasterRenderUrl(beforeSceneId, renderMode);
    const afterUrl = api.getRasterRenderUrl(afterSceneId, renderMode);

    setCompareOverlay({
      beforeUrl,
      afterUrl,
      bounds: leafletBounds,
      splitPosition: compareSplit,
      comparisonMode: 'split',
      activeView: 'after',
      opacity,
      beforeTitle: `${beforeScene.mission} Pre-event (${beforeScene.acquisition_date.split('T')[0]})`,
      afterTitle: `${afterScene.mission} Post-event (${afterScene.acquisition_date.split('T')[0]})`,
    });
  }, [isCompareMode, beforeSceneId, afterSceneId, compareSplit, renderMode, opacity, availableScenes, activeAOI]);

  const handleToggleLayer = (layerKey: string) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  };

  const activeSceneObj = availableScenes.find((s) => s.id === activeSceneId);
  const isS1 = activeSceneObj?.mission === 'Sentinel-1';

  const settlementsCount = layersData.osm_settlements?.features?.length ?? 0;
  const roadsCount = layersData.osm_roads?.features?.length ?? 0;
  const waterwaysCount = layersData.osm_waterways?.features?.length ?? 0;

  // Filter settlements for search
  const filteredVillages = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return priorityVillages.filter((v) =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [priorityVillages, searchTerm]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-[#050505] flex flex-col overflow-hidden">
      {/* Top Floating Telemetry & Scene Bar */}
      <div className="absolute top-4 left-5 z-[1000] flex flex-wrap items-center gap-2">
        <button
          onClick={onOpenAOIModal}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#111113]/90 backdrop-blur-md border border-zinc-800 text-xs text-white hover:border-white transition shadow-lg cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-white" />
          <span className="font-semibold">{activeAOI?.name || 'Teesta Corridor'}</span>
        </button>

        {/* Real counts badge */}
        <div className="flex items-center space-x-3 px-3 py-1.5 rounded-lg bg-[#111113]/90 backdrop-blur-md border border-zinc-800 text-xs text-zinc-300 shadow-lg">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono font-bold text-white">{settlementsCount}</span>
            <span className="text-[11px] text-zinc-400">Settlements</span>
          </div>
          <span className="text-zinc-600">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-mono font-bold text-white">{roadsCount}</span>
            <span className="text-[11px] text-zinc-400">Road Ways</span>
          </div>
          <span className="text-zinc-600">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-300" />
            <span className="font-mono font-bold text-white">{waterwaysCount}</span>
            <span className="text-[11px] text-zinc-400">River Channels</span>
          </div>
          <span className="text-zinc-600">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono font-bold text-emerald-400">{reliefFacilities.length}</span>
            <span className="text-[11px] text-zinc-400">Relief Hubs</span>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search settlement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg bg-black border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white shadow-lg w-44"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Search Dropdown Results */}
          {filteredVillages.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-60 bg-[#111113] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden z-[1100] max-h-48 overflow-y-auto">
              {filteredVillages.map((v) => (
                <div
                  key={v.name}
                  onClick={() => {
                    setSelectedVillage(v);
                    setSearchTerm('');
                  }}
                  className="px-3 py-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800/60 last:border-0 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">#{v.rank} {v.name}</div>
                    <div className="text-[10px] text-zinc-400 capitalize">{v.place_type} • {v.population ? `${v.population.toLocaleString()} pop` : 'Unrecorded pop'}</div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                    v.priority_tier === 'P1_CRITICAL'
                      ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                      : 'bg-amber-950/80 text-amber-300 border-amber-800'
                  }`}>
                    {v.composite_priority_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Satellite & Flood Controls Card */}
      <div className="absolute top-16 left-5 z-[1000] w-80 bg-[#111113]/95 backdrop-blur-md border border-zinc-800 rounded-xl p-3.5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <div className="flex items-center space-x-2">
            <Satellite className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Satellite & Flood Controls
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-[11px] text-zinc-400 flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isOverlayVisible}
                onChange={(e) => setIsOverlayVisible(e.target.checked)}
                className="rounded bg-zinc-800 border-zinc-700 text-white focus:ring-0 w-3 h-3 cursor-pointer"
              />
              <span>Imagery</span>
            </label>
          </div>
        </div>

        {/* Scene Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider">
            Active Satellite Scene
          </label>
          <select
            value={activeSceneId || ''}
            onChange={(e) => {
              const sid = e.target.value;
              setActiveSceneId(sid);
              const sc = availableScenes.find((s) => s.id === sid);
              if (sc?.mission === 'Sentinel-1') {
                setRenderMode('sar_calibrated');
              } else {
                setRenderMode('true_color');
              }
            }}
            className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:border-white focus:outline-none"
          >
            {availableScenes.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.mission}] {s.id.substring(0, 24)}... ({s.acquisition_date.split('T')[0]})
              </option>
            ))}
          </select>
        </div>

        {/* Layer Mode Selector */}
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider">
            Raster Processing Mode
          </label>
          <select
            value={renderMode}
            onChange={(e) => setRenderMode(e.target.value as RasterRenderMode)}
            className="w-full bg-black border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:border-white focus:outline-none"
          >
            {isS1 ? (
              <>
                <option value="sar_calibrated">SAR Calibrated Backscatter (σ⁰ dB)</option>
                <option value="sar_water_mask">Filtered Water Mask (Shadow & River Excl.)</option>
              </>
            ) : (
              <>
                <option value="true_color">True-Color RGB (B04, B03, B02)</option>
                <option value="ndwi">NDWI Water Index ((G - NIR)/(G + NIR))</option>
                <option value="cloud_mask">Optical Cloud Mask</option>
              </>
            )}
          </select>
        </div>

        {/* Satellite Opacity Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>Satellite Opacity</span>
            <span className="font-mono text-white">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        {/* Flood Extent Opacity Slider */}
        <div className="space-y-1 pt-1 border-t border-zinc-800">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span className="flex items-center space-x-1 text-zinc-200">
              <Waves className="w-3 h-3 text-white" />
              <span>Flood Inundation Opacity</span>
            </span>
            <span className="font-mono text-white">{Math.round(floodOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={floodOpacity}
            onChange={(e) => setFloodOpacity(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        {/* Before / After Toggle Section */}
        <div className="pt-2 border-t border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-300 flex items-center space-x-1.5">
              <ArrowRightLeft className="w-3 h-3 text-white" />
              <span>Event Comparison</span>
            </span>
            <button
              onClick={() => {
                if (!isCompareMode && availableScenes.length >= 2) {
                  setBeforeSceneId(availableScenes[1].id);
                  setAfterSceneId(availableScenes[0].id);
                }
                setIsCompareMode(!isCompareMode);
              }}
              className={`text-[10px] px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                isCompareMode
                  ? 'bg-white text-black font-bold'
                  : 'bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
            >
              {isCompareMode ? 'Disable Comparison' : 'Enable Split'}
            </button>
          </div>

          {isCompareMode && (
            <div className="space-y-2 pt-1 text-[11px]">
              <div>
                <label className="text-[10px] text-zinc-400">Before-Event Scene:</label>
                <select
                  value={beforeSceneId}
                  onChange={(e) => setBeforeSceneId(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                >
                  {availableScenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id.substring(0, 18)}... ({s.acquisition_date.split('T')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400">After-Event Scene:</label>
                <select
                  value={afterSceneId}
                  onChange={(e) => setAfterSceneId(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-zinc-200"
                >
                  {availableScenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id.substring(0, 18)}... ({s.acquisition_date.split('T')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400">
                  <span>Split Divider</span>
                  <span className="font-mono text-white">{compareSplit}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={compareSplit}
                  onChange={(e) => setCompareSplit(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Map Viewer */}
      <MapViewer
        activeAOI={activeAOI}
        activeBasemap={activeBasemap}
        layersData={layersData}
        visibleLayers={visibleLayers}
        rasterOverlay={rasterOverlay}
        compareOverlay={compareOverlay}
        floodOverlay={floodOverlay}
        reliefFacilities={reliefFacilities}
        priorityVillages={priorityVillages}
        emergencyRoutes={emergencyRoutes}
        onSelectVillage={(v) => setSelectedVillage(v)}
      />

      {/* Right-side GIS Layer Control Panel */}
      <LayerControlPanel
        layers={layers}
        visibleLayers={visibleLayers}
        onToggleLayer={handleToggleLayer}
        activeBasemap={activeBasemap}
        onChangeBasemap={setActiveBasemap}
        onDownloadLayer={onDownloadLayer}
      />
    </div>
  );
};
