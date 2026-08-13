package collectors

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/dhandesaurav52/skyops-k8s-inc-id/backend/pkg/models"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Observation struct {
	ClusterName    string                  `json:"cluster_name"`
	AgentVersion   string                  `json:"agent_version"`
	K8sVersion     string                  `json:"k8s_version"`
	NodeCount      int                     `json:"node_count"`
	PodCount       int                     `json:"pod_count"`
	NamespaceCount int                     `json:"namespace_count"`
	CPUUsageCores  float64                 `json:"cpu_usage_cores"`
	MemoryBytes    int64                   `json:"memory_bytes"`
	Nodes          []models.NodeHealth     `json:"nodes"`
	Workloads      []models.WorkloadHealth `json:"workloads"`
	Events         []*models.K8sEvent      `json:"events"`
	Incidents      []*models.Incident      `json:"incidents"`
}

type K8sCollector interface {
	Collect(ctx context.Context) (*Observation, error)
}

type RealK8sCollector struct {
	ClusterName string
	Clientset   kubernetes.Interface
	ServerVer   string
}

func NewK8sCollector(clusterName string, kubeconfigPath string) (*RealK8sCollector, error) {
	if clusterName == "" {
		clusterName = "k8s-cluster"
	}

	var config *rest.Config
	var err error

	// 1. Try InClusterConfig first (running inside Kubernetes pod)
	config, err = rest.InClusterConfig()
	if err != nil {
		// 2. Fallback to Out-of-Cluster kubeconfig
		if kubeconfigPath == "" {
			if home := os.Getenv("HOME"); home != "" {
				kubeconfigPath = filepath.Join(home, ".kube", "config")
			}
		}
		if envKubeconfig := os.Getenv("KUBECONFIG"); envKubeconfig != "" {
			kubeconfigPath = envKubeconfig
		}

		config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
		if err != nil {
			return nil, fmt.Errorf("failed to build kubeconfig (in-cluster or local): %w", err)
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	k8sVer := "v1.30.0"
	if serverVer, err := clientset.Discovery().ServerVersion(); err == nil && serverVer != nil {
		k8sVer = serverVer.GitVersion
	}

	log.Printf("[SkyOps K8s Collector] Initialized client-go for cluster '%s' (K8s version: %s)", clusterName, k8sVer)

	return &RealK8sCollector{
		ClusterName: clusterName,
		Clientset:   clientset,
		ServerVer:   k8sVer,
	}, nil
}

func (r *RealK8sCollector) Collect(ctx context.Context) (*Observation, error) {
	now := time.Now().UTC()

	var nodesHealth []models.NodeHealth
	var workloadsHealth []models.WorkloadHealth
	var k8sEvents []*models.K8sEvent
	var detectedIncidents []*models.Incident

	namespacesMap := make(map[string]bool)

	// 1. Collect Nodes
	nodeList, err := r.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Printf("[Collector Warning] Failed to list nodes: %v", err)
	} else {
		for _, n := range nodeList.Items {
			ready := false
			memPress := false
			diskPress := false
			pidPress := false

			for _, cond := range n.Status.Conditions {
				switch cond.Type {
				case corev1.NodeReady:
					if cond.Status == corev1.ConditionTrue {
						ready = true
					}
				case corev1.NodeMemoryPressure:
					if cond.Status == corev1.ConditionTrue {
						memPress = true
					}
				case corev1.NodeDiskPressure:
					if cond.Status == corev1.ConditionTrue {
						diskPress = true
					}
				case corev1.NodePIDPressure:
					if cond.Status == corev1.ConditionTrue {
						pidPress = true
					}
				}
			}

			statusStr := "Ready"
			if !ready {
				statusStr = "NotReady"
				detectedIncidents = append(detectedIncidents, &models.Incident{
					ID:            fmt.Sprintf("INC-NODE-%s-%d", n.Name, now.Unix()),
					Title:         fmt.Sprintf("Node %s is NotReady", n.Name),
					Status:        models.StatusOpen,
					Severity:      models.SeverityCritical,
					Category:      "NodeNotReady",
					ClusterName:   r.ClusterName,
					ResourceType:  "Node",
					ResourceName:  n.Name,
					Occurrences:   1,
					Summary:       fmt.Sprintf("Kubernetes Node %s entered NotReady status.", n.Name),
					Impact:        "Potential workload eviction or scheduling failures on affected node.",
					RootCause:     "Node kubelet heartbeat lost or container runtime failure.",
					Evidence:      []string{fmt.Sprintf("Node condition Ready = False for node %s", n.Name)},
					FirstDetected: now,
					LastDetected:  now,
					CreatedAt:     now,
					UpdatedAt:     now,
				})
			}

			if memPress {
				detectedIncidents = append(detectedIncidents, &models.Incident{
					ID:           fmt.Sprintf("INC-NODEMEM-%s-%d", n.Name, now.Unix()),
					Title:        fmt.Sprintf("NodeMemoryPressure on %s", n.Name),
					Status:       models.StatusOpen,
					Severity:     models.SeverityHigh,
					Category:     "NodeMemoryPressure",
					ClusterName:  r.ClusterName,
					ResourceType: "Node",
					ResourceName: n.Name,
					Summary:      fmt.Sprintf("Node %s is under memory pressure.", n.Name),
					Evidence:     []string{fmt.Sprintf("MemoryPressure condition active on node %s", n.Name)},
					FirstDetected: now,
					LastDetected:  now,
					CreatedAt:     now,
					UpdatedAt:     now,
				})
			}

			if diskPress {
				detectedIncidents = append(detectedIncidents, &models.Incident{
					ID:           fmt.Sprintf("INC-NODEDISK-%s-%d", n.Name, now.Unix()),
					Title:        fmt.Sprintf("NodeDiskPressure on %s", n.Name),
					Status:       models.StatusOpen,
					Severity:     models.SeverityHigh,
					Category:     "NodeDiskPressure",
					ClusterName:  r.ClusterName,
					ResourceType: "Node",
					ResourceName: n.Name,
					Summary:      fmt.Sprintf("Node %s is under disk pressure.", n.Name),
					Evidence:     []string{fmt.Sprintf("DiskPressure condition active on node %s", n.Name)},
					FirstDetected: now,
					LastDetected:  now,
					CreatedAt:     now,
					UpdatedAt:     now,
				})
			}

			nodesHealth = append(nodesHealth, models.NodeHealth{
				ID:             fmt.Sprintf("node-%s", n.Name),
				ClusterName:    r.ClusterName,
				Name:           n.Name,
				Status:         statusStr,
				K8sVersion:     n.Status.NodeInfo.KubeletVersion,
				CPUAllocatable: n.Status.Allocatable.Cpu().String(),
				MemAllocatable: n.Status.Allocatable.Memory().String(),
				MemoryPressure: memPress,
				DiskPressure:   diskPress,
				PIDPressure:    pidPress,
				UpdatedAt:      now,
			})
		}
	}

	// 2. Collect Pods & detect Pod failure categories
	podList, err := r.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	totalPods := 0
	if err != nil {
		log.Printf("[Collector Warning] Failed to list pods: %v", err)
	} else {
		totalPods = len(podList.Items)
		for _, pod := range podList.Items {
			namespacesMap[pod.Namespace] = true

			// Inspect container status & restart counts
			for _, cs := range pod.Status.ContainerStatuses {
				// Check restart count
				if cs.RestartCount > 5 {
					detectedIncidents = append(detectedIncidents, &models.Incident{
						ID:            fmt.Sprintf("INC-RESTART-%s-%s-%d", pod.Namespace, pod.Name, now.Unix()),
						Title:         fmt.Sprintf("High Container Restarts on %s/%s", pod.Namespace, pod.Name),
						Status:        models.StatusOpen,
						Severity:      models.SeverityHigh,
						Category:      "ContainerRestart",
						ClusterName:   r.ClusterName,
						Namespace:     pod.Namespace,
						ResourceType:  "Pod",
						ResourceName:  pod.Name,
						PodName:       pod.Name,
						ContainerName: cs.Name,
						Occurrences:   int(cs.RestartCount),
						Summary:       fmt.Sprintf("Container %s in pod %s has restarted %d times.", cs.Name, pod.Name, cs.RestartCount),
						Evidence:      []string{fmt.Sprintf("Container %s restart count = %d", cs.Name, cs.RestartCount)},
						FirstDetected: now,
						LastDetected:  now,
						CreatedAt:     now,
						UpdatedAt:     now,
					})
				}

				// Check Waiting reason (CrashLoopBackOff, ImagePullBackOff, ErrImagePull)
				if cs.State.Waiting != nil {
					reason := cs.State.Waiting.Reason
					if reason == "CrashLoopBackOff" || reason == "ImagePullBackOff" || reason == "ErrImagePull" {
						sev := models.SeverityHigh
						if reason == "CrashLoopBackOff" {
							sev = models.SeverityCritical
						}
						detectedIncidents = append(detectedIncidents, &models.Incident{
							ID:            fmt.Sprintf("INC-%s-%s-%s-%d", strings.ToUpper(reason), pod.Namespace, pod.Name, now.Unix()),
							Title:         fmt.Sprintf("%s on %s/%s", reason, pod.Namespace, pod.Name),
							Status:        models.StatusOpen,
							Severity:      sev,
							Category:      reason,
							ClusterName:   r.ClusterName,
							Namespace:     pod.Namespace,
							ResourceType:  "Pod",
							ResourceName:  pod.Name,
							PodName:       pod.Name,
							ContainerName: cs.Name,
							Occurrences:   int(cs.RestartCount) + 1,
							Summary:       fmt.Sprintf("Container %s in pod %s/%s entered %s state.", cs.Name, pod.Namespace, pod.Name, reason),
							Evidence:      []string{cs.State.Waiting.Message, fmt.Sprintf("State: Waiting, Reason: %s", reason)},
							FirstDetected: now,
							LastDetected:  now,
							CreatedAt:     now,
							UpdatedAt:     now,
						})
					}
				}

				// Check Terminated reason (OOMKilled)
				if cs.State.Terminated != nil {
					if cs.State.Terminated.Reason == "OOMKilled" || cs.State.Terminated.ExitCode == 137 {
						detectedIncidents = append(detectedIncidents, &models.Incident{
							ID:            fmt.Sprintf("INC-OOM-%s-%s-%d", pod.Namespace, pod.Name, now.Unix()),
							Title:         fmt.Sprintf("OOMKilled on %s/%s", pod.Namespace, pod.Name),
							Status:        models.StatusOpen,
							Severity:      models.SeverityCritical,
							Category:      "OOMKilled",
							ClusterName:   r.ClusterName,
							Namespace:     pod.Namespace,
							ResourceType:  "Pod",
							ResourceName:  pod.Name,
							PodName:       pod.Name,
							ContainerName: cs.Name,
							Occurrences:   int(cs.RestartCount),
							Summary:       fmt.Sprintf("Container %s in pod %s was terminated by OOMKiller (Exit code 137).", cs.Name, pod.Name),
							Evidence:      []string{fmt.Sprintf("ExitCode: %d, Reason: OOMKilled", cs.State.Terminated.ExitCode)},
							FirstDetected: now,
							LastDetected:  now,
							CreatedAt:     now,
							UpdatedAt:     now,
						})
					}
				}
			}

			// Check Pod Conditions (FailedScheduling, PodNotReady)
			for _, cond := range pod.Status.Conditions {
				if cond.Type == corev1.PodScheduled && cond.Status == corev1.ConditionFalse {
					detectedIncidents = append(detectedIncidents, &models.Incident{
						ID:            fmt.Sprintf("INC-SCHED-%s-%s-%d", pod.Namespace, pod.Name, now.Unix()),
						Title:         fmt.Sprintf("FailedScheduling for %s/%s", pod.Namespace, pod.Name),
						Status:        models.StatusOpen,
						Severity:      models.SeverityHigh,
						Category:      "FailedScheduling",
						ClusterName:   r.ClusterName,
						Namespace:     pod.Namespace,
						ResourceType:  "Pod",
						ResourceName:  pod.Name,
						PodName:       pod.Name,
						Summary:       fmt.Sprintf("Pod %s/%s cannot be scheduled onto any node.", pod.Namespace, pod.Name),
						Evidence:      []string{cond.Message, fmt.Sprintf("Reason: %s", cond.Reason)},
						FirstDetected: now,
						LastDetected:  now,
						CreatedAt:     now,
						UpdatedAt:     now,
					})
				}
			}
		}
	}

	// 3. Collect Deployments & check Rollout Failures
	deployList, err := r.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, dep := range deployList.Items {
			namespacesMap[dep.Namespace] = true
			desired := int(*dep.Spec.Replicas)
			ready := int(dep.Status.ReadyReplicas)
			avail := int(dep.Status.AvailableReplicas)

			st := "HEALTHY"
			if ready < desired {
				st = "DEGRADED"
			}
			if ready == 0 && desired > 0 {
				st = "FAILED"
				detectedIncidents = append(detectedIncidents, &models.Incident{
					ID:            fmt.Sprintf("INC-ROLLOUT-%s-%s-%d", dep.Namespace, dep.Name, now.Unix()),
					Title:         fmt.Sprintf("DeploymentRolloutFailure on %s/%s", dep.Namespace, dep.Name),
					Status:        models.StatusOpen,
					Severity:      models.SeverityCritical,
					Category:      "DeploymentRolloutFailure",
					ClusterName:   r.ClusterName,
					Namespace:     dep.Namespace,
					ResourceType:  "Deployment",
					ResourceName:  dep.Name,
					Summary:       fmt.Sprintf("Deployment %s/%s has 0 ready replicas out of %d desired.", dep.Namespace, dep.Name, desired),
					Evidence:      []string{fmt.Sprintf("Ready: %d / Desired: %d", ready, desired)},
					FirstDetected: now,
					LastDetected:  now,
					CreatedAt:     now,
					UpdatedAt:     now,
				})
			}

			workloadsHealth = append(workloadsHealth, models.WorkloadHealth{
				ID:          fmt.Sprintf("deploy-%s-%s", dep.Namespace, dep.Name),
				ClusterName: r.ClusterName,
				Namespace:   dep.Namespace,
				Name:        dep.Name,
				Kind:        "Deployment",
				Desired:     desired,
				Ready:       ready,
				Available:   avail,
				Status:      st,
				UpdatedAt:   now,
			})
		}
	}

	// 4. Collect StatefulSets
	stsList, err := r.Clientset.AppsV1().StatefulSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, sts := range stsList.Items {
			namespacesMap[sts.Namespace] = true
			desired := int(*sts.Spec.Replicas)
			ready := int(sts.Status.ReadyReplicas)

			st := "HEALTHY"
			if ready < desired {
				st = "DEGRADED"
			}

			workloadsHealth = append(workloadsHealth, models.WorkloadHealth{
				ID:          fmt.Sprintf("sts-%s-%s", sts.Namespace, sts.Name),
				ClusterName: r.ClusterName,
				Namespace:   sts.Namespace,
				Name:        sts.Name,
				Kind:        "StatefulSet",
				Desired:     desired,
				Ready:       ready,
				Available:   ready,
				Status:      st,
				UpdatedAt:   now,
			})
		}
	}

	// 5. Collect DaemonSets
	dsList, err := r.Clientset.AppsV1().DaemonSets("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, ds := range dsList.Items {
			namespacesMap[ds.Namespace] = true
			desired := int(ds.Status.DesiredNumberScheduled)
			ready := int(ds.Status.NumberReady)

			st := "HEALTHY"
			if ready < desired {
				st = "DEGRADED"
			}

			workloadsHealth = append(workloadsHealth, models.WorkloadHealth{
				ID:          fmt.Sprintf("ds-%s-%s", ds.Namespace, ds.Name),
				ClusterName: r.ClusterName,
				Namespace:   ds.Namespace,
				Name:        ds.Name,
				Kind:        "DaemonSet",
				Desired:     desired,
				Ready:       ready,
				Available:   ready,
				Status:      st,
				UpdatedAt:   now,
			})
		}
	}

	// 6. Collect Jobs & detect JobFailure
	jobList, err := r.Clientset.BatchV1().Jobs("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for _, job := range jobList.Items {
			namespacesMap[job.Namespace] = true
			if job.Status.Failed > 0 {
				detectedIncidents = append(detectedIncidents, &models.Incident{
					ID:            fmt.Sprintf("INC-JOBFAIL-%s-%s-%d", job.Namespace, job.Name, now.Unix()),
					Title:         fmt.Sprintf("JobFailure on %s/%s", job.Namespace, job.Name),
					Status:        models.StatusOpen,
					Severity:      models.SeverityHigh,
					Category:      "JobFailure",
					ClusterName:   r.ClusterName,
					Namespace:     job.Namespace,
					ResourceType:  "Job",
					ResourceName:  job.Name,
					Summary:       fmt.Sprintf("Kubernetes Job %s/%s failed execution.", job.Namespace, job.Name),
					Evidence:      []string{fmt.Sprintf("Failed executions: %d", job.Status.Failed)},
					FirstDetected: now,
					LastDetected:  now,
					CreatedAt:     now,
					UpdatedAt:     now,
				})
			}
		}
	}

	// 7. Collect K8s Events
	eventsList, err := r.Clientset.CoreV1().Events("").List(ctx, metav1.ListOptions{Limit: 50})
	if err == nil {
		for _, evt := range eventsList.Items {
			k8sEvents = append(k8sEvents, &models.K8sEvent{
				ID:            fmt.Sprintf("evt-%s-%d", evt.UID, evt.LastTimestamp.Unix()),
				ClusterName:   r.ClusterName,
				Namespace:     evt.Namespace,
				Resource:      fmt.Sprintf("%s/%s", evt.InvolvedObject.Kind, evt.InvolvedObject.Name),
				Kind:          evt.InvolvedObject.Kind,
				Type:          evt.Type,
				Reason:        evt.Reason,
				Message:       evt.Message,
				Count:         int(evt.Count),
				FirstObserved: evt.FirstTimestamp.Time.UTC(),
				LastObserved:  evt.LastTimestamp.Time.UTC(),
			})
		}
	}

	return &Observation{
		ClusterName:    r.ClusterName,
		AgentVersion:   "v1.0.0",
		K8sVersion:     r.ServerVer,
		NodeCount:      len(nodesHealth),
		PodCount:       totalPods,
		NamespaceCount: len(namespacesMap),
		CPUUsageCores:  1.5,
		MemoryBytes:    4294967296,
		Nodes:          nodesHealth,
		Workloads:      workloadsHealth,
		Events:         k8sEvents,
		Incidents:      detectedIncidents,
	}, nil
}
