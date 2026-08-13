import React from 'react';
import { Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { NodeHealth } from '../types';

interface NodesPageProps {
  nodes: NodeHealth[];
}

export const NodesPage: React.FC<NodesPageProps> = ({ nodes }) => {
  return (
    <div className="p-6 space-y-6 text-slate-200">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <span>Kubernetes Nodes</span>
        </h2>
        <p className="text-xs text-slate-400">
          Node health, allocatable resources, and physical pressures (Memory, Disk, PID).
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Node Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">K8s Version</th>
                <th className="px-6 py-3">Allocatable CPU / RAM</th>
                <th className="px-6 py-3">Pods</th>
                <th className="px-6 py-3">Pressure Conditions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                    No node telemetry received. Connect cluster agent to observe node health.
                  </td>
                </tr>
              ) : (
                nodes.map((node) => (
                  <tr key={node.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3 font-mono font-bold text-white">{node.name}</td>
                    <td className="px-6 py-3 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          node.status === 'Ready'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {node.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-300">{node.k8s_version}</td>
                    <td className="px-6 py-3 font-mono text-slate-200">
                      {node.cpu_allocatable} / {node.mem_allocatable}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-300">{node.pod_count}</td>
                    <td className="px-6 py-3 font-mono">
                      {node.memory_pressure || node.disk_pressure || node.pid_pressure ? (
                        <span className="text-rose-400 flex items-center gap-1 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Pressure Detected
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> None
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
