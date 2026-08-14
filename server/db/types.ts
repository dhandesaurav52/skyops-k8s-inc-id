export type Role = 'ADMIN' | 'SRE' | 'DEVELOPER' | 'VIEWER';

export type PlanType = 'COMMUNITY' | 'PRO' | 'ENTERPRISE';

export type DeploymentMode = 'self-hosted' | 'cloud';

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: Role;
  organization_id: string;
  organization_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  organization_id: string;
  user_id: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  created_at: string;
}

export interface License {
  id: string;
  organization_id: string;
  plan: PlanType;
  max_clusters: number;
  max_users: number;
  features: {
    advanced_rca: boolean;
    sso_enabled: boolean;
    audit_retention_days: number;
    custom_runbooks: boolean;
    data_telemetry: boolean;
    unlimited_tickets: boolean;
  };
  issued_at: string;
  expires_at: string;
  signature: string;
  is_valid: boolean;
}

export interface Cluster {
  id: string;
  organization_id: string;
  name: string;
  environment: string;
  status: 'CONNECTED' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
  agent_version: string;
  k8s_version: string;
  registration_token_hash?: string;
  cluster_token_hash?: string;
  node_count: number;
  pod_count: number;
  namespace_count: number;
  active_incidents: number;
  cpu_usage_cores: number;
  memory_usage_bytes: number;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
}

export interface Incident {
  id: string;
  organization_id: string;
  cluster_id: string;
  cluster_name: string;
  title: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  namespace: string;
  resource_type: string;
  resource_name: string;
  pod_name?: string;
  container_name?: string;
  occurrences: number;
  summary: string;
  impact: string;
  root_cause: string;
  evidence: string[];
  timeline: Array<{
    timestamp: string;
    title: string;
    detail: string;
    author?: string;
    type: 'event' | 'status_change' | 'comment' | 'remediation';
  }>;
  suggested_actions: string[];
  suggested_command?: string;
  suggested_yaml_patch?: string;
  resolved_by?: string;
  resolved_at?: string;
  first_detected: string;
  last_detected: string;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
}

export interface TicketTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface CommentItem {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  incident_id: string;
  organization_id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  assignee: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'RESOLVED' | 'CLOSED';
  cluster_id: string;
  cluster_name: string;
  namespace: string;
  resource: string;
  category?: string;
  impact?: string;
  root_cause?: string;
  suggested_actions?: string[];
  suggested_command?: string;
  suggested_yaml_patch?: string;
  evidence?: string[];
  tasks?: TicketTask[];
  timeline?: Array<{
    timestamp: string;
    title: string;
    detail: string;
    author?: string;
    type: 'event' | 'status_change' | 'comment' | 'remediation';
  }>;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  due_date?: string;
  tags?: string[];
  comments: CommentItem[];
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id?: string;
  user_email: string;
  action: string;
  resource: string;
  details: string;
  ip_address?: string;
  timestamp: string;
}

export interface K8sEvent {
  id: string;
  organization_id: string;
  cluster_id?: string;
  cluster_name: string;
  namespace: string;
  resource: string;
  kind: string;
  type: 'Normal' | 'Warning' | 'Error';
  reason: string;
  message: string;
  count: number;
  first_observed: string;
  last_observed: string;
}

export interface NodeHealth {
  id: string;
  organization_id: string;
  cluster_id?: string;
  cluster_name: string;
  name: string;
  status: 'Ready' | 'NotReady';
  k8s_version: string;
  cpu_allocatable: string;
  mem_allocatable: string;
  pod_count: number;
  memory_pressure: boolean;
  disk_pressure: boolean;
  pid_pressure: boolean;
  updated_at: string;
}

export interface WorkloadHealth {
  id: string;
  organization_id: string;
  cluster_id?: string;
  cluster_name: string;
  namespace: string;
  name: string;
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'Job' | 'CronJob';
  desired: number;
  ready: number;
  available: number;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  updated_at: string;
}
