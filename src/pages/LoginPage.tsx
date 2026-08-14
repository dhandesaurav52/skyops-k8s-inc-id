import React, { useState } from 'react';
import { Shield, Lock, Mail, Key, Eye, EyeOff, Server, Terminal, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { login } from '../services/api';
import { User } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await login(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid administrator email or password. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0f] flex flex-col justify-between text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bar */}
      <header className="border-b border-[#141e2e] px-6 py-4 flex items-center justify-between bg-[#090d15]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-wider text-white">SKYOPS</span>
              <span className="text-[10px] font-mono font-bold bg-[#121c2c] text-cyan-400 px-2 py-0.5 rounded border border-[#1e2f47]">
                CONTROL PLANE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Self-Hosted Kubernetes Observability</p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0d1420] border border-[#182638] rounded">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-400 font-semibold text-[11px]">Control Plane Online</span>
          </div>
        </div>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[#0c121c] border border-[#1a2638] rounded-xl shadow-2xl overflow-hidden">
          {/* Card Header */}
          <div className="p-6 pb-4 border-b border-[#162234] bg-[#090e17]">
            <h1 className="text-lg font-bold text-white tracking-wide">Sign In to SkyOps</h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Authenticate using the credentials specified during installation.
            </p>
          </div>

          {/* Form */}
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 font-mono animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Authentication Failed</p>
                  <p className="text-rose-300/90 text-[11px]">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@company.internal"
                    className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono font-medium text-slate-300">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#070b12] border border-[#1c2a3d] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 rounded-lg pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg text-xs font-mono tracking-wider transition-colors shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>LOG IN TO CONTROL PLANE</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Card Footer Info */}
          <div className="px-6 py-3.5 bg-[#080d15] border-t border-[#141e2e] flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Self-Hosted Instance</span>
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
