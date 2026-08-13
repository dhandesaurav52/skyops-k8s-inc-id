package models

import "time"

type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type User struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	OrganizationID string    `json:"organization_id"`
	Role           string    `json:"role"` // admin, sre, viewer
	CreatedAt      time.Time `json:"created_at"`
}

type Cluster struct {
	ID                string    `json:"id"`
	OrganizationID    string    `json:"organization_id"`
	Name              string    `json:"name"`
	Environment       string    `json:"environment"` // production, staging, dev
	Status            string    `json:"status"`      // CONNECTED, DEGRADED, OFFLINE, UNKNOWN
	AgentVersion      string    `json:"agent_version"`
	K8sVersion        string    `json:"k8s_version"`
	RegistrationToken string    `json:"registration_token,omitempty"`
	ClusterToken      string    `json:"cluster_token,omitempty"`
	NodeCount         int       `json:"node_count"`
	PodCount          int       `json:"pod_count"`
	NamespaceCount    int       `json:"namespace_count"`
	ActiveIncidents   int       `json:"active_incidents"`
	CPUUsageCores     float64   `json:"cpu_usage_cores"`
	MemoryUsageBytes  int64     `json:"memory_usage_bytes"`
	LastHeartbeat     time.Time `json:"last_heartbeat"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type Severity string

const (
	SeverityCritical Severity = "CRITICAL"
	SeverityHigh     Severity = "HIGH"
	SeverityMedium   Severity = "MEDIUM"
	SeverityLow      Severity = "LOW"
	SeverityInfo     Severity = "INFO"
)

type IncidentStatus string

const (
	StatusOpen         IncidentStatus = "OPEN"
	StatusAcknowledged IncidentStatus = "ACKNOWLEDGED"
	StatusInvestigating IncidentStatus = "INVESTIGATING"
	StatusMitigated    IncidentStatus = "MITIGATED"
	StatusResolved     IncidentStatus = "RESOLVED"
	StatusClosed       IncidentStatus = "CLOSED"
)

type Incident struct {
	ID                 string         `json:"id"`
	Title              string         `json:"title"`
	Status             IncidentStatus `json:"status"`
	Severity           Severity       `json:"severity"`
	Category           string         `json:"category"` // CrashLoopBackOff, OOMKilled, ImagePullFailure, etc.
	OrganizationID     string         `json:"organization_id"`
	ClusterID          string         `json:"cluster_id"`
	ClusterName        string         `json:"cluster_name"`
	Namespace          string         `json:"namespace"`
	ResourceType       string         `json:"resource_type"` // Pod, Deployment, Node, etc.
	ResourceName       string         `json:"resource_name"`
	PodName            string         `json:"pod_name,omitempty"`
	ContainerName      string         `json:"container_name,omitempty"`
	Occurrences        int            `json:"occurrences"`
	Summary            string         `json:"summary"`
	Impact             string         `json:"impact"`
	RootCause          string         `json:"root_cause"`
	Evidence           []string       `json:"evidence"`
	Timeline           []TimelineItem `json:"timeline"`
	SuggestedActions   []string       `json:"suggested_actions"`
	SuggestedCommand   string         `json:"suggested_command,omitempty"`
	SuggestedYamlPatch string         `json:"suggested_yaml_patch,omitempty"`
	ResolvedBy         string         `json:"resolved_by,omitempty"`
	ResolvedAt         *time.Time     `json:"resolved_at,omitempty"`
	FirstDetected      time.Time      `json:"first_detected"`
	LastDetected       time.Time      `json:"last_detected"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

type TimelineItem struct {
	Timestamp time.Time `json:"timestamp"`
	Title     string    `json:"title"`
	Detail    string    `json:"detail"`
	Author    string    `json:"author,omitempty"`
	Type      string    `json:"type"` // event, status_change, comment, remediation
}

type TicketStatus string

const (
	TicketOpen       TicketStatus = "OPEN"
	TicketInProgress TicketStatus = "IN_PROGRESS"
	TicketBlocked    TicketStatus = "BLOCKED"
	TicketResolved   TicketStatus = "RESOLVED"
	TicketClosed     TicketStatus = "CLOSED"
)

type Ticket struct {
	ID             string        `json:"id"` // SKY-1001
	IncidentID     string        `json:"incident_id"`
	OrganizationID string        `json:"organization_id"`
	Title          string        `json:"title"`
	Description    string        `json:"description"`
	Severity       Severity      `json:"severity"`
	Priority       string        `json:"priority"` // P0, P1, P2, P3
	Assignee       string        `json:"assignee"`
	Status         TicketStatus  `json:"status"`
	ClusterID      string        `json:"cluster_id"`
	ClusterName    string        `json:"cluster_name"`
	Namespace      string        `json:"namespace"`
	Resource       string        `json:"resource"`
	Comments       []CommentItem `json:"comments"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type CommentItem struct {
	ID        string    `json:"id"`
	Author    string    `json:"author"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

type K8sEvent struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	ClusterID      string    `json:"cluster_id"`
	ClusterName    string    `json:"cluster_name"`
	Namespace      string    `json:"namespace"`
	Resource       string    `json:"resource"`
	Kind           string    `json:"kind"`
	Type           string    `json:"type"` // Normal, Warning, Error
	Reason         string    `json:"reason"`
	Message        string    `json:"message"`
	Count          int       `json:"count"`
	FirstObserved  time.Time `json:"first_observed"`
	LastObserved   time.Time `json:"last_observed"`
}

type MetricPoint struct {
	Timestamp        time.Time `json:"timestamp"`
	ClusterID        string    `json:"cluster_id"`
	CPUUtilization   float64   `json:"cpu_utilization"`   // percentage
	MemoryMB         float64   `json:"memory_mb"`          // MB
	PodRestartRate   float64   `json:"pod_restart_rate"`  // restarts per min
	NodeHealthPct    float64   `json:"node_health_pct"`   // % healthy
	ActiveIncidents  int       `json:"active_incidents"`
}

type AuditLog struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	UserID         string    `json:"user_id"`
	UserEmail      string    `json:"user_email"`
	Action         string    `json:"action"` // cluster_registered, incident_acknowledged, ticket_created, etc.
	Resource       string    `json:"resource"`
	Details        string    `json:"details"`
	IPAddress      string    `json:"ip_address"`
	Timestamp      time.Time `json:"timestamp"`
}

type WorkloadHealth struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	ClusterID      string    `json:"cluster_id"`
	ClusterName    string    `json:"cluster_name"`
	Namespace      string    `json:"namespace"`
	Name           string    `json:"name"`
	Kind           string    `json:"kind"` // Deployment, StatefulSet, DaemonSet, Job, CronJob
	Desired        int       `json:"desired"`
	Ready          int       `json:"ready"`
	Available      int       `json:"available"`
	Status         string    `json:"status"` // HEALTHY, DEGRADED, FAILED
	UpdatedAt      time.Time `json:"updated_at"`
}

type NodeHealth struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	ClusterID      string    `json:"cluster_id"`
	ClusterName    string    `json:"cluster_name"`
	Name           string    `json:"name"`
	Status         string    `json:"status"` // Ready, NotReady
	K8sVersion     string    `json:"k8s_version"`
	CPUAllocatable string    `json:"cpu_allocatable"`
	MemAllocatable string    `json:"mem_allocatable"`
	PodCount       int       `json:"pod_count"`
	MemoryPressure bool      `json:"memory_pressure"`
	DiskPressure   bool      `json:"disk_pressure"`
	PIDPressure    bool      `json:"pid_pressure"`
	UpdatedAt      time.Time `json:"updated_at"`
}
