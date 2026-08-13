import React from 'react';
import { ListFilter, Radio } from 'lucide-react';
import { K8sEvent } from '../types';

interface EventsPageProps {
  events: K8sEvent[];
}

export const EventsPage: React.FC<EventsPageProps> = ({ events }) => {
  return (
    <div className="p-6 space-y-6 text-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ListFilter className="w-5 h-5 text-emerald-400" />
            <span>Kubernetes Event Stream</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time event stream ingested from Kubernetes API informers.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/30">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>LIVE STREAM</span>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Resource Target</th>
                <th className="px-6 py-3">Message</th>
                <th className="px-6 py-3">Count</th>
                <th className="px-6 py-3">Observed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                    No Kubernetes events currently streamed.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-3 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          evt.type === 'Warning' || evt.type === 'Error'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {evt.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-white">{evt.reason}</td>
                    <td className="px-6 py-3 font-mono text-slate-300">
                      {evt.namespace} / {evt.resource}
                    </td>
                    <td className="px-6 py-3 text-slate-300 font-mono text-[11px]">
                      {evt.message}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-400">{evt.count}x</td>
                    <td className="px-6 py-3 font-mono text-slate-500 text-[11px]">
                      {new Date(evt.last_observed).toLocaleTimeString()}
                    </td>
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
