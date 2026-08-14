import { Pool } from 'pg';
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
import fs from 'fs';
import path from 'path';

export class PostgresRepository implements DatabaseRepository {
  private pool: Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/skyops',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(sql);
      }
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; type: 'postgres' | 'memory'; details?: string }> {
    try {
      const res = await this.pool.query('SELECT NOW() as now');
      return { healthy: true, type: 'postgres', details: `PostgreSQL connection active (${res.rows[0].now})` };
    } catch (err: any) {
      return { healthy: false, type: 'postgres', details: err.message };
    }
  }

  // Organizations
  async createOrganization(name: string, slug: string): Promise<Organization> {
    const id = `org-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO organizations (id, name, slug, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING *
    `;
    const res = await this.pool.query(query, [id, name, slug, now]);
    return res.rows[0];
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const res = await this.pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const res = await this.pool.query('SELECT * FROM organizations WHERE slug = $1', [slug]);
    return res.rows[0] || null;
  }

  async listOrganizations(): Promise<Organization[]> {
    const res = await this.pool.query('SELECT * FROM organizations ORDER BY created_at ASC');
    return res.rows;
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.slug !== undefined) {
      fields.push(`slug = $${idx++}`);
      values.push(updates.slug);
    }

    if (fields.length === 0) return this.getOrganizationById(id);

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const query = `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  // Users
  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO users (id, email, name, password_hash, role, organization_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      id,
      user.email.toLowerCase().trim(),
      user.name,
      user.password_hash,
      user.role,
      user.organization_id,
      now,
    ]);
    return res.rows[0];
  }

  async getUserById(id: string): Promise<User | null> {
    const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const res = await this.pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
    return res.rows[0] || null;
  }

  async listUsersByOrg(orgId: string): Promise<User[]> {
    const res = await this.pool.query('SELECT * FROM users WHERE organization_id = $1 ORDER BY created_at ASC', [orgId]);
    return res.rows;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(updates.email.toLowerCase().trim());
    }
    if (updates.password_hash !== undefined) {
      fields.push(`password_hash = $${idx++}`);
      values.push(updates.password_hash);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(updates.role);
    }

    if (fields.length === 0) return this.getUserById(id);

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // Sessions
  async createSession(session: Omit<Session, 'id' | 'created_at'>): Promise<Session> {
    const id = `ses-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      id,
      session.user_id,
      session.token_hash,
      session.ip_address || null,
      session.user_agent || null,
      session.expires_at,
      now,
    ]);
    return res.rows[0];
  }

  async getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    const res = await this.pool.query(
      'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    return (res.rowCount ?? 0) > 0;
  }

  // Licenses
  async getLicenseByOrg(orgId: string): Promise<License | null> {
    const res = await this.pool.query(
      'SELECT * FROM licenses WHERE organization_id = $1 ORDER BY issued_at DESC LIMIT 1',
      [orgId]
    );
    return res.rows[0] || null;
  }

  async saveLicense(license: License): Promise<License> {
    const query = `
      INSERT INTO licenses (id, organization_id, plan, max_clusters, max_users, features, issued_at, expires_at, signature, is_valid)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        plan = EXCLUDED.plan,
        max_clusters = EXCLUDED.max_clusters,
        max_users = EXCLUDED.max_users,
        features = EXCLUDED.features,
        expires_at = EXCLUDED.expires_at,
        signature = EXCLUDED.signature,
        is_valid = EXCLUDED.is_valid
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      license.id,
      license.organization_id,
      license.plan,
      license.max_clusters,
      license.max_users,
      JSON.stringify(license.features),
      license.issued_at,
      license.expires_at,
      license.signature,
      license.is_valid,
    ]);
    return res.rows[0];
  }

  // Clusters
  async createCluster(cluster: Omit<Cluster, 'id' | 'created_at' | 'updated_at'>): Promise<Cluster> {
    const id = `cls-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO clusters (
        id, organization_id, name, environment, status, agent_version, k8s_version,
        registration_token_hash, cluster_token_hash, node_count, pod_count,
        namespace_count, active_incidents, cpu_usage_cores, memory_usage_bytes,
        last_heartbeat, created_at, updated_at, is_demo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, $18)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      id,
      cluster.organization_id,
      cluster.name,
      cluster.environment || 'production',
      cluster.status || 'UNKNOWN',
      cluster.agent_version || 'v1.0.0',
      cluster.k8s_version || 'v1.30.0',
      cluster.registration_token_hash || null,
      cluster.cluster_token_hash || null,
      cluster.node_count || 0,
      cluster.pod_count || 0,
      cluster.namespace_count || 0,
      cluster.active_incidents || 0,
      cluster.cpu_usage_cores || 0,
      cluster.memory_usage_bytes || 0,
      cluster.last_heartbeat || now,
      now,
      cluster.is_demo || false,
    ]);
    return res.rows[0];
  }

  async getClusterById(id: string, orgId?: string): Promise<Cluster | null> {
    const query = orgId
      ? 'SELECT * FROM clusters WHERE id = $1 AND organization_id = $2'
      : 'SELECT * FROM clusters WHERE id = $1';
    const params = orgId ? [id, orgId] : [id];
    const res = await this.pool.query(query, params);
    return res.rows[0] || null;
  }

  async getClusterByName(name: string, orgId: string): Promise<Cluster | null> {
    const res = await this.pool.query(
      'SELECT * FROM clusters WHERE name = $1 AND organization_id = $2',
      [name, orgId]
    );
    return res.rows[0] || null;
  }

  async getClusterByTokenHash(tokenHash: string): Promise<Cluster | null> {
    const res = await this.pool.query(
      'SELECT * FROM clusters WHERE cluster_token_hash = $1 OR registration_token_hash = $1',
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  async listClustersByOrg(orgId: string): Promise<Cluster[]> {
    const res = await this.pool.query(
      'SELECT * FROM clusters WHERE organization_id = $1 ORDER BY created_at DESC',
      [orgId]
    );
    return res.rows;
  }

  async updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return this.getClusterById(id);

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const query = `UPDATE clusters SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  async deleteCluster(id: string, orgId: string): Promise<boolean> {
    const res = await this.pool.query(
      'DELETE FROM clusters WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  // Incidents
  async createIncident(incident: Omit<Incident, 'id' | 'created_at' | 'updated_at'>): Promise<Incident> {
    const id = `INC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO incidents (
        id, organization_id, cluster_id, cluster_name, title, status, severity,
        category, namespace, resource_type, resource_name, pod_name, container_name,
        occurrences, summary, impact, root_cause, evidence, timeline, suggested_actions,
        suggested_command, suggested_yaml_patch, resolved_by, resolved_at,
        first_detected, last_detected, created_at, updated_at, is_demo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $27, $28)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      id,
      incident.organization_id,
      incident.cluster_id,
      incident.cluster_name,
      incident.title,
      incident.status || 'OPEN',
      incident.severity || 'HIGH',
      incident.category,
      incident.namespace || 'default',
      incident.resource_type || 'Pod',
      incident.resource_name,
      incident.pod_name || null,
      incident.container_name || null,
      incident.occurrences || 1,
      incident.summary,
      incident.impact,
      incident.root_cause,
      JSON.stringify(incident.evidence || []),
      JSON.stringify(incident.timeline || []),
      JSON.stringify(incident.suggested_actions || []),
      incident.suggested_command || null,
      incident.suggested_yaml_patch || null,
      incident.resolved_by || null,
      incident.resolved_at || null,
      incident.first_detected || now,
      incident.last_detected || now,
      now,
      incident.is_demo || false,
    ]);
    return res.rows[0];
  }

  async getIncidentById(id: string, orgId?: string): Promise<Incident | null> {
    const query = orgId
      ? 'SELECT * FROM incidents WHERE id = $1 AND organization_id = $2'
      : 'SELECT * FROM incidents WHERE id = $1';
    const params = orgId ? [id, orgId] : [id];
    const res = await this.pool.query(query, params);
    return res.rows[0] || null;
  }

  async listIncidentsByOrg(
    orgId: string,
    options?: { clusterId?: string; status?: string; limit?: number }
  ): Promise<Incident[]> {
    let query = 'SELECT * FROM incidents WHERE organization_id = $1';
    const params: any[] = [orgId];
    let idx = 2;

    if (options?.clusterId) {
      query += ` AND cluster_id = $${idx++}`;
      params.push(options.clusterId);
    }
    if (options?.status) {
      query += ` AND status = $${idx++}`;
      params.push(options.status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(options?.limit || 200);

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && val !== undefined) {
        if (['evidence', 'timeline', 'suggested_actions'].includes(key)) {
          fields.push(`${key} = $${idx++}`);
          values.push(JSON.stringify(val));
        } else {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        }
      }
    }

    if (fields.length === 0) return this.getIncidentById(id);

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const query = `UPDATE incidents SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  async deleteIncident(id: string, orgId: string): Promise<boolean> {
    const res = await this.pool.query(
      'DELETE FROM incidents WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  // Tickets
  async createTicket(ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Promise<Ticket> {
    const countRes = await this.pool.query('SELECT COUNT(*) FROM tickets WHERE organization_id = $1', [ticket.organization_id]);
    const num = 1001 + parseInt(countRes.rows[0].count, 10);
    const id = `SKY-${num}`;
    const now = new Date().toISOString();

    const query = `
      INSERT INTO tickets (
        id, incident_id, organization_id, title, description, severity, priority,
        assignee, status, cluster_id, cluster_name, namespace, resource,
        category, impact, root_cause, suggested_actions, suggested_command,
        suggested_yaml_patch, evidence, tasks, timeline, comments, tags,
        resolution_notes, resolved_by, resolved_at, created_at, updated_at, is_demo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $28, $29)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      id,
      ticket.incident_id || null,
      ticket.organization_id,
      ticket.title,
      ticket.description,
      ticket.severity || 'HIGH',
      ticket.priority || 'P1',
      ticket.assignee,
      ticket.status || 'OPEN',
      ticket.cluster_id,
      ticket.cluster_name,
      ticket.namespace,
      ticket.resource,
      ticket.category || null,
      ticket.impact || null,
      ticket.root_cause || null,
      JSON.stringify(ticket.suggested_actions || []),
      ticket.suggested_command || null,
      ticket.suggested_yaml_patch || null,
      JSON.stringify(ticket.evidence || []),
      JSON.stringify(ticket.tasks || []),
      JSON.stringify(ticket.timeline || []),
      JSON.stringify(ticket.comments || []),
      JSON.stringify(ticket.tags || []),
      ticket.resolution_notes || null,
      ticket.resolved_by || null,
      ticket.resolved_at || null,
      now,
      ticket.is_demo || false,
    ]);
    return res.rows[0];
  }

  async getTicketById(id: string, orgId?: string): Promise<Ticket | null> {
    const query = orgId
      ? 'SELECT * FROM tickets WHERE id = $1 AND organization_id = $2'
      : 'SELECT * FROM tickets WHERE id = $1';
    const params = orgId ? [id, orgId] : [id];
    const res = await this.pool.query(query, params);
    return res.rows[0] || null;
  }

  async listTicketsByOrg(
    orgId: string,
    options?: { clusterId?: string; status?: string; limit?: number }
  ): Promise<Ticket[]> {
    let query = 'SELECT * FROM tickets WHERE organization_id = $1';
    const params: any[] = [orgId];
    let idx = 2;

    if (options?.clusterId) {
      query += ` AND cluster_id = $${idx++}`;
      params.push(options.clusterId);
    }
    if (options?.status) {
      query += ` AND status = $${idx++}`;
      params.push(options.status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(options?.limit || 200);

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && val !== undefined) {
        if (['tasks', 'timeline', 'comments', 'tags', 'suggested_actions', 'evidence'].includes(key)) {
          fields.push(`${key} = $${idx++}`);
          values.push(JSON.stringify(val));
        } else {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        }
      }
    }

    if (fields.length === 0) return this.getTicketById(id);

    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(id);

    const query = `UPDATE tickets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  async deleteTicket(id: string, orgId: string): Promise<boolean> {
    const res = await this.pool.query(
      'DELETE FROM tickets WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  // Audit Logs
  async createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const id = `aud-${crypto.randomUUID().slice(0, 10)}`;
    const now = new Date().toISOString();
    const query = `
      INSERT INTO audit_logs (id, organization_id, user_id, user_email, action, resource, details, ip_address, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      id,
      log.organization_id,
      log.user_id || null,
      log.user_email,
      log.action,
      log.resource,
      log.details,
      log.ip_address || null,
      now,
    ]);
    return res.rows[0];
  }

  async listAuditLogsByOrg(orgId: string, limit = 200): Promise<AuditLog[]> {
    const res = await this.pool.query(
      'SELECT * FROM audit_logs WHERE organization_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [orgId, limit]
    );
    return res.rows;
  }

  // K8s Events
  async saveK8sEvents(events: Array<Omit<K8sEvent, 'id'>>): Promise<void> {
    if (events.length === 0) return;
    for (const ev of events) {
      const id = `evt-${crypto.randomUUID().slice(0, 10)}`;
      await this.pool.query(
        `INSERT INTO k8s_events (id, organization_id, cluster_id, cluster_name, namespace, resource, kind, type, reason, message, count, first_observed, last_observed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          id,
          ev.organization_id,
          ev.cluster_id || null,
          ev.cluster_name,
          ev.namespace,
          ev.resource,
          ev.kind,
          ev.type,
          ev.reason,
          ev.message,
          ev.count || 1,
          ev.first_observed || new Date().toISOString(),
          ev.last_observed || new Date().toISOString(),
        ]
      );
    }
  }

  async listK8sEventsByOrg(orgId: string, limit = 100): Promise<K8sEvent[]> {
    const res = await this.pool.query(
      'SELECT * FROM k8s_events WHERE organization_id = $1 ORDER BY last_observed DESC LIMIT $2',
      [orgId, limit]
    );
    return res.rows;
  }

  // Node Health
  async saveNodeHealth(nodes: Array<Omit<NodeHealth, 'id' | 'updated_at'>>): Promise<void> {
    const now = new Date().toISOString();
    for (const n of nodes) {
      const id = `nod-${crypto.randomUUID().slice(0, 8)}`;
      await this.pool.query(
        `INSERT INTO node_health (id, organization_id, cluster_id, cluster_name, name, status, k8s_version, cpu_allocatable, mem_allocatable, pod_count, memory_pressure, disk_pressure, pid_pressure, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (organization_id, cluster_name, name) DO UPDATE SET
           status = EXCLUDED.status,
           k8s_version = EXCLUDED.k8s_version,
           cpu_allocatable = EXCLUDED.cpu_allocatable,
           mem_allocatable = EXCLUDED.mem_allocatable,
           pod_count = EXCLUDED.pod_count,
           memory_pressure = EXCLUDED.memory_pressure,
           disk_pressure = EXCLUDED.disk_pressure,
           pid_pressure = EXCLUDED.pid_pressure,
           updated_at = EXCLUDED.updated_at`,
        [
          id,
          n.organization_id,
          n.cluster_id || null,
          n.cluster_name,
          n.name,
          n.status,
          n.k8s_version,
          n.cpu_allocatable,
          n.mem_allocatable,
          n.pod_count,
          n.memory_pressure || false,
          n.disk_pressure || false,
          n.pid_pressure || false,
          now,
        ]
      );
    }
  }

  async listNodeHealthByOrg(orgId: string): Promise<NodeHealth[]> {
    const res = await this.pool.query(
      'SELECT * FROM node_health WHERE organization_id = $1 ORDER BY name ASC',
      [orgId]
    );
    return res.rows;
  }

  // Workload Health
  async saveWorkloadHealth(workloads: Array<Omit<WorkloadHealth, 'id' | 'updated_at'>>): Promise<void> {
    const now = new Date().toISOString();
    for (const w of workloads) {
      const id = `wkl-${crypto.randomUUID().slice(0, 8)}`;
      await this.pool.query(
        `INSERT INTO workload_health (id, organization_id, cluster_id, cluster_name, namespace, name, kind, desired, ready, available, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (organization_id, cluster_name, namespace, name) DO UPDATE SET
           desired = EXCLUDED.desired,
           ready = EXCLUDED.ready,
           available = EXCLUDED.available,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at`,
        [
          id,
          w.organization_id,
          w.cluster_id || null,
          w.cluster_name,
          w.namespace,
          w.name,
          w.kind,
          w.desired,
          w.ready,
          w.available,
          w.status,
          now,
        ]
      );
    }
  }

  async listWorkloadHealthByOrg(orgId: string): Promise<WorkloadHealth[]> {
    const res = await this.pool.query(
      'SELECT * FROM workload_health WHERE organization_id = $1 ORDER BY namespace ASC, name ASC',
      [orgId]
    );
    return res.rows;
  }

  async seedDemoData(orgId: string): Promise<void> {
    // Handled in repository provider or explicit seed call
  }

  async clearDemoData(orgId: string): Promise<void> {
    await this.pool.query('DELETE FROM incidents WHERE organization_id = $1 AND is_demo = true', [orgId]);
    await this.pool.query('DELETE FROM tickets WHERE organization_id = $1 AND is_demo = true', [orgId]);
    await this.pool.query('DELETE FROM clusters WHERE organization_id = $1 AND is_demo = true', [orgId]);
  }
}
