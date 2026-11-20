import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  Satellite,
  Waves,
  Network,
  Moon,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

export type PageId =
  | 'overview'
  | 'map'
  | 'satellite'
  | 'flood'
  | 'isolation'
  | 'nightlight'
  | 'priorities'
  | 'methodology';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage }) => {
  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: '1. Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'map',
      label: '2. Live Geographic Map',
      icon: <MapPin className="w-4 h-4" />,
      badge: 'GIS',
    },
    {
      id: 'satellite',
      label: '3. Satellite Imagery',
      icon: <Satellite className="w-4 h-4" />,
      badge: 'S1/S2',
    },
    {
      id: 'flood',
      label: '4. Flood Analysis',
      icon: <Waves className="w-4 h-4" />,
      badge: 'GloFAS',
    },
    {
      id: 'isolation',
      label: '5. Village Isolation',
      icon: <Network className="w-4 h-4" />,
      badge: 'Graph',
    },
    {
      id: 'nightlight',
      label: '6. Night-Light Intelligence',
      icon: <Moon className="w-4 h-4" />,
      badge: 'VIIRS',
    },
    {
      id: 'priorities',
      label: '7. Emergency Priorities',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'methodology',
      label: '8. Data Sources & Methodology',
      icon: <BookOpen className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Navigation Modules
        </div>
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 shadow-sm shadow-cyan-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className={isActive ? 'text-cyan-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    isActive
                      ? 'bg-cyan-800 text-cyan-100'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Operational footer badge */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/50">
        <div className="rounded-lg p-3 bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>Teesta AOI Ingestion</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <p className="text-[10px] text-slate-500">
            Real data from OSM, Sentinel-1/2, GloFAS, NASA VIIRS & SRTM.
          </p>
        </div>
      </div>
    </aside>
  );
};
