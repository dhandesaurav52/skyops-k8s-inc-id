#!/usr/bin/env bash
set -e

# SkyOps Kubernetes Agent One-Line Installer
# Primary installation method for SkyOps agent telemetry collector.
#
# Usage:
#   curl -fsSL https://install.skyops.io/agent.sh | SKYOPS_TOKEN="<TOKEN>" SKYOPS_CLUSTER="<CLUSTER>" bash

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

echo -e "${BOLD}${CYAN}====================================================${RESET}"
echo -e "${BOLD}${CYAN}   SkyOps Kubernetes Agent One-Line Installer       ${RESET}"
echo -e "${BOLD}${CYAN}====================================================${RESET}\n"

# 1. Verify kubectl exists
if ! command -v kubectl &> /dev/null; then
  echo -e "${RED}[Error] 'kubectl' command line tool was not found in PATH.${RESET}"
  echo -e "Please install kubectl and configure cluster access before running this installer."
  exit 1
fi

# 2. Verify current Kubernetes context and cluster info
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || true)
if [ -z "$CURRENT_CONTEXT" ]; then
  echo -e "${RED}[Error] No active Kubernetes context found in kubeconfig.${RESET}"
  echo -e "Please ensure your kubeconfig is configured and points to a target cluster."
  exit 1
fi

CURRENT_CLUSTER=$(kubectl config view -o jsonpath="{.contexts[?(@.name==\"$CURRENT_CONTEXT\")].context.cluster}" 2>/dev/null || echo "$CURRENT_CONTEXT")

echo -e "${BOLD}Target Kubernetes Context:${RESET} ${GREEN}${CURRENT_CONTEXT}${RESET}"
echo -e "${BOLD}Target Kubernetes Cluster:${RESET} ${GREEN}${CURRENT_CLUSTER}${RESET}\n"

if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}[Error] Unable to communicate with target Kubernetes cluster.${RESET}"
  echo -e "Please verify your network connectivity and cluster administrator access."
  exit 1
fi

# 3. Require SKYOPS_TOKEN and SKYOPS_CLUSTER
TOKEN="${SKYOPS_TOKEN:-$SKYOPS_REGISTRATION_TOKEN}"
CLUSTER="${SKYOPS_CLUSTER:-$SKYOPS_CLUSTER_NAME}"
SERVER_URL="${SKYOPS_SERVER_URL:-https://api.skyops.io}"
AGENT_IMAGE="${SKYOPS_AGENT_IMAGE:-dhandesaurav52/skyops-agent:1.0.0}"

if [ -z "$TOKEN" ]; then
  echo -e "${RED}[Error] SKYOPS_TOKEN environment variable is required.${RESET}"
  echo -e "Provide it when executing the installer:"
  echo -e "  ${YELLOW}curl -fsSL https://install.skyops.io/agent.sh | SKYOPS_TOKEN=\"<TOKEN>\" SKYOPS_CLUSTER=\"<CLUSTER>\" bash${RESET}"
  exit 1
fi

if [ -z "$CLUSTER" ]; then
  echo -e "${RED}[Error] SKYOPS_CLUSTER environment variable is required.${RESET}"
  echo -e "Provide it when executing the installer:"
  echo -e "  ${YELLOW}curl -fsSL https://install.skyops.io/agent.sh | SKYOPS_TOKEN=\"<TOKEN>\" SKYOPS_CLUSTER=\"<CLUSTER>\" bash${RESET}"
  exit 1
fi

echo -e "Deploying SkyOps Agent for cluster '${BOLD}${CLUSTER}${RESET}'..."

# 4. Create Namespace (Idempotent)
echo -e "\n${CYAN}[1/6] Reconciling namespace 'skyops-system'...${RESET}"
kubectl create namespace skyops-system --dry-run=client -o yaml | kubectl apply -f -

# 5. Create ServiceAccount, ClusterRole, and ClusterRoleBinding (Idempotent, minimal read-only permissions)
echo -e "${CYAN}[2/6] Applying minimal read-only RBAC rules...${RESET}"
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: skyops-agent-sa
  namespace: skyops-system
  labels:
    app.kubernetes.io/name: skyops-agent
    app.kubernetes.io/part-of: skyops
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: skyops-agent-role
  labels:
    app.kubernetes.io/name: skyops-agent
    app.kubernetes.io/part-of: skyops
rules:
  - apiGroups: [""]
    resources:
      - pods
      - pods/log
      - pods/status
      - nodes
      - nodes/status
      - events
      - namespaces
      - services
      - configmaps
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources:
      - deployments
      - daemonsets
      - statefulsets
      - replicasets
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources:
      - jobs
      - cronjobs
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: skyops-agent-binding
  labels:
    app.kubernetes.io/name: skyops-agent
    app.kubernetes.io/part-of: skyops
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: skyops-agent-role
subjects:
  - kind: ServiceAccount
    name: skyops-agent-sa
    namespace: skyops-system
EOF

# 6. Create Secret containing registration token (Idempotent)
echo -e "${CYAN}[3/6] Applying secret 'skyops-agent-secret'...${RESET}"
kubectl create secret generic skyops-agent-secret \
  --namespace skyops-system \
  --from-literal=registration_token="$TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -

# 7. Create Deployment (Idempotent)
echo -e "${CYAN}[4/6] Reconciling SkyOps Agent deployment...${RESET}"
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skyops-agent
  namespace: skyops-system
  labels:
    app.kubernetes.io/name: skyops-agent
    app.kubernetes.io/part-of: skyops
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: skyops-agent
  template:
    metadata:
      labels:
        app.kubernetes.io/name: skyops-agent
        app.kubernetes.io/part-of: skyops
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8081"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: skyops-agent-sa
      containers:
        - name: skyops-agent
          image: ${AGENT_IMAGE}
          imagePullPolicy: IfNotPresent
          ports:
            - name: metrics
              containerPort: 8081
              protocol: TCP
          env:
            - name: SKYOPS_SERVER_URL
              value: "${SERVER_URL}"
            - name: SKYOPS_CLUSTER_NAME
              value: "${CLUSTER}"
            - name: SKYOPS_AGENT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: skyops-agent-secret
                  key: registration_token
            - name: SKYOPS_REGISTRATION_TOKEN
              valueFrom:
                secretKeyRef:
                  name: skyops-agent-secret
                  key: registration_token
          livenessProbe:
            httpGet:
              path: /health
              port: 8081
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8081
            initialDelaySeconds: 3
            periodSeconds: 5
          resources:
            limits:
              cpu: 200m
              memory: 256Mi
            requests:
              cpu: 50m
              memory: 64Mi
EOF

# 8. Wait for deployment readiness
echo -e "${CYAN}[5/6] Waiting for deployment rollout in 'skyops-system'...${RESET}"
if kubectl rollout status deployment/skyops-agent -n skyops-system --timeout=60s; then
  echo -e "${GREEN}Deployment rollout succeeded.${RESET}"
else
  echo -e "${YELLOW}[Warning] Rollout timeout reached. Checking pod status...${RESET}"
fi

# 9. Verify agent health & connection
echo -e "${CYAN}[6/6] Verifying SkyOps Agent pod health...${RESET}"
POD_NAME=$(kubectl get pods -n skyops-system -l app.kubernetes.io/name=skyops-agent -o jsonpath="{.items[0].metadata.name}" 2>/dev/null || echo "")

if [ -n "$POD_NAME" ]; then
  POD_STATUS=$(kubectl get pod "$POD_NAME" -n skyops-system -o jsonpath="{.status.phase}" 2>/dev/null || echo "Unknown")
  echo -e "Agent Pod Name:   ${GREEN}${POD_NAME}${RESET}"
  echo -e "Agent Pod Status: ${GREEN}${POD_STATUS}${RESET}"

  if [ "$POD_STATUS" = "Running" ]; then
    echo -e "\n${BOLD}${GREEN}====================================================${RESET}"
    echo -e "${BOLD}${GREEN}   SkyOps Agent Installation Completed Successfully! ${RESET}"
    echo -e "${BOLD}${GREEN}====================================================${RESET}"
    echo -e "Cluster ${BOLD}${CLUSTER}${RESET} is now connected to SkyOps Control Plane."
    echo -e "Real-time Kubernetes telemetry & incident detection is now active.\n"
    exit 0
  fi
fi

echo -e "\n${BOLD}${YELLOW}====================================================${RESET}"
echo -e "${BOLD}${YELLOW}   SkyOps Agent Installation Progress Summary       ${RESET}"
echo -e "${BOLD}${YELLOW}====================================================${RESET}"
echo -e "Agent resources deployed. Pod is initializing. Verify status with:"
echo -e "  ${YELLOW}kubectl get pods -n skyops-system${RESET}"
echo -e "  ${YELLOW}kubectl logs -n skyops-system deployment/skyops-agent${RESET}\n"
