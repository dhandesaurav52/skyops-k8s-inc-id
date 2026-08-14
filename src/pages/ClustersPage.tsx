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
    <div className="p-4 md:p-6 space-y-5 text-slate-200 font-sans max-w-[1600px] mx-auto select-none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#182232] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
            <Server className="w-4 h-4 text-emerald-400" />
            <span className="tracking-wider uppercase">Kubernetes Clusters</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Registered Kubernetes clusters sending telemetry outbound to SkyOps SaaS.
          </p>
        </div>

        <button
          onClick={onOpenConnectModal}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 rounded text-xs flex items-center gap-1.5 shadow-sm font-mono transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Connect Cluster / Install Agent</span>
        </button>
      </div>

      {clusters.length === 0 ? (
        <div className="bg-[#0c111a] border border-[#182232] rounded-md p-12 text-center space-y-4 font-mono">
          <Server className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Clusters Connected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click "Install Agent" to download the installer script or copy the one-line curl command for your Kubernetes cluster.
          </p>
          <button
            onClick={onOpenConnectModal}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded text-xs inline-block shadow-md"
          >
            Install SkyOps Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
          {clusters.map((cls) => {
            const isConnected = cls.status === 'CONNECTED';

            return (
              <div
                key={cls.id}
                className="bg-[#0c111a] border border-[#182232] rounded-md p-4 space-y-3 shadow-sm hover:border-[#223249] transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{cls.name}</h3>
                    <p className="text-[11px] text-slate-400">ID: {cls.id}</p>
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

                <div className="grid grid-cols-2 gap-2 bg-[#090d14] p-3 rounded-md border border-[#182232] text-xs font-mono">
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

                <div className="pt-2 border-t border-[#182232] flex items-center justify-between text-xs">
                  <div className="text-[10px] text-slate-500 font-mono">
                    Heartbeat: {new Date(cls.last_heartbeat).toLocaleTimeString()}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRotateToken(cls.id, cls.name)}
                      className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-[#151e2b] transition-colors"
                      title="Rotate Cluster Token"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cls.id, cls.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-[#151e2b] transition-colors"
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

