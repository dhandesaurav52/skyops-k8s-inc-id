package incidents

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/dhandesaurav52/skyops-k8s-inc-id/backend/pkg/models"
)

type Correlator struct{}

func NewCorrelator() *Correlator {
	return &Correlator{}
}

// ProcessRawObservation receives a raw failure event and either matches an existing active incident or creates a new correlated incident.
func (c *Correlator) CorrelateEvent(
	existing []*models.Incident,
	orgID string,
	clusterID string,
	clusterName string,
	namespace string,
	resourceType string,
	resourceName string,
	podName string,
	category string,
	message string,
	evidenceLine string,
) (*models.Incident, bool) {
	now := time.Now().UTC()

	// Look for existing OPEN, ACKNOWLEDGED, or INVESTIGATING incident for the same resource + category
	for _, inc := range existing {
		if inc.OrganizationID == orgID &&
			inc.ClusterID == clusterID &&
			inc.Namespace == namespace &&
			inc.ResourceName == resourceName &&
			inc.Category == category &&
			isUnresolved(inc.Status) {

			// Update existing incident
			inc.Occurrences++
			inc.LastDetected = now
			inc.UpdatedAt = now

			// Add evidence line if not already present
			if evidenceLine != "" && !contains(inc.Evidence, evidenceLine) {
				inc.Evidence = append(inc.Evidence, evidenceLine)
				if len(inc.Evidence) > 20 {
					inc.Evidence = inc.Evidence[len(inc.Evidence)-20:]
				}
			}

			// Add timeline entry
			inc.Timeline = append(inc.Timeline, models.TimelineItem{
				Timestamp: now,
				Title:     fmt.Sprintf("Occurrence #%d recorded", inc.Occurrences),
				Detail:    message,
				Type:      "event",
			})

			return inc, false // false = updated, not new
		}
	}

	// No existing open incident found -> create a new correlated incident
	incID := fmt.Sprintf("INC-%s", strings.ToUpper(uuid.New().String()[:8]))
	severity := DetermineSeverity(category, message)

	remediation, command, yamlPatch := GenerateRemediation(category, resourceType, namespace, resourceName)

	newInc := &models.Incident{
		ID:             incID,
		Title:          fmt.Sprintf("%s failure on %s/%s", category, namespace, resourceName),
		Status:         models.StatusOpen,
		Severity:       severity,
		Category:       category,
		OrganizationID: orgID,
		ClusterID:      clusterID,
		ClusterName:    clusterName,
		Namespace:      namespace,
		ResourceType:   resourceType,
		ResourceName:   resourceName,
		PodName:        podName,
		Occurrences:    1,
		Summary:        fmt.Sprintf("Resource %s/%s triggered %s: %s", namespace, resourceName, category, message),
		Impact:         DetermineImpact(category, resourceType),
		RootCause:      DetermineRootCause(category, message),
		Evidence:       []string{evidenceLine},
		Timeline: []models.TimelineItem{
			{
				Timestamp: now,
				Title:     "Incident Detected",
				Detail:    fmt.Sprintf("Initial %s event observed: %s", category, message),
				Type:      "event",
			},
		},
		SuggestedActions:   remediation,
		SuggestedCommand:   command,
		SuggestedYamlPatch: yamlPatch,
		FirstDetected:      now,
		LastDetected:       now,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	return newInc, true // true = newly created
}

func isUnresolved(status models.IncidentStatus) bool {
	return status == models.StatusOpen ||
		status == models.StatusAcknowledged ||
		status == models.StatusInvestigating ||
		status == models.StatusMitigated
}

func contains(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

func DetermineSeverity(category string, message string) models.Severity {
	catUpper := strings.ToUpper(category)
	msgUpper := strings.ToUpper(message)

	if strings.Contains(catUpper, "OOMKILLED") ||
		strings.Contains(catUpper, "NODE") && strings.Contains(catUpper, "NOTREADY") ||
		strings.Contains(msgUpper, "CRITICAL") {
		return models.SeverityCritical
	}

	if strings.Contains(catUpper, "CRASHLOOP") ||
		strings.Contains(catUpper, "ROLLOUT") ||
		strings.Contains(catUpper, "FAILED") {
		return models.SeverityHigh
	}

	if strings.Contains(catUpper, "IMAGEPULL") ||
		strings.Contains(catUpper, "PRESSURE") {
		return models.SeverityMedium
	}

	return models.SeverityLow
}

func DetermineImpact(category, resourceType string) string {
	switch category {
	case "CrashLoopBackOff":
		return "Application pod failing to start, leading to degraded deployment capacity."
	case "OOMKilled":
		return "Container terminated due to exceeding memory limits. Service experience latency or drop in request processing."
	case "ImagePullFailure":
		return "Pod stuck in ImagePullBackOff or ErrImagePull. New code deployment cannot proceed."
	case "NodeNotReady":
		return "Node unreachable or unhealthy. Workloads may need reschedule to healthy nodes."
	default:
		return fmt.Sprintf("Service disruption observed on %s workload.", resourceType)
	}
}

func DetermineRootCause(category, message string) string {
	switch category {
	case "CrashLoopBackOff":
		return "Container entrypoint process exited with non-zero status or unhandled error during startup."
	case "OOMKilled":
		return "Container memory consumption breached allocated cgroup memory limit."
	case "ImagePullFailure":
		return "Container image tag not found, registry authentication missing, or image pull timeout."
	case "NodeNotReady":
		return "Kubelet heartbeat missed due to network partition or host resource exhaustion."
	default:
		return message
	}
}

func GenerateRemediation(category, resourceType, namespace, name string) ([]string, string, string) {
	cmd := fmt.Sprintf("kubectl rollout restart %s/%s -n %s", strings.ToLower(resourceType), name, namespace)
	yamlPatch := fmt.Sprintf(`apiVersion: apps/v1
kind: %s
metadata:
  name: %s
  namespace: %s
spec:
  template:
    spec:
      containers:
      - name: main
        resources:
          limits:
            memory: "1Gi"
            cpu: "500m"`, resourceType, name, namespace)

	actions := []string{
		fmt.Sprintf("Inspect live logs: kubectl logs -n %s -l app=%s --tail=100", namespace, name),
		fmt.Sprintf("Check resource metrics: kubectl top pods -n %s", namespace),
		"Verify environment variable configurations and secrets",
	}

	return actions, cmd, yamlPatch
}
