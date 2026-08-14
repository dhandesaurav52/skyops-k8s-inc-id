import React, { useState } from 'react';
import {
  Ticket as TicketIcon,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  FileText,
  AlertTriangle,
  Clock,
  ArrowRight,
  ListTodo,
  ShieldCheck,
  Check,
  Tag,
  X,
} from 'lucide-react';
import { Ticket, TicketStatus, Severity } from '../types';
import { updateTicketStatus, createTicket } from '../services/api';

interface TicketsPageProps {
  tickets: Ticket[];
  onRefresh: () => void;
  onSelectTicket: (ticket: Ticket) => void;
}

export const TicketsPage: React.FC<TicketsPageProps> = ({
  tickets,
  onRefresh,
  onSelectTicket,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // New ticket modal state
  const [isCreatingTicket, setIsCreatingTicket] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P1');
  const [newSeverity, setNewSeverity] = useState<Severity>('HIGH');
  const [newCluster, setNewCluster] = useState('demo-production-us-east');
  const [newNamespace, setNewNamespace] = useState('default');
  const [newResource, setNewResource] = useState('Deployment/service');
  const [newAssignee, setNewAssignee] = useState('sre-lead@skyops.io');
  const [creatingSubmitting, setCreatingSubmitting] = useState(false);

  const handleStatusChange = async (e: React.MouseEvent, ticketId: string, newStatus: string) => {
    e.stopPropagation();
    setUpdatingId(ticketId);
    try {
      await updateTicketStatus(ticketId, newStatus);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreatingSubmitting(true);
    try {
      const created = await createTicket({
        title: newTitle.trim(),
        description: newDescription.trim() || 'SRE issue tracked for investigation and remediation.',
        priority: newPriority,
        severity: newSeverity,
        cluster_name: newCluster,
        namespace: newNamespace,
        resource: newResource,
        assignee: newAssignee,
      });

      setIsCreatingTicket(false);
      setNewTitle('');
      setNewDescription('');
      onRefresh();
      onSelectTicket(created);
    } catch (err) {
      console.error('Failed to create ticket', err);
    } finally {
      setCreatingSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? t.status !== 'RESOLVED' && t.status !== 'CLOSED'
        : t.status === statusFilter;

    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

    const matchesSearch =
      searchQuery.trim() === '' ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.cluster_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesPriority && matchesSearch;
  });

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'P0':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'P1':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'P2':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
    }
  };

  const getStatusClass = (status: TicketStatus) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'IN_PROGRESS':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'BLOCKED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 text-slate-200 font-sans max-w-[1600px] mx-auto select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#182232] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
            <TicketIcon className="w-4 h-4 text-indigo-400" />
            <span className="tracking-wider uppercase">SRE Ticket Documents & Remediation</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Structured SRE runbooks, root-cause analyses, checklist tasks, and forensic reports. Click any ticket to open the full document.
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-mono">
          <button
            onClick={() => setIsCreatingTicket(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New SRE Ticket</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0c111a] p-3 rounded-md border border-[#182232] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Tickets' },
            { id: 'ACTIVE', label: 'Active Unresolved' },
            { id: 'OPEN', label: 'Open' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'BLOCKED', label: 'Blocked' },
            { id: 'RESOLVED', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded font-mono font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121824]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority & Search & View Toggle */}
        <div className="flex items-center gap-3">
          {/* Priority filter */}
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-slate-500 text-[11px]">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#090d14] border border-[#182232] rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative w-44 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full bg-[#090d14] border border-[#182232] rounded pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#090d14] border border-[#182232] rounded p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded ${
                viewMode === 'table' ? 'bg-[#182232] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1 rounded ${
                viewMode === 'cards' ? 'bg-[#182232] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Card Document View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredTickets.length === 0 ? (
        <div className="bg-[#0c111a] border border-[#182232] rounded-md p-12 text-center space-y-3 font-mono">
          <TicketIcon className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Tickets Match Criteria</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {tickets.length === 0
              ? 'No SRE tickets currently exist. Convert an incident or click "+ New SRE Ticket" above.'
              : 'Try clearing search filters or changing the active status tab.'}
          </p>
          {tickets.length === 0 && (
            <button
              onClick={() => setIsCreatingTicket(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded text-xs inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create First SRE Ticket</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table Document View */
        <div className="bg-[#0c111a] rounded-md border border-[#182232] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090d14] text-slate-400 font-mono text-[11px] uppercase border-b border-[#182232]">
                <tr>
                  <th className="px-6 py-3">Ticket ID</th>
                  <th className="px-6 py-3">Priority</th>
                  <th className="px-6 py-3">Document Title & Summary</th>
                  <th className="px-6 py-3">Cluster / Resource</th>
                  <th className="px-6 py-3.5">Tasks</th>
                  <th className="px-6 py-3.5">Assignee</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredTickets.map((t) => {
                  const completedTasks = t.tasks ? t.tasks.filter((tsk) => tsk.completed).length : 0;
                  const totalTasks = t.tasks ? t.tasks.length : 0;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTicket(t)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-3.5 font-mono font-bold text-indigo-300">
                        <div className="flex items-center gap-1.5">
                          <span>{t.id}</span>
                          {t.incident_id && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-normal">
                              {t.incident_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityClass(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 max-w-md">
                        <div className="font-semibold text-slate-200 group-hover:text-indigo-200 transition-colors">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
                          {t.description}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-400">
                        <div className="text-slate-300 font-semibold">{t.cluster_name}</div>
                        <div className="text-slate-500 text-[10px]">{t.namespace} / {t.resource}</div>
                      </td>
                      <td className="px-6 py-3.5 font-mono">
                        {totalTasks > 0 ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{completedTasks}/{totalTasks}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-300 font-mono">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[120px]">{t.assignee}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(e as any, t.id, e.target.value)}
                          disabled={updatingId === t.id}
                          className={`border rounded px-2 py-1 text-xs font-bold focus:outline-none ${getStatusClass(t.status)}`}
                        >
                          <option value="OPEN" className="bg-slate-900 text-amber-300">OPEN</option>
                          <option value="IN_PROGRESS" className="bg-slate-900 text-indigo-300">IN_PROGRESS</option>
                          <option value="BLOCKED" className="bg-slate-900 text-rose-300">BLOCKED</option>
                          <option value="RESOLVED" className="bg-slate-900 text-emerald-300">RESOLVED</option>
                          <option value="CLOSED" className="bg-slate-900 text-slate-300">CLOSED</option>
                        </select>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTicket(t);
                          }}
                          className="bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ml-auto transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Open Document</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card / Grid Document View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTickets.map((t) => {
            const completedTasks = t.tasks ? t.tasks.filter((tsk) => tsk.completed).length : 0;
            const totalTasks = t.tasks ? t.tasks.length : 0;

            return (
              <div
                key={t.id}
                onClick={() => onSelectTicket(t)}
                className="bg-slate-900 hover:bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 cursor-pointer transition-all shadow-sm flex flex-col justify-between group space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-indigo-300">{t.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getPriorityClass(t.priority)}`}>
                        {t.priority}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getStatusClass(t.status)}`}>
                      {t.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors line-clamp-2 leading-snug">
                      {t.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 font-sans">
                      {t.description}
                    </p>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-[11px] font-mono space-y-1 text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Target:</span>
                      <span className="text-slate-300 font-semibold truncate max-w-[170px]">{t.cluster_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Resource:</span>
                      <span className="text-indigo-300 truncate max-w-[170px]">{t.namespace} / {t.resource}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    {totalTasks > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{completedTasks}/{totalTasks} tasks</span>
                      </span>
                    )}
                    {t.comments && t.comments.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <MessageSquare className="w-3 h-3" />
                        <span>{t.comments.length}</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTicket(t);
                    }}
                    className="text-xs text-indigo-400 group-hover:text-indigo-300 font-bold flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual SRE Ticket Creation Modal */}
      {isCreatingTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg text-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <TicketIcon className="w-4 h-4 text-indigo-400" />
                <span>Create New SRE Ticket Document</span>
              </h3>
              <button onClick={() => setIsCreatingTicket(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicketSubmit} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ticket Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Memory pressure & replica scaling on auth-service"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Issue Description & Failure Context</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide failure context, error exit codes, or maintenance requirements..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none"
                  >
                    <option value="P0">P0 - Blocker (Active Outage)</option>
                    <option value="P1">P1 - High Priority</option>
                    <option value="P2">P2 - Medium Priority</option>
                    <option value="P3">P3 - Low Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cluster</label>
                  <input
                    type="text"
                    value={newCluster}
                    onChange={(e) => setNewCluster(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Namespace</label>
                  <input
                    type="text"
                    value={newNamespace}
                    onChange={(e) => setNewNamespace(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Resource</label>
                  <input
                    type="text"
                    value={newResource}
                    onChange={(e) => setNewResource(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Assignee</label>
                  <input
                    type="text"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingTicket(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSubmitting || !newTitle.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingSubmitting ? 'Creating...' : 'Create Ticket Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
