import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Satellite,
  Waves,
  Network,
  Moon,
  AlertTriangle,
  BookOpen,
  Compass,
  Grid,
  Pin,
  PinOff,
} from 'lucide-react';

export type PageId =
  | 'overview'
  | 'command-map'
  | 'india-surveillance'
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

interface NavSection {
  title: string;
  items: {
    id: PageId;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage }) => {
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isPinned) return;
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const togglePin = () => {
    setIsPinned((prev) => !prev);
  };

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  const isOpen = isPinned || isHovered;

  const sections: NavSection[] = [
    {
      title: 'OPERATIONAL COMMAND',
      items: [
        {
          id: 'overview',
          label: '1. Command Overview',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          id: 'command-map',
          label: '2. Unified Tactical Map',
          icon: <Compass className="w-4 h-4" />,
          badge: 'TACTICAL',
          badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        },
        {
          id: 'india-surveillance',
          label: '3. All-India Surveillance',
          icon: <Grid className="w-4 h-4" />,
          badge: '4-GRID',
          badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        },
      ],
    },
    {
      title: 'EARTH OBSERVATION & HAZARDS',
      items: [
        {
          id: 'satellite',
          label: '4. Satellite Ingestion',
          icon: <Satellite className="w-4 h-4" />,
          badge: 'S1/S2',
          badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        },
        {
          id: 'flood',
          label: '5. Hydrology & Flood Engine',
          icon: <Waves className="w-4 h-4" />,
          badge: 'GLOFAS',
          badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        },
        {
          id: 'nightlight',
          label: '6. Night-Light Intelligence',
          icon: <Moon className="w-4 h-4" />,
          badge: 'VIIRS',
          badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        },
      ],
    },
    {
      title: 'LOGISTICS & DISPATCH',
      items: [
        {
          id: 'isolation',
          label: '7. Multi-Modal Rescue',
          icon: <Network className="w-4 h-4" />,
          badge: '3-WAY',
          badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
        },
        {
          id: 'priorities',
          label: '8. Emergency Triage & SITREP',
          icon: <AlertTriangle className="w-4 h-4" />,
          badge: 'P1-ALERT',
          badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
        },
        {
          id: 'map',
          label: '9. GIS Layer Catalog',
          icon: <MapPin className="w-4 h-4" />,
          badge: 'LAYERS',
          badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        },
      ],
    },
    {
      title: 'GOVERNANCE & AUDIT',
      items: [
        {
          id: 'methodology',
          label: '10. Provenance & Guardrails',
          icon: <BookOpen className="w-4 h-4" />,
          badge: 'AUDIT',
          badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        },
      ],
    },
  ];

  return (
    <>
      {/* Invisible Full-Height Edge Hover Trigger Zone (z-[1999]) */}
      <div
        onMouseEnter={handleMouseEnter}
        className="fixed left-0 top-[64px] bottom-0 w-4 z-[1999] cursor-pointer pointer-events-auto"
        aria-label="Hover left edge to reveal Navigation Modules"
      />

      {/* Sleek, Slim Vertical Edge Handle (z-[2000]) */}
      <div
        onMouseEnter={handleMouseEnter}
        onClick={handleMouseEnter}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-[2000] w-3 h-20 rounded-r-lg bg-zinc-900/90 border border-l-0 border-zinc-700 flex items-center justify-center cursor-pointer transition-all duration-300 pointer-events-auto ${
          isOpen
            ? 'opacity-0 -translate-x-full pointer-events-none'
            : 'opacity-90 hover:opacity-100 hover:bg-zinc-800 hover:border-white shadow-lg shadow-black'
        }`}
        title="Hover left edge to reveal Navigation Modules"
      >
        <div className="w-0.5 h-10 bg-zinc-400 rounded-full" />
      </div>

      {/* Smooth Slide-Out Full-Height Floating Overlay Drawer (z-[2000] Above All Leaflet Map Layers) */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 top-[64px] bottom-0 w-64 z-[2000] backdrop-blur-md bg-[#09090B]/95 border-r border-zinc-800 shadow-2xl flex flex-col justify-between transition-all duration-300 ease-out select-none ${
          isOpen
            ? 'translate-x-0 opacity-100 pointer-events-auto'
            : '-translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Navigation Modules Header with Pin / Auto-Hide Button */}
        <div className="px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-[11px] font-bold tracking-wider font-mono uppercase text-white">
              Navigation Modules
            </span>
          </div>

          <button
            onClick={togglePin}
            title={isPinned ? 'Unpin sidebar (auto-hides on cursor leave)' : 'Pin sidebar (keep open)'}
            className={`px-2 py-1 rounded-md border text-[10px] font-mono transition cursor-pointer flex items-center space-x-1.5 ${isPinned
              ? 'bg-white border-white text-black font-semibold shadow-sm'
              : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
              }`}
          >
            {isPinned ? (
              <>
                <Pin className="w-3 h-3 text-black rotate-45" />
                <span className="font-bold tracking-tight">PINNED</span>
              </>
            ) : (
              <>
                <PinOff className="w-3 h-3 text-zinc-400" />
                <span className="tracking-tight">AUTO-HIDE</span>
              </>
            )}
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="p-3 space-y-4 overflow-y-auto flex-1">
          {sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-1">
              <div className="px-3 pt-1 pb-1 text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                {sec.title}
              </div>
              {sec.items.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectPage(item.id);
                      if (!isPinned) {
                        setIsHovered(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer border ${isActive
                      ? 'bg-white text-black font-semibold border-white shadow-md'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-900 border-transparent'
                      }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <span className={`shrink-0 ${isActive ? 'text-black' : 'text-zinc-400'}`}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border shrink-0 ${
                          isActive
                            ? 'bg-black text-white border-black'
                            : (item.badgeColor || 'bg-zinc-800 text-zinc-300 border-zinc-700')
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Operational Agency Accreditation Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/90 shrink-0">
          <div className="rounded-lg p-2.5 bg-black border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <div className="flex items-center justify-between text-zinc-200 font-semibold text-[11px]">
              <span>National Telemetry Engine</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight">
              Copernicus GloFAS, ESA Sentinel-1/2, NASA VIIRS &amp; OpenStreetMap.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
