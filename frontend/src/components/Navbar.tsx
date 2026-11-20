import React from 'react';
import { AOIConfig } from '../types';
import { ShieldAlert, Compass, Globe, Radio, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeAOI: AOIConfig | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenAOIModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeAOI,
  onRefresh,
  isRefreshing,
  onOpenAOIModal,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Project Mission */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <ShieldAlert className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-black text-xl tracking-wider bg-gradient-to-r from-cyan-400 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
              JATAYU AI
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800/80 text-cyan-300">
              Phase 1: Real Data Foundation
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-Data Disaster Intelligence • Teesta River Basin, Sikkim & North Bengal
          </p>
        </div>
      </div>

      {/* AOI Status & Live Telemetry Controls */}
      <div className="flex items-center space-x-4">
        {activeAOI && (
          <button
            onClick={onOpenAOIModal}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-600/50 hover:bg-slate-850 transition text-xs text-slate-300 group cursor-pointer"
            title="Configure Area of Interest (AOI)"
          >
            <Compass className="w-4 h-4 text-cyan-400 group-hover:rotate-45 transition-transform" />
            <div className="text-left">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Active AOI</span>
              <span className="font-medium text-slate-200">{activeAOI.name}</span>
            </div>
            <span className="text-[11px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/50">
              {activeAOI.bbox.min_lat}°N - {activeAOI.bbox.max_lat}°N
            </span>
          </button>
        )}

        <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-md bg-emerald-950/50 border border-emerald-800/60 text-emerald-400 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px]">ZERO FABRICATED DATA GUARANTEE</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-slate-700 transition cursor-pointer disabled:opacity-50"
          title="Refresh All Services Status"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};
