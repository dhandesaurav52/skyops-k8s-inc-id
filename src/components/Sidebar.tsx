import React from 'react';
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  Ticket,
  Activity,
  ListFilter,
  Cpu,
  Boxes,
  FileText,
  Settings,
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeIncidentsCount,
  openTicketsCount,
  clustersCount,
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'clusters' as NavTab, label: 'Clusters', icon: Server, badge: clustersCount },
    { id: 'incidents' as NavTab, label: 'Incidents', icon: AlertTriangle, badge: activeIncidentsCount, alert: activeIncidentsCount > 0 },
    { id: 'tickets' as NavTab, label: 'Tickets', icon: Ticket, badge: openTicketsCount },
    { id: 'metrics' as NavTab, label: 'Metrics', icon: Activity },
    { id: 'events' as NavTab, label: 'Events Stream', icon: ListFilter },
    { id: 'nodes' as NavTab, label: 'Nodes', icon: Cpu },
    { id: 'workloads' as NavTab, label: 'Workloads', icon: Boxes },
    { id: 'audit' as NavTab, label: 'Audit Logs', icon: FileText },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-60 bg-slate-950 border-r border-slate-800 text-slate-300 flex flex-col justify-between shrink-0 min-h-[calc(100vh-57px)] font-sans">
      <div className="py-4">
        <div className="px-4 mb-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          Observability Plane
        </div>

        <nav className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 font-semibold border-l-2 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded font-mono font-bold ${
                      item.alert
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isActive
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/50">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>SkyOps Agent Engine v1.0</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Multi-tenant SaaS Control Plane</p>
      </div>
    </aside>
  );
};
