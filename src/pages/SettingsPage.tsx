import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Key,
  Database,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertCircle,
  Award,
  Server,
  Lock,
  Plus,
  Trash2,
  Edit2,
  Copy,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchSystemInfo,
  fetchLicense,
  activateLicense,
  generateDemoLicenseKey,
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../services/api';
import { SystemInfo, License, User, Role } from '../types';

interface SettingsPageProps {
  demoMode: boolean;
  onToggleDemoMode: () => void;
  currentUser?: User | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ demoMode, onToggleDemoMode, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'system' | 'users' | 'license' | 'demo'>('system');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [license, setLicense] = useState<License | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // License activation input state
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // New user modal/form state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('SRE');

  const isAdmin = currentUser?.role === 'ADMIN';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sys, lic, userList] = await Promise.all([
        fetchSystemInfo().catch(() => null),
        fetchLicense().catch(() => null),
        fetchUsers().catch(() => []),
      ]);
      setSystemInfo(sys);
      setLicense(lic);
      setUsers(userList);
    } catch (err) {
      console.error('Failed to load settings data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setIsActivating(true);
    setMsg(null);
    try {
      const res = await activateLicense(licenseKeyInput.trim());
      setLicense(res.license);
      setMsg({ type: 'success', text: res.message || 'License key activated successfully!' });
      setLicenseKeyInput('');
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to activate license key' });
    } finally {
      setIsActivating(false);
    }
  };

  const handleGenerateEnterpriseDemo = async () => {
    setIsLoading(true);
    try {
      const demo = await generateDemoLicenseKey('ENTERPRISE');
      setLicenseKeyInput(demo.license_key);
      setMsg({
        type: 'success',
        text: 'Generated valid Enterprise signed license key. Click "Activate Key" to apply.',
      });
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Failed to generate demo license' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await createUser({
        email: newEmail.trim(),
        name: newName.trim(),
        password: newPassword,
        role: newRole,
      });
      setMsg({ type: 'success', text: `User ${newEmail} created successfully` });
      setIsAddUserOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to create user' });
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${email}?`)) return;
    try {
      await deleteUser(userId);
      setMsg({ type: 'success', text: `User ${email} deleted` });
      await loadData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to delete user' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMsg({ type: 'success', text: 'Copied to clipboard!' });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="p-6 space-y-6 text-slate-200 max-w-6xl font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#182333] pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-cyan-400" />
            <span>SkyOps Control Plane Settings</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Manage Self-Hosted architecture, Database isolation, RBAC Team members, and Cryptographic licensing.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#0a1018] p-1 border border-[#1b283b] rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveSubTab('system')}
            className={`px-3 py-1.5 rounded font-bold transition-colors ${
              activeSubTab === 'system' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            System & Privacy
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded font-bold transition-colors ${
              activeSubTab === 'users' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Users & RBAC ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('license')}
            className={`px-3 py-1.5 rounded font-bold transition-colors ${
              activeSubTab === 'license' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            License & Tiers
          </button>
          <button
            onClick={() => setActiveSubTab('demo')}
            className={`px-3 py-1.5 rounded font-bold transition-colors ${
              activeSubTab === 'demo' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sandbox Mode
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-lg border text-xs font-mono ${
            msg.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-950/40 text-rose-300 border-rose-500/40'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* SubTab 1: System & Privacy */}
      {activeSubTab === 'system' && (
        <div className="space-y-6">
          {/* Core Architecture Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
            <div className="bg-[#0b1019] border border-[#1a273b] p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>DEPLOYMENT MODE</span>
              </div>
              <div className="text-lg font-bold text-slate-100 uppercase">
                {systemInfo?.deploymentMode || 'SELF-HOSTED'}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Platform operates fully independent of external cloud dependencies.
              </p>
            </div>

            <div className="bg-[#0b1019] border border-[#1a273b] p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                <Database className="w-4 h-4" />
                <span>DATABASE ENGINE</span>
              </div>
              <div className="text-lg font-bold text-slate-100 uppercase">
                {systemInfo?.database?.type === 'postgres' ? 'POSTGRESQL' : 'EMBEDDED DB'}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Status: {systemInfo?.database?.healthy ? 'Operational' : 'Degraded'}
              </p>
            </div>

            <div className="bg-[#0b1019] border border-[#1a273b] p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Lock className="w-4 h-4" />
                <span>DATA PRIVACY</span>
              </div>
              <div className="text-lg font-bold text-emerald-300">STRICT LOCAL ONLY</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Zero external telemetry exfiltration. All events & logs remain inside tenant boundary.
              </p>
            </div>
          </div>

          {/* Cryptographic Secrets Status Card */}
          <div className="bg-[#0b1019] border border-[#1a273b] rounded-xl p-6 space-y-4 font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <span>Cryptographic Secret Generation & Lifecycle</span>
              </h3>
              <span className="px-2.5 py-1 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
                CSPRNG ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-[#070b12] border border-[#182333] p-3.5 rounded-lg space-y-1.5">
                <div className="text-slate-400 text-[11px]">JWT Secret (HS256)</div>
                <div className="text-slate-200 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {systemInfo?.secrets?.jwtSecretSource === 'ENVIRONMENT'
                      ? 'Operator Configured (Env)'
                      : 'Auto-Generated (Persisted)'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">256-bit entropy random token key</div>
              </div>

              <div className="bg-[#070b12] border border-[#182333] p-3.5 rounded-lg space-y-1.5">
                <div className="text-slate-400 text-[11px]">License Secret (HMAC-SHA256)</div>
                <div className="text-slate-200 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {systemInfo?.secrets?.licenseSecretSource === 'ENVIRONMENT'
                      ? 'Operator Configured (Env)'
                      : 'Auto-Generated (Persisted)'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">Cryptographic offline license verifier</div>
              </div>

              <div className="bg-[#070b12] border border-[#182333] p-3.5 rounded-lg space-y-1.5">
                <div className="text-slate-400 text-[11px]">Secret Persistence Storage</div>
                <div className="text-slate-200 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{systemInfo?.secrets?.isSecretsFilePersisted ? 'Local Disk (.data)' : 'In-Memory (Ephemeral)'}</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={systemInfo?.secrets?.secretsFilePath || '.data/secrets.json'}>
                  {systemInfo?.secrets?.secretsFilePath || '.data/secrets.json'}
                </div>
              </div>
            </div>
          </div>

          {/* Runtime & Process Diagnostics */}
          <div className="bg-[#0b1019] border border-[#1a273b] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>SkyOps Single-Tenant Architecture & Endpoints</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[#070b12] border border-[#182333] p-4 rounded-lg space-y-2">
                <span className="text-slate-500 block text-[11px]">Control Plane Endpoints</span>
                <div className="space-y-1 text-slate-300">
                  <div>
                    <span className="text-cyan-400 font-bold">Agent Ingestion:</span> POST /api/v1/agent/heartbeat
                  </div>
                  <div>
                    <span className="text-cyan-400 font-bold">Agent Registration:</span> POST /api/v1/agent/register
                  </div>
                  <div>
                    <span className="text-cyan-400 font-bold">Installer Script:</span> GET /agent.sh
                  </div>
                  <div>
                    <span className="text-cyan-400 font-bold">Uptime:</span> {systemInfo?.uptimeSeconds ? `${Math.floor(systemInfo.uptimeSeconds / 60)}m ${systemInfo.uptimeSeconds % 60}s` : 'Active'}
                  </div>
                </div>
              </div>

              <div className="bg-[#070b12] border border-[#182333] p-4 rounded-lg space-y-2">
                <span className="text-slate-500 block text-[11px]">Observability & Probes</span>
                <div className="space-y-1 text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Liveness: /health</span>
                    <a href="/health" target="_blank" className="text-cyan-400 hover:underline flex items-center gap-1">
                      JSON <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Readiness: /ready</span>
                    <a href="/ready" target="_blank" className="text-cyan-400 hover:underline flex items-center gap-1">
                      JSON <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Prometheus: /metrics</span>
                    <a href="/metrics" target="_blank" className="text-cyan-400 hover:underline flex items-center gap-1">
                      Metrics <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {systemInfo?.runtime && (
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      Node: {systemInfo.runtime.nodeVersion} | Memory: {systemInfo.runtime.memoryUsageMb}MB
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Users & RBAC */}
      {activeSubTab === 'users' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Role-Based Access Control (RBAC) User Directory</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Assign granular roles: ADMIN (Full Control), SRE (Cluster & Incident Management), DEVELOPER (Diagnostics & Tickets), VIEWER (Read Only).
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs font-mono transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD USER</span>
              </button>
            )}
          </div>

          {/* User list table */}
          <div className="bg-[#0b1019] border border-[#1a273b] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#070d14] border-b border-[#182333] text-slate-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3">NAME & EMAIL</th>
                    <th className="px-4 py-3">ROLE</th>
                    <th className="px-4 py-3">CREATED</th>
                    <th className="px-4 py-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151f2e]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#0e1522] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-200">{u.name}</div>
                        <div className="text-slate-500 text-[11px]">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-950/50 text-purple-300 border-purple-500/30'
                              : u.role === 'SRE'
                              ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/30'
                              : u.role === 'DEVELOPER'
                              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin && u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-1 rounded text-rose-400 hover:bg-rose-950/40 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add User Modal */}
          {isAddUserOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-[#0b1019] border border-[#1e2a3d] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#1c293c] pb-3">
                  <h3 className="text-sm font-bold text-slate-100 font-mono">Create New Team Member</h3>
                  <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-200">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="block text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-[#080d15] border border-[#202e42] focus:border-cyan-500 rounded p-2 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full bg-[#080d15] border border-[#202e42] focus:border-cyan-500 rounded p-2 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Initial Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#080d15] border border-[#202e42] focus:border-cyan-500 rounded p-2 text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">RBAC Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as Role)}
                      className="w-full bg-[#080d15] border border-[#202e42] focus:border-cyan-500 rounded p-2 text-slate-200"
                    >
                      <option value="ADMIN">ADMIN - Full administrative control</option>
                      <option value="SRE">SRE - Cluster management & incident resolution</option>
                      <option value="DEVELOPER">DEVELOPER - Root cause analysis & tickets</option>
                      <option value="VIEWER">VIEWER - Read only telemetry</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddUserOpen(false)}
                      className="px-3 py-1.5 rounded bg-[#101824] hover:bg-[#182436] text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                    >
                      Create User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: License & Tiers */}
      {activeSubTab === 'license' && (
        <div className="space-y-6">
          {/* Current License Details */}
          <div className="bg-[#0b1019] border border-[#1a273b] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono">
                  ACTIVE LICENSE: {license?.plan || 'COMMUNITY'} EDITION
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
                VALID & ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono bg-[#070b12] p-4 rounded-lg border border-[#182333]">
              <div>
                <span className="text-slate-500 block text-[10px]">Max Connected Clusters</span>
                <span className="text-slate-200 font-bold text-sm">
                  {license?.current_clusters || 0} / {license?.max_clusters || 5}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Max User Seats</span>
                <span className="text-slate-200 font-bold text-sm">
                  {license?.current_users || 0} / {license?.max_users || 10}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Audit Retention</span>
                <span className="text-slate-200 font-bold text-sm">
                  {license?.features?.audit_retention_days || 90} Days
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Expires On</span>
                <span className="text-slate-200 font-bold text-sm">
                  {license?.expires_at ? new Date(license.expires_at).toLocaleDateString() : 'Perpetual'}
                </span>
              </div>
            </div>
          </div>

          {/* Activate License Key Form */}
          <div className="bg-[#0b1019] border border-[#1a273b] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>Apply Cryptographically Signed License Key</span>
            </h3>

            <p className="text-xs text-slate-400 font-mono">
              Offline HMAC-SHA256 signature verification allows immediate on-premise upgrades without external network connections.
            </p>

            <form onSubmit={handleActivateLicense} className="space-y-3 font-mono text-xs">
              <div className="relative">
                <textarea
                  rows={3}
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="SKYOPS-eyJpZCI6ImxpYy1kZWZhdWx0Iiwi...signature"
                  className="w-full bg-[#080d15] border border-[#202e42] focus:border-cyan-500 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleGenerateEnterpriseDemo}
                  className="px-3 py-2 rounded bg-[#101926] hover:bg-[#18263a] border border-[#1e2f47] text-cyan-300 text-xs font-mono font-semibold"
                >
                  ⚡ Generate Enterprise Evaluation Key
                </button>

                <button
                  type="submit"
                  disabled={isActivating || !licenseKeyInput.trim()}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono tracking-wider shadow-md"
                >
                  {isActivating ? 'ACTIVATING...' : 'ACTIVATE LICENSE KEY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SubTab 4: Demo Sandbox Mode */}
      {activeSubTab === 'demo' && (
        <div className="bg-[#0b1019] border border-[#1a273b] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-mono">Evaluation Sandbox & Telemetry Simulator</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Populates realistic production clusters, crash incidents, and SRE tasks for testing without connecting a live Kubernetes cluster.
                </p>
              </div>
            </div>

            <button
              onClick={onToggleDemoMode}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold border transition-colors ${
                demoMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
              }`}
            >
              {demoMode ? 'DISABLE SANDBOX MODE' : 'ENABLE SANDBOX MODE'}
            </button>
          </div>

          <div className="bg-[#070b12] border border-[#182333] p-4 rounded-lg text-xs font-mono space-y-2 text-slate-300">
            <p>
              <strong>Status:</strong> {demoMode ? 'Active - Populated with sample clusters (production-us-east, staging-eu-west)' : 'Inactive - Awaiting live telemetry from skyops-agent'}
            </p>
            <p>
              <strong>Clean-up guarantee:</strong> Disabling sandbox mode removes demo records cleanly from the local database repository.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
