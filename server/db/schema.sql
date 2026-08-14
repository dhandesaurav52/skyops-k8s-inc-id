-- SkyOps Production PostgreSQL Database Schema
-- Multi-Tenant, Role-Based Access Control, Cluster Ingestion, Correlated Incidents & SRE Tickets

-- 1. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users & Credentials
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'VIEWER', -- ADMIN, SRE, DEVELOPER, VIEWER
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. User Memberships
CREATE TABLE IF NOT EXISTS memberships (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'VIEWER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

-- 4. Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(64),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

-- 5. Licenses
CREATE TABLE IF NOT EXISTS licenses (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan VARCHAR(32) NOT NULL DEFAULT 'COMMUNITY', -- COMMUNITY, PRO, ENTERPRISE
    max_clusters INTEGER NOT NULL DEFAULT 3,
    max_users INTEGER NOT NULL DEFAULT 5,
    features JSONB NOT NULL DEFAULT '{}',
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    signature TEXT NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_licenses_org ON licenses(organization_id);

-- 6. Clusters
CREATE TABLE IF NOT EXISTS clusters (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(64) NOT NULL DEFAULT 'production',
    status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN', -- CONNECTED, DEGRADED, OFFLINE, UNKNOWN
    agent_version VARCHAR(64) DEFAULT 'v1.0.0',
    k8s_version VARCHAR(64) DEFAULT 'v1.30.0',
    registration_token_hash VARCHAR(255),
    cluster_token_hash VARCHAR(255),
    node_count INTEGER DEFAULT 0,
    pod_count INTEGER DEFAULT 0,
    namespace_count INTEGER DEFAULT 0,
    active_incidents INTEGER DEFAULT 0,
    cpu_usage_cores DOUBLE PRECISION DEFAULT 0.0,
    memory_usage_bytes BIGINT DEFAULT 0,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_demo BOOLEAN DEFAULT FALSE,
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_clusters_org ON clusters(organization_id);
CREATE INDEX IF NOT EXISTS idx_clusters_token ON clusters(cluster_token_hash);

-- 7. Correlated Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id VARCHAR(64) NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    cluster_name VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, ACKNOWLEDGED, INVESTIGATING, MITIGATED, RESOLVED, CLOSED
    severity VARCHAR(32) NOT NULL DEFAULT 'HIGH', -- CRITICAL, HIGH, MEDIUM, LOW, INFO
    category VARCHAR(128) NOT NULL,
    namespace VARCHAR(128) NOT NULL DEFAULT 'default',
    resource_type VARCHAR(64) NOT NULL DEFAULT 'Pod',
    resource_name VARCHAR(255) NOT NULL,
    pod_name VARCHAR(255),
    container_name VARCHAR(255),
    occurrences INTEGER DEFAULT 1,
    summary TEXT NOT NULL,
    impact TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    evidence JSONB DEFAULT '[]',
    timeline JSONB DEFAULT '[]',
    suggested_actions JSONB DEFAULT '[]',
    suggested_command TEXT,
    suggested_yaml_patch TEXT,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    first_detected TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_detected TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_demo BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_incidents_org ON incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_incidents_cluster ON incidents(cluster_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

-- 8. SRE Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(64) PRIMARY KEY,
    incident_id VARCHAR(64),
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'HIGH',
    priority VARCHAR(16) NOT NULL DEFAULT 'P1', -- P0, P1, P2, P3
    assignee VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, BLOCKED, RESOLVED, CLOSED
    cluster_id VARCHAR(64) NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    cluster_name VARCHAR(255) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    category VARCHAR(128),
    impact TEXT,
    root_cause TEXT,
    suggested_actions JSONB DEFAULT '[]',
    suggested_command TEXT,
    suggested_yaml_patch TEXT,
    evidence JSONB DEFAULT '[]',
    tasks JSONB DEFAULT '[]',
    timeline JSONB DEFAULT '[]',
    comments JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    resolution_notes TEXT,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_demo BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_cluster ON tickets(cluster_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- 9. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(64),
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(128) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(timestamp DESC);

-- 10. Kubernetes Event Stream
CREATE TABLE IF NOT EXISTS k8s_events (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id VARCHAR(64),
    cluster_name VARCHAR(255) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    resource VARCHAR(255) NOT NULL,
    kind VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL, -- Normal, Warning, Error
    reason VARCHAR(128) NOT NULL,
    message TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    first_observed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_observed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_org ON k8s_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_cluster ON k8s_events(cluster_id);

-- 11. Node Health
CREATE TABLE IF NOT EXISTS node_health (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id VARCHAR(64),
    cluster_name VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL, -- Ready, NotReady
    k8s_version VARCHAR(64),
    cpu_allocatable VARCHAR(64),
    mem_allocatable VARCHAR(64),
    pod_count INTEGER DEFAULT 0,
    memory_pressure BOOLEAN DEFAULT FALSE,
    disk_pressure BOOLEAN DEFAULT FALSE,
    pid_pressure BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, cluster_name, name)
);

CREATE INDEX IF NOT EXISTS idx_nodes_org ON node_health(organization_id);

-- 12. Workload Health
CREATE TABLE IF NOT EXISTS workload_health (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cluster_id VARCHAR(64),
    cluster_name VARCHAR(255) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(64) NOT NULL,
    desired INTEGER DEFAULT 0,
    ready INTEGER DEFAULT 0,
    available INTEGER DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, cluster_name, namespace, name)
);

CREATE INDEX IF NOT EXISTS idx_workloads_org ON workload_health(organization_id);
