import React from 'react';
import {
  LayoutGrid,
  Server,
  AlertCircle,
  Ticket,
  Activity,
  Radio,
  Cpu,
  Boxes,
  FileText,
  Settings,
  LogOut,
  Info,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'clusters'
  | 'incidents'
  | 'tickets'
  | 'metrics'
  | 'events'
  | 'nodes'
  | 'workloads'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeIncidentsCount: number;
  openTicketsCount: number;
  clustersCount: number;
  apiHealthy?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeIncidentsCount,
  openTicketsCount,
  clustersCount,
  apiHealthy = true,
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutGrid },
    {
      id: 'incidents' as NavTab,
      label: 'Incidents',
      icon: AlertCircle,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined,
      alert: activeIncidentsCount > 0,
    },
    {
      id: 'tickets' as NavTab,
      label: 'Tickets',
      icon: Ticket,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
    },
    { id: 'metrics' as NavTab, label: 'Metrics', icon: Activity, pillBadge: 'LIVE', pillColor: 'cyan' },
    {
      id: 'clusters' as NavTab,
      label: 'Clusters',
      icon: Server,
      badge: clustersCount,
    },
    { id: 'nodes' as NavTab, label: 'Nodes', icon: Cpu },
    { id: 'events' as NavTab, label: 'Event Stream', icon: Radio, pillBadge: 'LIVE', pillColor: 'emerald' },
    { id: 'workloads' as NavTab, label: 'Workloads', icon: Boxes },
    { id: 'audit' as NavTab, label: 'Audit Logs', icon: FileText },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#090d14] border-r border-[#161d28] text-slate-300 flex flex-col justify-between shrink-0 min-h-[calc(100vh-53px)] select-none">
      {/* Top Logo & Navigation Section */}
      <div className="p-3 space-y-4">
        {/* Brand Header */}
        <div className="p-2 flex items-center gap-3 border-b border-[#161d28]/60 pb-3">
          <div className="w-8 h-8 rounded bg-[#0c1624] border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm shadow-[0_0_10px_rgba(6,182,212,0.15)]">
            &gt;_
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-sm tracking-wider text-white">SKYOPS</span>
              <span className="text-[10px] bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                v1.0.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>K8s Control Plane</span>
            </div>
          </div>
        </div>

        {/* Console Nav Section */}
        <div>
          <div className="px-2 mb-2 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
            CONSOLE
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono transition-all ${
                    isActive
                      ? 'bg-[#0e1726] text-cyan-400 font-semibold border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.1)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#0c121c] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className={isActive ? 'text-cyan-200' : ''}>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.pillBadge && (
                      <span
                        className={`px-1.5 py-0.2 text-[9px] font-bold rounded font-mono tracking-wider ${
                          item.pillColor === 'emerald'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {item.pillBadge}
                      </span>
                    )}

                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] rounded font-mono font-bold ${
                          item.alert
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                            : isActive
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-[#141b26] text-slate-400 border border-[#1e293b]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Status & User Profile */}
      <div className="p-3 space-y-3 border-t border-[#161d28] bg-[#070a0f]">
        {/* System Health */}
        <div className="space-y-1.5 px-1">
          <div className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
            SYSTEM HEALTH
          </div>
          
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Cloud API</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${apiHealthy ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`}></span>
              <span className={apiHealthy ? 'text-emerald-400' : 'text-rose-400'}>
                {apiHealthy ? 'HEALTHY' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">K8s Agent</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-emerald-400">HEALTHY</span>
            </div>
          </div>
        </div>

        {/* System Info Button */}
        <button
          onClick={() => onSelectTab('settings')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#0d131d] hover:bg-[#121927] border border-[#1b2535] text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>System &amp; API Info</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold">v1.0</span>
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between pt-2 border-t border-[#161d28]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono font-bold flex items-center justify-center text-xs">
              A
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200 font-mono leading-none">admin</div>
              <div className="text-[10px] text-slate-500 font-mono leading-none mt-1">Admin</div>
            </div>
          </div>

          <button
            onClick={() => onSelectTab('settings')}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-[#141b26] transition-colors"
            title="User Settings / Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

