import React from 'react';
import {
  Layers,
  AlertTriangle,
  Cpu,
  Activity,
  Server,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  Clock,
  Ticket,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Cluster, Incident, Ticket as TicketType, K8sEvent, NodeHealth } from '../types';

interface OverviewPageProps {
  clusters: Cluster[];
  incidents: Incident[];
  tickets: TicketType[];
  events?: K8sEvent[];
  nodes?: NodeHealth[];
  onOpenConnectModal: () => void;
  onSelectIncident: (inc: Incident) => void;
  onSelectTicket?: (ticket: TicketType) => void;
  onNavigateTab: (tab: any) => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  onSimulateIncident: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  clusters,
  incidents,
  tickets,
  events = [],
  nodes = [],
  onOpenConnectModal,
  onSelectIncident,
  onSelectTicket,
  onNavigateTab,
  demoMode,
  onToggleDemoMode,
  onSimulateIncident,
}) => {
  const connectedClustersCount = clusters.filter((c) => c.status === 'CONNECTED').length;
  const activeIncidents = incidents.filter(
    (i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );
  const criticalIncidentsCount = activeIncidents.filter(
    (i) => i.severity === 'CRITICAL' || i.severity === 'HIGH'
  ).length;
  const mediumIncidentsCount = activeIncidents.filter(
    (i) => i.severity === 'MEDIUM' || i.severity === 'LOW'
  ).length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;

  const totalPods = clusters.reduce((acc, c) => acc + (c.pod_count || 0), 0);
  const totalNodes = clusters.reduce((acc, c) => acc + (c.node_count || (nodes.length > 0 ? nodes.length : 0)), 0);
  const uniqueNamespaces = new Set(clusters.map((c) => c.name)).size;

  const recentEvents = events.slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-5 text-slate-200 font-sans max-w-[1600px] mx-auto select-none">
      {/* Zero Clusters Onboarding Hero */}
      {clusters.length === 0 && (
        <div className="bg-[#0c1320] border border-[#1a2b42] rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  CONTROL PLANE READY &bull; 0 CLUSTERS CONNECTED
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Connect Your Kubernetes Cluster
              </h2>
              <p className="text-xs text-slate-400 max-w-2xl">
                SkyOps Control Plane is fully initialized and operational. Install the lightweight SkyOps Agent in your Kubernetes cluster to begin streaming real-time pod health, event anomaly detection, and automated root cause analysis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={onOpenConnectModal}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-xs font-mono tracking-wider flex items-center gap-2 transition-colors shadow-lg shadow-cyan-950/40"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>CONNECT KUBERNETES CLUSTER</span>
              </button>

              {!demoMode && (
                <button
                  onClick={onToggleDemoMode}
                  className="bg-[#121b2b] hover:bg-[#1a273d] text-slate-300 hover:text-white border border-[#22354f] font-semibold px-4 py-2.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Load Demo Fleet (Optional)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4 Metric KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. CLUSTERS SCOPE */}
        <div className="bg-[#0c111a] border border-[#182232] rounded-md p-4 flex flex-col justify-between hover:border-[#22334a] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold tracking-wider text-slate-400">
            <span>CLUSTERS SCOPE</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2.5">
            <span className="text-3xl font-extrabold text-white font-mono">{clusters.length}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>{connectedClustersCount} Connected</span>
            </div>
            {clusters.length === 0 && (
              <button
                onClick={onOpenConnectModal}
                className="text-[10px] text-cyan-400 hover:underline font-semibold"
              >
                + Connect
              </button>
            )}
          </div>
        </div>

        {/* 2. OPEN INCIDENTS */}
        <div className="bg-[#0c111a] border border-[#182232] rounded-md p-4 flex flex-col justify-between hover:border-[#22334a] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold tracking-wider text-slate-400">
            <span>OPEN INCIDENTS</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2.5">
            <span className={`text-3xl font-extrabold font-mono ${activeIncidents.length > 0 ? 'text-amber-400' : 'text-amber-400/80'}`}>
              {activeIncidents.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div>
              <span>High: </span>
              <span className="text-rose-400 font-bold">{criticalIncidentsCount}</span>
              <span> &bull; Med: </span>
              <span className="text-amber-400 font-bold">{mediumIncidentsCount}</span>
            </div>
            <div className="text-emerald-400 font-bold">{resolvedCount} Resolved</div>
          </div>
        </div>

        {/* 3. KUBERNETES RESOURCES */}
        <div className="bg-[#0c111a] border border-[#182232] rounded-md p-4 flex flex-col justify-between hover:border-[#22334a] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold tracking-wider text-slate-400">
            <span>KUBERNETES RESOURCES</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-white font-mono">{totalPods}</span>
              <span className="text-xs text-slate-400 font-mono">Pods</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-white font-mono">{totalNodes}</span>
              <span className="text-xs text-slate-400 font-mono">Nodes</span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            <span>Active in </span>
            <span className="text-slate-200 font-bold">{uniqueNamespaces}</span>
            <span> Namespaces</span>
          </div>
        </div>

        {/* 4. SKYOPS AGENTS */}
        <div className="bg-[#0c111a] border border-[#182232] rounded-md p-4 flex flex-col justify-between hover:border-[#22334a] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold tracking-wider text-slate-400">
            <span>SKYOPS AGENTS</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">
              {connectedClustersCount} / {clusters.length}
            </span>
            <span className="text-xs text-slate-400 font-mono">Healthy</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Telemetry Outbox Sync:</span>
            <span className="text-emerald-400 font-bold">5s Polling</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Wide Column (Incidents & Documents) + Right Column (Cluster Health & Events Stream) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (8 cols): Recent Active Incidents & Work Orders */}
        <div className="lg:col-span-8 space-y-5">
          {/* Recent Active Incidents Panel */}
          <div className="bg-[#0c111a] border border-[#182232] rounded-md overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[#182232] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                  RECENT ACTIVE INCIDENTS
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('incidents')}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold transition-colors"
              >
                <span>VIEW ALL ({activeIncidents.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-4">
                <p>No active incidents recorded. Cluster is operating within normal bounds.</p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={onSimulateIncident}
                    className="bg-[#0c1624] hover:bg-[#121f33] text-cyan-400 border border-cyan-500/40 px-3.5 py-1.5 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Inject Anomaly Signal</span>
                  </button>
                  {!demoMode && (
                    <button
                      onClick={onToggleDemoMode}
                      className="bg-[#121824] hover:bg-[#182232] text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Load Demo Fleet</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#182232]">
                {activeIncidents.slice(0, 5).map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => onSelectIncident(inc)}
                    className="p-4 hover:bg-[#101724] cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-white tracking-wide">{inc.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            inc.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}
                        >
                          {inc.severity}
                        </span>
                        <span className="bg-[#141d2b] text-slate-300 border border-[#1e2b3d] px-2 py-0.5 rounded text-[10px]">
                          {inc.status}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Occurrences: <strong className="text-white">{inc.occurrences}</strong>
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-200 font-sans">
                        {inc.title}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                        <span>Cluster: <strong className="text-slate-300">{inc.cluster_name}</strong></span>
                        <span>Namespace: <strong className="text-slate-300">{inc.namespace}</strong></span>
                        <span>Target: <strong className="text-slate-300">{inc.resource_type}/{inc.resource_name}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-slate-500">
                        {new Date(inc.first_detected).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc);
                        }}
                        className="bg-[#0e1929] hover:bg-[#14233a] text-cyan-400 border border-cyan-500/40 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <span>Investigate</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SRE Work Orders & Tickets Panel */}
          {tickets.length > 0 && (
            <div className="bg-[#0c111a] border border-[#182232] rounded-md overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-[#182232] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                    SRE WORK ORDERS &amp; REMEDIATION DOCUMENTS
                  </h3>
                </div>
                <button
                  onClick={() => onNavigateTab('tickets')}
                  className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold transition-colors"
                >
                  <span>VIEW ALL ({tickets.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="divide-y divide-[#182232]">
                {tickets.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onSelectTicket && onSelectTicket(t)}
                    className="p-3.5 hover:bg-[#101724] cursor-pointer transition-colors flex items-center justify-between gap-3 font-mono text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-300">{t.id}</span>
                        <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold">
                          {t.priority}
                        </span>
                        <span className="font-sans font-semibold text-slate-200 text-xs">
                          {t.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Target: {t.cluster_name}/{t.resource} &bull; Assignee: {t.assignee}
                      </div>
                    </div>

                    <span className="text-indigo-400 hover:underline text-xs font-semibold">
                      Open &rarr;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Cluster Health & Event Stream */}
        <div className="lg:col-span-4 space-y-5">
          {/* Cluster Health Box */}
          <div className="bg-[#0c111a] border border-[#182232] rounded-md overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[#182232] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                  CLUSTER HEALTH
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('clusters')}
                className="text-xs font-mono text-slate-400 hover:text-slate-200 font-bold transition-colors"
              >
                MANAGE
              </button>
            </div>

            <div className="p-4 space-y-3">
              {clusters.length === 0 ? (
                <div className="text-center py-6 text-slate-500 font-mono text-xs space-y-2">
                  <p>No clusters registered.</p>
                  <button
                    onClick={onOpenConnectModal}
                    className="text-cyan-400 hover:underline text-xs font-bold"
                  >
                    + Connect Kubernetes Cluster
                  </button>
                </div>
              ) : (
                clusters.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onNavigateTab('clusters')}
                    className="p-3 bg-[#090d14] border border-[#182232] rounded hover:border-[#22334a] cursor-pointer transition-colors space-y-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 truncate">{c.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                          c.status === 'CONNECTED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                      <div>
                        <span>Pods: </span>
                        <strong className="text-slate-200">{c.pod_count || 12}</strong>
                      </div>
                      <div>
                        <span>Nodes: </span>
                        <strong className="text-slate-200">{c.node_count || 3}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Event Stream Terminal Box */}
          <div className="bg-[#0c111a] border border-[#182232] rounded-md overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[#182232] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                  EVENT STREAM
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                STREAM
              </span>
            </div>

            <div className="p-3 space-y-2 font-mono text-xs">
              {recentEvents.length === 0 ? (
                <>
                  <div className="p-2.5 bg-[#090d14] rounded border border-[#161f2c] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-amber-400 font-bold">[K8s.Watcher]</span>
                      <span className="text-slate-500">Just now</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Pod event stream monitored continuously
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#090d14] rounded border border-[#161f2c] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-cyan-400 font-bold">[Cloud.SyncWorker]</span>
                      <span className="text-slate-500">5s ago</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Outbox queue synced with SkyOps Cloud API
                    </p>
                  </div>
                </>
              ) : (
                recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 bg-[#090d14] rounded border border-[#161f2c] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`font-bold ${
                          evt.type === 'Warning' ? 'text-amber-400' : 'text-cyan-400'
                        }`}
                      >
                        [{evt.reason || 'K8s.Event'}]
                      </span>
                      <span className="text-slate-500">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] line-clamp-2">
                      {evt.message || `${evt.involved_object.kind}/${evt.involved_object.name}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

