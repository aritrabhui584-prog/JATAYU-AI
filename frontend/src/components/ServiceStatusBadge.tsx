import React from 'react';
import { IngestionState } from '../types';

interface ServiceStatusBadgeProps {
  state: IngestionState;
  showDot?: boolean;
}

export const ServiceStatusBadge: React.FC<ServiceStatusBadgeProps> = ({ state, showDot = true }) => {
  const getBadgeStyle = (s: IngestionState) => {
    switch (s) {
      case 'AVAILABLE':
        return {
          bg: 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300',
          dot: 'bg-emerald-400',
          label: 'AVAILABLE',
        };
      case 'FETCHING':
        return {
          bg: 'bg-cyan-950/70 border-cyan-700/60 text-cyan-300',
          dot: 'bg-cyan-400 animate-pulse',
          label: 'FETCHING',
        };
      case 'AUTH_REQUIRED':
        return {
          bg: 'bg-amber-950/70 border-amber-700/60 text-amber-300',
          dot: 'bg-amber-400',
          label: 'AUTH REQUIRED',
        };
      case 'RATE_LIMITED':
        return {
          bg: 'bg-orange-950/70 border-orange-700/60 text-orange-300',
          dot: 'bg-orange-400',
          label: 'RATE LIMITED',
        };
      case 'ERROR':
        return {
          bg: 'bg-rose-950/70 border-rose-700/60 text-rose-300',
          dot: 'bg-rose-400',
          label: 'FAILED',
        };
      case 'UNAVAILABLE':
        return {
          bg: 'bg-red-950/70 border-red-700/60 text-red-300',
          dot: 'bg-red-400',
          label: 'UNAVAILABLE',
        };
      case 'IDLE':
      default:
        return {
          bg: 'bg-slate-900 border-slate-700 text-slate-400',
          dot: 'bg-slate-500',
          label: 'IDLE (NOT INGESTED)',
        };
    }
  };

  const style = getBadgeStyle(state);

  return (
    <span
      className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${style.bg}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />}
      <span>{style.label}</span>
    </span>
  );
};
