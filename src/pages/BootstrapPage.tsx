import React, { useState } from 'react';
import {
  Shield,
  Key,
  Lock,
  User as UserIcon,
  Mail,
  Building2,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  Server,
} from 'lucide-react';
import { verifyBootstrapPassword, createPermanentAdmin } from '../services/api';
import { User, SetupStatus } from '../types';

interface BootstrapPageProps {
  setupStatus: SetupStatus | null;
  onComplete: (user: User) => void;
}

export const BootstrapPage: React.FC<BootstrapPageProps> = ({ setupStatus, onComplete }) => {
  // Wizard steps: 'VERIFY_PASSWORD' -> 'CREATE_ADMIN' -> 'READY'
  const [step, setStep] = useState<'VERIFY_PASSWORD' | 'CREATE_ADMIN' | 'READY'>('VERIFY_PASSWORD');

  // Step 1 State
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [showBootstrapPassword, setShowBootstrapPassword] = useState(false);
  const [bootstrapToken, setBootstrapToken] = useState<string | null>(null);

  // Step 2 State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('Primary Workspace');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Step 3 State
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  // Global UX
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const passwordFilePath = setupStatus?.passwordFilePath || '.data/secrets/initial-admin-password';

  const copyCommand = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // 1. Verify Bootstrap Password
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrapPassword.trim()) {
      setError('Please enter the initial administrator password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await verifyBootstrapPassword(bootstrapPassword.trim());
      setBootstrapToken(res.bootstrapToken);
      setStep('CREATE_ADMIN');
    } catch (err: any) {
      setError(err.message || 'Invalid initial administrator password. Please verify with the server filesystem.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Create Permanent Administrator Account
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrapToken) {
      setError('Session expired. Please re-verify the initial administrator password.');
      setStep('VERIFY_PASSWORD');
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid administrator email address.');
      return;
    }

    if (password.length < 8) {
      setError('Permanent password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify and retype.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await createPermanentAdmin({
        bootstrapToken,
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        organizationName: organizationName.trim() || 'Primary Workspace',
      });

      setCreatedUser(res.user);
      setStep('READY');
    } catch (err: any) {
      setError(err.message || 'Failed to create administrator account.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Finalize & Enter App
  const handleEnterApp = () => {
    if (createdUser) {
      onComplete(createdUser);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0f] flex flex-col justify-between text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <header className="border-b border-[#141e2e] px-6 py-4 flex items-center justify-between bg-[#090d15]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-wider text-white">SKYOPS</span>
              <span className="text-[10px] font-mono font-bold bg-[#121c2c] text-cyan-400 px-2 py-0.5 rounded border border-[#1e2f47]">
                BOOTSTRAP WIZARD
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Self-Hosted Kubernetes Observability Control Plane</p>
          </div>
        </div>

        {/* Step Progress Pills */}
        <div className="hidden sm:flex items-center gap-2 font-mono text-xs">
          <div
            className={`px-3 py-1 rounded border flex items-center gap-1.5 ${
              step === 'VERIFY_PASSWORD'
                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                : 'bg-[#0d1420] border-[#182638] text-slate-500'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Unlock</span>
          </div>

          <span className="text-slate-600">&rarr;</span>

          <div
            className={`px-3 py-1 rounded border flex items-center gap-1.5 ${
              step === 'CREATE_ADMIN'
                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300 font-bold'
                : step === 'READY'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-[#0d1420] border-[#182638] text-slate-500'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Admin Setup</span>
          </div>

          <span className="text-slate-600">&rarr;</span>

          <div
            className={`px-3 py-1 rounded border flex items-center gap-1.5 ${
              step === 'READY'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                : 'bg-[#0d1420] border-[#182638] text-slate-500'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Ready</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-[#0c121c] border border-[#1a2638] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          {/* STEP 1: INITIAL ADMIN PASSWORD */}
          {step === 'VERIFY_PASSWORD' && (
            <div>
              <div className="p-6 pb-4 border-b border-[#162234] bg-[#090e17]">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
                  <Key className="w-3.5 h-3.5" />
                  <span>First-Launch Initial Authentication</span>
                </div>
                <h1 className="text-xl font-bold text-white tracking-wide">
                  Initial Administrator Password
                </h1>
                <p className="text-xs text-slate-400 font-mono mt-1.5 leading-relaxed">
                  Paste the one-time administrator password automatically generated by SkyOps during installation.
                </p>
              </div>

              <div className="p-6 space-y-5">
                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 font-mono">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Verification Failed</p>
                      <p className="text-rose-300/90 text-[11px] mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {/* Operator Retrieval Commands Box */}
                <div className="bg-[#070b12] border border-[#1a2638] rounded-lg p-4 space-y-3 font-mono">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-bold text-slate-300">RETRIEVE FROM SERVER / CONTAINER:</span>
                    </div>
                  </div>

                  {/* Local Server CLI */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Self-Hosted / Local CLI:</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#04070c] border border-[#142030] rounded px-2.5 py-1.5 text-xs text-cyan-300">
                      <code>cat {passwordFilePath}</code>
                      <button
                        type="button"
                        onClick={() => copyCommand(`cat ${passwordFilePath}`, 'cat')}
                        className="text-slate-500 hover:text-slate-300 ml-2"
                        title="Copy command"
                      >
                        {copiedCmd === 'cat' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Docker Compose */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Docker Compose:</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#04070c] border border-[#142030] rounded px-2.5 py-1.5 text-xs text-cyan-300">
                      <code>docker compose exec skyops skyops admin initial-password</code>
                      <button
                        type="button"
                        onClick={() => copyCommand('docker compose exec skyops skyops admin initial-password', 'docker')}
                        className="text-slate-500 hover:text-slate-300 ml-2"
                        title="Copy command"
                      >
                        {copiedCmd === 'docker' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Kubernetes */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Kubernetes:</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#04070c] border border-[#142030] rounded px-2.5 py-1.5 text-xs text-cyan-300">
                      <code>kubectl exec -n skyops-system deployment/skyops -- skyops admin initial-password</code>
                      <button
                        type="button"
                        onClick={() => copyCommand('kubectl exec -n skyops-system deployment/skyops -- skyops admin initial-password', 'k8s')}
                        className="text-slate-500 hover:text-slate-300 ml-2"
                        title="Copy command"
                      >
                        {copiedCmd === 'k8s' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Input Form */}
                <form onSubmit={handleVerifyPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Administrator Password
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type={showBootstrapPassword ? 'text' : 'password'}
                        required
                        autoFocus
                        value={bootstrapPassword}
                        onChange={(e) => setBootstrapPassword(e.target.value)}
                        placeholder="SKYOPS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono transition-colors tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBootstrapPassword(!showBootstrapPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                      >
                        {showBootstrapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !bootstrapPassword.trim()}
                    className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg text-xs font-mono tracking-wider transition-colors shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>VERIFYING CREDENTIAL...</span>
                      </>
                    ) : (
                      <>
                        <span>CONTINUE</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* STEP 2: CREATE YOUR ADMINISTRATOR ACCOUNT */}
          {step === 'CREATE_ADMIN' && (
            <div>
              <div className="p-6 pb-4 border-b border-[#162234] bg-[#090e17]">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Bootstrap Credential Verified</span>
                </div>
                <h1 className="text-xl font-bold text-white tracking-wide">
                  Create Your Administrator Account
                </h1>
                <p className="text-xs text-slate-400 font-mono mt-1.5">
                  Configure the permanent master administrator credentials for your instance.
                </p>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 font-mono">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Error</p>
                      <p className="text-rose-300/90 text-[11px] mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alex Rivera"
                        className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Email / Username
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@company.internal"
                        className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Password & Confirm */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 rounded-lg pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-3 text-slate-500 hover:text-slate-300"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Organization Name */}
                  <div>
                    <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                      Organization Name <span className="text-slate-500">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="Primary Workspace"
                        className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !fullName.trim() || !email.trim() || !password}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg text-xs font-mono tracking-wider transition-colors shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 mt-4"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>CREATING ADMINISTRATOR...</span>
                      </>
                    ) : (
                      <>
                        <span>CREATE ADMINISTRATOR</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* STEP 3: SKYOPS IS READY */}
          {step === 'READY' && (
            <div>
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto animate-pulse">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h1 className="text-2xl font-black text-white tracking-wide">
                    SkyOps is Ready!
                  </h1>
                  <p className="text-xs text-emerald-400 font-mono font-semibold">
                    Administrator account successfully created.
                  </p>
                </div>

                <div className="bg-[#070b12] border border-[#1a2638] rounded-lg p-4 text-xs font-mono text-slate-400 space-y-2 text-left">
                  <div className="flex items-center justify-between pb-2 border-b border-[#142030]">
                    <span>Master Administrator:</span>
                    <span className="text-white font-bold">{createdUser?.email}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#142030]">
                    <span>Assigned Role:</span>
                    <span className="text-cyan-400 font-bold">ADMIN (Full Access)</span>
                  </div>
                  <div className="flex items-start gap-2 pt-1 text-[11px] text-amber-300/90">
                    <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>The one-time bootstrap credential has been permanently invalidated and erased from disk.</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEnterApp}
                  className="w-full py-3 px-6 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs font-mono tracking-wider transition-colors shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2"
                >
                  <span>CONTINUE TO DASHBOARD</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Card Footer Info */}
          <div className="px-6 py-3 bg-[#080d15] border-t border-[#141e2e] flex items-center justify-between text-[11px] font-mono text-slate-500">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Self-Hosted Control Plane</span>
            </div>
            <span className="text-slate-500">v1.0.0</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#141e2e] px-6 py-3 bg-[#080d15] text-center text-xs font-mono text-slate-500">
        SkyOps Autonomous Kubernetes Incident Triage Engine &bull; Zero External Cloud Dependencies
      </footer>
    </div>
  );
};
