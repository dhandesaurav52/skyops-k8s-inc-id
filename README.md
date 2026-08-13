# SkyOps Kubernetes Agent Installation & Architecture Guide

SkyOps is a cloud-native Kubernetes incident detection, correlation, and automated root cause analysis platform.

The **SkyOps Agent** (`skyops-agent`) is a lightweight, read-only Go daemon installed in customer Kubernetes clusters. It gathers real-time telemetry via `client-go` and streams alerts and metrics outbound over HTTPS to the SkyOps Control Plane.

---

## 🚀 Primary Installation Experience (One-Line Installer)

Customers install the agent using a single shell command without needing Helm repositories or Docker on their machine.

```bash
curl -fsSL https://install.skyops.io/agent.sh | SKYOPS_TOKEN="<TOKEN>" SKYOPS_CLUSTER="<CLUSTER>" bash
```

> **Note**: For local or development testing, you can execute the repository-hosted installer:
> ```bash
> ./install.sh
> # OR
> curl -fsSL http://localhost:3000/install.sh | SKYOPS_TOKEN="skyops_reg_sample" SKYOPS_CLUSTER="production-us-east" bash
> ```

---

## 🛠️ What the Installer Does

1. **Environment Verification**: Validates that `kubectl` is installed and connected to an active Kubernetes cluster context. Displays the target cluster name before applying changes.
2. **Credential Validation**: Ensures `SKYOPS_TOKEN` and `SKYOPS_CLUSTER` environment variables are supplied.
3. **Namespace Isolation**: Reconciles the dedicated `skyops-system` namespace.
4. **Minimal RBAC**: Applies a minimal, read-only `ClusterRole` and `ClusterRoleBinding` granting `get`, `list`, and `watch` permissions on workloads, pods, nodes, and events. **No write or delete permissions on customer workloads are ever granted.**
5. **Secret Creation**: Stores the registration token in Kubernetes Secret `skyops-agent-secret`.
6. **Agent Deployment**: Deploys a single replica of the Go SkyOps Agent using official multi-architecture Docker images (`linux/amd64` and `linux/arm64`).
7. **Rollout Verification**: Waits for the deployment to reach Ready state (`kubectl rollout status`) and verifies health probes (`/health`, `/ready`, and Prometheus `/metrics` on port `8081`).
8. **Idempotency**: Running the installer multiple times safely reconciles existing manifests without creating duplicate resources or downtime.

---

## 📋 Direct Manifest Installation (`kubectl apply`)

If your security policy prohibits pipe-to-bash installers, you can apply the manifests directly from the repository:

### Option A: Combined Installation Manifest

```bash
# 1. Create secret with registration token
kubectl create namespace skyops-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic skyops-agent-secret \
  --namespace skyops-system \
  --from-literal=registration_token="<YOUR_SKYOPS_TOKEN>"

# 2. Apply complete agent manifest
kubectl apply -f deploy/install/agent.yaml
```

### Option B: Modular Manifests

```bash
kubectl apply -f deploy/install/namespace.yaml
kubectl apply -f deploy/install/rbac.yaml
kubectl apply -f deploy/install/secret.yaml
kubectl apply -f deploy/install/deployment.yaml
```

---

## 🔒 Security & Architecture Guarantees

- **Zero Cloud Infrastructure in Customer Cluster**: SkyOps installs **NO databases (PostgreSQL/Firebase), web APIs, or frontend components** inside your Kubernetes cluster.
- **Outbound-Only Communication**: The agent initiates all connections to SkyOps SaaS over standard HTTPS. No ingress ports are required or opened.
- **Read-Only Telemetry**: The agent RBAC role is strictly scoped to observe cluster state (Pod restarts, OOMKilled events, CrashLoopBackOff states, Node pressure, and Deployment rollout failures).
- **Non-Privileged Runtime**: Runs as non-root user `10001:10001` with minimal CPU (50m) and memory (64Mi) resource requests.

---

## 📦 Helm Chart Installation (Alternative)

For GitOps workflows (ArgoCD, Flux) or organizations standardizing on Helm:

```bash
helm upgrade --install skyops-agent deploy/helm/skyops-agent \
  --namespace skyops-system \
  --create-namespace \
  --set server.url="https://api.skyops.io" \
  --set cluster.name="production-us-east" \
  --set agent.token="<YOUR_SKYOPS_TOKEN>"
```

---

## 🧹 Uninstallation

To remove the SkyOps Agent and all associated RBAC rules cleanly:

```bash
kubectl delete namespace skyops-system
kubectl delete clusterrole skyops-agent-role
kubectl delete clusterrolebinding skyops-agent-binding
```
