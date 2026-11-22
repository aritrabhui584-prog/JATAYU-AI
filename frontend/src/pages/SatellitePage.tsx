import React, { useState, useEffect } from 'react';
import {
  AOIConfig,
  BeforeAfterComparison,
  RasterImportRequest,
  RasterRenderMode,
  RasterSceneRecord,
  SatelliteSearchQuery,
  SceneProcessingStatus,
} from '../types';
import * as api from '../api/client';
import { MapViewer, RasterOverlayConfig, CompareOverlayConfig } from '../components/MapViewer';
import {
  Satellite,
  Radio,
  Eye,
  Cloud,
  Calendar,
  Layers,
  ExternalLink,
  Sliders,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Clock,
  ArrowRightLeft,
  Info,
  Maximize2
} from 'lucide-react';

interface SatellitePageProps {
  activeAOI: AOIConfig | null;
  onOpenAOIModal: () => void;
  onViewOnLiveMap?: (sceneId: string) => void;
}

export const SatellitePage: React.FC<SatellitePageProps> = ({
  activeAOI,
  onOpenAOIModal,
  onViewOnLiveMap,
}) => {
  const [scenes, setScenes] = useState<RasterSceneRecord[]>([]);
  const [isLoadingScenes, setIsLoadingScenes] = useState(false);
  const [missionFilter, setMissionFilter] = useState<'all' | 'Sentinel-1' | 'Sentinel-2'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [maxCloudCover, setMaxCloudCover] = useState(40);
  const [isSearchingSTAC, setIsSearchingSTAC] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<RasterRenderMode>('true_color');
  const [opacity, setOpacity] = useState<number>(0.9);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const [isCompareActive, setIsCompareActive] = useState(false);
  const [beforeSceneId, setBeforeSceneId] = useState<string>('');
  const [afterSceneId, setAfterSceneId] = useState<string>('');
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [comparisonMode, setComparisonMode] = useState<'split' | 'toggle'>('split');
  const [toggleActiveView, setToggleActiveView] = useState<'before' | 'after'>('after');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFilePath, setImportFilePath] = useState('');
  const [importMission, setImportMission] = useState<'Sentinel-1' | 'Sentinel-2'>('Sentinel-2');
  const [importProductId, setImportProductId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);

  const loadScenes = async () => {
    setIsLoadingScenes(true);
    try {
      const res = await api.fetchRegisteredScenes(
        missionFilter === 'all' ? undefined : missionFilter,
        statusFilter === 'all' ? undefined : statusFilter
      );
      const sortedScenes = [...res.scenes].sort((a, b) => {
        if (a.has_local_raster && !b.has_local_raster) return -1;
        if (!a.has_local_raster && b.has_local_raster) return 1;
        return 0;
      });
      setScenes(sortedScenes);
      if (sortedScenes.length > 0) {
        const currentSelected = sortedScenes.find((s) => s.id === selectedSceneId);
        if (!selectedSceneId || !currentSelected || (!currentSelected.has_local_raster && sortedScenes.some((s) => s.has_local_raster))) {
          const preferredScene = sortedScenes.find((s) => s.has_local_raster) || sortedScenes[0];
          setSelectedSceneId(preferredScene.id);
          if (preferredScene.mission === 'Sentinel-1') {
            setRenderMode('sar_calibrated');
          } else {
            setRenderMode('true_color');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load scenes:', err);
    } finally {
      setIsLoadingScenes(false);
    }
  };

  useEffect(() => {
    loadScenes();
  }, [missionFilter, statusFilter]);

  const handleSearchSTAC = async () => {
    if (!activeAOI) return;
    setIsSearchingSTAC(true);
    setSearchFeedback(null);
    try {
      const query: SatelliteSearchQuery = {
        min_lat: activeAOI.bbox.min_lat,
        min_lon: activeAOI.bbox.min_lon,
        max_lat: activeAOI.bbox.max_lat,
        max_lon: activeAOI.bbox.max_lon,
        start_date: startDate,
        end_date: endDate,
        mission: missionFilter,
        max_cloud_cover: maxCloudCover,
        limit: 15,
      };

      const res = await api.searchSatelliteScenes(query);
      if (res.success && res.scenes.length > 0) {
        setSearchFeedback(`Discovered ${res.count} genuine Copernicus scenes via STAC Earth Search.`);
        await loadScenes();
        setSelectedSceneId(res.scenes[0].id);
      } else {
        setSearchFeedback(`STAC query completed: ${res.count} scenes found for date range. No fabricated data created.`);
        await loadScenes();
      }
    } catch (err: any) {
      setSearchFeedback(`Search notice: ${err.message}. Offline or cloud catalog timeout. Loaded local database.`);
      await loadScenes();
    } finally {
      setIsSearchingSTAC(false);
    }
  };

  const handleProcessScene = async (sceneId: string) => {
    const targetScene = scenes.find((s) => s.id === sceneId);
    if (targetScene && !targetScene.has_local_raster) {
      setSearchFeedback(`Scene '${sceneId}' is a metadata-only STAC entry. Please click 'Import GeoTIFF' to import or download the raster before calibration.`);
      return;
    }
    setIsProcessing(sceneId);
    try {
      await api.processSatelliteScene(sceneId);
      await loadScenes();
      setSelectedSceneId(sceneId);
    } catch (err: any) {
      console.error(`Processing failed: ${err.message}`);
      setSearchFeedback(`Calibration notice: ${err.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFilePath) return;
    setIsImporting(true);
    setImportStatusMsg(null);
    try {
      const req: RasterImportRequest = {
        mission: importMission,
        file_path: importFilePath,
        product_id: importProductId || undefined,
      };
      const res = await api.importGeoTIFF(req);
      setImportStatusMsg(`Successfully imported and clipped to AOI: ${res.scene.id}`);
      await loadScenes();
      setSelectedSceneId(res.scene.id);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportFilePath('');
        setImportStatusMsg(null);
      }, 1500);
    } catch (err: any) {
      setImportStatusMsg(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const activeScene = scenes.find((s) => s.id === selectedSceneId);
  const isSelectedS1 = activeScene?.mission === 'Sentinel-1';

  const leafletBounds: [[number, number], [number, number]] = activeScene?.bounds && activeScene.bounds.length === 4
    ? [
        [activeScene.bounds[0], activeScene.bounds[1]],
        [activeScene.bounds[2], activeScene.bounds[3]],
      ]
    : [
        [activeAOI?.bbox.min_lat || 26.5, activeAOI?.bbox.min_lon || 88.25],
        [activeAOI?.bbox.max_lat || 27.75, activeAOI?.bbox.max_lon || 88.85],
      ];

  const rasterOverlay: RasterOverlayConfig | null =
    selectedSceneId && !isCompareActive
      ? {
          url: api.getRasterRenderUrl(selectedSceneId, renderMode),
          bounds: leafletBounds,
          opacity,
          visible: true,
          title: activeScene?.product_id,
          renderMode,
        }
      : null;

  const compareOverlay: CompareOverlayConfig | null =
    isCompareActive && beforeSceneId && afterSceneId
      ? {
          beforeUrl: api.getRasterRenderUrl(beforeSceneId, renderMode),
          afterUrl: api.getRasterRenderUrl(afterSceneId, renderMode),
          bounds: leafletBounds,
          splitPosition: splitRatio,
          comparisonMode,
          activeView: toggleActiveView,
          opacity,
        }
      : null;

  const renderStatusBadge = (status: SceneProcessingStatus, hasLocalRaster?: boolean) => {
    if (hasLocalRaster) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
          {status === 'Processed' ? 'Calibrated' : 'Local Raster'}
        </span>
      );
    }
    switch (status) {
      case 'Processed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
            Processed
          </span>
        );
      case 'Downloaded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-2.5 h-2.5 mr-1" />
            Downloaded
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-2.5 h-2.5 mr-1" />
            Failed
          </span>
        );
      case 'Discovered':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Eye className="w-2.5 h-2.5 mr-1 text-zinc-500" />
            Metadata Only
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Satellite className="w-5 h-5 text-white" />
            <h1 className="text-xl font-bold text-white">
              Copernicus Satellite Imagery & Radar Intelligence
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real Copernicus Sentinel-1 C-SAR radar and Sentinel-2 MSI multi-spectral scenes over the Teesta Basin.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-white text-white text-xs font-semibold flex items-center space-x-2 cursor-pointer shadow transition"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-300" />
            <span>Import GeoTIFF</span>
          </button>
          <button
            onClick={loadScenes}
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-300 text-xs flex items-center space-x-1.5 cursor-pointer transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Discovery & Search Panel */}
      <div className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-zinc-300" />
              <span>STAC Satellite Scene Search</span>
            </div>
            <div className="text-[11px] text-zinc-400">
              Area of Interest: <b className="text-white">{activeAOI?.name || 'Teesta Corridor'}</b> ({activeAOI?.bbox.min_lat}°N - {activeAOI?.bbox.max_lat}°N, {activeAOI?.bbox.min_lon}°E - {activeAOI?.bbox.max_lon}°E)
              <button
                onClick={onOpenAOIModal}
                className="ml-2 text-white hover:underline cursor-pointer font-semibold"
              >
                Change AOI
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Start Date */}
            <div className="flex items-center space-x-1.5 bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] text-zinc-400 uppercase">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center space-x-1.5 bg-black border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] text-zinc-400 uppercase">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white text-xs focus:outline-none"
              />
            </div>

            {/* Mission Filter */}
            <select
              value={missionFilter}
              onChange={(e) => setMissionFilter(e.target.value as any)}
              className="bg-black border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="all">All Missions (Radar & Optical)</option>
              <option value="Sentinel-1">Sentinel-1 (C-SAR Radar)</option>
              <option value="Sentinel-2">Sentinel-2 (MSI Optical)</option>
            </select>

            {/* Cloud Cover Filter */}
            <div className="flex items-center space-x-2 bg-black border border-zinc-800 rounded-lg px-3 py-1.5 text-xs">
              <Cloud className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[10px] text-zinc-400">Max Cloud:</span>
              <span className="font-mono text-white text-xs">{maxCloudCover}%</span>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={maxCloudCover}
                onChange={(e) => setMaxCloudCover(parseInt(e.target.value))}
                className="w-16 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearchSTAC}
              disabled={isSearchingSTAC}
              className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center space-x-2 cursor-pointer disabled:opacity-50 shadow-sm transition"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isSearchingSTAC ? 'Searching STAC...' : 'Search Copernicus'}</span>
            </button>
          </div>
        </div>

        {searchFeedback && (
          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center space-x-2">
            <Info className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>{searchFeedback}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Interactive Map Viewer (Top/Left) & Scene Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Satellite Map Viewport (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-white" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Georeferenced Satellite Map Display
              </h2>
            </div>
            {activeScene && (
              <span className="text-[11px] text-zinc-400 font-mono">
                {activeScene.mission} • {activeScene.acquisition_date.split('T')[0]}
              </span>
            )}
          </div>

          <div className="relative w-full h-[480px] rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-[#050505]">
            <MapViewer
              activeAOI={activeAOI}
              activeBasemap="satellite"
              layersData={{}}
              visibleLayers={{ aoi_corridor: true }}
              rasterOverlay={rasterOverlay}
              compareOverlay={compareOverlay}
            />

            {/* Map Overlay Floating Controls */}
            <div className="absolute top-3 right-3 z-[1000] w-64 bg-[#111113]/95 backdrop-blur-md border border-zinc-800 rounded-lg p-3 space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center space-x-1">
                  <Sliders className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Layer Mode</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {Math.round(opacity * 100)}%
                </span>
              </div>

              {/* Mode Switcher */}
              <select
                value={renderMode}
                onChange={(e) => setRenderMode(e.target.value as RasterRenderMode)}
                className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
              >
                {isSelectedS1 ? (
                  <>
                    <option value="sar_calibrated">SAR Backscatter (σ⁰ dB)</option>
                    <option value="sar_water_mask">Filtered Flood Water (Excl. Shadow)</option>
                  </>
                ) : (
                  <>
                    <option value="true_color">True-Color RGB (B04, B03, B02)</option>
                    <option value="ndwi">NDWI Water Index ((G - NIR)/(G + NIR))</option>
                    <option value="cloud_mask">Optical Cloud Mask</option>
                  </>
                )}
              </select>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Compare Toggle */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">Before/After Comparison</span>
                <button
                  onClick={() => {
                    if (!isCompareActive && scenes.length >= 2) {
                      setBeforeSceneId(scenes[1].id);
                      setAfterSceneId(scenes[0].id);
                    }
                    setIsCompareActive(!isCompareActive);
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded font-semibold cursor-pointer transition ${
                    isCompareActive
                      ? 'bg-white text-black font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {isCompareActive ? 'Exit Split' : 'Compare'}
                </button>
              </div>

              {isCompareActive && (
                <div className="space-y-1.5 pt-1 text-[10px]">
                  <div className="flex justify-between text-zinc-400">
                    <span>Split Ratio:</span>
                    <span className="font-mono text-white">{splitRatio}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splitRatio}
                    onChange={(e) => setSplitRatio(parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Active Scene Legend & Calibration Notes */}
          <div className="rounded-lg bg-[#111113] border border-zinc-800 p-3 text-xs space-y-1.5">
            <div className="text-white font-semibold flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              <span>Scientific Processing & False-Positive Elimination</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {isSelectedS1
                ? 'Sentinel-1 C-SAR radar backscatter is radiometrically calibrated to decibels (σ⁰ dB) with a 3×3 speckle suppression filter. In accordance with strict disaster protocols, radar shadows from steep Himalayan terrain and the permanent Teesta riverbed are screened out so that only genuine floodwater inundation is highlighted.'
                : 'Sentinel-2 Level-2A surface reflectance is enhanced using dynamic 2%–98% percentile stretching across B04 (Red), B03 (Green), and B02 (Blue). NDWI is mathematically derived as (B03 - B08)/(B03 + B08) with positive values mapping to open water.'}
            </p>
          </div>
        </div>

        {/* Selected Scene Metadata Card (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Selected Scene Telemetry
            </h2>
            {activeScene && renderStatusBadge(activeScene.status, activeScene.has_local_raster)}
          </div>

          {activeScene ? (
            <div className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-4 shadow-xl">
              <div>
                <div className="text-xs font-mono font-bold text-white break-all">
                  {activeScene.product_id}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Acquired on {new Date(activeScene.acquisition_date).toUTCString()}
                </div>
              </div>

              {/* Key Specs Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Mission / Sensor</div>
                  <div className="font-semibold text-white mt-0.5">
                    {activeScene.mission} ({activeScene.instrument})
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Platform</div>
                  <div className="font-semibold text-white mt-0.5">
                    {activeScene.platform}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Coordinate System</div>
                  <div className="font-semibold text-white mt-0.5">
                    {activeScene.crs || 'EPSG:4326 (WGS84)'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Spatial Resolution</div>
                  <div className="font-semibold text-white mt-0.5">
                    {activeScene.resolution_m || (activeScene.mission === 'Sentinel-2' ? '10m' : '20m')} GSD
                  </div>
                </div>

                {activeScene.cloud_cover !== null && activeScene.cloud_cover !== undefined && (
                  <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase">Cloud Coverage</div>
                    <div className="font-semibold text-amber-400 mt-0.5">
                      {activeScene.cloud_cover}%
                    </div>
                  </div>
                )}

                {activeScene.orbit_direction && (
                  <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 uppercase">Orbit Pass</div>
                    <div className="font-semibold text-white mt-0.5">
                      {activeScene.orbit_direction}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Message */}
              <div className="p-3 rounded-lg bg-black border border-zinc-800 text-xs">
                <div className="text-[10px] text-zinc-500 uppercase font-bold">Processing Audit Log</div>
                <div className="text-zinc-300 text-[11px] mt-0.5">
                  {activeScene.status_message || 'Scene discovered and cataloged in local SQLite database.'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                {activeScene.has_local_raster ? (
                  <button
                    onClick={() => handleProcessScene(activeScene.id)}
                    disabled={isProcessing === activeScene.id}
                    className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-sm disabled:opacity-50 transition"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {isProcessing === activeScene.id
                        ? 'Calibrating & Rendering...'
                        : activeScene.status === 'Processed'
                        ? 'Re-process Scene Products'
                        : 'Process & Calibrate Imagery'}
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full py-2.5 px-4 rounded-lg bg-zinc-800/70 text-zinc-500 text-xs font-bold flex items-center justify-center space-x-2 cursor-not-allowed border border-zinc-700/50"
                    >
                      <Play className="w-4 h-4 text-zinc-600" />
                      <span>Process & Calibrate Imagery</span>
                    </button>
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Metadata Only — Click &quot;Import GeoTIFF&quot; above to import or download full raster.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Official Copernicus Attribution */}
              <div className="text-[10px] text-zinc-500 leading-tight pt-2 border-t border-zinc-800">
                Data provided under Copernicus Open Access Policy. European Space Agency (ESA).
                Strict zero-fabrication protocol active.
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[#111113] border border-zinc-800 p-8 text-center text-xs text-zinc-500">
              Select a scene from the catalog below to inspect telemetry.
            </div>
          )}
        </div>
      </div>

      {/* Discovered & Registered Satellite Scenes Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-white" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Copernicus Satellite Scenes Database ({scenes.length} Registered)
            </h2>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-zinc-500">Status Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black border border-zinc-800 rounded px-2.5 py-1 text-zinc-300 text-xs focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Processed">Processed Only</option>
              <option value="Downloaded">Downloaded Only</option>
              <option value="Discovered">Discovered Only</option>
              <option value="Failed">Failed Only</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#111113] shadow-xl">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-black border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Mission</th>
                <th className="py-3 px-4">Product Identifier</th>
                <th className="py-3 px-4">Acquisition Date</th>
                <th className="py-3 px-4">Cloud Cover</th>
                <th className="py-3 px-4">Orbit / Sensor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 font-mono text-[11px]">
              {scenes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-zinc-500 font-sans">
                    No satellite scenes found matching filter. Query STAC above to discover real acquisitions.
                  </td>
                </tr>
              ) : (
                scenes.map((s) => {
                  const isSelected = s.id === selectedSceneId;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => {
                        setSelectedSceneId(s.id);
                        if (s.mission === 'Sentinel-1') setRenderMode('sar_calibrated');
                        else setRenderMode('true_color');
                      }}
                      className={`hover:bg-zinc-800/40 transition cursor-pointer ${
                        isSelected ? 'bg-zinc-900 border-l-2 border-l-white' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-sans font-bold">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-200 border border-zinc-700"
                        >
                          {s.mission}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white font-mono truncate max-w-xs">
                        {s.id}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {s.acquisition_date.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-3 px-4">
                        {s.cloud_cover !== null && s.cloud_cover !== undefined ? (
                          <span className={s.cloud_cover > 30 ? 'text-amber-400' : 'text-emerald-400'}>
                            {s.cloud_cover}%
                          </span>
                        ) : (
                          <span className="text-zinc-600">N/A (Radar)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {s.instrument} {s.orbit_direction ? `(${s.orbit_direction})` : ''}
                      </td>
                      <td className="py-3 px-4">{renderStatusBadge(s.status, s.has_local_raster)}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {s.has_local_raster ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProcessScene(s.id);
                            }}
                            disabled={isProcessing === s.id}
                            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-white hover:text-black text-zinc-200 text-[10px] font-sans font-semibold transition cursor-pointer disabled:opacity-50"
                          >
                            {isProcessing === s.id ? 'Processing...' : 'Process'}
                          </button>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-sans bg-zinc-900 text-zinc-500 border border-zinc-800">
                            Metadata Only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Local GeoTIFF Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Import Sentinel GeoTIFF Raster
                </h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-300 font-semibold">Mission Type</label>
                <select
                  value={importMission}
                  onChange={(e) => setImportMission(e.target.value as any)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="Sentinel-2">Sentinel-2 MSI (Multi-Spectral L2A)</option>
                  <option value="Sentinel-1">Sentinel-1 C-SAR (Radar GRD)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-300 font-semibold">Local File Path (GeoTIFF)</label>
                <input
                  type="text"
                  placeholder="e.g. C:/data/S2_Teesta_2026.tif"
                  value={importFilePath}
                  onChange={(e) => setImportFilePath(e.target.value)}
                  required
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-zinc-500">
                  GeoTIFF will be inspected, reprojected to EPSG:4326 (WGS84) if projected in UTM, and clipped to the active AOI.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-300 font-semibold">Optional Product ID / Label</label>
                <input
                  type="text"
                  placeholder="e.g. S2B_TEESTA_FLOOD_2026"
                  value={importProductId}
                  onChange={(e) => setImportProductId(e.target.value)}
                  className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none font-mono"
                />
              </div>

              {importStatusMsg && (
                <div className="p-3 rounded-lg bg-black border border-zinc-800 text-xs text-white">
                  {importStatusMsg}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importFilePath}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-bold cursor-pointer disabled:opacity-50 transition"
                >
                  {isImporting ? 'Processing & Clipping...' : 'Import & Reproject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
