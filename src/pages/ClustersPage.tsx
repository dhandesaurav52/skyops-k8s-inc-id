import React from 'react';
import { Server, Plus, RefreshCw, Trash2, Key, Activity, ShieldCheck } from 'lucide-react';
import { Cluster } from '../types';
import { rotateClusterToken, deleteCluster } from '../services/api';

interface ClustersPageProps {
  clusters: Cluster[];
  onOpenConnectModal: () => void;
  onRefresh: () => void;
}

export const ClustersPage: React.FC<ClustersPageProps> = ({
  clusters,
  onOpenConnectModal,
  onRefresh,
}) => {
  const handleRotateToken = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to rotate the cluster token for ${name}?`)) {
      try {
        await rotateClusterToken(id);
        alert(`New token generated for ${name}. Update your skyops-agent Helm release secret.`);
        onRefresh();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove cluster ${name}?`)) {
      try {
        await deleteCluster(id);
        onRefresh();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="p-6 space-y-6 text-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <span>Kubernetes Clusters</span>
          </h2>
          <p className="text-xs text-slate-400">
            Registered Kubernetes clusters sending telemetry outbound to SkyOps.
          </p>
        </div>

        <button
          onClick={onOpenConnectModal}
          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-md text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Cluster</span>
        </button>
      </div>

      {clusters.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-4">
          <Server className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Clusters Connected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click "Connect Cluster" to generate a single-use token and Helm command for your target cluster.
          </p>
          <button
            onClick={onOpenConnectModal}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-md text-xs inline-block"
          >
            Connect Cluster
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clusters.map((cls) => {
            const isConnected = cls.status === 'CONNECTED';

            return (
              <div
                key={cls.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white font-mono text-sm">{cls.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">ID: {cls.id}</p>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
                      isConnected
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {cls.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-md border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Nodes / Pods</span>
                    <span className="text-slate-200 font-bold">
                      {cls.node_count} nodes / {cls.pod_count} pods
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">K8s Version</span>
                    <span className="text-slate-200">{cls.k8s_version}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">CPU Cores</span>
                    <span className="text-emerald-400">{cls.cpu_usage_cores || 1.2} cores</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Agent Version</span>
                    <span className="text-slate-300">{cls.agent_version}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="text-[10px] text-slate-500 font-mono">
                    Heartbeat: {new Date(cls.last_heartbeat).toLocaleTimeString()}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRotateToken(cls.id, cls.name)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800"
                      title="Rotate Cluster Token"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cls.id, cls.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                      title="Delete Cluster"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
