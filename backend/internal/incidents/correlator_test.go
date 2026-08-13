package incidents

import (
	"testing"

	"github.com/skyops/skyops/backend/pkg/models"
)

func TestIncidentCorrelation(t *testing.T) {
	correlator := NewCorrelator()

	orgID := "org-123"
	clusterID := "cluster-456"
	clusterName := "production"
	namespace := "default"
	resourceType := "Deployment"
	resourceName := "payment-api"
	podName := "payment-api-7c8d9"

	var activeIncidents []*models.Incident

	// First failure
	inc1, isNew := correlator.CorrelateEvent(
		activeIncidents,
		orgID, clusterID, clusterName, namespace, resourceType, resourceName, podName,
		"CrashLoopBackOff", "Back-off 5m0s restarting failed container", "Back-off restarting container in pod payment-api-7c8d9",
	)

	if !isNew {
		t.Fatalf("Expected new incident on first failure")
	}

	if inc1.Occurrences != 1 {
		t.Fatalf("Expected 1 occurrence, got %d", inc1.Occurrences)
	}

	activeIncidents = append(activeIncidents, inc1)

	// Second failure on same pod & resource -> should correlate to same incident
	inc2, isNew2 := correlator.CorrelateEvent(
		activeIncidents,
		orgID, clusterID, clusterName, namespace, resourceType, resourceName, podName,
		"CrashLoopBackOff", "Back-off 5m0s restarting failed container", "Back-off restarting container in pod payment-api-7c8d9",
	)

	if isNew2 {
		t.Fatalf("Expected correlated existing incident on second failure, got new")
	}

	if inc2.ID != inc1.ID {
		t.Fatalf("Expected incident ID %s, got %s", inc1.ID, inc2.ID)
	}

	if inc2.Occurrences != 2 {
		t.Fatalf("Expected 2 occurrences, got %d", inc2.Occurrences)
	}

	t.Logf("Successfully correlated incident %s with 2 occurrences!", inc2.ID)
}

func TestDetermineSeverity(t *testing.T) {
	if sev := DetermineSeverity("OOMKilled", "Container killed"); sev != models.SeverityCritical {
		t.Fatalf("Expected CRITICAL for OOMKilled, got %s", sev)
	}

	if sev := DetermineSeverity("CrashLoopBackOff", "Container restarting"); sev != models.SeverityHigh {
		t.Fatalf("Expected HIGH for CrashLoopBackOff, got %s", sev)
	}
}
