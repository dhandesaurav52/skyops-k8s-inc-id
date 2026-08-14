import React, { useState } from 'react';
import {
  Shield,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  Sparkles,
  Server,
  Key,
} from 'lucide-react';
import { SetupStatus, User } from '../types';
import { initializeSetup } from '../services/api';

interface SetupWizardProps {
  setupStatus: SetupStatus | null;
  onComplete: (user: User) => void;
}

export function SetupWizard({ setupStatus, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [adminName, setAdminName] = useState<string>('SkyOps Administrator');
  const [adminEmail, setAdminEmail] = useState<string>('admin@skyops.io');
  const [adminPassword, setAdminPassword] = useState<string>('SkyOpsAdmin123!');
  const [confirmPassword, setConfirmPassword] = useState<string>('SkyOpsAdmin123!');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [organizationName, setOrganizationName] = useState<string>('Acme Cloud Engineering');
  const [licenseType, setLicenseType] = useState<'community' | 'enterprise'>('community');
  const [enterpriseKey, setEnterpriseKey] = useState<string>('');
  const [seedSampleData, setSeedSampleData] = useState<boolean>(true);

  // Completed user placeholder
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  // Password Strength Calculation
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const passwordStrength = getPasswordStrength(adminPassword);

  const handleCreateAdministrator = async () => {
    setError(null);

    if (!adminName || adminName.trim().length < 2) {
      setError('Please enter your full name (minimum 2 characters).');
      return;
    }

    if (!adminEmail || !adminEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Advance to Organization Setup step
    setStep(3);
  };

  const handleFinishSetup = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await initializeSetup({
        adminName,
        adminEmail,
        adminPassword,
        organizationName: organizationName.trim() || 'Primary Infrastructure',
        licenseKey: licenseType === 'enterprise' && enterpriseKey.trim() ? enterpriseKey.trim() : undefined,
        seedSampleData,
      });

      setCreatedUser(res.user);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Initialization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepsList = [
    { id: 1, title: 'Welcome', desc: 'Get Started' },
    { id: 2, title: 'Create Administrator', desc: 'Master Account' },
    { id: 3, title: 'Organization Setup', desc: 'Workspace & Tenancy' },
    { id: 4, title: "You're Ready", desc: 'Launch Dashboard' },
  ];

  return (
    <div id="skyops-setup-wizard-modal" className="fixed inset-0 z-50 bg-[#05070a]/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0b101b] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Wizard Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0d1527] to-slate-900 border-b border-slate-800/80 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-slate-100 tracking-tight">SkyOps Control Plane</h1>
                  <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-md">
                    First-Run Setup
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated Self-Hosted Installation & Master Account Setup
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-500 font-mono">Step {step} of 4</span>
              <div className="text-xs font-medium text-cyan-400">{stepsList[step - 1].title}</div>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mt-6 grid grid-cols-4 gap-2">
            {stepsList.map((s) => (
              <div key={s.id} className="flex flex-col space-y-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s.id === step
                      ? 'bg-cyan-500 shadow-sm shadow-cyan-500/50'
                      : s.id < step
                      ? 'bg-cyan-600/70'
                      : 'bg-slate-800'
                  }`}
                />
                <span
                  className={`text-[11px] truncate ${
                    s.id === step ? 'text-cyan-300 font-semibold' : s.id < step ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="p-8 flex-1">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* STEP 1: Welcome to SkyOps */}
          {step === 1 && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
                <Shield className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                  Welcome to SkyOps
                </h2>
                <p className="text-slate-300 text-base mt-2 font-medium">
                  Let's create your administrator account.
                </p>
                <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto leading-relaxed">
                  SkyOps is running in self-hosted privacy mode with auto-configured internal security.
                  Follow these quick steps to launch your control plane.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
                <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <div className="text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Auto-Configured
                  </div>
                  <div className="text-xs text-slate-300 font-medium">Zero-Configuration</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Internal secrets & database ready</p>
                </div>

                <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <div className="text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Private & Local
                  </div>
                  <div className="text-xs text-slate-300 font-medium">Strict Local Privacy</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Telemetry disabled by default</p>
                </div>

                <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <div className="text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Free Forever
                  </div>
                  <div className="text-xs text-slate-300 font-medium">Community Edition</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Up to 5 K8s clusters included</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Create Administrator */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  Create Master Administrator Account
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  This user will have full cluster management, RBAC, and system audit privileges.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="setup-admin-name"
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="e.g. Sarah Chen"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="setup-admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="admin@yourcompany.com"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="setup-admin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 pr-10"
                        placeholder="••••••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      id="setup-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      placeholder="••••••••••••"
                    />
                  </div>
                </div>

                {/* Password Strength Indicator */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Password Strength:</span>
                    <span className="font-semibold text-slate-300">
                      {passwordStrength >= 4
                        ? 'Strong'
                        : passwordStrength >= 3
                        ? 'Good'
                        : passwordStrength >= 2
                        ? 'Fair'
                        : 'Weak'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full ${
                          passwordStrength >= i
                            ? passwordStrength >= 4
                              ? 'bg-emerald-500'
                              : passwordStrength >= 3
                              ? 'bg-cyan-500'
                              : 'bg-amber-500'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Organization Setup */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Building className="w-5 h-5 text-cyan-400" />
                  Organization & Workspace Setup
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Name your primary organization namespace. You can add clusters, teams, and SREs afterwards.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Organization / Tenant Name
                  </label>
                  <input
                    id="setup-org-name"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="e.g. Acme Corp Infrastructure"
                  />
                </div>

                {/* License Option Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Licensing Plan
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setLicenseType('community')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        licenseType === 'community'
                          ? 'bg-cyan-950/20 border-cyan-500 shadow-md shadow-cyan-500/10'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-2 py-0.5 text-xs font-semibold uppercase bg-cyan-500/20 text-cyan-300 rounded">
                          Community Edition
                        </span>
                        <span className="text-xs font-bold text-emerald-400">Free Forever</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Up to 5 Connected K8s Clusters, AI Root Cause Analysis, and Incident Ticketing.
                      </p>
                    </div>

                    <div
                      onClick={() => setLicenseType('enterprise')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        licenseType === 'enterprise'
                          ? 'bg-indigo-950/20 border-indigo-500 shadow-md shadow-indigo-500/10'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-2 py-0.5 text-xs font-semibold uppercase bg-indigo-500/20 text-indigo-300 rounded">
                          Enterprise Tier
                        </span>
                        <span className="text-xs font-medium text-slate-400">Have a Key</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Unlimited Clusters, Custom SSO/SAML, and 365-day audit log retention.
                      </p>
                    </div>
                  </div>
                </div>

                {licenseType === 'enterprise' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Enterprise License Key
                    </label>
                    <textarea
                      id="setup-enterprise-key"
                      rows={2}
                      value={enterpriseKey}
                      onChange={(e) => setEnterpriseKey(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                      placeholder="SKYOPS-eyJpZCI6ImxpYy0..."
                    />
                  </div>
                )}

                {/* Seed Sample Evaluation Data Checkbox */}
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-start space-x-3">
                    <Sparkles className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        Seed Evaluation Workloads & SRE Incident Data
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Includes sample SRE team accounts and test incidents for immediate tour.
                      </p>
                    </div>
                  </div>
                  <input
                    id="setup-seed-data"
                    type="checkbox"
                    checked={seedSampleData}
                    onChange={(e) => setSeedSampleData(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: You're Ready */}
          {step === 4 && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                  Your SkyOps installation is ready.
                </h2>
                <p className="text-slate-300 text-sm mt-2">
                  Master administrator <strong className="text-cyan-300">{adminEmail}</strong> has been configured for <strong className="text-white">{organizationName}</strong>.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-left space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Master Administrator:</span>
                  <span className="font-semibold text-slate-200 font-mono">{adminName} ({adminEmail})</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Organization:</span>
                  <span className="font-semibold text-slate-200">{organizationName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Licensing Tier:</span>
                  <span className="font-semibold text-cyan-400 uppercase">{licenseType === 'enterprise' ? 'Enterprise' : 'Community (Free Forever)'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Security & Privacy:</span>
                  <span className="font-semibold text-emerald-400">Strict Local Only (Air-Gap Capable)</span>
                </div>
              </div>

              <div className="p-3 bg-cyan-950/20 border border-cyan-800/30 rounded-lg text-xs text-cyan-300 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 flex-shrink-0" />
                Setup wizard is now permanently locked. Future access requires admin authentication.
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="bg-slate-900/90 border-t border-slate-800/80 px-8 py-4 flex items-center justify-between">
          <div>
            {step > 1 && step < 4 && (
              <button
                id="setup-back-btn"
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {step === 1 && (
              <button
                id="setup-get-started-btn"
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                Let's create your administrator account <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                id="setup-create-admin-btn"
                type="button"
                onClick={handleCreateAdministrator}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                Create SkyOps Administrator <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                id="setup-finish-btn"
                type="button"
                onClick={handleFinishSetup}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Initializing SkyOps...
                  </>
                ) : (
                  <>
                    Initialize Control Plane <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {step === 4 && (
              <button
                id="setup-launch-dashboard-btn"
                type="button"
                onClick={() => {
                  if (createdUser) {
                    onComplete(createdUser);
                  }
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Open SkyOps Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
