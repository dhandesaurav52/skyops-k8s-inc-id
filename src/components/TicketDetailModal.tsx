import React, { useState, useEffect } from 'react';
import {
  X,
  Ticket as TicketIcon,
  Download,
  CheckCircle2,
  Clock,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  UserCheck,
  MessageSquare,
  ListTodo,
  ExternalLink,
  Plus,
  Send,
  Sparkles,
  ShieldCheck,
  FileCode,
  Tag,
  Share2,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { Ticket, TicketStatus, Severity } from '../types';
import {
  updateTicket,
  toggleTicketTask,
  addTicketComment,
} from '../services/api';
import {
  downloadTicketPdf,
  downloadTicketJson,
  downloadTicketMarkdown,
} from '../services/pdfExporter';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onTicketUpdated: () => void;
  onSelectIncident?: (incidentId: string) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
  onTicketUpdated,
  onSelectIncident,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [authorName, setAuthorName] = useState('sre-engineer@skyops.io');
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!ticket) return null;

  const handleStatusChange = async (newStatus: TicketStatus) => {
    setStatusUpdating(true);
    try {
      await updateTicket(ticket.id, { status: newStatus });
      onTicketUpdated();
    } catch (e) {
      console.error('Failed to update ticket status', e);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCloseTicketAndExit = async () => {
    setStatusUpdating(true);
    try {
      await updateTicket(ticket.id, { status: 'CLOSED' });
      onTicketUpdated();
      onClose();
    } catch (e) {
      console.error('Failed to close ticket', e);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: 'P0' | 'P1' | 'P2' | 'P3') => {
    try {
      await updateTicket(ticket.id, { priority: newPriority });
      onTicketUpdated();
    } catch (e) {
      console.error('Failed to update priority', e);
    }
  };

  const handleAssigneeChange = async (newAssignee: string) => {
    try {
      await updateTicket(ticket.id, { assignee: newAssignee });
      onTicketUpdated();
    } catch (e) {
      console.error('Failed to update assignee', e);
    }
  };

  const handleToggleTask = async (taskId: string, currentVal: boolean) => {
    try {
      await toggleTicketTask(ticket.id, taskId, !currentVal);
      onTicketUpdated();
    } catch (e) {
      console.error('Failed to toggle task', e);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const existingTasks = ticket.tasks || [];
    const updatedTasks = [
      ...existingTasks,
      { id: `tsk-${Date.now()}`, text: newTaskText.trim(), completed: false },
    ];

    try {
      await updateTicket(ticket.id, { tasks: updatedTasks });
      setNewTaskText('');
      setIsAddingTask(false);
      onTicketUpdated();
    } catch (err) {
      console.error('Failed to add task', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await addTicketComment(ticket.id, newComment.trim());
      setNewComment('');
      onTicketUpdated();
    } catch (e) {
      console.error('Failed to post comment', e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCopyCommand = () => {
    if (!ticket.suggested_command) return;
    navigator.clipboard.writeText(ticket.suggested_command);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyYaml = () => {
    if (!ticket.suggested_yaml_patch) return;
    navigator.clipboard.writeText(ticket.suggested_yaml_patch);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 2000);
  };

  const handleCopySummary = () => {
    const summaryText = `[SkyOps SRE Ticket ${ticket.id}] (${ticket.priority} - ${ticket.status})\nTitle: ${ticket.title}\nCluster: ${ticket.cluster_name} / Namespace: ${ticket.namespace}\nResource: ${ticket.resource}\nAssignee: ${ticket.assignee}\nDescription: ${ticket.description}`;
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const priorityBadgeClass =
    ticket.priority === 'P0'
      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
      : ticket.priority === 'P1'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
      : ticket.priority === 'P2'
      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
      : 'bg-slate-700/40 text-slate-300 border-slate-600/40';

  const severityBadgeClass =
    ticket.severity === 'CRITICAL'
      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
      : ticket.severity === 'HIGH'
      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';

  const statusBadgeClass =
    ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : ticket.status === 'IN_PROGRESS'
      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
      : ticket.status === 'BLOCKED'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  const completedTasksCount = ticket.tasks ? ticket.tasks.filter((t) => t.completed).length : 0;
  const totalTasksCount = ticket.tasks ? ticket.tasks.length : 0;
  const taskProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-5xl text-slate-200 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
      >
        {/* Document Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <TicketIcon className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono font-bold text-lg text-white tracking-wide">{ticket.id}</span>
              <span className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded border ${priorityBadgeClass}`}>
                {ticket.priority}
              </span>
              <span className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded border ${severityBadgeClass}`}>
                {ticket.severity}
              </span>
              
              {/* Interactive Status Selector */}
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                disabled={statusUpdating}
                className={`px-2.5 py-0.5 text-xs font-bold font-mono rounded border focus:outline-none cursor-pointer ${statusBadgeClass}`}
                title="Change ticket status"
              >
                <option value="OPEN" className="bg-slate-900 text-amber-300">OPEN</option>
                <option value="IN_PROGRESS" className="bg-slate-900 text-indigo-300">IN_PROGRESS</option>
                <option value="BLOCKED" className="bg-slate-900 text-rose-300">BLOCKED</option>
                <option value="RESOLVED" className="bg-slate-900 text-emerald-300">RESOLVED</option>
                <option value="CLOSED" className="bg-slate-900 text-slate-400">CLOSED</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {ticket.incident_id && (
              <button
                onClick={() => onSelectIncident && onSelectIncident(ticket.incident_id)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded text-xs font-mono flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="View linked incident"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Linked: {ticket.incident_id}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-mono border border-transparent hover:border-slate-700"
              title="Close document (Esc)"
              aria-label="Close document"
            >
              <X className="w-5 h-5" />
              <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Status Progression Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-mono text-[11px] uppercase mr-1">Lifecycle:</span>
            {ticket.status !== 'IN_PROGRESS' && ticket.status !== 'CLOSED' && (
              <button
                onClick={() => handleStatusChange('IN_PROGRESS')}
                disabled={statusUpdating}
                className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>In Progress</span>
              </button>
            )}

            {ticket.status !== 'BLOCKED' && ticket.status !== 'CLOSED' && (
              <button
                onClick={() => handleStatusChange('BLOCKED')}
                disabled={statusUpdating}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold px-3 py-1.5 rounded transition-colors"
              >
                Mark Blocked
              </button>
            )}

            {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
              <button
                onClick={() => handleStatusChange('RESOLVED')}
                disabled={statusUpdating}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            )}

            {ticket.status !== 'CLOSED' ? (
              <button
                onClick={() => handleStatusChange('CLOSED')}
                disabled={statusUpdating}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                title="Mark this ticket as CLOSED"
              >
                <Archive className="w-3.5 h-3.5 text-rose-400" />
                <span>Close Ticket</span>
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange('OPEN')}
                disabled={statusUpdating}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                title="Reopen this closed ticket"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Reopen Ticket</span>
              </button>
            )}
          </div>

          {/* Quick Actions & Exporters */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 flex items-center gap-1.5 font-medium transition-colors"
              title="Copy ticket summary to clipboard"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{copiedSummary ? 'Copied Summary' : 'Share / Copy'}</span>
            </button>

            <button
              onClick={() => downloadTicketPdf(ticket)}
              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 px-3 py-1.5 rounded border border-indigo-500/40 flex items-center gap-1.5 font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => downloadTicketMarkdown(ticket)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded border border-slate-700 font-mono transition-colors"
              title="Export as Markdown"
            >
              MD
            </button>
            <button
              onClick={() => downloadTicketJson(ticket)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded border border-slate-700 font-mono transition-colors"
              title="Export as JSON"
            >
              JSON
            </button>
          </div>
        </div>

        {/* Scrollable Document Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Main Title & Executive Information */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <h1 className="text-xl font-bold text-white leading-tight">{ticket.title}</h1>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Opened {new Date(ticket.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Classification & Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/90 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Cluster</span>
                <span className="text-slate-200 font-bold">{ticket.cluster_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Namespace</span>
                <span className="text-slate-200 font-semibold">{ticket.namespace}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Target Resource</span>
                <span className="text-indigo-300 font-semibold truncate block">{ticket.resource}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Priority</span>
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 font-bold focus:outline-none"
                >
                  <option value="P0">P0 - Blocker</option>
                  <option value="P1">P1 - High</option>
                  <option value="P2">P2 - Medium</option>
                  <option value="P3">P3 - Low</option>
                </select>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Assignee</span>
                <input
                  type="text"
                  value={ticket.assignee}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 w-full focus:outline-none truncate"
                />
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Failure Type</span>
                <span className="text-amber-400 font-semibold">{ticket.category || 'Workload Fault'}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Failure Summary & Impact Analysis */}
          <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">1</span>
              <span>Executive Problem Description & Business Impact</span>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800/80 text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                {ticket.description}
              </div>

              {ticket.impact && (
                <div className="flex items-start gap-2.5 bg-rose-950/20 border border-rose-500/30 p-3.5 rounded-lg text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-300 block mb-0.5">Service & Infrastructure Blast Radius</span>
                    <span className="text-slate-300 font-sans">{ticket.impact}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Root Cause Analysis (RCA) */}
          {(ticket.root_cause || ticket.evidence) && (
            <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Root Cause Analysis (RCA) & Forensic Evidence</span>
              </h3>

              {ticket.root_cause && (
                <div className="bg-indigo-950/20 border border-indigo-500/30 p-4 rounded-lg text-xs space-y-1.5">
                  <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px] block">
                    Identified Root Cause:
                  </span>
                  <p className="text-slate-200 font-mono leading-relaxed bg-slate-950 p-3 rounded border border-slate-800">
                    {ticket.root_cause}
                  </p>
                </div>
              )}

              {ticket.evidence && ticket.evidence.length > 0 && (
                <div>
                  <span className="text-slate-400 text-xs font-semibold block mb-2 font-mono">
                    Captured Telemetry & Log Signatures:
                  </span>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 max-h-40 overflow-y-auto font-mono text-xs text-rose-300/90">
                    {ticket.evidence.map((ev, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-slate-600 select-none">&gt;</span>
                        <span className="break-all">{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Actionable SRE Remediation Checklist & Runbook */}
          <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>SRE Remediation Tasks & Runbook</span>
              </h3>

              {totalTasksCount > 0 && (
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-slate-400">{completedTasksCount}/{totalTasksCount} completed</span>
                  <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${taskProgress}%` }}
                    />
                  </div>
                  <span className="text-emerald-400 font-bold">{taskProgress}%</span>
                </div>
              )}
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
              {ticket.tasks && ticket.tasks.length > 0 ? (
                ticket.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id, task.completed)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      task.completed
                        ? 'bg-emerald-950/15 border-emerald-500/30 text-slate-400 line-through'
                        : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => {}} // Handled by parent div
                      className="mt-0.5 w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-sans font-medium flex-1">{task.text}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic p-3 bg-slate-900 rounded border border-slate-800">
                  No task checklist items yet. Add one below to guide engineers.
                </div>
              )}

              {/* Add task input */}
              {isAddingTask ? (
                <form onSubmit={handleAddTask} className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="e.g. Inspect container exit code in pod logs..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs"
                  >
                    Add Task
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingTask(false);
                      setNewTaskText('');
                    }}
                    className="text-slate-400 hover:text-slate-200 text-xs px-2"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingTask(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 pt-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Checklist Task</span>
                </button>
              )}
            </div>

            {/* Suggested Command */}
            {ticket.suggested_command && (
              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Runbook Execution Command:</span>
                  </span>
                  <button
                    onClick={handleCopyCommand}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? 'Copied!' : 'Copy Command'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
                  {ticket.suggested_command}
                </pre>
              </div>
            )}

            {/* Suggested YAML Patch */}
            {ticket.suggested_yaml_patch && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Suggested YAML Manifest Patch:</span>
                  </span>
                  <button
                    onClick={handleCopyYaml}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800"
                  >
                    {copiedYaml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedYaml ? 'Copied!' : 'Copy YAML'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-indigo-200 overflow-x-auto">
                  {ticket.suggested_yaml_patch}
                </pre>
              </div>
            )}
          </div>

          {/* Section 4: Discussion, Work Notes & Collaboration */}
          <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">4</span>
              <span>SRE Work Notes & Discussion ({ticket.comments?.length || 0})</span>
            </h3>

            {/* Comments Stream */}
            <div className="space-y-3">
              {ticket.comments && ticket.comments.length > 0 ? (
                ticket.comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                          {comment.author.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-200">{comment.author}</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans pl-7 leading-relaxed whitespace-pre-line">
                      {comment.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic p-3 bg-slate-900 rounded border border-slate-800">
                  No work notes logged on this ticket yet.
                </div>
              )}
            </div>

            {/* Add Comment Box */}
            <form onSubmit={handleAddComment} className="pt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Author:</span>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add an SRE investigation note, RCA finding, or status update..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="absolute bottom-3 right-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Send className="w-3 h-3" />
                  <span>Post Note</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 5: Document Audit & Activity Timeline */}
          {ticket.timeline && ticket.timeline.length > 0 && (
            <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-700/40 text-slate-300 flex items-center justify-center text-[10px] font-bold">5</span>
                <span>Document Audit History & Timeline</span>
              </h3>

              <div className="space-y-3 font-mono text-xs">
                {ticket.timeline.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{item.title}</span>
                        <span className="text-slate-500 text-[10px]">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>SkyOps SRE System Work Order &bull; Document Verified</span>
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="text-slate-400">Current Status: <strong className="text-slate-200">{ticket.status}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            {ticket.status !== 'CLOSED' && (
              <button
                onClick={handleCloseTicketAndExit}
                disabled={statusUpdating}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 font-semibold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                title="Mark ticket as CLOSED and dismiss window"
              >
                <Archive className="w-3.5 h-3.5 text-rose-400" />
                <span>Mark Closed & Exit</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-1.5 rounded transition-colors flex items-center gap-1.5 border border-slate-700 hover:border-slate-600"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Window (Esc)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
