import React, { useState } from 'react';
import {
  Search,
  AlertTriangle,
  RefreshCw,
  Settings,
  PlusCircle,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { Cluster } from '../types';

interface HeaderProps {
  demoMode: boolean;
  onToggleDemoMode: () => void;
  clusters: Cluster[];
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string | null) => void;
  activeIncidentsCount: number;
  onOpenConnectModal: () => void;
  onSimulateIncident: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  onOpenSettings?: () => void;
  apiHealthy?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  demoMode,
  onToggleDemoMode,
  clusters,
  selectedClusterId,
  onSelectCluster,
  activeIncidentsCount,
  onOpenConnectModal,
  onSimulateIncident,
  searchQuery,
  onSearchChange,
  onRefresh,
  onOpenSettings,
  apiHealthy = true,
}) => {
  const [isClusterDropdownOpen, setIsClusterDropdownOpen] = useState(false);

  const selectedClusterName =
    selectedClusterId === null
      ? 'ALL CLUSTERS'
      : clusters.find((c) => c.id === selectedClusterId)?.name || 'ALL CLUSTERS';

  return (
    <header className="bg-[#090d14] border-b border-[#161d28] text-slate-100 px-4 py-2.5 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left section: Cluster Dropdown & API Status */}
      <div className="flex items-center gap-3">
        {/* Cluster Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsClusterDropdownOpen(!isClusterDropdownOpen)}
            className="flex items-center gap-2 bg-[#0c121c] hover:bg-[#121a28] border border-[#1e293b] text-slate-200 px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="tracking-wide">{selectedClusterName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {isClusterDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-60 bg-[#0d1420] border border-[#1e2d42] rounded-md shadow-2xl z-50 py-1 font-mono text-xs">
              <button
                onClick={() => {
                  onSelectCluster(null);
                  setIsClusterDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#152033] ${
                  selectedClusterId === null ? 'text-cyan-400 bg-[#121c2e] font-bold' : 'text-slate-300'
                }`}
              >
                <span>ALL CLUSTERS</span>
                <span className="text-[10px] text-slate-500">{clusters.length} total</span>
              </button>
              <div className="border-t border-[#1a2638] my-1"></div>
              {clusters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectCluster(c.id);
                    setIsClusterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#152033] ${
                    selectedClusterId === c.id ? 'text-cyan-400 bg-[#121c2e] font-bold' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className={`text-[10px] ${c.status === 'CONNECTED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ●
                  </span>
                </button>
              ))}
              <div className="border-t border-[#1a2638] my-1"></div>
              <button
                onClick={() => {
                  setIsClusterDropdownOpen(false);
                  onOpenConnectModal();
                }}
                className="w-full text-left px-3 py-1.5 text-cyan-400 hover:bg-[#152033] flex items-center gap-1.5 font-bold"
              >
                <span>+ Connect New Cluster</span>
              </button>
            </div>
          )}
        </div>

        {/* API Status Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
            apiHealthy
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${apiHealthy ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`}></span>
          <span>{apiHealthy ? 'API ONLINE' : 'API OFFLINE'}</span>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="hidden md:flex items-center relative w-96 max-w-md mx-4">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search incidents, pods, namespaces, categories..."
          className="w-full bg-[#0c121c] border border-[#1c2636] focus:border-cyan-500/50 rounded pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Active Incidents Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border ${
            activeIncidentsCount > 0
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
              : 'bg-[#0c121c] text-slate-400 border-[#1c2636]'
          }`}
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${activeIncidentsCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          <span>{activeIncidentsCount} ACTIVE</span>
        </div>

        {/* Inject Signal / Simulate Failure CTA */}
        <button
          onClick={onSimulateIncident}
          className="flex items-center gap-1.5 bg-[#0a1829] hover:bg-[#0f243d] text-cyan-400 border border-cyan-500/40 hover:border-cyan-500/70 px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors shadow-[0_0_10px_rgba(6,182,212,0.1)]"
          title="Inject synthetic telemetry anomaly signal to test automated incident correlation"
        >
          <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span className="tracking-wide">INJECT SIGNAL</span>
        </button>

        {/* Refresh Action Button */}
        <button
          onClick={onRefresh}
          className="p-1.5 rounded bg-[#0c121c] hover:bg-[#141d2d] border border-[#1c2636] text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh Telemetry Stream"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Settings / Modal */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded bg-[#0c121c] hover:bg-[#141d2d] border border-[#1c2636] text-slate-400 hover:text-slate-200 transition-colors"
            title="System Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

