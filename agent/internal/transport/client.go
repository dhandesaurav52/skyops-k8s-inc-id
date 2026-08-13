package transport

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/dhandesaurav52/skyops-k8s-inc-id/agent/internal/collectors"
	"github.com/dhandesaurav52/skyops-k8s-inc-id/backend/pkg/models"
)

type Client struct {
	ServerURL    string
	OrgID        string
	ClusterID    string
	ClusterToken string
	httpClient   *http.Client
}

func NewClient(serverURL, orgID, clusterID, clusterToken string) *Client {
	return &Client{
		ServerURL:    serverURL,
		OrgID:        orgID,
		ClusterID:    clusterID,
		ClusterToken: clusterToken,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type RegistrationResponse struct {
	ClusterID    string `json:"cluster_id"`
	ClusterToken string `json:"cluster_token"`
	OrgID        string `json:"org_id"`
}

func (c *Client) Register(registrationToken, clusterName string) (*RegistrationResponse, error) {
	url := fmt.Sprintf("%s/api/v1/agent/register", c.ServerURL)
	payload := map[string]string{
		"registration_token": registrationToken,
		"cluster_name":       clusterName,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registration failed with status code %d", resp.StatusCode)
	}

	var res RegistrationResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	c.ClusterID = res.ClusterID
	c.ClusterToken = res.ClusterToken
	c.OrgID = res.OrgID

	return &res, nil
}

func (c *Client) SendHeartbeat(obs *collectors.Observation) error {
	url := fmt.Sprintf("%s/api/v1/agent/heartbeat", c.ServerURL)

	payload := map[string]interface{}{
		"org_id":          c.OrgID,
		"cluster_id":      c.ClusterID,
		"cluster_token":   c.ClusterToken,
		"cluster_name":    obs.ClusterName,
		"node_count":      obs.NodeCount,
		"pod_count":       obs.PodCount,
		"namespace_count": obs.NamespaceCount,
		"cpu_usage_cores": obs.CPUUsageCores,
		"memory_bytes":    obs.MemoryBytes,
		"k8s_version":     obs.K8sVersion,
		"agent_version":   obs.AgentVersion,
		"nodes":           obs.Nodes,
		"workloads":       obs.Workloads,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.ClusterToken != "" {
		req.Header.Set("X-SkyOps-Cluster-Token", c.ClusterToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat returned status code %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) SendEventsBatch(events []*models.K8sEvent) error {
	if len(events) == 0 {
		return nil
	}

	url := fmt.Sprintf("%s/api/v1/agent/events/batch", c.ServerURL)
	payload := map[string]interface{}{
		"cluster_id":    c.ClusterID,
		"cluster_token": c.ClusterToken,
		"events":        events,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.ClusterToken != "" {
		req.Header.Set("X-SkyOps-Cluster-Token", c.ClusterToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("batch events upload failed with status code %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) SendIncidentsBatch(incidents []*models.Incident) error {
	if len(incidents) == 0 {
		return nil
	}

	url := fmt.Sprintf("%s/api/v1/agent/incidents", c.ServerURL)
	payload := map[string]interface{}{
		"cluster_id":    c.ClusterID,
		"cluster_token": c.ClusterToken,
		"incidents":     incidents,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.ClusterToken != "" {
		req.Header.Set("X-SkyOps-Cluster-Token", c.ClusterToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("batch incidents upload failed with status code %d", resp.StatusCode)
	}

	return nil
}
