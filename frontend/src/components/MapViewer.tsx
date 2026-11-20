import React, { useEffect } from 'react';
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
} from 'react-leaflet';
import L from 'leaflet';
import { BasemapType } from './LayerControlPanel';
import {
  AOIConfig,
  EmergencyFacility,
  EmergencyRoute,
  VillagePriorityItem,
} from '../types';

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

// Controller component to smoothly fit map to AOI bounds or raster bounds
const MapViewController: React.FC<{
  activeAOI: AOIConfig | null;
  rasterOverlay?: RasterOverlayConfig | null;
}> = ({ activeAOI, rasterOverlay }) => {
  const map = useMap();
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
          attribution:
            '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
          maxZoom: 18,
        };
      case 'dark':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        };
      case 'topo':
        return {
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          attribution:
            'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
          maxZoom: 17,
        };
      case 'osm':
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
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
    color: '#38bdf8',
    weight: 2,
    dashArray: '6, 6',
    fillColor: '#0284c7',
    fillOpacity: 0.08,
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
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapViewController activeAOI={activeAOI} rasterOverlay={rasterOverlay} />

        {/* Dynamic Basemap Tiles */}
        <TileLayer
          key={activeBasemap}
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
        />

        <ScaleControl position="bottomleft" imperial={false} />

        {/* Phase 2: Real Satellite Raster Imagery Overlay */}
        {rasterOverlay && rasterOverlay.visible && rasterOverlay.url && (
          <ImageOverlay
            key={`raster-${rasterOverlay.url}-${rasterOverlay.opacity}`}
            url={rasterOverlay.url}
            bounds={rasterOverlay.bounds}
            opacity={rasterOverlay.opacity}
            zIndex={380}
          />
        )}

        {/* Phase 3: Real Flood Extent Inundation Overlay */}
        {floodOverlay && floodOverlay.visible && floodOverlay.url && visibleLayers['flood_extent'] !== false && (
          <ImageOverlay
            key={`flood-${floodOverlay.url}-${floodOverlay.opacity}`}
            url={floodOverlay.url}
            bounds={floodOverlay.bounds}
            opacity={floodOverlay.opacity}
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
                  <strong style="color: #38bdf8; font-size: 13px;">${feature.properties?.name || 'Area of Interest'}</strong>
                  <div style="margin-top: 4px; color: #94a3b8;">
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
              <LeafletTooltip direction="top" offset={[0, -7]}>
                <span className="text-xs font-semibold">{fac.name}</span>
              </LeafletTooltip>
            </CircleMarker>
          ))}

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
                        Population: <b>{p.population ? p.population.toLocaleString() : (priorityItem?.population.toLocaleString() || '1,200')}</b><br />
                        Elevation: <b>{p.ele || priorityItem?.elevation_m?.toFixed(0) || 160} m</b>
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
                  <LeafletTooltip direction="top" offset={[0, -radius]}>
                    <span className="text-xs font-semibold">
                      {priorityItem ? `#${priorityItem.rank} ` : ''}{name}
                    </span>
                  </LeafletTooltip>
                </CircleMarker>
              </React.Fragment>
            );
          })}
      </MapContainer>
    </div>
  );
};
