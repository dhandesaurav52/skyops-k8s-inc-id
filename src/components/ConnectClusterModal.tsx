import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Terminal,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Download,
  FileCode,
  Radio,
  ExternalLink,
  Cpu,
  Boxes,
  AlertTriangle,
  Play,
  Zap,
} from 'lucide-react';
import { registerCluster, fetchClusters } from '../services/api';
import { Cluster } from '../types';

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
  const [copiedTestCmd, setCopiedTestCmd] = useState(false);
  const [copiedManualCmd, setCopiedManualCmd] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'curl' | 'download' | 'yaml'>('download');
  const [connectedCluster, setConnectedCluster] = useState<Cluster | null>(null);

  const [registrationResult, setRegistrationResult] = useState<{
    registration_token: string;
    install_command?: string;
    helm_command?: string;
    cluster: Cluster;
  } | null>(null);

  // Poll for connection status once registration has occurred
  useEffect(() => {
    if (!isOpen || !registrationResult) return;

    const interval = setInterval(async () => {
      try {
        const clusters = await fetchClusters();
        const found = clusters.find(
          (c) =>
            c.name === clusterName ||
            (registrationResult.cluster && c.id === registrationResult.cluster.id)
        );

        if (found && found.status === 'CONNECTED') {
          setConnectedCluster(found);
          onClusterConnected();
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, registrationResult, clusterName, onClusterConnected]);

  if (!isOpen) return null;

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://install.skyops.io';

  const getCurlCommand = () => {
    if (!registrationResult) return '';
    const scriptUrl = `${currentOrigin}/agent.sh`;
    return `curl -fsSL ${scriptUrl} | SKYOPS_TOKEN="${registrationResult.registration_token}" SKYOPS_CLUSTER="${clusterName}" SKYOPS_SERVER_URL="${currentOrigin}" bash`;
  };

  const getDownloadScriptUrl = () => {
    if (!registrationResult) return '';
    return `/api/v1/agent/download-script?cluster=${encodeURIComponent(
      clusterName
    )}&token=${encodeURIComponent(registrationResult.registration_token)}&server_url=${encodeURIComponent(
      currentOrigin
    )}`;
  };

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

  const handleCopy = (text: string, type: 'main' | 'test' | 'manual') => {
    navigator.clipboard.writeText(text);
    if (type === 'main') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (type === 'test') {
      setCopiedTestCmd(true);
      setTimeout(() => setCopiedTestCmd(false), 2000);
    } else if (type === 'manual') {
      setCopiedManualCmd(true);
      setTimeout(() => setCopiedManualCmd(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl text-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">SkyOps Agent Installer</h3>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-500/20">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Install the lightweight Go agent to stream Kubernetes telemetry and detect incidents in real time.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {!registrationResult ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Kubernetes Cluster Name
                </label>
                <input
                  type="text"
                  value={clusterName}
                  onChange={(e) => setClusterName(e.target.value)}
                  placeholder="e.g. production-us-east, eks-staging-01, minikube"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Environment Tier
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                  <option value="other">Edge / Bare-Metal</option>
                </select>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2">
                <p className="font-semibold text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  What the SkyOps Agent Does:
                </p>
                <ul className="text-slate-400 space-y-1 pl-6 list-disc text-[11px]">
                  <li>Collects node health, CPU/memory pressure, and pod statuses</li>
                  <li>Detects <code>CrashLoopBackOff</code>, <code>OOMKilled</code>, and <code>FailedScheduling</code> failures</li>
                  <li>Streams telemetry outbound over secure HTTPS (no inbound open ports)</li>
                  <li>Zero cluster databases or heavyweight sidecars installed in your cluster</li>
                </ul>
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2 rounded-md text-xs flex items-center gap-2 transition-colors shadow-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span>Generate Agent Installer</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Connected Status Card */}
              {connectedCluster ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <span className="font-bold text-sm text-emerald-300">
                        Agent Connected & Actively Streaming!
                      </span>
                    </div>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono font-bold">
                      LIVE HEARTBEAT
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                    <div className="bg-slate-950/60 p-2.5 rounded border border-emerald-500/20">
                      <span className="text-slate-400 block text-[10px]">CLUSTER</span>
                      <span className="text-white font-bold">{connectedCluster.name}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded border border-emerald-500/20">
                      <span className="text-slate-400 block text-[10px]">NODES / PODS</span>
                      <span className="text-white font-bold">
                        {connectedCluster.node_count} Nodes / {connectedCluster.pod_count} Pods
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-2.5 rounded border border-emerald-500/20">
                      <span className="text-slate-400 block text-[10px]">ACTIVE INCIDENTS</span>
                      <span
                        className={`font-bold ${
                          connectedCluster.active_incidents > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {connectedCluster.active_incidents} Incidents
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="font-semibold text-amber-200">
                      Waiting for agent heartbeat from <code>{clusterName}</code>...
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400/80 font-mono">Listening on SaaS Endpoint</span>
                </div>
              )}

              {/* Installation Method Tabs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Choose Installation Method
                  </span>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setActiveMethod('download')}
                      className={`px-3 py-1 rounded font-medium transition-all ${
                        activeMethod === 'download'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ⬇ Download Script (.sh)
                    </button>
                    <button
                      onClick={() => setActiveMethod('curl')}
                      className={`px-3 py-1 rounded font-medium transition-all ${
                        activeMethod === 'curl'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      1-Line Command
                    </button>
                    <button
                      onClick={() => setActiveMethod('yaml')}
                      className={`px-3 py-1 rounded font-medium transition-all ${
                        activeMethod === 'yaml'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Kubernetes YAML
                    </button>
                  </div>
                </div>

                {/* Tab 1: Download Preconfigured Script */}
                {activeMethod === 'download' && (
                  <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Download className="w-4 h-4 text-emerald-400" />
                          Pre-Configured Agent Installer Script
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Contains your cluster token and endpoint pre-baked. Just download and run.
                        </p>
                      </div>

                      <a
                        href={getDownloadScriptUrl()}
                        download={`skyops-install-${clusterName}.sh`}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-md text-xs flex items-center justify-center gap-2 transition-colors shadow-sm shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download skyops-install.sh</span>
                      </a>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-900">
                      <span className="text-[11px] text-slate-400 block mb-1 font-semibold">
                        After downloading, run in your cluster control plane or terminal:
                      </span>
                      <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded border border-slate-800 font-mono text-xs text-emerald-300">
                        <code>bash skyops-install-{clusterName}.sh</code>
                        <button
                          onClick={() => handleCopy(`bash skyops-install-${clusterName}.sh`, 'manual')}
                          className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded"
                        >
                          {copiedManualCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedManualCmd ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: 1-Line Curl Command */}
                {activeMethod === 'curl' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-mono">Execute directly in terminal with kubectl access:</span>
                      <button
                        onClick={() => handleCopy(getCurlCommand(), 'main')}
                        className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/30 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied to Clipboard!' : 'Copy Command'}</span>
                      </button>
                    </div>

                    <pre className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                      {getCurlCommand()}
                    </pre>
                  </div>
                )}

                {/* Tab 3: Kubernetes YAML */}
                {activeMethod === 'yaml' && (
                  <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <FileCode className="w-4 h-4 text-emerald-400" />
                          Declarative Kubernetes Manifest (agent.yaml)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          For GitOps, ArgoCD, Flux, or direct <code>kubectl apply</code>.
                        </p>
                      </div>

                      <a
                        href="/agent.yaml"
                        download="skyops-agent.yaml"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download agent.yaml</span>
                      </a>
                    </div>

                    <div className="bg-slate-900 p-3 rounded border border-slate-800 text-xs font-mono text-slate-300 space-y-1">
                      <p className="text-slate-400 text-[11px]">Deploy directly via URL:</p>
                      <code>kubectl apply -f {currentOrigin}/agent.yaml</code>
                    </div>
                  </div>
                )}
              </div>

              {/* Simulation Test Helper */}
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-amber-400" />
                    Verify Real-Time Incident Detection (Optional Test):
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'kubectl run test-fail-pod --image=busybox --restart=Always -n default -- sh -c "sleep 2; exit 1"',
                        'test'
                      )
                    }
                    className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                  >
                    {copiedTestCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTestCmd ? 'Copied' : 'Copy Test'}</span>
                  </button>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Run <code>kubectl run test-fail-pod --image=busybox --restart=Always -n default -- sh -c "sleep 2; exit 1"</code> to see SkyOps instantly catch the <code>CrashLoopBackOff</code> and generate an incident!
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-2 rounded-md text-xs"
                >
                  {connectedCluster ? 'Close & View Incidents' : 'Done'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
