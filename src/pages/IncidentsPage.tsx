import React, { useState } from 'react';
import { AlertTriangle, Filter, ShieldAlert, ArrowRight } from 'lucide-react';
import { Incident } from '../types';

interface IncidentsPageProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
}

export const IncidentsPage: React.FC<IncidentsPageProps> = ({
  incidents,
  onSelectIncident,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredIncidents = incidents.filter((inc) => {
    if (filterSeverity !== 'ALL' && inc.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && inc.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-5 text-slate-200 font-sans max-w-[1600px] mx-auto select-none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#182232] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="tracking-wider uppercase">Correlated Incidents</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Automated correlation engine deduplicating raw pod failure observations into unified incident timelines.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-[#0c121c] px-3 py-1.5 rounded border border-[#182232]">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none font-mono font-semibold"
            >
              <option value="ALL" className="bg-[#0c121c]">ALL</option>
              <option value="CRITICAL" className="bg-[#0c121c]">CRITICAL</option>
              <option value="HIGH" className="bg-[#0c121c]">HIGH</option>
              <option value="MEDIUM" className="bg-[#0c121c]">MEDIUM</option>
              <option value="LOW" className="bg-[#0c121c]">LOW</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0c121c] px-3 py-1.5 rounded border border-[#182232]">
            <span className="text-slate-400">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none font-mono font-semibold"
            >
              <option value="ALL" className="bg-[#0c121c]">ALL</option>
              <option value="DETECTED" className="bg-[#0c121c]">DETECTED</option>
              <option value="OPEN" className="bg-[#0c121c]">OPEN</option>
              <option value="ACKNOWLEDGED" className="bg-[#0c121c]">ACKNOWLEDGED</option>
              <option value="RESOLVED" className="bg-[#0c121c]">RESOLVED</option>
              <option value="CLOSED" className="bg-[#0c121c]">CLOSED</option>
            </select>
          </div>
        </div>
      </div>

      {filteredIncidents.length === 0 ? (
        <div className="bg-[#0c111a] border border-[#182232] rounded-md p-12 text-center space-y-3 font-mono">
          <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Incidents Found</h3>
          <p className="text-xs text-slate-400">
            No correlated incidents matching the selected filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3 font-mono">
          {filteredIncidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              className="bg-[#0c111a] border border-[#182232] hover:border-cyan-500/40 rounded-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-all shadow-sm group"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">
                    {inc.id}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      inc.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : inc.severity === 'HIGH'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {inc.severity}
                  </span>
                  <span className="bg-[#141d2b] text-slate-300 border border-[#1e2b3d] px-2 py-0.5 rounded text-[10px]">
                    {inc.status}
                  </span>
                  <span className="text-slate-400 text-xs">
                    Occurrences: <strong className="text-white">{inc.occurrences}</strong>
                  </span>
                </div>

                <div className="text-sm font-semibold text-slate-200 font-sans">
                  {inc.title}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span>Cluster: <strong className="text-slate-300">{inc.cluster_name}</strong></span>
                  <span>Namespace: <strong className="text-slate-300">{inc.namespace}</strong></span>
                  <span>Target: <strong className="text-slate-300">{inc.resource_type}/{inc.resource_name}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-500">
                  {new Date(inc.first_detected).toLocaleTimeString()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIncident(inc);
                  }}
                  className="bg-[#0e1929] hover:bg-[#14233a] text-cyan-400 border border-cyan-500/40 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Investigate</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

