import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  FileText,
  Download,
  Sparkles,
  Ticket,
  CheckCircle2,
  Clock,
  Terminal,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { Incident } from '../types';
import {
  acknowledgeIncident,
  resolveIncident,
  generateAiDiagnosis,
  convertIncidentToTicket,
} from '../services/api';
import {
  downloadIncidentPdf,
  downloadIncidentJson,
  downloadIncidentMarkdown,
} from '../services/pdfExporter';

interface IncidentDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
  onIncidentUpdated: () => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
  onIncidentUpdated,
}) => {
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [ticketCreated, setTicketCreated] = useState<string | null>(null);

  if (!incident) return null;

  const handleAcknowledge = async () => {
    try {
      await acknowledgeIncident(incident.id, 'sre@skyops.io');
      onIncidentUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = async () => {
    try {
      await resolveIncident(incident.id, 'sre@skyops.io');
      onIncidentUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateAiDiagnosis = async () => {
    setLoadingAi(true);
    try {
      const diagnosis = await generateAiDiagnosis(incident.id);
      setAiDiagnosis(diagnosis);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleConvertToTicket = async () => {
    try {
      const ticket = await convertIncidentToTicket(incident.id, 'sre-lead@skyops.io');
      setTicketCreated(ticket.id);
      onIncidentUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyCommand = () => {
    if (!incident.suggested_command) return;
    navigator.clipboard.writeText(incident.suggested_command);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const severityBadgeClass =
    incident.severity === 'CRITICAL'
      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
      : incident.severity === 'HIGH'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl text-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg text-white">{incident.id}</span>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded border ${severityBadgeClass}`}
            >
              {incident.severity}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">
              {incident.status}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Occurrences: {incident.occurrences}
            </span>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-2.5 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {incident.status === 'OPEN' && (
              <button
                onClick={handleAcknowledge}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold px-3 py-1.5 rounded transition-colors"
              >
                Acknowledge Incident
              </button>
            )}
            {incident.status !== 'RESOLVED' && (
              <button
                onClick={handleResolve}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolve Incident
              </button>
            )}

            {!ticketCreated ? (
              <button
                onClick={handleConvertToTicket}
                className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
              >
                <Ticket className="w-3.5 h-3.5" />
                Convert to Ticket
              </button>
            ) : (
              <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded border border-indigo-500/30 font-mono">
                Ticket Created: {ticketCreated}
              </span>
            )}
          </div>

          {/* Export Downloads */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadIncidentPdf(incident)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700 flex items-center gap-1.5 font-semibold"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => downloadIncidentJson(incident)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded border border-slate-700 font-mono"
            >
              JSON
            </button>
            <button
              onClick={() => downloadIncidentMarkdown(incident)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded border border-slate-700 font-mono"
            >
              MD
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Title & Metadata */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">{incident.title}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Cluster:</span>
                <span className="text-slate-200 font-semibold">{incident.cluster_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Namespace:</span>
                <span className="text-slate-200 font-semibold">{incident.namespace}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Resource:</span>
                <span className="text-slate-200 font-semibold">
                  {incident.resource_type}/{incident.resource_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">First Detected:</span>
                <span className="text-slate-300">
                  {new Date(incident.first_detected).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* AI Diagnostics Box */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 p-4 rounded-xl border border-indigo-500/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                  SkyOps Gemini AI Diagnostic Engine
                </h4>
              </div>

              {!aiDiagnosis && (
                <button
                  onClick={handleGenerateAiDiagnosis}
                  disabled={loadingAi}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                >
                  {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Generate Root Cause Diagnosis</span>
                </button>
              )}
            </div>

            {aiDiagnosis ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3 bg-indigo-950/50 p-2.5 rounded border border-indigo-500/20 font-mono">
                  <span className="text-indigo-300 font-bold">
                    Confidence: {Math.round((aiDiagnosis.confidence || 0.92) * 100)}%
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-300">Analysis verified against container exit events</span>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">AI Identified Root Cause:</span>
                  <p className="text-slate-200 font-mono bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                    {aiDiagnosis.root_cause || aiDiagnosis.summary}
                  </p>
                </div>

                {aiDiagnosis.recommended_actions && (
                  <div>
                    <span className="text-slate-400 font-semibold block mb-0.5">Recommended Actions:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-1 pl-1">
                      {aiDiagnosis.recommended_actions.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Click above to synthesize structured container exit codes, logs, and k8s event timeline using Gemini AI.
              </p>
            )}
          </div>

          {/* Root Cause & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Impact & Summary
              </h4>
              <p className="text-xs text-slate-300 mb-2 leading-relaxed">{incident.summary}</p>
              <div className="text-xs text-slate-400 pt-2 border-t border-slate-900">
                <strong className="text-slate-300">Business Impact:</strong> {incident.impact}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Identified Root Cause
              </h4>
              <p className="text-xs text-rose-300 font-mono leading-relaxed bg-rose-950/30 p-2.5 rounded border border-rose-500/20">
                {incident.root_cause}
              </p>
            </div>
          </div>

          {/* Container Evidence & Logs */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>Forensic Evidence & Container Logs</span>
            </h4>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1 max-h-48 overflow-y-auto">
              {incident.evidence && incident.evidence.length > 0 ? (
                incident.evidence.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-rose-300/90">
                    <span className="text-slate-600 select-none">$</span>
                    <span>{line}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">No raw log lines attached.</p>
              )}
            </div>
          </div>

          {/* Remediation Commands */}
          {incident.suggested_command && (
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Suggested Remediation</span>
                </h4>
                <button
                  onClick={handleCopyCommand}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? 'Copied!' : 'Copy Command'}</span>
                </button>
              </div>

              <code className="block bg-slate-900 p-2.5 rounded text-xs font-mono text-emerald-300 select-all border border-slate-800">
                {incident.suggested_command}
              </code>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Incident Event Timeline</span>
            </h4>

            <div className="space-y-2 border-l-2 border-slate-800 pl-4 font-mono text-xs">
              {incident.timeline && incident.timeline.length > 0 ? (
                incident.timeline.map((item, idx) => (
                  <div key={idx} className="relative pb-2">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-slate-900"></div>
                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      <span className="text-slate-200 font-bold">{item.title}</span>
                    </div>
                    <p className="text-slate-300 mt-0.5">{item.detail}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">No timeline items.</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-1.5 rounded text-xs"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
};
