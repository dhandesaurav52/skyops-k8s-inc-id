export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type IncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'MITIGATED'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'RESOLVED'
  | 'CLOSED';

export type ClusterStatus = 'CONNECTED' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export type Role = 'ADMIN' | 'SRE' | 'DEVELOPER' | 'VIEWER';

export type PlanType = 'COMMUNITY' | 'PRO' | 'ENTERPRISE';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  organization_id: string;
  organization_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface LicenseFeatures {
  advanced_rca: boolean;
  sso_enabled: boolean;
  audit_retention_days: number;
  custom_runbooks: boolean;
  data_telemetry: boolean;
  unlimited_tickets: boolean;
}

export interface License {
  id?: string;
  plan: PlanType;
  max_clusters: number;
  max_users: number;
  current_clusters?: number;
  current_users?: number;
  expires_at: string;
  issued_at?: string;
  features: LicenseFeatures;
  is_valid?: boolean;
}

export interface SystemInfo {
  product: string;
  version: string;
  deploymentMode: 'self-hosted' | 'cloud';
  uptimeSeconds?: number;
  dataPrivacy: {
    telemetryEnabled: boolean;
    mode: 'STRICT_LOCAL_ONLY' | 'ANONYMIZED_TELEMETRY';
    description: string;
  };
  database: {
    type: 'postgres' | 'memory';
    healthy: boolean;
    details?: string;
  };
  secrets?: {
    jwtSecretSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
    jwtSecretConfigured: boolean;
    licenseSecretSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
    licenseSecretConfigured: boolean;
    encryptionKeySource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
    isSecretsFilePersisted: boolean;
    secretsFilePath?: string;
  };
  runtime?: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memoryUsageMb: number;
  };
  limits: {
    plan: string;
    maxClusters: number;
    maxUsers: number;
  };
  authenticated: boolean;
  userRole: Role | null;
  serverTime: string;
}

export interface SetupStatus {
  isInitialized: boolean;
  setupRequired: boolean;
  deploymentMode: 'self-hosted' | 'cloud';
  telemetryEnabled: boolean;
  database: {
    type: string;
    healthy: boolean;
  };
  secrets: {
    jwtSource: string;
    licenseSource: string;
    isPersisted: boolean;
  };
  version: string;
  serverTime: string;
}

export interface SetupInitPayload {
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  organizationName: string;
  licenseKey?: string;
  seedSampleData?: boolean;
}

export interface TimelineItem {
  timestamp: string;
  title: string;
  detail: string;
  author?: string;
  type: 'event' | 'status_change' | 'comment' | 'remediation';
}

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  category: string;
  organization_id: string;
  cluster_id: string;
  cluster_name: string;
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
  timeline: TimelineItem[];
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

export interface CommentItem {
  id: string;
  author: string;
  message: string;
  createdAt: string;
}

export interface TicketTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Ticket {
  id: string;
  incident_id: string;
  organization_id: string;
  title: string;
  description: string;
  severity: Severity;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  assignee: string;
  status: TicketStatus;
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
  timeline?: TimelineItem[];
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

export interface Cluster {
  id: string;
  organization_id: string;
  name: string;
  environment: string;
  status: ClusterStatus;
  agent_version: string;
  k8s_version: string;
  registration_token?: string;
  cluster_token?: string;
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

export interface AuditLog {
  id: string;
  organization_id: string;
  user_email: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
  ip_address?: string;
}

export interface K8sEvent {
  id: string;
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
