package main

import (
	"flag"
	"log"
	"os"
	"time"

	"github.com/skyops/skyops/agent/internal/buffer"
	"github.com/skyops/skyops/agent/internal/collectors"
	"github.com/skyops/skyops/agent/internal/transport"
)

func main() {
	serverURL := flag.String("server-url", os.Getenv("SKYOPS_SERVER_URL"), "SkyOps Cloud API URL")
	token := flag.String("token", os.Getenv("SKYOPS_REGISTRATION_TOKEN"), "Registration Token")
	clusterName := flag.String("cluster-name", os.Getenv("SKYOPS_CLUSTER_NAME"), "Kubernetes Cluster Name")
	flag.Parse()

	if *serverURL == "" {
		*serverURL = "http://localhost:3000"
	}

	if *clusterName == "" {
		*clusterName = "production-k8s"
	}

	log.Printf("[SkyOps Agent] Starting agent for cluster: %s (Server: %s)", *clusterName, *serverURL)

	eventBuffer := buffer.NewBoundedBuffer(1000)
	collector := collectors.NewSyntheticCollector(*clusterName)
	client := transport.NewClient(*serverURL, "", "", "")

	// Registration step if token provided
	if *token != "" {
		log.Printf("[SkyOps Agent] Registering with token: %s...", *token)
		regResp, err := client.Register(*token, *clusterName)
		if err != nil {
			log.Printf("[SkyOps Agent Warning] Registration failed: %v. Will retry during heartbeat loop.", err)
		} else {
			log.Printf("[SkyOps Agent] Successfully registered! Assigned Cluster ID: %s", regResp.ClusterID)
		}
	}

	backoff := buffer.NewBackoff(2*time.Second, 30*time.Second)

	// Heartbeat & Telemetry Loop
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		obs, err := collector.Collect()
		if err != nil {
			log.Printf("[SkyOps Agent] Error collecting cluster telemetry: %v", err)
			continue
		}

		err = client.SendHeartbeat(obs)
		if err != nil {
			nextWait := backoff.Next()
			log.Printf("[SkyOps Agent] Heartbeat failed (%v). Buffering events locally (buffer size: %d, dropped: %d). Retrying in %v...",
				err, eventBuffer.Size(), eventBuffer.DroppedCount(), nextWait)
		} else {
			backoff.Reset()
			log.Printf("[SkyOps Agent] Heartbeat sent successfully (Nodes: %d, Pods: %d, CPU: %.2f cores)",
				obs.NodeCount, obs.PodCount, obs.CPUUsageCores)
		}
	}
}
