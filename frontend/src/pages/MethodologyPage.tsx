import React from 'react';
import {
  BookOpen,
  ShieldCheck,
  ExternalLink,
  Layers,
  Database,
  Radio,
  FileText,
  CheckCircle2,
} from 'lucide-react';

interface MethodologyPageProps {
  catalog: any;
}

export const MethodologyPage: React.FC<MethodologyPageProps> = ({ catalog }) => {
  const sources = catalog?.data_sources || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-white" />
          <h1 className="text-xl font-bold text-white tracking-tight">
            JATAYU AI — Intelligent Disaster Prediction & National Emergency Response System
          </h1>
        </div>
        <p className="text-xs text-zinc-400 italic mt-0.5">
          "Predict Before Disaster. Respond Before It's Too Late. Save Lives."
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          Authorized Command & Control operational platform for government disaster management authorities (NDMA/SDMA), emergency response units, and rescue coordination centers.
        </p>
      </div>

      {/* Zero Fabrication Guarantee Protocol */}
      <div className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-3">
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Core Operational Principle: Multi-Source Intelligence Fusion</span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">
          JATAYU AI unifies multi-source intelligence fusion — combining <b>Copernicus Sentinel-1 C-SAR radar backscatter</b>, <b>Sentinel-2 optical MSI</b>, <b>Copernicus GloFAS hydrometeorological discharge models</b>, <b>authentic Copernicus DEM GLO-90 topography</b>, <b>OpenStreetMap topological highway graphs</b>, and <b>NASA VIIRS Black Marble VNP46A2 night-light radiance</b> — to predict hazard risk and trigger pre-disaster evacuation before communities become isolated.
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800 pt-2">
          <b>Zero Hallucination Mandate:</b> In national emergency response, synthetic geographic records or simulated victims cost lives. JATAYU AI strictly operates on verified Earth observation rasters, authentic Overpass nodes, and true DEM elevations. If an observation is absent or cloud-obscured, the system reports it honestly and penalizes confidence rather than hallucinating emergencies.
        </p>
      </div>

      {/* 7 Services Technical Catalog */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider">
          Independent Modular Data Services Catalog
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((src: any) => (
            <div
              key={src.service_id}
              className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-3 hover:border-zinc-600 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    {src.service_id}
                  </span>
                  <h3 className="font-bold text-white text-sm">{src.service_name}</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">
                  {src.license}
                </span>
              </div>

              <div className="text-xs text-zinc-400 font-mono space-y-1">
                <div>
                  <span className="text-zinc-500">Provider:</span>{' '}
                  <span className="text-zinc-300">{src.provider}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Citation:</span>{' '}
                  <span className="text-zinc-300 block text-[11px] mt-0.5">{src.citation}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Terms of Use:</span>{' '}
                  <span className="text-zinc-400 block text-[11px]">{src.terms_of_use}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 flex items-center space-x-3 text-xs">
                <a
                  href={src.documentation_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white hover:text-zinc-300 underline underline-offset-2 flex items-center space-x-1"
                >
                  <span>API Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={src.license_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-400 hover:text-white underline underline-offset-2 flex items-center space-x-1"
                >
                  <span>License Details</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GIS Stack & Architecture Description */}
      <div className="rounded-xl bg-[#111113] border border-zinc-800 p-5 space-y-4">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider">
          Architecture & Technology Foundations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2">
            <div className="font-bold text-white">Backend & API</div>
            <ul className="text-zinc-400 space-y-1 list-disc list-inside">
              <li>Python 3.12 + FastAPI async architecture</li>
              <li>Pydantic v2 strict data validation</li>
              <li>SQLite spatial metadata & job audit engine</li>
              <li>WGS84 (EPSG:4326) coordinate transformations</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2">
            <div className="font-bold text-white">GIS & Graph Analytics</div>
            <ul className="text-zinc-400 space-y-1 list-disc list-inside">
              <li>NetworkX geodetically weighted road graphs</li>
              <li>Shapely geometric point-to-line distance</li>
              <li>GeoPandas & PyOgrio GeoJSON persistence</li>
              <li>PyProj geodetic ellipsoid computations</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-black border border-zinc-800 space-y-2">
            <div className="font-bold text-white">Frontend & Visualization</div>
            <ul className="text-zinc-400 space-y-1 list-disc list-inside">
              <li>React 19 + TypeScript + Vite 8</li>
              <li>Tailwind CSS v4 sleek dark emergency UI</li>
              <li>React Leaflet multi-basemap layer control</li>
              <li>Recharts hydrometeorological time series</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
