package collectors

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestRealK8sCollectorWithFakeClient(t *testing.T) {
	fakeClientset := fake.NewSimpleClientset(
		&corev1.Node{
			ObjectMeta: metav1.ObjectMeta{Name: "node-1"},
			Status: corev1.NodeStatus{
				Conditions: []corev1.NodeCondition{
					{Type: corev1.NodeReady, Status: corev1.ConditionTrue},
				},
				NodeInfo: corev1.NodeSystemInfo{KubeletVersion: "v1.30.0"},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{Name: "crash-pod", Namespace: "default"},
			Status: corev1.PodStatus{
				ContainerStatuses: []corev1.ContainerStatus{
					{
						Name:         "app",
						RestartCount: 12,
						State: corev1.ContainerState{
							Waiting: &corev1.ContainerStateWaiting{Reason: "CrashLoopBackOff", Message: "back-off 5m"},
						},
					},
				},
			},
		},
	)

	collector := &RealK8sCollector{
		ClusterName: "test-cluster",
		Clientset:   fakeClientset,
		ServerVer:   "v1.30.0",
	}

	obs, err := collector.Collect(context.Background())
	if err != nil {
		t.Fatalf("Unexpected error collecting: %v", err)
	}

	if obs.NodeCount != 1 {
		t.Fatalf("Expected 1 node, got %d", obs.NodeCount)
	}

	if obs.PodCount != 1 {
		t.Fatalf("Expected 1 pod, got %d", obs.PodCount)
	}

	if len(obs.Incidents) == 0 {
		t.Fatalf("Expected at least 1 incident detected for CrashLoopBackOff pod")
	}

	foundCrashLoop := false
	for _, inc := range obs.Incidents {
		if inc.Category == "CrashLoopBackOff" {
			foundCrashLoop = true
			break
		}
	}

	if !foundCrashLoop {
		t.Fatalf("Expected CrashLoopBackOff incident category to be detected")
	}
}
