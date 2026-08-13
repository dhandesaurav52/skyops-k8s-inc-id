import React from 'react';
import { Boxes, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { WorkloadHealth } from '../types';

interface WorkloadsPageProps {
  workloads: WorkloadHealth[];
}

export const WorkloadsPage: React.FC<WorkloadsPageProps> = ({ workloads }) => {
  return (
    <div className="p-6 space-y-6 text-slate-200">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Boxes className="w-5 h-5 text-emerald-400" />
          <span>Kubernetes Workloads</span>
        </h2>
        <p className="text-xs text-slate-400">
          Deployments, StatefulSets, DaemonSets, and Jobs health status across clusters.
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Workload Name</th>
                <th className="px-6 py-3">Kind</th>
                <th className="px-6 py-3">Cluster / Namespace</th>
                <th className="px-6 py-3">Replicas (Ready / Desired)</th>
                <th className="px-6 py-3">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {workloads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                    No workload telemetry observed. Connect skyops-agent to populate workload health.
                  </td>
                </tr>
              ) : (
                workloads.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3 font-mono font-bold text-white">{w.name}</td>
                    <td className="px-6 py-3 font-mono text-slate-400">{w.kind}</td>
                    <td className="px-6 py-3 font-mono text-slate-300">
                      {w.cluster_name} <span className="text-slate-600">/</span> {w.namespace}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-200 font-bold">
                      {w.ready} / {w.desired}
                    </td>
                    <td className="px-6 py-3 font-mono">
                      {w.status === 'HEALTHY' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> HEALTHY
                        </span>
                      ) : w.status === 'DEGRADED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> DEGRADED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> FAILED
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
