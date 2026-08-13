import React from 'react';
import { Settings, Shield, Terminal, Key, Database, RefreshCw } from 'lucide-react';

interface SettingsPageProps {
  demoMode: boolean;
  onToggleDemoMode: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ demoMode, onToggleDemoMode }) => {
  return (
    <div className="p-6 space-y-6 text-slate-200 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          <span>Platform Settings</span>
        </h2>
        <p className="text-xs text-slate-400">
          Control plane configuration, security tokens, and organization details.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
        {/* Organization Info */}
        <div className="space-y-3 pb-6 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Organization Details</span>
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">Organization Name</span>
              <span className="text-slate-200 font-bold">Acme Cloud Eng</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Organization ID</span>
              <span className="text-slate-200">org-default</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Tier</span>
              <span className="text-emerald-400 font-bold">Enterprise SaaS</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">API Endpoint</span>
              <span className="text-slate-300">/api/v1/agent</span>
            </div>
          </div>
        </div>

        {/* Demo Telemetry Settings */}
        <div className="space-y-3 pb-6 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-amber-400" />
            <span>Demo Telemetry Sandbox</span>
          </h3>
          <p className="text-xs text-slate-400">
            Inject mock clusters, correlated incidents, and SRE tickets to evaluate SkyOps features without requiring an active Kubernetes cluster.
          </p>

          <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white block">Demo Mode Status</span>
              <span className="text-[11px] text-slate-400">
                {demoMode ? 'Active: Populated mock telemetry data' : 'Disabled: Showing live customer clusters only'}
              </span>
            </div>

            <button
              onClick={onToggleDemoMode}
              className={`px-4 py-2 rounded-md text-xs font-bold border transition-colors ${
                demoMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold'
              }`}
            >
              {demoMode ? 'Disable Demo Mode' : 'Enable Demo Mode'}
            </button>
          </div>
        </div>

        {/* Data Storage & Security */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Data Storage & Security Model</span>
          </h3>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs text-slate-300">
            <p>
              <strong>Architecture:</strong> Customer Kubernetes clusters install <strong>ONLY</strong> the lightweight <code>skyops-agent</code>.
            </p>
            <p>
              <strong>Outbound Telemetry:</strong> All events, metrics, and incident heartbeats are sent outbound over HTTPS to SkyOps Control Plane. No ingress ports or databases are exposed inside customer clusters.
            </p>
            <p>
              <strong>Persistence:</strong> Backed by Firestore database and encrypted in transit & at rest.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
