package clusters

import (
	"testing"
	"time"
)

func TestClusterRegistrationAndTokenExchange(t *testing.T) {
	mgr := NewManager()

	cluster, regToken := mgr.RegisterCluster("org-1", "prod-us-east", "production")

	if cluster.Status != "UNKNOWN" {
		t.Fatalf("Expected initial cluster status UNKNOWN, got %s", cluster.Status)
	}

	if regToken == "" {
		t.Fatalf("Expected non-empty registration token")
	}

	// Exchange with wrong token
	_, err := mgr.ExchangeToken(cluster, "wrong_token")
	if err == nil {
		t.Fatalf("Expected error for wrong registration token")
	}

	// Exchange with correct token
	clusterToken, err := mgr.ExchangeToken(cluster, regToken)
	if err != nil {
		t.Fatalf("Unexpected error exchanging token: %v", err)
	}

	if clusterToken == "" {
		t.Fatalf("Expected non-empty cluster token")
	}

	if cluster.Status != "CONNECTED" {
		t.Fatalf("Expected status CONNECTED after token exchange, got %s", cluster.Status)
	}

	if cluster.RegistrationToken != "" {
		t.Fatalf("Expected registration token to be invalidated after exchange")
	}

	// Heartbeat test
	mgr.ProcessHeartbeat(cluster, 5, 42, 8, "v1.30.2", "v1.0.0", 2.4, 8589934592)

	if cluster.NodeCount != 5 || cluster.PodCount != 42 {
		t.Fatalf("Expected node count 5 and pod count 42, got nodes=%d pods=%d", cluster.NodeCount, cluster.PodCount)
	}

	// Offline check
	cluster.LastHeartbeat = time.Now().Add(-10 * time.Minute)
	isOffline := mgr.CheckOffline(cluster, 5*time.Minute)
	if !isOffline || cluster.Status != "OFFLINE" {
		t.Fatalf("Expected cluster to be marked OFFLINE after 10m inactivity")
	}
}
