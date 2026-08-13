import { Cluster, Incident, Ticket, AuditLog, K8sEvent, NodeHealth, WorkloadHealth } from '../types';

const API_BASE = '/api/v1';

export async function fetchClusters(): Promise<Cluster[]> {
  const res = await fetch(`${API_BASE}/clusters`);
  if (!res.ok) throw new Error('Failed to fetch clusters');
  return res.json();
}

export async function registerCluster(name: string, environment: string) {
  const res = await fetch(`${API_BASE}/clusters/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, environment }),
  });
  if (!res.ok) throw new Error('Failed to register cluster');
  return res.json();
}

export async function rotateClusterToken(clusterId: string) {
  const res = await fetch(`${API_BASE}/clusters/${clusterId}/rotate-token`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to rotate token');
  return res.json();
}

export async function deleteCluster(clusterId: string) {
  const res = await fetch(`${API_BASE}/clusters/${clusterId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete cluster');
  return res.json();
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_BASE}/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function acknowledgeIncident(incidentId: string, userEmail: string): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email: userEmail }),
  });
  if (!res.ok) throw new Error('Failed to acknowledge incident');
  return res.json();
}

export async function resolveIncident(incidentId: string, userEmail: string): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_email: userEmail }),
  });
  if (!res.ok) throw new Error('Failed to resolve incident');
  return res.json();
}

export async function generateAiDiagnosis(incidentId: string) {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/ai-diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to generate AI diagnosis');
  return res.json();
}

export async function convertIncidentToTicket(incidentId: string, assignee: string): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/incidents/${incidentId}/ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignee }),
  });
  if (!res.ok) throw new Error('Failed to convert incident to ticket');
  return res.json();
}

export async function fetchTickets(): Promise<Ticket[]> {
  const res = await fetch(`${API_BASE}/tickets`);
  if (!res.ok) throw new Error('Failed to fetch tickets');
  return res.json();
}

export async function updateTicketStatus(ticketId: string, status: string, assignee?: string): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, assignee }),
  });
  if (!res.ok) throw new Error('Failed to update ticket');
  return res.json();
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function fetchEvents(): Promise<K8sEvent[]> {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function fetchNodes(): Promise<NodeHealth[]> {
  const res = await fetch(`${API_BASE}/nodes`);
  if (!res.ok) throw new Error('Failed to fetch nodes');
  return res.json();
}

export async function fetchWorkloads(): Promise<WorkloadHealth[]> {
  const res = await fetch(`${API_BASE}/workloads`);
  if (!res.ok) throw new Error('Failed to fetch workloads');
  return res.json();
}

export async function toggleDemoMode(enabled: boolean) {
  const res = await fetch(`${API_BASE}/settings/demo-mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle demo mode');
  return res.json();
}

export async function fetchDemoModeStatus(): Promise<{ demoMode: boolean }> {
  const res = await fetch(`${API_BASE}/settings/demo-mode`);
  if (!res.ok) return { demoMode: false };
  return res.json();
}
