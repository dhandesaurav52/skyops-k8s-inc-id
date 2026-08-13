import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { registerCluster } from '../services/api';

interface ConnectClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClusterConnected: () => void;
}

export const ConnectClusterModal: React.FC<ConnectClusterModalProps> = ({
  isOpen,
  onClose,
  onClusterConnected,
}) => {
  const [clusterName, setClusterName] = useState('production-us-east');
  const [environment, setEnvironment] = useState('production');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{
    registration_token: string;
    helm_command: string;
    cluster: any;
  } | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clusterName) return;

    setLoading(true);
    try {
      const res = await registerCluster(clusterName, environment);
      setRegistrationResult(res);
      onClusterConnected();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!registrationResult) return;
    navigator.clipboard.writeText(registrationResult.helm_command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl text-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Connect Kubernetes Cluster</h3>
              <p className="text-xs text-slate-400">
                Deploy ONLY the lightweight SkyOps Agent (`skyops-agent`) into your cluster.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!registrationResult ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cluster Name
                </label>
                <input
                  type="text"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  placeholder="e.g. production-us-east, eks-dev-01"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Environment
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-md text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Zero Cloud Infrastructure in Customer Cluster
                </p>
                <p>
                  SkyOps installs <strong>no databases, PostgreSQL, or web APIs</strong> inside your cluster. All telemetry is securely transmitted outbound over HTTPS to SkyOps SaaS.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-md text-xs flex items-center gap-2 transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Generate Helm Installation Command</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Warning */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs text-amber-300 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Security Token Warning</p>
                  <p className="text-[11px] text-amber-300/80">
                    This registration token is single-use and will be exchanged for a cluster credential once your agent connects.
                  </p>
                </div>
              </div>

              {/* Helm Command Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300 font-mono">Helm V3 Install Command</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Command'}</span>
                  </button>
                </div>

                <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {registrationResult.helm_command}
                </pre>
              </div>

              {/* Agent Status */}
              <div className="bg-slate-950 p-3 rounded-md border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="text-slate-300 font-mono">Waiting for agent heartbeat...</span>
                </div>
                <span className="text-slate-500 text-[10px]">Auto-refreshing every 5s</span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2 rounded-md text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
