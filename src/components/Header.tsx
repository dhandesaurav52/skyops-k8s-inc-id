import React from 'react';
import { Search, Shield, Bell, Terminal, RefreshCw, Layers } from 'lucide-react';

interface HeaderProps {
  demoMode: boolean;
  onToggleDemoMode: () => void;
  clusterCount: number;
  activeIncidentsCount: number;
  onOpenConnectModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  demoMode,
  onToggleDemoMode,
  clusterCount,
  activeIncidentsCount,
  onOpenConnectModal,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold tracking-wider">
            <Terminal className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-wider text-white">SKYOPS</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-mono">
                SAAS V1.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Kubernetes Observability & SRE Incident Management</p>
          </div>
        </div>

        {/* Organization Switcher */}
        <div className="hidden md:flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Org:</span>
          <span className="font-semibold text-slate-200">Acme Cloud Eng</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="hidden lg:flex items-center relative w-80">
        <Search className="w-4 h-4 text-slate-400 absolute left-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search INC-001, SKY-1001, pod, cluster..."
          className="w-full bg-slate-950 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 font-mono"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Demo Mode Toggle */}
        <button
          onClick={onToggleDemoMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
            demoMode
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Demo Data Mode"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${demoMode ? 'animate-spin text-amber-400' : ''}`} />
          <span>{demoMode ? 'DEMO MODE (ACTIVE)' : 'ENABLE DEMO MODE'}</span>
        </button>

        {/* Connect Cluster CTA */}
        <button
          onClick={onOpenConnectModal}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold px-3.5 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <span>+ Connect Cluster</span>
        </button>

        {/* Status Indicators */}
        <div className="hidden xl:flex items-center gap-3 text-xs bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-400">Clusters:</span>
            <span className="text-slate-200 font-bold">{clusterCount}</span>
          </div>
          <div className="w-px h-3 bg-slate-800"></div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${activeIncidentsCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'}`}></span>
            <span className="text-slate-400">Active Incidents:</span>
            <span className={`font-bold ${activeIncidentsCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {activeIncidentsCount}
            </span>
          </div>
        </div>

        {/* User Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-slate-300">
            SRE
          </div>
        </div>
      </div>
    </header>
  );
};
