import crypto from 'crypto';
import { DatabaseRepository } from './repository';
import {
  User,
  Organization,
  Session,
  License,
  Cluster,
  Incident,
  Ticket,
  AuditLog,
  K8sEvent,
  NodeHealth,
  WorkloadHealth,
} from './types';

export class MemoryRepository implements DatabaseRepository {
  private organizations: Map<string, Organization> = new Map();
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private licenses: Map<string, License> = new Map();
  private clusters: Map<string, Cluster> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private tickets: Map<string, Ticket> = new Map();
  private auditLogs: AuditLog[] = [];
  private k8sEvents: K8sEvent[] = [];
  private nodeHealth: Map<string, NodeHealth> = new Map();
  private workloadHealth: Map<string, WorkloadHealth> = new Map();

  async init(): Promise<void> {
    // Initialized in-memory store
  }

  async healthCheck(): Promise<{ healthy: boolean; type: 'postgres' | 'memory'; details?: string }> {
    return {
      healthy: true,
      type: 'memory',
      details: `In-memory repository active (Orgs: ${this.organizations.size}, Users: ${this.users.size}, Clusters: ${this.clusters.size})`,
    };
  }

  // Organizations
  async createOrganization(name: string, slug: string): Promise<Organization> {
    const id = `org-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const org: Organization = { id, name, slug, created_at: now, updated_at: now };
    this.organizations.set(id, org);
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    for (const org of this.organizations.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  async listOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
    const org = this.organizations.get(id);
    if (!org) return null;
    const updated = { ...org, ...updates, updated_at: new Date().toISOString() };
    this.organizations.set(id, updated);
    return updated;
  }

  // Users
  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const newUser: User = {
      id,
      ...user,
      email: user.email.toLowerCase().trim(),
      created_at: now,
      updated_at: now,
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const clean = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === clean) return u;
    }
    return null;
  }

  async listUsersByOrg(orgId: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter((u) => u.organization_id === orgId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = {
      ...user,
      ...updates,
      email: updates.email ? updates.email.toLowerCase().trim() : user.email,
      updated_at: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Sessions
  async createSession(session: Omit<Session, 'id' | 'created_at'>): Promise<Session> {
    const id = `ses-${crypto.randomUUID().slice(0, 12)}`;
    const newSession: Session = {
      id,
      ...session,
      created_at: new Date().toISOString(),
    };
    this.sessions.set(session.token_hash, newSession);
    return newSession;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.sessions.delete(tokenHash);
      return null;
    }
    return session;
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    return this.sessions.delete(tokenHash);
  }

  // Licenses
  async getLicenseByOrg(orgId: string): Promise<License | null> {
    for (const lic of this.licenses.values()) {
      if (lic.organization_id === orgId) return lic;
    }
    return null;
  }

  async saveLicense(license: License): Promise<License> {
    this.licenses.set(license.id, license);
    return license;
  }

  // Clusters
  async createCluster(cluster: Omit<Cluster, 'id' | 'created_at' | 'updated_at'>): Promise<Cluster> {
    const id = `cls-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const newCluster: Cluster = {
      id,
      ...cluster,
      created_at: now,
      updated_at: now,
    };
    this.clusters.set(id, newCluster);
    return newCluster;
  }

  async getClusterById(id: string, orgId?: string): Promise<Cluster | null> {
    const cluster = this.clusters.get(id);
    if (!cluster) return null;
    if (orgId && cluster.organization_id !== orgId) return null;
    return cluster;
  }

  async getClusterByName(name: string, orgId: string): Promise<Cluster | null> {
    for (const c of this.clusters.values()) {
      if (c.organization_id === orgId && c.name === name) return c;
    }
    return null;
  }

  async getClusterByTokenHash(tokenHash: string): Promise<Cluster | null> {
    for (const c of this.clusters.values()) {
      if (c.cluster_token_hash === tokenHash || c.registration_token_hash === tokenHash) return c;
    }
    return null;
  }

  async listClustersByOrg(orgId: string): Promise<Cluster[]> {
    return Array.from(this.clusters.values())
      .filter((c) => c.organization_id === orgId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster | null> {
    const cluster = this.clusters.get(id);
    if (!cluster) return null;
    const updated = { ...cluster, ...updates, updated_at: new Date().toISOString() };
    this.clusters.set(id, updated);
    return updated;
  }

  async deleteCluster(id: string, orgId: string): Promise<boolean> {
    const cluster = this.clusters.get(id);
    if (!cluster || cluster.organization_id !== orgId) return false;
    return this.clusters.delete(id);
  }

  // Incidents
  async createIncident(incident: Omit<Incident, 'id' | 'created_at' | 'updated_at'>): Promise<Incident> {
    const id = `INC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const newInc: Incident = {
      id,
      ...incident,
      created_at: now,
      updated_at: now,
    };
    this.incidents.set(id, newInc);
    return newInc;
  }

  async getIncidentById(id: string, orgId?: string): Promise<Incident | null> {
    const inc = this.incidents.get(id);
    if (!inc) return null;
    if (orgId && inc.organization_id !== orgId) return null;
    return inc;
  }

  async listIncidentsByOrg(
    orgId: string,
    options?: { clusterId?: string; status?: string; limit?: number }
  ): Promise<Incident[]> {
    let list = Array.from(this.incidents.values()).filter((i) => i.organization_id === orgId);
    if (options?.clusterId) {
      list = list.filter((i) => i.cluster_id === options.clusterId);
    }
    if (options?.status) {
      list = list.filter((i) => i.status === options.status);
    }
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null> {
    const inc = this.incidents.get(id);
    if (!inc) return null;
    const updated = { ...inc, ...updates, updated_at: new Date().toISOString() };
    this.incidents.set(id, updated);
    return updated;
  }

  async deleteIncident(id: string, orgId: string): Promise<boolean> {
    const inc = this.incidents.get(id);
    if (!inc || inc.organization_id !== orgId) return false;
    return this.incidents.delete(id);
  }

  // Tickets
  async createTicket(ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Promise<Ticket> {
    const orgTickets = Array.from(this.tickets.values()).filter(
      (t) => t.organization_id === ticket.organization_id
    );
    const id = `SKY-${1001 + orgTickets.length}`;
    const now = new Date().toISOString();
    const newTicket: Ticket = {
      id,
      ...ticket,
      created_at: now,
      updated_at: now,
    };
    this.tickets.set(id, newTicket);
    return newTicket;
  }

  async getTicketById(id: string, orgId?: string): Promise<Ticket | null> {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;
    if (orgId && ticket.organization_id !== orgId) return null;
    return ticket;
  }

  async listTicketsByOrg(
    orgId: string,
    options?: { clusterId?: string; status?: string; limit?: number }
  ): Promise<Ticket[]> {
    let list = Array.from(this.tickets.values()).filter((t) => t.organization_id === orgId);
    if (options?.clusterId) {
      list = list.filter((t) => t.cluster_id === options.clusterId);
    }
    if (options?.status) {
      list = list.filter((t) => t.status === options.status);
    }
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list;
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;
    const updated = { ...ticket, ...updates, updated_at: new Date().toISOString() };
    this.tickets.set(id, updated);
    return updated;
  }

  async deleteTicket(id: string, orgId: string): Promise<boolean> {
    const ticket = this.tickets.get(id);
    if (!ticket || ticket.organization_id !== orgId) return false;
    return this.tickets.delete(id);
  }

  // Audit Logs
  async createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const id = `aud-${crypto.randomUUID().slice(0, 10)}`;
    const newLog: AuditLog = {
      id,
      ...log,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(newLog);
    if (this.auditLogs.length > 5000) {
      this.auditLogs = this.auditLogs.slice(0, 5000);
    }
    return newLog;
  }

  async listAuditLogsByOrg(orgId: string, limit = 200): Promise<AuditLog[]> {
    return this.auditLogs
      .filter((l) => l.organization_id === orgId)
      .slice(0, limit);
  }

  // K8s Events
  async saveK8sEvents(events: Array<Omit<K8sEvent, 'id'>>): Promise<void> {
    for (const ev of events) {
      const id = `evt-${crypto.randomUUID().slice(0, 10)}`;
      this.k8sEvents.unshift({ id, ...ev });
    }
    if (this.k8sEvents.length > 1000) {
      this.k8sEvents = this.k8sEvents.slice(0, 1000);
    }
  }

  async listK8sEventsByOrg(orgId: string, limit = 100): Promise<K8sEvent[]> {
    return this.k8sEvents
      .filter((e) => e.organization_id === orgId)
      .slice(0, limit);
  }

  // Node Health
  async saveNodeHealth(nodes: Array<Omit<NodeHealth, 'id' | 'updated_at'>>): Promise<void> {
    const now = new Date().toISOString();
    for (const n of nodes) {
      const key = `${n.organization_id}:${n.cluster_name}:${n.name}`;
      const existing = this.nodeHealth.get(key);
      const id = existing ? existing.id : `nod-${crypto.randomUUID().slice(0, 8)}`;
      this.nodeHealth.set(key, { id, ...n, updated_at: now });
    }
  }

  async listNodeHealthByOrg(orgId: string): Promise<NodeHealth[]> {
    return Array.from(this.nodeHealth.values())
      .filter((n) => n.organization_id === orgId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Workload Health
  async saveWorkloadHealth(workloads: Array<Omit<WorkloadHealth, 'id' | 'updated_at'>>): Promise<void> {
    const now = new Date().toISOString();
    for (const w of workloads) {
      const key = `${w.organization_id}:${w.cluster_name}:${w.namespace}:${w.name}`;
      const existing = this.workloadHealth.get(key);
      const id = existing ? existing.id : `wkl-${crypto.randomUUID().slice(0, 8)}`;
      this.workloadHealth.set(key, { id, ...w, updated_at: now });
    }
  }

  async listWorkloadHealthByOrg(orgId: string): Promise<WorkloadHealth[]> {
    return Array.from(this.workloadHealth.values())
      .filter((w) => w.organization_id === orgId)
      .sort((a, b) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`));
  }

  async seedDemoData(orgId: string): Promise<void> {
    // Populated dynamically via provider
  }

  async clearDemoData(orgId: string): Promise<void> {
    for (const [id, inc] of this.incidents.entries()) {
      if (inc.organization_id === orgId && inc.is_demo) this.incidents.delete(id);
    }
    for (const [id, tick] of this.tickets.entries()) {
      if (tick.organization_id === orgId && tick.is_demo) this.tickets.delete(id);
    }
    for (const [id, cls] of this.clusters.entries()) {
      if (cls.organization_id === orgId && cls.is_demo) this.clusters.delete(id);
    }
  }
}
