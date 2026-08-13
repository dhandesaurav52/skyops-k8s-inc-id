package transport

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dhandesaurav52/skyops-k8s-inc-id/backend/pkg/models"
)

func TestClientRegisterAndBatchUpload(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/v1/agent/register":
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(RegistrationResponse{
				ClusterID:    "cls-1234",
				ClusterToken: "token-5678",
				OrgID:        "org-test",
			})
		case "/api/v1/agent/events/batch":
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer ts.Close()

	client := NewClient(ts.URL, "", "", "")
	res, err := client.Register("reg-token", "test-cluster")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	if res.ClusterID != "cls-1234" || res.ClusterToken != "token-5678" {
		t.Fatalf("Unexpected registration response: %+v", res)
	}

	events := []*models.K8sEvent{
		{
			ID:      "evt-1",
			Type:    "Warning",
			Reason:  "FailedScheduling",
			Message: "0/3 nodes available",
		},
	}

	err = client.SendEventsBatch(events)
	if err != nil {
		t.Fatalf("SendEventsBatch failed: %v", err)
	}
}
