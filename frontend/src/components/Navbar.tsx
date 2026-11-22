import React, { useState } from 'react';
import { AOIConfig, LiveSatelliteSyncStatus } from '../types';
import { Compass, RefreshCw, Sun, Moon, ShieldCheck, Satellite, CheckCircle2 } from 'lucide-react';
import * as api from '../api/client';

interface NavbarProps {
  activeAOI: AOIConfig | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenAOIModal: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeAOI,
  onRefresh,
  isRefreshing,
  onOpenAOIModal,
  theme = 'dark',
  onToggleTheme,
}) => {
  const [isSyncingSatellites, setIsSyncingSatellites] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<LiveSatelliteSyncStatus | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSyncSatellites = async () => {
    setIsSyncingSatellites(true);
    setSyncFeedback('Syncing Live Satellites (Sentinel-1, Sentinel-2, VIIRS)...');
    try {
      const res = await api.triggerLiveRefresh();
      setSyncStatus(res);
      setSyncFeedback(`Live Satellites Synced (${res.sentinel1_sar.acquisition_date_ist.slice(0, 11)})`);
      onRefresh();
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (e: any) {
      setSyncFeedback('Sync failed: ' + (e.message || 'Network error'));
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncingSatellites(false);
    }
  };

  return (
    <header className="h-16 border-b border-zinc-800 bg-[#09090B] px-5 flex items-center justify-between sticky top-0 z-[2050] shadow-md select-none">
      {/* Brand & National Mandate */}
      <div className="flex items-center space-x-3.5">
        <div className="relative group cursor-pointer bg-black border border-white/25 rounded-lg p-0.5 shadow-sm">
          <img
            src="/jatayu-logo.jpg"
            alt="JATAYU AI Official Insignia"
            className="w-10 h-10 rounded-md object-contain bg-black"
          />
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-black rounded-full" title="Sensors Online & Operational" />
        </div>

        <div>
          <div className="flex items-center space-x-2.5">
            <span className="font-black text-lg tracking-wider text-white">
              JATAYU AI
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              NDMA / SDMA CONSOLE
            </span>
            <span className="hidden xl:inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE TELEMETRY</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium tracking-tight">
            National Disaster Intelligence &amp; Emergency Response System
          </p>
        </div>
      </div>

      {/* AOI Status & Command Controls */}
      <div className="flex items-center space-x-3">
        {/* Active AOI Selector */}
        {activeAOI && (
          <button
            onClick={onOpenAOIModal}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-white hover:bg-zinc-800 transition text-xs text-zinc-200 group cursor-pointer shadow-sm"
            title="Configure Active Area of Interest (AOI)"
          >
            <Compass className="w-3.5 h-3.5 text-zinc-300 group-hover:rotate-45 transition-transform" />
            <div className="text-left">
              <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">THEATRE AOI</span>
              <span className="font-semibold text-white text-xs">{activeAOI.name}</span>
            </div>
            <span className="text-[10px] text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 font-mono">
              {activeAOI.bbox.min_lat.toFixed(2)}°N - {activeAOI.bbox.max_lat.toFixed(2)}°N
            </span>
          </button>
        )}

        {/* Zero Fabricated Data Institutional Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono text-[11px] font-bold tracking-tight text-white">ZERO FABRICATED DATA</span>
        </div>

        {/* Command Dark / Briefing Light Theme Toggle */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-white hover:bg-zinc-800 transition text-xs text-zinc-300 cursor-pointer shadow-sm"
            title={theme === 'dark' ? "Switch to Briefing Light Mode (High-Clarity for Projection Displays)" : "Switch to Obsidian Black Mode"}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-medium hidden sm:inline">Briefing Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-white" />
                <span className="text-[11px] font-medium hidden sm:inline">Obsidian Dark</span>
              </>
            )}
          </button>
        )}

        {/* Sync Live Satellites Button */}
        <button
          onClick={handleSyncSatellites}
          disabled={isSyncingSatellites}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 hover:border-white transition text-xs font-mono font-bold cursor-pointer disabled:opacity-50 shadow-sm"
          title="Query Microsoft Planetary Computer & Open-Meteo for latest real-time Sentinel-1, Sentinel-2, VIIRS and GloFAS passes"
        >
          <Satellite className={`w-3.5 h-3.5 text-zinc-300 ${isSyncingSatellites ? 'animate-pulse text-white' : ''}`} />
          <span className="hidden md:inline">Sync Live Satellites</span>
        </button>

        {/* Telemetry Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-white hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50 shadow-sm"
          title="Refresh Real-Time Telemetry Feeds"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
        </button>
      </div>

      {/* Sync Notification Toast */}
      {syncFeedback && (
        <div className="absolute top-16 right-5 z-50 bg-[#111113]/95 border border-zinc-600 rounded-lg px-3.5 py-2 text-xs font-mono text-white shadow-2xl backdrop-blur-md flex items-center space-x-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}
    </header>
  );
};
