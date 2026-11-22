import React, { useEffect, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  ScaleControl,
  ImageOverlay,
  Polyline,
  Tooltip as LeafletTooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { BasemapType } from './LayerControlPanel';
import {
  AOIConfig,
  EmergencyFacility,
  EmergencyRoute,
  VillagePriorityItem,
} from '../types';
import { Hospital, Plane, Train, X } from 'lucide-react';
import { AreaReconDrawer } from './AreaReconDrawer';

export interface RasterOverlayConfig {
  url: string;
  bounds: [[number, number], [number, number]];
  opacity: number;
  visible: boolean;
  title?: string;
  renderMode?: string;
}

export interface CompareOverlayConfig {
  beforeUrl: string;
  afterUrl: string;
  bounds: [[number, number], [number, number]];
  splitPosition: number; // 0 to 100
  comparisonMode: 'split' | 'toggle';
  activeView: 'before' | 'after';
  opacity: number;
  beforeTitle?: string;
  afterTitle?: string;
}

export interface FloodOverlayConfig {
  url: string;
  bounds: [[number, number], [number, number]];
  opacity: number;
  visible: boolean;
  title?: string;
}

interface MapViewerProps {
  activeAOI: AOIConfig | null;
  activeBasemap: BasemapType;
  layersData: {
    osm_roads?: any;
    osm_settlements?: any;
    osm_waterways?: any;
    aoi_corridor?: any;
    flood_extent?: any;
    hlz_landing_zones?: any;
  };
  visibleLayers: Record<string, boolean>;
  rasterOverlay?: RasterOverlayConfig | null;
  compareOverlay?: CompareOverlayConfig | null;
  floodOverlay?: FloodOverlayConfig | null;
  reliefFacilities?: EmergencyFacility[];
  priorityVillages?: VillagePriorityItem[];
  emergencyRoutes?: EmergencyRoute[];
  onSelectVillage?: (village: VillagePriorityItem) => void;
}

// Controller component to smoothly fit map to AOI bounds or raster bounds and invalidate sizing
const MapViewController: React.FC<{
  activeAOI: AOIConfig | null;
  rasterOverlay?: RasterOverlayConfig | null;
}> = ({ activeAOI, rasterOverlay }) => {
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
    if (rasterOverlay && rasterOverlay.bounds) {
      const bounds = L.latLngBounds(rasterOverlay.bounds[0], rasterOverlay.bounds[1]);
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14, animate: true });
    } else if (activeAOI) {
      const bounds = L.latLngBounds(
        [activeAOI.bbox.min_lat, activeAOI.bbox.min_lon],
        [activeAOI.bbox.max_lat, activeAOI.bbox.max_lon]
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13, animate: true });
    }
  }, [activeAOI, rasterOverlay, map]);
  return null;
};

// Controller to smoothly pan & zoom to target coordinates (e.g., from AreaReconDrawer)
const MapZoomController: React.FC<{
  target: { lat: number; lon: number; zoom: number; timestamp: number } | null;
}> = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lon], target.zoom, { animate: true, duration: 1.2 });
    }
  }, [target, map]);
  return null;
};

// Tactical Ground Recon Helpers & Event Controller
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

export const MapViewer: React.FC<MapViewerProps> = ({
  activeAOI,
  activeBasemap,
  layersData,
  visibleLayers,
  rasterOverlay,
  compareOverlay,
  floodOverlay,
  reliefFacilities = [],
  priorityVillages = [],
  emergencyRoutes = [],
  onSelectVillage,
}) => {
  // Live Cursor Telemetry & Ground Sector Recon Inspector State
  const [currentZoom, setCurrentZoom] = useState<number>(11);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number }>({ lat: 26.9200, lon: 88.4800 });
  const [reconState, setReconState] = useState<{
    coords: { lat: number; lon: number } | null;
    name?: string;
    category?: string;
    priorityScore?: number;
    isolationStatus?: string;
  }>({ coords: null });
  const [zoomTarget, setZoomTarget] = useState<{ lat: number; lon: number; zoom: number; timestamp: number } | null>(null);

  const defaultCenter: [number, number] = activeAOI
    ? [
      (activeAOI.bbox.min_lat + activeAOI.bbox.max_lat) / 2,
      (activeAOI.bbox.min_lon + activeAOI.bbox.max_lon) / 2,
    ]
    : [26.92, 88.48];

  const getTileConfig = (basemap: BasemapType) => {
    switch (basemap) {
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          transportationUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
          labelsUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          attribution:
            '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          maxNativeZoom: 16,
          labelsMaxNativeZoom: 16,
          maxZoom: 18,
        };
      case 'dark':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          transportationUrl: null,
          labelsUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
          attribution:
            '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community',
          maxNativeZoom: 15,
          labelsMaxNativeZoom: 15,
          maxZoom: 18,
        };
      case 'topo':
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          transportationUrl: null,
          labelsUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          attribution:
            '&copy; OpenStreetMap contributors, &copy; Esri',
          maxNativeZoom: 18,
          labelsMaxNativeZoom: 16,
          maxZoom: 18,
        };
      case 'osm':
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          transportationUrl: null,
          labelsUrl: null,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxNativeZoom: 18,
          maxZoom: 18,
        };
    }
  };

  const tile = getTileConfig(activeBasemap);

  // Styling for Road Network GeoJSON
  const roadStyle = (feature: any) => {
    const hw = feature?.properties?.highway;
    let color = '#94a3b8';
    let weight = 1.5;
    let opacity = 0.8;

    if (hw === 'motorway' || hw === 'trunk') {
      color = '#f59e0b'; // Vibrant amber for NH10 / trunk
      weight = 3.5;
      opacity = 0.95;
    } else if (hw === 'primary') {
      color = '#fbbf24';
      weight = 3.0;
      opacity = 0.9;
    } else if (hw === 'secondary') {
      color = '#38bdf8'; // Blue for secondary valley routes
      weight = 2.2;
      opacity = 0.85;
    } else if (hw === 'tertiary') {
      color = '#818cf8';
      weight = 1.8;
    }

    return { color, weight, opacity };
  };

  // Styling for Waterways GeoJSON
  const waterwayStyle = () => ({
    color: '#06b6d4', // Vibrant Cyan for Teesta & mountain streams
    weight: 3.5,
    opacity: 0.9,
  });

  // Styling for AOI Bounding Box GeoJSON
  const aoiStyle = () => ({
    color: '#ffffff',
    weight: 2,
    dashArray: '6, 6',
    fillColor: '#ffffff',
    fillOpacity: 0.05,
  });

  // Map settlement names to priority item for rich priority pin rendering
  const priorityMap = new Map<string, VillagePriorityItem>();
  priorityVillages.forEach((v) => {
    priorityMap.set(v.name.toLowerCase(), v);
    priorityMap.set(String(v.osm_id), v);
  });

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        zoomSnap={1}
        zoomDelta={1}
        wheelPxPerZoomLevel={120}
        maxZoom={18}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapViewController activeAOI={activeAOI} rasterOverlay={rasterOverlay} />
        <MapZoomController target={zoomTarget} />
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

        {/* Dynamic Basemap Tiles */}
        <TileLayer
          key={activeBasemap}
          url={tile.url}
          attribution={tile.attribution}
          maxNativeZoom={tile.maxNativeZoom}
          maxZoom={tile.maxZoom || 18}
          detectRetina={false}
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        />
        {tile.transportationUrl && (
          <TileLayer
            key={`${activeBasemap}-transport`}
            url={tile.transportationUrl}
            attribution=""
            maxNativeZoom={tile.maxNativeZoom}
            maxZoom={tile.maxZoom || 18}
            detectRetina={false}
            opacity={0.85}
            zIndex={385}
            errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
          />
        )}
        {tile.labelsUrl && (
          <TileLayer
            key={`${activeBasemap}-labels`}
            url={tile.labelsUrl}
            attribution=""
            maxNativeZoom={tile.labelsMaxNativeZoom || tile.maxNativeZoom}
            maxZoom={tile.maxZoom || 18}
            detectRetina={false}
            zIndex={650}
            errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
          />
        )}

        <ScaleControl position="bottomleft" imperial={false} />

        {/* Phase 2: Real Satellite Raster Imagery Overlay (Auto-Cleared at zoom >= 13 for sub-meter Maxar clarity) */}
        {rasterOverlay && rasterOverlay.visible && rasterOverlay.url && (
          <ImageOverlay
            key={`raster-${rasterOverlay.url}-${rasterOverlay.opacity}`}
            url={rasterOverlay.url}
            bounds={rasterOverlay.bounds}
            opacity={currentZoom >= 13 ? 0 : rasterOverlay.opacity}
            zIndex={380}
          />
        )}

        {/* Phase 3: Real Flood Extent Inundation Overlay (Auto-Cleared at zoom >= 13 in favor of crisp vector contours) */}
        {floodOverlay && floodOverlay.visible && floodOverlay.url && visibleLayers['flood_extent'] !== false && (
          <ImageOverlay
            key={`flood-${floodOverlay.url}-${floodOverlay.opacity}`}
            url={floodOverlay.url}
            bounds={floodOverlay.bounds}
            opacity={currentZoom >= 13 ? 0 : floodOverlay.opacity}
            zIndex={410}
          />
        )}

        {/* Phase 2: Before/After Comparison Overlay */}
        {compareOverlay && (
          <>
            {compareOverlay.comparisonMode === 'toggle' ? (
              <ImageOverlay
                key={`compare-toggle-${compareOverlay.activeView}`}
                url={
                  compareOverlay.activeView === 'before'
                    ? compareOverlay.beforeUrl
                    : compareOverlay.afterUrl
                }
                bounds={compareOverlay.bounds}
                opacity={compareOverlay.opacity}
                zIndex={390}
              />
            ) : (
              // Split Comparison: Dual image overlays
              <>
                <ImageOverlay
                  key={`compare-before-${compareOverlay.beforeUrl}`}
                  url={compareOverlay.beforeUrl}
                  bounds={compareOverlay.bounds}
                  opacity={compareOverlay.opacity}
                  zIndex={385}
                />
                <ImageOverlay
                  key={`compare-after-${compareOverlay.afterUrl}`}
                  url={compareOverlay.afterUrl}
                  bounds={compareOverlay.bounds}
                  opacity={compareOverlay.opacity * (compareOverlay.splitPosition / 100)}
                  zIndex={395}
                />
              </>
            )}
          </>
        )}

        {/* Active AOI Boundary Polygon */}
        {visibleLayers['aoi_corridor'] !== false && layersData.aoi_corridor && (
          <GeoJSON
            key={`aoi-${activeAOI?.id}`}
            data={layersData.aoi_corridor}
            style={aoiStyle}
            onEachFeature={(feature, layer) => {
              layer.bindPopup(`
                <div style="font-family: sans-serif; font-size: 12px; line-height: 1.5;">
                  <strong style="color: #ffffff; font-size: 13px;">${feature.properties?.name || 'Area of Interest'}</strong>
                  <div style="margin-top: 4px; color: #a1a1aa;">
                    Approx Area: <b>${feature.properties?.area_approx_sqkm} km²</b><br/>
                    Center: <b>${feature.properties?.center_lat}°N, ${feature.properties?.center_lon}°E</b><br/>
                    Bounds: [${feature.properties?.min_lat}°N to ${feature.properties?.max_lat}°N]
                  </div>
                </div>
              `);
            }}
          />
        )}

        {/* Waterways Layer (Teesta River & tributaries) */}
        {visibleLayers['osm_waterways'] !== false && layersData.osm_waterways && (
          <GeoJSON
            key="osm_waterways"
            data={layersData.osm_waterways}
            style={waterwayStyle}
            onEachFeature={(feature, layer) => {
              const name = feature.properties?.name || 'Teesta Tributary Stream';
              const type = feature.properties?.waterway || 'river';
              layer.bindPopup(`
                <div style="font-family: sans-serif; font-size: 12px;">
                  <span style="color: #06b6d4; font-weight: bold; font-size: 13px;">${name}</span>
                  <div style="color: #94a3b8; margin-top: 3px;">
                    Type: <span style="text-transform: capitalize;">${type}</span><br/>
                    Source: OpenStreetMap Contributors
                  </div>
                </div>
              `);
            }}
          />
        )}

        {/* Phase 3: Real Flood Extent Vector Outlines (Crisp Boundaries at zoom >= 13, Zero Cloud Obscuration) */}
        {visibleLayers['flood_extent'] !== false && layersData.flood_extent && (
          <GeoJSON
            key={`flood-vector-${currentZoom >= 13 ? 'sharp' : 'coarse'}`}
            data={layersData.flood_extent}
            style={{
              fillColor: '#0ea5e9',
              fillOpacity: currentZoom >= 13 ? 0.22 : 0.45,
              color: '#38bdf8',
              weight: 2,
              opacity: 0.9,
            }}
          />
        )}

        {/* Road Network Layer */}
        {visibleLayers['osm_roads'] !== false && layersData.osm_roads && (
          <GeoJSON
            key="osm_roads"
            data={layersData.osm_roads}
            style={roadStyle}
            onEachFeature={(feature, layer) => {
              const p = feature.properties || {};
              const roadName = p.name || 'Unnamed Road';
              const hw = p.highway || 'unclassified';
              layer.bindPopup(`
                <div style="font-family: sans-serif; font-size: 12px;">
                  <strong style="color: #f59e0b; font-size: 13px;">${roadName}</strong>
                  <div style="color: #94a3b8; margin-top: 4px;">
                    Classification: <b style="color: #e2e8f0; text-transform: uppercase;">${hw}</b><br/>
                    ${p.surface ? `Surface: ${p.surface}<br/>` : ''}
                    ${p.bridge ? `Structure: Bridge<br/>` : ''}
                    OSM Way ID: <span style="font-family: monospace;">${p.osm_id}</span>
                  </div>
                </div>
              `);
            }}
          />
        )}

        {/* Emergency Evacuation Routes */}
        {visibleLayers['emergency_routes'] !== false &&
          emergencyRoutes.map((rt, idx) => {
            const latlngs = rt.path.map((c) => [c[1], c[0]] as [number, number]);
            return (
              <Polyline
                key={`emg-route-${idx}`}
                positions={latlngs}
                pathOptions={{
                  color: rt.detour_delay_min ? '#f59e0b' : '#38bdf8',
                  weight: 3,
                  opacity: 0.85,
                  dashArray: rt.detour_delay_min ? '6, 6' : undefined,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'sans-serif', fontSize: '12px' }}>
                    <strong style={{ color: '#f59e0b', fontSize: '13px' }}>
                      Evacuation Corridor: {rt.village_name}
                    </strong>
                    <div style={{ color: '#94a3b8', marginTop: '4px' }}>
                      Reachable Facility: <b>{rt.facility_name || 'Emergency Centre'}</b><br />
                      Status: <b>{rt.status}</b><br />
                      {rt.detour_delay_min && (
                        <div>
                          Detour Delay: <b style={{ color: '#f59e0b' }}>+{rt.detour_delay_min.toFixed(1)} min</b>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Polyline>
            );
          })}

        {/* Emergency Relief Centers & Hospitals Layer */}
        {visibleLayers['relief_centers'] !== false &&
          reliefFacilities.map((fac) => (
            <CircleMarker
              key={`facility-${fac.facility_id}`}
              center={[fac.latitude, fac.longitude]}
              radius={7}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#10b981',
                fillOpacity: 0.95,
                weight: 2,
              }}
              eventHandlers={{
                click: () => {
                  setReconState({
                    coords: { lat: fac.latitude, lon: fac.longitude },
                    name: fac.name,
                    category: 'Medical Facility',
                  });
                },
              }}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif', fontSize: '12px', minWidth: '170px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#10b981' }}>
                    🏥 {fac.name}
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: '4px' }}>
                    Type: <b style={{ color: '#e2e8f0', textTransform: 'capitalize' }}>{fac.facility_type}</b><br />
                    Capacity: <b>{fac.capacity_beds} Beds</b><br />
                    {fac.trauma_centre && (
                      <div style={{ color: '#f43f5e', fontWeight: 'bold', marginTop: '2px' }}>
                        ⚡ Level-1 Trauma Centre
                      </div>
                    )}
                    {fac.icu_available && (
                      <div style={{ color: '#38bdf8', marginTop: '2px' }}>
                        ✓ ICU Operational
                      </div>
                    )}
                    Coordinates: {fac.latitude.toFixed(4)}°N, {fac.longitude.toFixed(4)}°E
                  </div>
                </div>
              </Popup>
              <LeafletTooltip
                direction="top"
                offset={[0, -7]}
                permanent={currentZoom >= 14}
                className={currentZoom >= 14 ? 'tactical-tooltip' : undefined}
              >
                {currentZoom >= 14 ? (
                  <span>MEDICAL · {fac.name}</span>
                ) : (
                  <span className="text-xs font-semibold">{fac.name}</span>
                )}
              </LeafletTooltip>
            </CircleMarker>
          ))}

        {/* Helicopter Landing Zones (HLZ) Air Rescue Layer */}
        {visibleLayers['hlz_landing_zones'] !== false &&
          layersData.hlz_landing_zones?.features?.map((feat: any, idx: number) => {
            const coords = feat.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;
            const [lon, lat] = coords;
            const p = feat.properties || {};
            const isTier1 = p.suitability_tier?.includes('Tier 1');
            const color = isTier1 ? '#10b981' : '#f59e0b';
            return (
              <CircleMarker
                key={`hlz-${p.hlz_id || idx}`}
                center={[lat, lon]}
                radius={9}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: color,
                  fillOpacity: 0.92,
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => {
                    setReconState({
                      coords: { lat, lon },
                      name: p.name || 'Air Rescue HLZ',
                      category: 'Helicopter Landing Zone',
                    });
                  },
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'sans-serif', fontSize: '12px', minWidth: '190px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🚁 {p.name || 'Air Rescue HLZ'}
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: '6px', lineHeight: '1.45' }}>
                      Nearest Settlement: <b style={{ color: '#e2e8f0' }}>{p.nearest_settlement}</b> ({p.distance_to_settlement_km} km)<br />
                      Elevation: <b style={{ color: '#e2e8f0' }}>{p.elevation_m} m</b><br />
                      Slope: <b style={{ color: '#38bdf8' }}>{p.slope_degrees}°</b> (Clearance &lt; 4.5°)<br />
                      Clearance Footprint: <b>{p.clearance_footprint_m}m × {p.clearance_footprint_m}m</b><br />
                      Suitability Tier: <b style={{ color }}>{p.suitability_tier}</b><br />
                      Score: <b style={{ color: '#38bdf8' }}>{p.suitability_score} / 100</b><br />
                      Status: <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ {p.operational_status}</span>
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
                    <span>HLZ · {p.clearance_footprint_m || 30}m · Slope {p.slope_degrees ?? 2.0}°</span>
                  ) : (
                    <span className="text-xs font-bold text-slate-100">🚁 {p.hlz_id}: {p.nearest_settlement}</span>
                  )}
                </LeafletTooltip>
              </CircleMarker>
            );
          })}

        {/* Settlements & Priority Markers Layer */}
        {visibleLayers['osm_settlements'] !== false &&
          layersData.osm_settlements?.features?.map((feat: any, idx: number) => {
            const coords = feat.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;
            const [lon, lat] = coords;
            const p = feat.properties || {};
            const name = p.name || 'Settlement';
            const priorityItem = priorityMap.get(name.toLowerCase()) || priorityMap.get(String(p.osm_id));

            // Default settlement marker styling
            const place = p.place || 'village';
            let radius = place === 'city' ? 9 : place === 'town' ? 7 : 5;
            let strokeColor = '#064e3b';
            let fillColor = '#10b981';
            let isTop5 = false;

            // Priority-enhanced styling if Phase 6 data available
            if (priorityItem && visibleLayers['priority_markers'] !== false) {
              isTop5 = priorityItem.rank <= 5;
              if (priorityItem.priority_tier === 'P1_CRITICAL') {
                strokeColor = '#ffffff';
                fillColor = '#f43f5e';
                radius = isTop5 ? 8 : 6;
              } else if (priorityItem.priority_tier === 'P2_HIGH') {
                strokeColor = '#ffffff';
                fillColor = '#f59e0b';
                radius = 6;
              } else if (priorityItem.priority_tier === 'P3_MODERATE') {
                strokeColor = '#ffffff';
                fillColor = '#38bdf8';
                radius = 5;
              } else {
                strokeColor = '#475569';
                fillColor = '#94a3b8';
                radius = 4;
              }
            }

            return (
              <React.Fragment key={`settlement-frag-${p.osm_id || idx}`}>
                {/* Top 5 Pulsing Concentric Highlight Ring */}
                {isTop5 && visibleLayers['priority_markers'] !== false && (
                  <CircleMarker
                    center={[lat, lon]}
                    radius={15}
                    pathOptions={{
                      color: fillColor,
                      fillColor: fillColor,
                      fillOpacity: 0.15,
                      weight: 1.5,
                      dashArray: '3, 4',
                    }}
                  />
                )}

                <CircleMarker
                  center={[lat, lon]}
                  radius={radius}
                  pathOptions={{
                    color: strokeColor,
                    fillColor: fillColor,
                    fillOpacity: 0.95,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      setReconState({
                        coords: { lat, lon },
                        name,
                        category: 'Settlement / Village',
                        priorityScore: priorityItem?.rank,
                        isolationStatus: priorityItem?.features.isolation_raw_status,
                      });
                      if (priorityItem && onSelectVillage) {
                        onSelectVillage(priorityItem);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'sans-serif', fontSize: '12px', minWidth: '180px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: fillColor }}>
                        {priorityItem ? `#${priorityItem.rank} ` : ''}{name}
                      </div>
                      <div style={{ color: '#94a3b8', marginTop: '4px' }}>
                        Type: <b style={{ color: '#e2e8f0', textTransform: 'capitalize' }}>{place}</b><br />
                        Population: <b>{p.population ? p.population.toLocaleString() : (priorityItem?.population ? priorityItem.population.toLocaleString() : 'Not tagged in OSM')}</b><br />
                        Elevation: <b>{p.ele || (priorityItem?.elevation_m !== undefined ? priorityItem.elevation_m.toFixed(0) : '--')} m</b>
                      </div>

                      {priorityItem && (
                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #334155' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span>Priority Score:</span>
                            <b style={{ color: fillColor }}>{priorityItem.composite_priority_score} / 100</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                            <span>Priority Tier:</span>
                            <b style={{ color: fillColor }}>{priorityItem.priority_tier.replace('_', ' ')}</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                            <span>Road Access:</span>
                            <b style={{ color: priorityItem.features.isolation_raw_status === 'CRITICALLY_ISOLATED' ? '#f43f5e' : '#10b981' }}>
                              {priorityItem.features.isolation_raw_status === 'CRITICALLY_ISOLATED' ? 'SEVERED' : 'OPEN'}
                            </b>
                          </div>
                          {priorityItem.features.nightlight_raw_reduction_pct > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                              <span>VIIRS Drop:</span>
                              <b style={{ color: '#f59e0b' }}>-{priorityItem.features.nightlight_raw_reduction_pct.toFixed(1)}%</b>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                            <span>Confidence:</span>
                            <b style={{ color: '#10b981' }}>{priorityItem.confidence_score}%</b>
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                  <LeafletTooltip
                    direction="top"
                    offset={[0, -radius]}
                    permanent={currentZoom >= 14}
                    className={currentZoom >= 14 ? 'tactical-tooltip' : undefined}
                  >
                    {currentZoom >= 14 ? (
                      <span>{name} · {p.ele || (priorityItem?.elevation_m !== undefined ? priorityItem.elevation_m.toFixed(0) : '240')}m · {priorityItem?.features.isolation_raw_status === 'CRITICALLY_ISOLATED' ? 'SEVERED' : 'OPEN'}</span>
                    ) : (
                      <span className="text-xs font-semibold">
                        {priorityItem ? `#${priorityItem.rank} ` : ''}{name}
                      </span>
                    )}
                  </LeafletTooltip>
                </CircleMarker>
              </React.Fragment>
            );
          })}
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

      {/* Google Maps-Style Visual Area Recon Drawer */}
      <AreaReconDrawer
        coords={reconState.coords}
        onClose={() => setReconState({ coords: null })}
        onZoomTo={(lat, lon) => setZoomTarget({ lat, lon, zoom: 16, timestamp: Date.now() })}
        initialName={reconState.name}
        initialCategory={reconState.category}
        initialPriorityScore={reconState.priorityScore}
        initialIsolationStatus={reconState.isolationStatus}
      />
    </div>
  );
};
