package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/dhandesaurav52/skyops-k8s-inc-id/agent/internal/buffer"
	"github.com/dhandesaurav52/skyops-k8s-inc-id/agent/internal/collectors"
	"github.com/dhandesaurav52/skyops-k8s-inc-id/agent/internal/transport"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	eventsProcessedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "events_processed_total",
		Help: "Total K8s events processed by agent",
	})
	eventsUploadedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "events_uploaded_total",
		Help: "Total K8s events uploaded to SkyOps Cloud",
	})
	incidentsDetectedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "incidents_detected_total",
		Help: "Total K8s incidents detected by agent",
	})
	uploadErrorsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "upload_errors_total",
		Help: "Total upload errors encountered",
	})
	heartbeatSuccessTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "heartbeat_success_total",
		Help: "Total successful heartbeats",
	})
	heartbeatFailuresTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "heartbeat_failures_total",
		Help: "Total failed heartbeats",
	})
	bufferSizeGauge = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "buffer_size",
		Help: "Current size of offline event buffer",
	})
)

func init() {
	prometheus.MustRegister(
		eventsProcessedTotal,
		eventsUploadedTotal,
		incidentsDetectedTotal,
		uploadErrorsTotal,
		heartbeatSuccessTotal,
		heartbeatFailuresTotal,
		bufferSizeGauge,
	)
}

func main() {
	serverURL := os.Getenv("SKYOPS_SERVER_URL")
	agentToken := os.Getenv("SKYOPS_AGENT_TOKEN")
	if agentToken == "" {
		agentToken = os.Getenv("SKYOPS_REGISTRATION_TOKEN")
	}
	clusterName := os.Getenv("SKYOPS_CLUSTER_NAME")

	flag.StringVar(&serverURL, "server-url", serverURL, "SkyOps Server URL")
	flag.StringVar(&agentToken, "agent-token", agentToken, "SkyOps Agent Registration Token")
	flag.StringVar(&clusterName, "cluster-name", clusterName, "Kubernetes Cluster Name")
	flag.Parse()

	// Configuration Validation (Requirement 3)
	if serverURL == "" {
		log.Fatalf("[SkyOps Agent Fatal] SKYOPS_SERVER_URL environment variable or -server-url flag is required")
	}
	if agentToken == "" {
		log.Fatalf("[SkyOps Agent Fatal] SKYOPS_AGENT_TOKEN environment variable or -agent-token flag is required")
	}
	if clusterName == "" {
		log.Fatalf("[SkyOps Agent Fatal] SKYOPS_CLUSTER_NAME environment variable or -cluster-name flag is required")
	}

	log.Printf("[SkyOps Agent] Starting SkyOps Kubernetes Agent for cluster '%s' (Server: %s)", clusterName, serverURL)

	// Start Health & Metrics HTTP Server (Port 8081)
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "skyops-agent"})
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	})
	mux.Handle("/metrics", promhttp.Handler())

	go func() {
		log.Printf("[SkyOps Agent] Health & Metrics server listening on :8081 (/health, /ready, /metrics)...")
		if err := http.ListenAndServe(":8081", mux); err != nil {
			log.Printf("[SkyOps Agent Warning] Metrics HTTP server exited: %v", err)
		}
	}()

	// Initialize Local Offline Buffer & Backoff
	eventBuffer := buffer.NewBoundedBuffer(2000)
	backoff := buffer.NewBackoff(2*time.Second, 30*time.Second)

	// Initialize Transport Client
	client := transport.NewClient(serverURL, "", "", "")

	// Perform Registration if token provided
	log.Printf("[SkyOps Agent] Performing registration for cluster '%s'...", clusterName)
	regResp, err := client.Register(agentToken, clusterName)
	if err != nil {
		log.Printf("[SkyOps Agent Warning] Initial registration failed (%v). Will retry in loop.", err)
	} else {
		log.Printf("[SkyOps Agent] Registration successful! Cluster ID: %s", regResp.ClusterID)
	}

	// Initialize Real Client-Go K8s Collector
	collector, err := collectors.NewK8sCollector(clusterName, "")
	if err != nil {
		log.Printf("[SkyOps Agent Warning] Failed to initialize client-go collector (%v). Creating fallback collector.", err)
	}

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	ctx := context.Background()

	for range ticker.C {
		bufferSizeGauge.Set(float64(eventBuffer.Size()))

		// 1. Collect Telemetry
		var obs *collectors.Observation
		if collector != nil {
			obs, err = collector.Collect(ctx)
			if err != nil {
				log.Printf("[SkyOps Agent Error] K8s collection error: %v", err)
				continue
			}
		} else {
			// Fallback empty observation
			obs = &collectors.Observation{
				ClusterName:  clusterName,
				AgentVersion: "v1.0.0",
				K8sVersion:   "v1.30.0",
			}
		}

		eventsProcessedTotal.Add(float64(len(obs.Events)))
		incidentsDetectedTotal.Add(float64(len(obs.Incidents)))

		// 2. Buffer events locally
		for _, evt := range obs.Events {
			eventBuffer.Push(evt)
		}

		// 3. Send Heartbeat
		err = client.SendHeartbeat(obs)
		if err != nil {
			heartbeatFailuresTotal.Inc()
			uploadErrorsTotal.Inc()
			nextWait := backoff.Next()
			log.Printf("[SkyOps Agent] Heartbeat failed (%v). Retrying in %v (Buffer size: %d, dropped: %d)",
				err, nextWait, eventBuffer.Size(), eventBuffer.DroppedCount())
		} else {
			heartbeatSuccessTotal.Inc()
			backoff.Reset()
			log.Printf("[SkyOps Agent] Heartbeat OK | Nodes: %d | Pods: %d | Incidents: %d | Events: %d",
				obs.NodeCount, obs.PodCount, len(obs.Incidents), len(obs.Events))
		}

		// 4. Batch Upload Events from Offline Buffer
		bufferedEvents := eventBuffer.Flush()
		if len(bufferedEvents) > 0 {
			if err := client.SendEventsBatch(bufferedEvents); err != nil {
				uploadErrorsTotal.Inc()
				log.Printf("[SkyOps Agent Error] Failed to upload event batch (%d events): %v. Re-queueing into buffer.", len(bufferedEvents), err)
				for _, evt := range bufferedEvents {
					eventBuffer.Push(evt)
				}
			} else {
				eventsUploadedTotal.Add(float64(len(bufferedEvents)))
				log.Printf("[SkyOps Agent] Successfully uploaded batch of %d events to SkyOps Cloud.", len(bufferedEvents))
			}
		}

		// 5. Upload Detected Incidents
		if len(obs.Incidents) > 0 {
			if err := client.SendIncidentsBatch(obs.Incidents); err != nil {
				uploadErrorsTotal.Inc()
				log.Printf("[SkyOps Agent Error] Failed to upload incidents: %v", err)
			}
		}
	}
}
