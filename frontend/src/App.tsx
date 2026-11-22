import React, { useState, useEffect, useCallback } from 'react';
import {
  AOIConfig,
  AOIPreset,
  BoundingBox,
  LayerMetadata,
  RoadNetworkStats,
  SentinelScene,
  ServiceStatus,
  SettlementIsolationResponse,
} from './types';
import * as api from './api/client';
import { Navbar } from './components/Navbar';
import { Sidebar, PageId } from './components/Sidebar';
import { AOISelector } from './components/AOISelector';
import { OverviewPage } from './pages/OverviewPage';
import { UnifiedCommandMapPage } from './pages/UnifiedCommandMapPage';
import { IndiaSurveillanceGridPage } from './pages/IndiaSurveillanceGridPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { SatellitePage } from './pages/SatellitePage';
import { FloodAnalysisPage } from './pages/FloodAnalysisPage';
import { VillageIsolationPage } from './pages/VillageIsolationPage';
import { NightLightPage } from './pages/NightLightPage';
import { EmergencyPrioritiesPage } from './pages/EmergencyPrioritiesPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [activeAOI, setActiveAOI] = useState<AOIConfig | null>(null);
  const [presets, setPresets] = useState<AOIPreset[]>([]);
  const [isAOIModalOpen, setIsAOIModalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('jatayu-theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('jatayu-theme', next);
      return next;
    });
  };

  // Data states
  const [servicesStatus, setServicesStatus] = useState<ServiceStatus[]>([]);
  const [layers, setLayers] = useState<LayerMetadata[]>([]);
  const [layersData, setLayersData] = useState<{
    osm_roads?: any;
    osm_settlements?: any;
    osm_waterways?: any;
    osm_facilities?: any;
    osm_railways?: any;
    aoi_corridor?: any;
    hlz_landing_zones?: any;
  }>({});
  const [roadStats, setRoadStats] = useState<RoadNetworkStats | null>(null);
  const [isolationData, setIsolationData] = useState<SettlementIsolationResponse | null>(null);
  const [elevationData, setElevationData] = useState<any>(null);
  const [meteoData, setMeteoData] = useState<any>(null);
  const [sentinel1Scenes, setSentinel1Scenes] = useState<SentinelScene[]>([]);
  const [sentinel2Scenes, setSentinel2Scenes] = useState<SentinelScene[]>([]);
  const [selectedRasterSceneId, setSelectedRasterSceneId] = useState<string | null>(null);
  const [viirsData, setVIIRSData] = useState<any>(null);
  const [dataCatalog, setDataCatalog] = useState<any>(null);

  // UI status
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  // Load all foundational data
  const loadInitialData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [aoi, pr, st, l, cat] = await Promise.all([
        api.fetchActiveAOI().catch(() => null),
        api.fetchAOIPresets().catch(() => []),
        api.fetchServicesStatus().catch(() => []),
        api.fetchLayers().catch(() => []),
        api.fetchDataSourcesCatalog().catch(() => null),
      ]);

      if (aoi) setActiveAOI(aoi);
      if (pr) setPresets(pr);
      if (st) setServicesStatus(st);
      if (l) setLayers(l);
      if (cat) setDataCatalog(cat);

      // Load AOI GeoJSON
      const aoiGeo = await api.fetchLayerGeoJSON('aoi_corridor').catch(() => null);

      // Attempt to load cached layers if already ingested
      const [roads, settlements, waterways, facilities, railways, hlz] = await Promise.all([
        api.fetchLayerGeoJSON('osm_roads').catch(() => null),
        api.fetchLayerGeoJSON('osm_settlements').catch(() => null),
        api.fetchLayerGeoJSON('osm_waterways').catch(() => null),
        api.fetchLayerGeoJSON('osm_facilities').catch(() => null),
        api.fetchLayerGeoJSON('osm_railways').catch(() => null),
        api.fetchHelicopterLandingZones().catch(() => null),
      ]);

      setLayersData({
        aoi_corridor: aoiGeo,
        osm_roads: roads,
        osm_settlements: settlements,
        osm_waterways: waterways,
        osm_facilities: facilities,
        osm_railways: railways,
        hlz_landing_zones: hlz,
      });

      // Load secondary intelligence
      const [net, iso, ele, meteo, s1, s2, viirs] = await Promise.all([
        api.fetchRoadNetworkStats().catch(() => null),
        api.fetchSettlementIsolation().catch(() => null),
        api.fetchElevationProfile().catch(() => null),
        api.fetchMeteoObservations().catch(() => null),
        api.fetchSentinel1Scenes().catch(() => null),
        api.fetchSentinel2Scenes().catch(() => null),
        api.fetchVIIRSStatus().catch(() => null),
      ]);

      if (net) setRoadStats(net);
      if (iso) setIsolationData(iso);
      if (ele) setElevationData(ele);
      if (meteo) setMeteoData(meteo);
      if (s1?.scenes) setSentinel1Scenes(s1.scenes);
      if (s2?.scenes) setSentinel2Scenes(s2.scenes);
      if (viirs) setVIIRSData(viirs);
    } catch (err: any) {
      showNotification('error', `Initial connection failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle Preset AOI Selection
  const handleSelectPreset = async (presetId: string) => {
    try {
      const updated = await api.selectAOIPreset(presetId);
      setActiveAOI(updated);
      showNotification('success', `Active Area of Interest set to: ${updated.name}`);
      await loadInitialData();
    } catch (err: any) {
      showNotification('error', `Failed to set preset: ${err.message}`);
      throw err;
    }
  };

  // Handle Custom AOI Selection
  const handleSetCustomAOI = async (bbox: BoundingBox, name: string) => {
    try {
      const updated = await api.setCustomAOI(bbox, name);
      setActiveAOI(updated);
      showNotification('success', `Custom AOI configured: ${name}`);
      await loadInitialData();
    } catch (err: any) {
      showNotification('error', `Failed to set custom AOI: ${err.message}`);
      throw err;
    }
  };

  // Trigger ingestion for a specific service
  const handleTriggerService = async (serviceId: string) => {
    setLoadingService(serviceId);
    try {
      const res = await api.triggerIngestion(serviceId);
      if (res.result?.success) {
        showNotification(
          'success',
          `${serviceId.toUpperCase()} ingestion successful: ${res.result.total_features ?? res.result.items_count ?? 'Complete'}`
        );
      } else {
        showNotification(
          'error',
          `${serviceId.toUpperCase()}: ${res.result?.error || 'Ingestion returned error. No fake data substituted.'}`
        );
      }
      await loadInitialData();
    } catch (err: any) {
      showNotification('error', `${serviceId.toUpperCase()} ingestion failed: ${err.message}`);
    } finally {
      setLoadingService(null);
    }
  };

  // Trigger ingestion for ALL services
  const handleTriggerAll = async () => {
    setLoadingService('ALL');
    try {
      showNotification('info', 'Triggering all 7 independent services...');
      await api.triggerAllIngestions();
      showNotification('success', 'Batch ingestion cycle completed.');
      await loadInitialData();
    } catch (err: any) {
      showNotification('error', `Batch ingestion encountered errors: ${err.message}`);
    } finally {
      setLoadingService(null);
    }
  };

  // Clear cache for a service
  const handleClearService = async (serviceId: string) => {
    try {
      await api.clearServiceCache(serviceId);
      showNotification('info', `Cache cleared for ${serviceId.toUpperCase()}`);
      await loadInitialData();
    } catch (err: any) {
      showNotification('error', `Failed to clear cache: ${err.message}`);
    }
  };

  // Download layer GeoJSON
  const handleDownloadLayer = async (layerKey: string) => {
    try {
      const data = await api.fetchLayerGeoJSON(layerKey);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/geo+json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${layerKey}.geojson`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', `Exported ${layerKey}.geojson`);
    } catch (err: any) {
      showNotification('error', `Download failed: ${err.message}`);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col antialiased transition-colors duration-200 ${
      theme === 'light' ? 'theme-briefing-light bg-white text-zinc-950' : 'theme-command-dark bg-[#050505] text-white'
    }`}>
      {/* Top Navbar */}
      <Navbar
        activeAOI={activeAOI}
        onRefresh={loadInitialData}
        isRefreshing={isRefreshing}
        onOpenAOIModal={() => setIsAOIModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        {/* Navigation Sidebar (Auto-Hiding Floating Overlay) */}
        <Sidebar currentPage={currentPage} onSelectPage={setCurrentPage} />

        {/* Content Pane - Edge-to-Edge 100vw Workspace */}
        <main
          className={`flex-1 ${
            ['command-map', 'india-surveillance', 'map'].includes(currentPage)
              ? 'p-0 overflow-hidden'
              : 'p-6 overflow-y-auto'
          } bg-[#050505] relative w-full h-[calc(100vh-4rem)]`}
        >
          {/* Notification Toast */}
          {notification && (
            <div
              className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl max-w-md flex items-start space-x-3 backdrop-blur-md transition-all duration-300 ${notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
                : notification.type === 'error'
                  ? 'bg-rose-950/90 border-rose-700 text-rose-200'
                  : 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
                }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed flex-1">{notification.message}</div>
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Page Routing */}
          {currentPage === 'overview' && (
            <OverviewPage
              activeAOI={activeAOI}
              servicesStatus={servicesStatus}
              roadStats={roadStats}
              isolationData={isolationData}
              elevationData={elevationData}
              meteoData={meteoData}
              onTriggerService={handleTriggerService}
              onTriggerAll={handleTriggerAll}
              onClearService={handleClearService}
              onOpenAOIModal={() => setIsAOIModalOpen(true)}
              onNavigatePage={(pageId) => setCurrentPage(pageId)}
              loadingService={loadingService}
            />
          )}

          {currentPage === 'command-map' && (
            <UnifiedCommandMapPage
              activeAOI={activeAOI}
              layersData={layersData}
            />
          )}

          {currentPage === 'india-surveillance' && (
            <IndiaSurveillanceGridPage />
          )}

          {currentPage === 'map' && (
            <LiveMapPage
              activeAOI={activeAOI}
              layers={layers}
              layersData={layersData}
              onDownloadLayer={handleDownloadLayer}
              onOpenAOIModal={() => setIsAOIModalOpen(true)}
              selectedRasterSceneId={selectedRasterSceneId}
            />
          )}

          {currentPage === 'satellite' && (
            <SatellitePage
              activeAOI={activeAOI}
              onOpenAOIModal={() => setIsAOIModalOpen(true)}
              onViewOnLiveMap={(sceneId) => {
                setSelectedRasterSceneId(sceneId);
                setCurrentPage('map');
              }}
            />
          )}

          {currentPage === 'flood' && (
            <FloodAnalysisPage
              activeAOI={activeAOI}
              onOpenAOIModal={() => setIsAOIModalOpen(true)}
            />
          )}

          {currentPage === 'isolation' && (
            <VillageIsolationPage
              isolationData={isolationData}
              roadStats={roadStats}
              layersData={layersData}
              onRefreshIsolation={() => handleTriggerService('osm')}
              isLoading={loadingService === 'osm'}
              activeAOI={activeAOI}
            />
          )}

          {currentPage === 'nightlight' && (
            <NightLightPage
              viirsData={viirsData}
              onRefreshVIIRS={() => handleTriggerService('viirs')}
              isLoading={loadingService === 'viirs'}
              activeAOI={activeAOI}
            />
          )}

          {currentPage === 'priorities' && (
            <EmergencyPrioritiesPage
              activeAOI={activeAOI}
              isolationData={isolationData}
              onRefreshPriorities={() => handleTriggerService('osm')}
              isLoading={loadingService === 'osm'}
            />
          )}

          {currentPage === 'methodology' && <MethodologyPage catalog={dataCatalog} />}
        </main>
      </div>

      {/* AOI Configuration Modal */}
      <AOISelector
        activeAOI={activeAOI}
        presets={presets}
        isOpen={isAOIModalOpen}
        onClose={() => setIsAOIModalOpen(false)}
        onSelectPreset={handleSelectPreset}
        onSetCustom={handleSetCustomAOI}
      />
    </div>
  );
};
export default App;
