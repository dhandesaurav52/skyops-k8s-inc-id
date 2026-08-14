import React, { useState } from 'react';
import {
  Search,
  AlertTriangle,
  RefreshCw,
  Settings,
  PlusCircle,
  ChevronDown,
  Layers,
  User as UserIcon,
  Lock,
  LogOut,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { Cluster, User } from '../types';

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
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
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
  currentUser,
  onOpenLogin,
  onLogout,
}) => {
  const [isClusterDropdownOpen, setIsClusterDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const selectedClusterName =
    selectedClusterId === null
      ? 'ALL CLUSTERS'
      : clusters.find((c) => c.id === selectedClusterId)?.name || 'ALL CLUSTERS';

  const getRoleBadgeStyle = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-950/60 text-purple-300 border-purple-500/40';
      case 'SRE':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40';
      case 'DEVELOPER':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-700';
    }
  };

  return (
    <header className="bg-[#090d14] border-b border-[#161d28] text-slate-100 px-4 py-2 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Left section: Cluster Dropdown & Deployment Badges */}
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
            <div className="absolute left-0 mt-1.5 w-64 bg-[#0d1420] border border-[#1e2d42] rounded-md shadow-2xl z-50 py-1 font-mono text-xs">
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

        {/* Deployment Mode Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono font-medium border bg-[#0c121c] border-[#1e293b] text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>SELF-HOSTED CORE</span>
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
          <span>{apiHealthy ? 'CONTROL PLANE READY' : 'API DISCONNECTED'}</span>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="hidden md:flex items-center relative w-80 lg:w-96 mx-4">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search incidents, pods, namespaces..."
          className="w-full bg-[#0c121c] border border-[#1c2636] focus:border-cyan-500/50 rounded pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
        />
      </div>

      {/* Right Controls: User Profile & Actions */}
      <div className="flex items-center gap-2.5">
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

        {/* Inject Signal Action */}
        <button
          onClick={onSimulateIncident}
          className="flex items-center gap-1.5 bg-[#0a1829] hover:bg-[#0f243d] text-cyan-400 border border-cyan-500/40 hover:border-cyan-500/70 px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors shadow-[0_0_10px_rgba(6,182,212,0.1)]"
          title="Inject synthetic failure telemetry signal"
        >
          <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span className="tracking-wide hidden sm:inline">INJECT SIGNAL</span>
        </button>

        {/* Refresh Action */}
        <button
          onClick={onRefresh}
          className="p-1.5 rounded bg-[#0c121c] hover:bg-[#141d2d] border border-[#1c2636] text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh Telemetry Stream"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* User Account / Login Dropdown */}
        <div className="relative">
          {currentUser ? (
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 bg-[#0c121c] hover:bg-[#121a28] border border-[#1e293b] text-slate-200 pl-2.5 pr-2 py-1 rounded text-xs font-mono transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
                {currentUser.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-[11px] font-semibold block text-slate-200 leading-tight max-w-[90px] truncate">
                  {currentUser.name}
                </span>
              </div>
              <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded border ${getRoleBadgeStyle(currentUser.role)}`}>
                {currentUser.role}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>LOG IN</span>
            </button>
          )}

          {isUserMenuOpen && currentUser && (
            <div className="absolute right-0 mt-1.5 w-64 bg-[#0d1420] border border-[#1e2d42] rounded-md shadow-2xl z-50 py-2 font-mono text-xs">
              <div className="px-3 py-2 border-b border-[#1a2638]">
                <div className="font-bold text-slate-200">{currentUser.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-cyan-400">
                  <Building className="w-3 h-3 text-cyan-400" />
                  <span>{currentUser.organization_name || 'Acme Cloud Eng'}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onOpenSettings && onOpenSettings();
                }}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-[#152033] flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Organization & Users</span>
              </button>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onOpenLogin();
                }}
                className="w-full text-left px-3 py-2 text-slate-300 hover:bg-[#152033] flex items-center gap-2"
              >
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Switch Account / Role</span>
              </button>

              <div className="border-t border-[#1a2638] my-1"></div>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-3 py-2 text-rose-400 hover:bg-[#152033] flex items-center gap-2 font-bold"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
