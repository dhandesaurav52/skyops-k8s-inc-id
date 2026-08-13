package clusters

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/dhandesaurav52/skyops-k8s-inc-id/backend/pkg/models"
)

type Manager struct{}

func NewManager() *Manager {
	return &Manager{}
}

func (m *Manager) GenerateRegistrationToken() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return fmt.Sprintf("skyops_reg_%s", hex.EncodeToString(bytes))
}

func (m *Manager) GenerateClusterToken() string {
	bytes := make([]byte, 24)
	rand.Read(bytes)
	return fmt.Sprintf("skyops_ctk_%s", hex.EncodeToString(bytes))
}

func (m *Manager) RegisterCluster(orgID, clusterName, environment string) (*models.Cluster, string) {
	regToken := m.GenerateRegistrationToken()
	now := time.Now().UTC()

	cluster := &models.Cluster{
		ID:                fmt.Sprintf("cls-%s", uuid.New().String()[:8]),
		OrganizationID:    orgID,
		Name:              clusterName,
		Environment:       environment,
		Status:            "UNKNOWN", // Initially UNKNOWN until first agent heartbeat
		AgentVersion:      "v1.0.0",
		K8sVersion:        "v1.30.0",
		RegistrationToken: regToken,
		NodeCount:         0,
		PodCount:          0,
		NamespaceCount:    0,
		ActiveIncidents:   0,
		LastHeartbeat:     now,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	return cluster, regToken
}

func (m *Manager) ExchangeToken(cluster *models.Cluster, regToken string) (string, error) {
	if cluster.RegistrationToken == "" || cluster.RegistrationToken != regToken {
		return "", fmt.Errorf("invalid registration token")
	}

	clusterToken := m.GenerateClusterToken()
	cluster.ClusterToken = clusterToken
	cluster.RegistrationToken = "" // Invalidate single-use registration token
	cluster.Status = "CONNECTED"
	cluster.LastHeartbeat = time.Now().UTC()
	cluster.UpdatedAt = time.Now().UTC()

	return clusterToken, nil
}

func (m *Manager) ProcessHeartbeat(cluster *models.Cluster, nodeCount, podCount, nsCount int, k8sVersion, agentVersion string, cpuCores float64, memBytes int64) {
	now := time.Now().UTC()
	cluster.LastHeartbeat = now
	cluster.Status = "CONNECTED"
	cluster.NodeCount = nodeCount
	cluster.PodCount = podCount
	cluster.NamespaceCount = nsCount
	if k8sVersion != "" {
		cluster.K8sVersion = k8sVersion
	}
	if agentVersion != "" {
		cluster.AgentVersion = agentVersion
	}
	cluster.CPUUsageCores = cpuCores
	cluster.MemoryUsageBytes = memBytes
	cluster.UpdatedAt = now
}

func (m *Manager) CheckOffline(cluster *models.Cluster, offlineThreshold time.Duration) bool {
	if time.Since(cluster.LastHeartbeat) > offlineThreshold {
		cluster.Status = "OFFLINE"
		return true
	}
	return false
}
