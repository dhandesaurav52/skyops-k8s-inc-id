package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/skyops/skyops/backend/internal/clusters"
	"github.com/skyops/skyops/backend/internal/incidents"
	"github.com/skyops/skyops/backend/internal/tickets"
	"github.com/skyops/skyops/backend/pkg/models"
)

type ServerStore struct {
	mu            sync.RWMutex
	clusters      map[string]*models.Cluster
	incidents     map[string]*models.Incident
	tickets       map[string]*models.Ticket
	auditLogs     []*models.AuditLog
	k8sEvents     []*models.K8sEvent
	workloads     map[string]*models.WorkloadHealth
	nodes         map[string]*models.NodeHealth
	clusterMgr    *clusters.Manager
	correlator    *incidents.Correlator
	ticketMgr     *tickets.Manager
	httpReqCount  int64
	eventsCount   int64
}

func NewServerStore() *ServerStore {
	return &ServerStore{
		clusters:   make(map[string]*models.Cluster),
		incidents:  make(map[string]*models.Incident),
		tickets:    make(map[string]*models.Ticket),
		auditLogs:  make([]*models.AuditLog, 0),
		k8sEvents:  make([]*models.K8sEvent, 0),
		workloads:  make(map[string]*models.WorkloadHealth),
		nodes:      make(map[string]*models.NodeHealth),
		clusterMgr: clusters.NewManager(),
		correlator: incidents.NewCorrelator(),
		ticketMgr:  tickets.NewManager(1001),
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	store := NewServerStore()

	mux := http.NewServeMux()

	// System Health & Observability Endpoints
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "skyops-backend", "version": "1.0.0"})
	})

	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ready", "database": "firestore"})
	})

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		store.mu.RLock()
		defer store.mu.RUnlock()

		fmt.Fprintf(w, "# HELP skyops_http_requests_total Total HTTP requests received.\n")
		fmt.Fprintf(w, "# TYPE skyops_http_requests_total counter\n")
		fmt.Fprintf(w, "skyops_http_requests_total %d\n", store.httpReqCount)

		fmt.Fprintf(w, "# HELP skyops_events_processed_total Total k8s events ingested.\n")
		fmt.Fprintf(w, "# TYPE skyops_events_processed_total counter\n")
		fmt.Fprintf(w, "skyops_events_processed_total %d\n", store.eventsCount)

		fmt.Fprintf(w, "# HELP skyops_active_clusters Active clusters registered.\n")
		fmt.Fprintf(w, "# TYPE skyops_active_clusters gauge\n")
		fmt.Fprintf(w, "skyops_active_clusters %d\n", len(store.clusters))

		fmt.Fprintf(w, "# HELP skyops_active_incidents Active correlated incidents.\n")
		fmt.Fprintf(w, "# TYPE skyops_active_incidents gauge\n")
		fmt.Fprintf(w, "skyops_active_incidents %d\n", len(store.incidents))
	})

	// Agent Endpoints
	mux.HandleFunc("/api/v1/agent/register", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			RegistrationToken string `json:"registration_token"`
			ClusterName       string `json:"cluster_name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON body", http.StatusBadRequest)
			return
		}

		store.mu.Lock()
		defer store.mu.Unlock()

		// Find cluster matching registration token
		var targetCluster *models.Cluster
		for _, cls := range store.clusters {
			if cls.RegistrationToken == req.RegistrationToken {
				targetCluster = cls
				break
			}
		}

		if targetCluster == nil {
			// Auto register cluster if valid registration token provided
			targetCluster, _ = store.clusterMgr.RegisterCluster("org-default", req.ClusterName, "production")
			targetCluster.RegistrationToken = req.RegistrationToken
			store.clusters[targetCluster.ID] = targetCluster
		}

		token, err := store.clusterMgr.ExchangeToken(targetCluster, req.RegistrationToken)
		if err != nil {
			http.Error(w, "Invalid registration token", http.StatusUnauthorized)
			return
		}

		store.auditLogs = append(store.auditLogs, &models.AuditLog{
			ID:             fmt.Sprintf("aud-%d", time.Now().UnixNano()),
			OrganizationID: targetCluster.OrganizationID,
			UserEmail:      "agent@skyops.internal",
			Action:         "cluster_registered",
			Resource:       targetCluster.Name,
			Details:        fmt.Sprintf("Agent registered for cluster %s (%s)", targetCluster.Name, targetCluster.ID),
			Timestamp:      time.Now().UTC(),
		})

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"cluster_id":    targetCluster.ID,
			"cluster_token": token,
			"org_id":        targetCluster.OrganizationID,
		})
	})

	mux.HandleFunc("/api/v1/agent/heartbeat", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			OrgID          string                  `json:"org_id"`
			ClusterID      string                  `json:"cluster_id"`
			ClusterToken   string                  `json:"cluster_token"`
			ClusterName    string                  `json:"cluster_name"`
			NodeCount      int                     `json:"node_count"`
			PodCount       int                     `json:"pod_count"`
			NamespaceCount int                     `json:"namespace_count"`
			CPUUsageCores  float64                 `json:"cpu_usage_cores"`
			MemoryBytes    int64                   `json:"memory_bytes"`
			K8sVersion     string                  `json:"k8s_version"`
			AgentVersion   string                  `json:"agent_version"`
			Nodes          []models.NodeHealth     `json:"nodes"`
			Workloads      []models.WorkloadHealth `json:"workloads"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON body", http.StatusBadRequest)
			return
		}

		store.mu.Lock()
		defer store.mu.Unlock()

		cluster, exists := store.clusters[req.ClusterID]
		if !exists {
			// Auto create if token matches or missing
			cluster = &models.Cluster{
				ID:             req.ClusterID,
				OrganizationID: req.OrgID,
				Name:           req.ClusterName,
				Environment:    "production",
			}
			store.clusters[req.ClusterID] = cluster
		}

		store.clusterMgr.ProcessHeartbeat(
			cluster, req.NodeCount, req.PodCount, req.NamespaceCount,
			req.K8sVersion, req.AgentVersion, req.CPUUsageCores, req.MemoryBytes,
		)

		for _, node := range req.Nodes {
			nodeKey := fmt.Sprintf("%s/%s", req.ClusterID, node.Name)
			node.OrganizationID = req.OrgID
			node.ClusterID = req.ClusterID
			store.nodes[nodeKey] = &node
		}

		for _, wl := range req.Workloads {
			wlKey := fmt.Sprintf("%s/%s/%s", req.ClusterID, wl.Namespace, wl.Name)
			wl.OrganizationID = req.OrgID
			wl.ClusterID = req.ClusterID
			store.workloads[wlKey] = &wl
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Cluster API
	mux.HandleFunc("/api/v1/clusters", func(w http.ResponseWriter, r *http.Request) {
		store.mu.RLock()
		defer store.mu.RUnlock()

		list := make([]*models.Cluster, 0, len(store.clusters))
		for _, cls := range store.clusters {
			list = append(list, cls)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(list)
	})

	log.Printf("[SkyOps Go Backend] Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
