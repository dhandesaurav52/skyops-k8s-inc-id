import {
  User,
  Organization,
  Membership,
  Session,
  License,
  Cluster,
  Incident,
  Ticket,
  AuditLog,
  K8sEvent,
  NodeHealth,
  WorkloadHealth,
  Role,
} from './types';

export interface DatabaseRepository {
  // Lifecycle & Health
  init(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; type: 'postgres' | 'memory'; details?: string }>;

  // Organizations
  createOrganization(name: string, slug: string): Promise<Organization>;
  getOrganizationById(id: string): Promise<Organization | null>;
  getOrganizationBySlug(slug: string): Promise<Organization | null>;
  listOrganizations(): Promise<Organization[]>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null>;

  // Users & Memberships
  createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  listUsersByOrg(orgId: string): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User | null>;
  deleteUser(id: string): Promise<boolean>;

  // Sessions
  createSession(session: Omit<Session, 'id' | 'created_at'>): Promise<Session>;
  getSessionByTokenHash(tokenHash: string): Promise<Session | null>;
  deleteSession(tokenHash: string): Promise<boolean>;

  // Licenses
  getLicenseByOrg(orgId: string): Promise<License | null>;
  saveLicense(license: License): Promise<License>;

  // Clusters
  createCluster(cluster: Omit<Cluster, 'id' | 'created_at' | 'updated_at'>): Promise<Cluster>;
  getClusterById(id: string, orgId?: string): Promise<Cluster | null>;
  getClusterByName(name: string, orgId: string): Promise<Cluster | null>;
  getClusterByTokenHash(tokenHash: string): Promise<Cluster | null>;
  listClustersByOrg(orgId: string): Promise<Cluster[]>;
  updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster | null>;
  deleteCluster(id: string, orgId: string): Promise<boolean>;

  // Incidents
  createIncident(incident: Omit<Incident, 'id' | 'created_at' | 'updated_at'>): Promise<Incident>;
  getIncidentById(id: string, orgId?: string): Promise<Incident | null>;
  listIncidentsByOrg(orgId: string, options?: { clusterId?: string; status?: string; limit?: number }): Promise<Incident[]>;
  updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null>;
  deleteIncident(id: string, orgId: string): Promise<boolean>;

  // Tickets
  createTicket(ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Promise<Ticket>;
  getTicketById(id: string, orgId?: string): Promise<Ticket | null>;
  listTicketsByOrg(orgId: string, options?: { clusterId?: string; status?: string; limit?: number }): Promise<Ticket[]>;
  updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null>;
  deleteTicket(id: string, orgId: string): Promise<boolean>;

  // Audit Logs
  createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog>;
  listAuditLogsByOrg(orgId: string, limit?: number): Promise<AuditLog[]>;

  // K8s Events
  saveK8sEvents(events: Array<Omit<K8sEvent, 'id'>>): Promise<void>;
  listK8sEventsByOrg(orgId: string, limit?: number): Promise<K8sEvent[]>;

  // Nodes & Workloads
  saveNodeHealth(nodes: Array<Omit<NodeHealth, 'id' | 'updated_at'>>): Promise<void>;
  listNodeHealthByOrg(orgId: string): Promise<NodeHealth[]>;

  saveWorkloadHealth(workloads: Array<Omit<WorkloadHealth, 'id' | 'updated_at'>>): Promise<void>;
  listWorkloadHealthByOrg(orgId: string): Promise<WorkloadHealth[]>;

  // Demo / Seed
  seedDemoData(orgId: string): Promise<void>;
  clearDemoData(orgId: string): Promise<void>;
}
