package collectors

import (
	"fmt"
	"time"

	"github.com/skyops/skyops/backend/pkg/models"
)

type Observation struct {
	ClusterName  string                  `json:"cluster_name"`
	AgentVersion string                  `json:"agent_version"`
	K8sVersion   string                  `json:"k8s_version"`
	NodeCount    int                     `json:"node_count"`
	PodCount     int                     `json:"pod_count"`
	NamespaceCount int                   `json:"namespace_count"`
	CPUUsageCores float64                `json:"cpu_usage_cores"`
	MemoryBytes  int64                   `json:"memory_bytes"`
	Nodes        []models.NodeHealth     `json:"nodes"`
	Workloads    []models.WorkloadHealth `json:"workloads"`
	Events       []*models.K8sEvent      `json:"events"`
	Incidents    []*models.Incident      `json:"incidents"`
}

type K8sCollector interface {
	Collect() (*Observation, error)
}

type SyntheticCollector struct {
	ClusterName string
}

func NewSyntheticCollector(clusterName string) *SyntheticCollector {
	if clusterName == "" {
		clusterName = "k8s-cluster"
	}
	return &SyntheticCollector{ClusterName: clusterName}
}

func (s *SyntheticCollector) Collect() (*Observation, error) {
	now := time.Now().UTC()

	nodes := []models.NodeHealth{
		{
			ID:             "node-1",
			ClusterName:    s.ClusterName,
			Name:           "node-01.k8s.internal",
			Status:         "Ready",
			K8sVersion:     "v1.30.2",
			CPUAllocatable: "8000m",
			MemAllocatable: "32Gi",
			PodCount:       24,
			MemoryPressure: false,
			DiskPressure:   false,
			PIDPressure:    false,
			UpdatedAt:      now,
		},
		{
			ID:             "node-2",
			ClusterName:    s.ClusterName,
			Name:           "node-02.k8s.internal",
			Status:         "Ready",
			K8sVersion:     "v1.30.2",
			CPUAllocatable: "8000m",
			MemAllocatable: "32Gi",
			PodCount:       22,
			MemoryPressure: false,
			DiskPressure:   false,
			PIDPressure:    false,
			UpdatedAt:      now,
		},
	}

	workloads := []models.WorkloadHealth{
		{
			ID:          "wl-1",
			ClusterName: s.ClusterName,
			Namespace:   "default",
			Name:        "payment-api",
			Kind:        "Deployment",
			Desired:     3,
			Ready:       3,
			Available:   3,
			Status:      "HEALTHY",
			UpdatedAt:   now,
		},
		{
			ID:          "wl-2",
			ClusterName: s.ClusterName,
			Namespace:   "default",
			Name:        "auth-service",
			Kind:        "Deployment",
			Desired:     2,
			Ready:       2,
			Available:   2,
			Status:      "HEALTHY",
			UpdatedAt:   now,
		},
	}

	return &Observation{
		ClusterName:    s.ClusterName,
		AgentVersion:   "v1.0.0",
		K8sVersion:     "v1.30.2",
		NodeCount:      len(nodes),
		PodCount:       46,
		NamespaceCount: 5,
		CPUUsageCores:  1.85,
		MemoryBytes:    6442450944,
		Nodes:          nodes,
		Workloads:      workloads,
		Events: []*models.K8sEvent{
			{
				ID:            fmt.Sprintf("evt-%d", now.UnixNano()),
				ClusterName:   s.ClusterName,
				Namespace:     "default",
				Resource:      "Deployment/payment-api",
				Kind:          "Deployment",
				Type:          "Normal",
				Reason:        "ScalingReplicaSet",
				Message:       "Scaled up replica set payment-api-7c8d9 to 3",
				Count:         1,
				FirstObserved: now,
				LastObserved:  now,
			},
		},
	}, nil
}
