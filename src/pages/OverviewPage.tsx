import React from 'react';
import {
  Server,
  AlertTriangle,
  Ticket,
  Activity,
  Cpu,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { Cluster, Incident, Ticket as TicketType } from '../types';

interface OverviewPageProps {
  clusters: Cluster[];
  incidents: Incident[];
  tickets: TicketType[];
  onOpenConnectModal: () => void;
  onSelectIncident: (inc: Incident) => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  clusters,
  incidents,
  tickets,
  onOpenConnectModal,
  onSelectIncident,
  demoMode,
  onToggleDemoMode,
}) => {
  const healthyClustersCount = clusters.filter((c) => c.status === 'CONNECTED').length;
  const activeIncidents = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );
  const criticalIncidentsCount = activeIncidents.filter((i) => i.severity === 'CRITICAL').length;
  const openTicketsCount = tickets.filter((t) => t.status !== 'CLOSED' && t.status !== 'RESOLVED').length;

  // Chart time series data
  const chartData = [
    { time: '10:00', cpu: 1.2, memory: 4.1, restarts: 0, incidents: 0 },
    { time: '10:05', cpu: 1.4, memory: 4.2, restarts: 1, incidents: 0 },
    { time: '10:10', cpu: 1.9, memory: 5.8, restarts: 4, incidents: 1 },
    { time: '10:15', cpu: 2.4, memory: 7.2, restarts: 12, incidents: 2 },
    { time: '10:20', cpu: 2.1, memory: 6.8, restarts: 8, incidents: 2 },
    { time: '10:25', cpu: 1.8, memory: 5.5, restarts: 2, incidents: 1 },
    { time: '10:30', cpu: 1.5, memory: 4.8, restarts: 0, incidents: 1 },
  ];

  const isEmptyState = clusters.length === 0 && !demoMode;

  return (
    <div className="p-6 space-y-6 text-slate-200">
      {/* Top Banner if Empty State */}
      {isEmptyState && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4 max-w-2xl mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">No Kubernetes Clusters Connected</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Install the lightweight SkyOps Agent into your Kubernetes cluster to start monitoring pods, nodes, and automated incident correlation.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenConnectModal}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-md text-xs flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Your First Cluster</span>
            </button>

            <button
              onClick={onToggleDemoMode}
              className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 px-4 py-2.5 rounded-md text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Load Demo Telemetry</span>
            </button>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 font-sans">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Clusters</span>
            <Server className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">{clusters.length}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Registered SaaS targets</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Healthy</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {healthyClustersCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Heartbeat online</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Active Incidents</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className={`text-2xl font-extrabold font-mono ${activeIncidents.length > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
            {activeIncidents.length}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Correlated failures</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Critical</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-500 font-mono">
            {criticalIncidentsCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Immediate action required</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Open Tickets</span>
            <Ticket className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-400 font-mono">
            {openTicketsCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">SRE queue</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Agents Online</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            {healthyClustersCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">skyops-agent V1</p>
        </div>
      </div>

      {/* Observability Telemetry Charts */}
      {!isEmptyState && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Cluster CPU Utilization (Cores)</span>
            </h3>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#cpuGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Pod Restart Spikes & Incident Frequency</span>
            </h3>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                  />
                  <Bar dataKey="restarts" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Active Incidents Table */}
      {!isEmptyState && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Correlated Active Incidents
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Showing {activeIncidents.length} unresolved failures
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Incident ID</th>
                  <th className="px-6 py-3">Severity</th>
                  <th className="px-6 py-3">Cluster / Namespace</th>
                  <th className="px-6 py-3">Resource Target</th>
                  <th className="px-6 py-3">Occurrences</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">First Seen</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {activeIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">
                      No active correlated incidents. Infrastructure healthy.
                    </td>
                  </tr>
                ) : (
                  activeIncidents.map((inc) => (
                    <tr
                      key={inc.id}
                      onClick={() => onSelectIncident(inc)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3 font-mono font-bold text-white">{inc.id}</td>
                      <td className="px-6 py-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            inc.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-slate-300">
                        {inc.cluster_name} <span className="text-slate-500">/</span> {inc.namespace}
                      </td>
                      <td className="px-6 py-3 font-mono text-slate-200">
                        {inc.resource_type}/{inc.resource_name}
                      </td>
                      <td className="px-6 py-3 font-mono text-rose-400 font-bold">
                        {inc.occurrences}x
                      </td>
                      <td className="px-6 py-3 font-mono text-amber-300">{inc.status}</td>
                      <td className="px-6 py-3 text-slate-400 text-[11px]">
                        {new Date(inc.first_detected).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-emerald-400 font-semibold hover:underline">
                          Investigate →
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
