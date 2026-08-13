import React, { useState } from 'react';
import { Ticket as TicketIcon, UserCheck, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Ticket } from '../types';
import { updateTicketStatus } from '../services/api';

interface TicketsPageProps {
  tickets: Ticket[];
  onRefresh: () => void;
}

export const TicketsPage: React.FC<TicketsPageProps> = ({ tickets, onRefresh }) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdatingId(ticketId);
    try {
      await updateTicketStatus(ticketId, newStatus);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 text-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TicketIcon className="w-5 h-5 text-indigo-400" />
            <span>SRE Tickets</span>
          </h2>
          <p className="text-xs text-slate-400">
            Remediation tickets generated directly from correlated incident reports.
          </p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <TicketIcon className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Tickets Created</h3>
          <p className="text-xs text-slate-400">
            To create an SRE ticket, open any correlated incident and click "Convert to Ticket".
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3">Ticket ID</th>
                  <th className="px-6 py-3">Priority</th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Cluster / Resource</th>
                  <th className="px-6 py-3">Assignee</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3 font-mono font-bold text-indigo-300">{t.id}</td>
                    <td className="px-6 py-3 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.priority === 'P0'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-200">{t.title}</td>
                    <td className="px-6 py-3 font-mono text-slate-400">
                      {t.cluster_name} <span className="text-slate-600">/</span> {t.resource}
                    </td>
                    <td className="px-6 py-3 text-slate-300 font-mono flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t.assignee}</span>
                    </td>
                    <td className="px-6 py-3 font-mono">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        disabled={updatingId === t.id}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="BLOCKED">BLOCKED</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-[11px] font-mono">
                      {new Date(t.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
