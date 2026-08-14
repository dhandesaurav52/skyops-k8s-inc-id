import {
  Cluster,
  Incident,
  Ticket,
  AuditLog,
  K8sEvent,
  NodeHealth,
  WorkloadHealth,
  User,
  Organization,
  License,
  SystemInfo,
  SetupStatus,
  SetupInitPayload,
} from '../types';

const API_BASE = '/api/v1';

// Setup & Installation API
export async function fetchSetupStatus(): Promise<SetupStatus> {
  const res = await fetch(`${API_BASE}/setup/status`);
  if (!res.ok) throw new Error('Failed to retrieve setup status');
  return res.json();
}

export async function verifyBootstrapPassword(password: string): Promise<{ success: boolean; bootstrapToken: string }> {
  const res = await fetch(`${API_BASE}/setup/verify-bootstrap-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Invalid initial administrator password.');
  }

  return res.json();
}

export async function createPermanentAdmin(payload: {
  bootstrapToken: string;
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  organizationName?: string;
}): Promise<{
  token: string;
  user: User;
  organization: Organization;
  license: License;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/setup/create-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to create administrator account.');
  }

  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function initializeSetup(payload: SetupInitPayload): Promise<{
  token: string;
  user: User;
  organization: Organization;
  license: License;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/setup/initialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to initialize SkyOps control plane');
  }

  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function testDatabaseConnection(databaseUrl: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/setup/test-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ databaseUrl }),
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Network error' }));
  return data;
}

// Token Management
export function getAuthToken(): string | null {
  return localStorage.getItem('skyops_auth_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('skyops_auth_token', token);
  } else {
    localStorage.removeItem('skyops_auth_token');
  }
}

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(input, {
    ...init,
    headers,
  });

  return res;
}

// Authentication API
export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Authentication failed');
  }

  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function getCurrentUser(): Promise<{ user: User; organization: Organization; license: License | null }> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error('Session expired or unauthenticated');
  return res.json();
}

export async function logout(): Promise<void> {
  await authFetch(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
  setAuthToken(null);
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to update password');
  }
}

// Users API (Admin)
export async function fetchUsers(): Promise<User[]> {
  const res = await authFetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(userData: { email: string; name: string; password: string; role: string }): Promise<User> {
  const res = await authFetch(`${API_BASE}/users`, {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to create user');
  }
  return res.json();
}

export async function updateUser(userId: string, updates: { name?: string; role?: string; password?: string }): Promise<User> {
  const res = await authFetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to update user');
  }
  return res.json();
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to delete user');
  }
}

// License API
export async function fetchLicense(): Promise<License> {
  const res = await authFetch(`${API_BASE}/license`);
  if (!res.ok) throw new Error('Failed to fetch license');
  return res.json();
}

export async function activateLicense(license_key: string): Promise<{ message: string; license: License }> {
  const res = await authFetch(`${API_BASE}/license/activate`, {
    method: 'POST',
    body: JSON.stringify({ license_key }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || 'Failed to activate license');
  }
  return res.json();
}

export async function generateDemoLicenseKey(plan = 'ENTERPRISE'): Promise<{ license_key: string; plan: string }> {
  const res = await authFetch(`${API_BASE}/license/generate-demo-key`, {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error('Failed to generate license key');
  return res.json();
}

// System API
export async function fetchSystemInfo(): Promise<SystemInfo> {
  const res = await authFetch(`${API_BASE}/system/info`);
  if (!res.ok) throw new Error('Failed to retrieve system status');
  return res.json();
}

// Clusters API
export async function fetchClusters(): Promise<Cluster[]> {
  const res = await authFetch(`${API_BASE}/clusters`);
  if (!res.ok) throw new Error('Failed to fetch clusters');
  return res.json();
}

export async function registerCluster(name: string, environment: string) {
  const res = await authFetch(`${API_BASE}/clusters/register`, {
    method: 'POST',
    body: JSON.stringify({ name, environment }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to register cluster');
  }
  return res.json();
}

export async function rotateClusterToken(clusterId: string) {
  const res = await authFetch(`${API_BASE}/clusters/${clusterId}/rotate-token`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to rotate token');
  return res.json();
}

export async function deleteCluster(clusterId: string) {
  const res = await authFetch(`${API_BASE}/clusters/${clusterId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete cluster');
  return res.json();
}

// Incidents API
export async function fetchIncidents(): Promise<Incident[]> {
  const res = await authFetch(`${API_BASE}/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function acknowledgeIncident(incidentId: string): Promise<Incident> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/acknowledge`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to acknowledge incident');
  return res.json();
}

export async function resolveIncident(incidentId: string): Promise<Incident> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/resolve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to resolve incident');
  return res.json();
}

export async function closeIncident(incidentId: string): Promise<Incident> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/close`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to close incident');
  return res.json();
}

export async function generateAiDiagnosis(incidentId: string) {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/ai-diagnose`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to generate AI diagnosis');
  return res.json();
}

export async function convertIncidentToTicket(incidentId: string, assignee: string): Promise<Ticket> {
  const res = await authFetch(`${API_BASE}/incidents/${incidentId}/ticket`, {
    method: 'POST',
    body: JSON.stringify({ assignee }),
  });
  if (!res.ok) throw new Error('Failed to convert incident to ticket');
  return res.json();
}

// Tickets API
export async function fetchTickets(): Promise<Ticket[]> {
  const res = await authFetch(`${API_BASE}/tickets`);
  if (!res.ok) throw new Error('Failed to fetch tickets');
  return res.json();
}

export async function fetchTicketById(ticketId: string): Promise<Ticket> {
  const res = await authFetch(`${API_BASE}/tickets/${ticketId}`);
  if (!res.ok) throw new Error('Failed to fetch ticket');
  return res.json();
}

export async function createTicket(ticketData: Partial<Ticket>): Promise<Ticket> {
  const res = await authFetch(`${API_BASE}/tickets`, {
    method: 'POST',
    body: JSON.stringify(ticketData),
  });
  if (!res.ok) throw new Error('Failed to create ticket');
  return res.json();
}

export async function updateTicket(ticketId: string, updates: Partial<Ticket>): Promise<Ticket> {
  const res = await authFetch(`${API_BASE}/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update ticket');
  return res.json();
}

export async function updateTicketStatus(ticketId: string, status: string, assignee?: string): Promise<Ticket> {
  return updateTicket(ticketId, { status: status as any, assignee });
}

export async function toggleTicketTask(ticketId: string, taskId: string, completed?: boolean): Promise<Ticket> {
  const res = await authFetch(`${API_BASE}/tickets/${ticketId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error('Failed to toggle task');
  return res.json();
}

export async function addTicketComment(ticketId: string, message: string): Promise<Ticket> {
  const res = await authFetch(`${API_BASE}/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Failed to add comment');
  return res.json();
}

// Telemetry & Logs API
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await authFetch(`${API_BASE}/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function fetchEvents(): Promise<K8sEvent[]> {
  const res = await authFetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function fetchNodes(): Promise<NodeHealth[]> {
  const res = await authFetch(`${API_BASE}/nodes`);
  if (!res.ok) throw new Error('Failed to fetch nodes');
  return res.json();
}

export async function fetchWorkloads(): Promise<WorkloadHealth[]> {
  const res = await authFetch(`${API_BASE}/workloads`);
  if (!res.ok) throw new Error('Failed to fetch workloads');
  return res.json();
}

// Sandbox & Simulation
export async function toggleDemoMode(enabled: boolean) {
  const res = await authFetch(`${API_BASE}/demo-mode`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle demo mode');
  return res.json();
}

export async function fetchDemoModeStatus(): Promise<{ demoMode: boolean }> {
  const res = await authFetch(`${API_BASE}/demo-mode`);
  if (!res.ok) return { demoMode: false };
  return res.json();
}

export async function simulateIncident(): Promise<Incident> {
  const res = await authFetch(`${API_BASE}/simulate-incident`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to inject anomaly signal');
  return res.json();
}
