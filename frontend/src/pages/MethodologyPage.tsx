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
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-slate-100">
            Data Sources, Remote-Sensing Methodology & Integrity Protocol
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Technical documentation of all independent geospatial pipelines, sensor physics, licensing and zero-fabrication standards.
        </p>
      </div>

      {/* Zero Fabrication Guarantee Protocol */}
      <div className="rounded-xl bg-slate-900 border border-emerald-800/80 p-5 space-y-3">
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Strict Zero-Fabrication Protocol (Phase 1 Foundation Mandate)</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          In high-stakes disaster intelligence, algorithmic hallucinations and synthetic geographic records cost human lives.
          JATAYU AI enforces an uncompromising architectural principle: <b>no simulated villages, roads, streamflows, populations, or night-light values are ever generated</b>.
          If any external scientific data service (e.g. Overpass, CDSE, or NASA Earthdata) is offline, throttled, or requires credentials,
          the system flags that layer as unavailable and reports the exact API response.
        </p>
      </div>

      {/* 7 Services Technical Catalog */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
          Independent Modular Data Services Catalog
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((src: any) => (
            <div
              key={src.service_id}
              className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                    {src.service_id}
                  </span>
                  <h3 className="font-bold text-slate-100 text-sm">{src.service_name}</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {src.license}
                </span>
              </div>

              <div className="text-xs text-slate-400 font-mono space-y-1">
                <div>
                  <span className="text-slate-500">Provider:</span>{' '}
                  <span className="text-slate-300">{src.provider}</span>
                </div>
                <div>
                  <span className="text-slate-500">Citation:</span>{' '}
                  <span className="text-slate-300 block text-[11px] mt-0.5">{src.citation}</span>
                </div>
                <div>
                  <span className="text-slate-500">Terms of Use:</span>{' '}
                  <span className="text-slate-400 block text-[11px]">{src.terms_of_use}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center space-x-3 text-xs">
                <a
                  href={src.documentation_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center space-x-1"
                >
                  <span>API Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={src.license_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 hover:underline flex items-center space-x-1"
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
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
          Architecture & Technology Foundations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-200">Backend & API</div>
            <ul className="text-slate-400 space-y-1 list-disc list-inside">
              <li>Python 3.12 + FastAPI async architecture</li>
              <li>Pydantic v2 strict data validation</li>
              <li>SQLite spatial metadata & job audit engine</li>
              <li>WGS84 (EPSG:4326) coordinate transformations</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-200">GIS & Graph Analytics</div>
            <ul className="text-slate-400 space-y-1 list-disc list-inside">
              <li>NetworkX geodetically weighted road graphs</li>
              <li>Shapely geometric point-to-line distance</li>
              <li>GeoPandas & PyOgrio GeoJSON persistence</li>
              <li>PyProj geodetic ellipsoid computations</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-200">Frontend & Visualization</div>
            <ul className="text-slate-400 space-y-1 list-disc list-inside">
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
