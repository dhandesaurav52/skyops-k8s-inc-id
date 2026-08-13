package tickets

import (
	"testing"

	"github.com/skyops/skyops/backend/pkg/models"
)

func TestTicketCreationAndComments(t *testing.T) {
	mgr := NewManager(1001)

	inc := &models.Incident{
		ID:             "INC-000123",
		OrganizationID: "org-1",
		Title:          "CrashLoopBackOff on payment-api",
		Severity:       models.SeverityCritical,
		Summary:        "Pod restarting continuously",
		Impact:         "Latency spike",
		RootCause:      "OOM during initialization",
		ClusterID:      "cls-1",
		ClusterName:    "prod",
		Namespace:      "default",
		ResourceType:   "Deployment",
		ResourceName:   "payment-api",
	}

	ticket := mgr.CreateTicketFromIncident(inc, "sre-lead@skyops.io")

	if ticket.ID != "SKY-1001" {
		t.Fatalf("Expected ticket ID SKY-1001, got %s", ticket.ID)
	}

	if ticket.Priority != "P0" {
		t.Fatalf("Expected P0 priority for CRITICAL incident, got %s", ticket.Priority)
	}

	mgr.AddComment(ticket, "sre-engineer@skyops.io", "Investigating container memory limit adjustment.")

	if len(ticket.Comments) != 2 {
		t.Fatalf("Expected 2 comments on ticket, got %d", len(ticket.Comments))
	}
}
