import React, { useState } from 'react';
import { Lock, Mail, Key, Shield, User as UserIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { login, getCurrentUser } from '../services/api';
import { User, Role } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@skyops.io');
  const [password, setPassword] = useState('SkyOpsAdmin123!');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await login(email, password);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#0b1019] border border-[#1e2a3d] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100 font-sans">
        <div className="flex items-center justify-between border-b border-[#1c293c] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 tracking-wide">SkyOps Authentication</h2>
              <p className="text-xs text-slate-400 font-mono">Self-Hosted & Cloud RBAC Access</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-[#162234]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-950/50 border border-rose-500/40 rounded-lg text-xs text-rose-300 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@skyops.io"
                className="w-full bg-[#080d15] border border-[#202e42] focus:border-cyan-500 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#080d15] border border-[#202e42] focus:border-cyan-500 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs font-mono tracking-wider transition-colors shadow-lg shadow-cyan-900/30"
          >
            {isLoading ? 'AUTHENTICATING...' : 'LOG IN TO SKYOPS'}
          </button>
        </form>

        {/* Quick Demo Accounts Helper */}
        <div className="bg-[#080d15] border border-[#1a2638] rounded-lg p-3 space-y-2">
          <span className="text-[11px] font-mono text-slate-400 block font-semibold">PRE-CONFIGURED RBAC ACCOUNTS:</span>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@skyops.io', 'SkyOpsAdmin123!')}
              className="py-1 px-2 rounded bg-[#101a28] hover:bg-[#18263a] border border-[#1e2f47] text-cyan-300 text-center truncate"
            >
              ADMIN
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('sre@skyops.io', 'SkyOpsSre123!')}
              className="py-1 px-2 rounded bg-[#101a28] hover:bg-[#18263a] border border-[#1e2f47] text-indigo-300 text-center truncate"
            >
              STAFF SRE
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('dev@skyops.io', 'SkyOpsDev123!')}
              className="py-1 px-2 rounded bg-[#101a28] hover:bg-[#18263a] border border-[#1e2f47] text-emerald-300 text-center truncate"
            >
              DEVELOPER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
