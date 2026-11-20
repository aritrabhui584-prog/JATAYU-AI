import React from 'react';
import { LayerMetadata } from '../types';
import {
  Layers,
  Eye,
  EyeOff,
  Download,
  Map,
  Mountain,
  Navigation,
  Compass,
  Waves,
  Hospital,
  AlertTriangle,
  Route,
  ShieldAlert,
} from 'lucide-react';

export type BasemapType = 'satellite' | 'osm' | 'dark' | 'topo';

interface LayerControlPanelProps {
  layers: LayerMetadata[];
  visibleLayers: Record<string, boolean>;
  onToggleLayer: (layerKey: string) => void;
  activeBasemap: BasemapType;
  onChangeBasemap: (basemap: BasemapType) => void;
  onDownloadLayer: (layerKey: string) => void;
}

export const LayerControlPanel: React.FC<LayerControlPanelProps> = ({
  layers,
  visibleLayers,
  onToggleLayer,
  activeBasemap,
  onChangeBasemap,
  onDownloadLayer,
}) => {
  const basemaps: { id: BasemapType; name: string; icon: React.ReactNode }[] = [
    { id: 'satellite', name: 'Satellite (Esri)', icon: <Map className="w-3.5 h-3.5" /> },
    { id: 'dark', name: 'Dark CartoDB', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'topo', name: 'Terrain (OpenTopo)', icon: <Mountain className="w-3.5 h-3.5" /> },
    { id: 'osm', name: 'OSM Standard', icon: <Navigation className="w-3.5 h-3.5" /> },
  ];

  const crisisLayers = [
    {
      key: 'flood_extent',
      name: 'Flood Inundation Extent',
      desc: 'Copernicus Sentinel-1 SAR & DEM',
      icon: <Waves className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      key: 'priority_markers',
      name: 'Emergency Priority Markers',
      desc: 'P1-P4 Multi-Criteria Roster & Top 5',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
    },
    {
      key: 'relief_centers',
      name: 'Relief Hubs & Hospitals',
      desc: 'OSM Healthcare Facilities & Trauma',
      icon: <Hospital className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      key: 'emergency_routes',
      name: 'Evacuation Corridors',
      desc: 'Alternative Detour Routes (NetworkX)',
      icon: <Route className="w-3.5 h-3.5 text-amber-400" />,
    },
  ];

  return (
    <div className="absolute top-4 right-4 z-[1000] w-72 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-4 text-xs text-slate-300 space-y-4 max-h-[85vh] overflow-y-auto">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
            GIS Layer Control
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">WGS84 EPSG:4326</span>
      </div>

      {/* Basemap Selection */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Basemap Tiles
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {basemaps.map((b) => (
            <button
              key={b.id}
              onClick={() => onChangeBasemap(b.id)}
              className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                activeBasemap === b.id
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{b.icon}</span>
              <span className="truncate">{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Phase 6 & 7: Crisis & Intelligence Layers */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider flex items-center space-x-1">
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          <span>Crisis Intelligence Layers</span>
        </div>
        <div className="space-y-1.5">
          {crisisLayers.map((cl) => {
            const isVisible = visibleLayers[cl.key] ?? true;
            return (
              <div
                key={cl.key}
                className={`p-2 rounded-lg border flex items-center justify-between transition ${
                  isVisible
                    ? 'bg-slate-900/90 border-slate-700/80'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <button
                    onClick={() => onToggleLayer(cl.key)}
                    className="cursor-pointer text-slate-400 hover:text-cyan-400"
                    title={isVisible ? 'Hide layer' : 'Show layer'}
                  >
                    {isVisible ? (
                      <Eye className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate text-[11px] flex items-center space-x-1.5">
                      <span>{cl.icon}</span>
                      <span>{cl.name}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 truncate font-mono">
                      {cl.desc}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vector Geospatial Layers */}
      <div className="space-y-2">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Vector Geographic Layers
        </div>
        <div className="space-y-1.5">
          {layers.map((layer) => {
            const isVisible = visibleLayers[layer.layer_key] ?? true;
            return (
              <div
                key={layer.layer_key}
                className={`p-2 rounded-lg border flex items-center justify-between transition ${
                  isVisible
                    ? 'bg-slate-900/90 border-slate-700/80'
                    : 'bg-slate-950/60 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <button
                    onClick={() => onToggleLayer(layer.layer_key)}
                    className="cursor-pointer text-slate-400 hover:text-cyan-400"
                    title={isVisible ? 'Hide layer' : 'Show layer'}
                  >
                    {isVisible ? (
                      <Eye className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate text-[11px]">
                      {layer.layer_name}
                    </div>
                    <div className="flex items-center space-x-1.5 text-[9px] text-slate-400 font-mono">
                      <span>{layer.feature_count} features</span>
                      <span>•</span>
                      <span className="truncate">{layer.data_source}</span>
                    </div>
                  </div>
                </div>

                {layer.is_available && (
                  <button
                    onClick={() => onDownloadLayer(layer.layer_key)}
                    className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition cursor-pointer"
                    title="Download Layer GeoJSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Layer legend preview */}
      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5 text-[10px]">
        <div className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">
          Symbology Legend
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
          <span className="text-slate-300">P1 Critical Settlement (Top 5 Pulse)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-300">P2 High Watch Settlement</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-300">Relief Hub / Hospital (Trauma)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-0.5 bg-amber-500" />
          <span className="text-slate-300">Primary / Trunk Highways (NH10)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-0.5 bg-cyan-400" />
          <span className="text-slate-300">Teesta River & Main Channels</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-2 border border-dashed border-cyan-400 bg-cyan-500/10" />
          <span className="text-slate-300">Active AOI Boundary</span>
        </div>
      </div>
    </div>
  );
};
