import React from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditPageProps {
  logs: AuditLog[];
}

export const AuditPage: React.FC<AuditPageProps> = ({ logs }) => {
  return (
    <div className="p-6 space-y-6 text-slate-200">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" />
          <span>SaaS Audit Trail</span>
        </h2>
        <p className="text-xs text-slate-400">
          Immutable audit log of all control plane actions, cluster registrations, and incident status updates.
        </p>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Resource Target</th>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">
                    No control plane audit events recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3 font-mono text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-emerald-400">{log.action}</td>
                    <td className="px-6 py-3 font-mono text-white">{log.resource}</td>
                    <td className="px-6 py-3 font-mono text-slate-300">{log.user_email}</td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-[11px]">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
