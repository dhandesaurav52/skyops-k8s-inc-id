# SkyOps Installation Guide

SkyOps is designed for instant, zero-friction installation. Normal self-hosted customers and SRE teams are **never required to understand or manually configure cryptographic secrets, database URLs, or signing keys**.

---

## 1. Quick-Start (Single-Line Self-Hosted Installer)

Launch the self-hosted SkyOps control plane with one command:

```bash
curl -fsSL https://get.skyops.io/install.sh | bash
```

*(Or from the repository root: `./install.sh`)*

### What Happens Automatically:
1. **Prerequisite Check**: Detects Docker or Podman on your host.
2. **Directory & Workspace**: Creates an isolated persistent workspace (`~/.skyops`).
3. **Automatic Secret Generation**: 256-bit CSPRNG cryptographic tokens (`JWT_SECRET`, `SESSION_SECRET`, database credentials) are generated and persisted to disk. Secrets survive container restarts and are never printed to logs.
4. **Bundled Storage**: Launches bundled PostgreSQL with automatic health checks and volume persistence.
5. **Control Plane Ready**: Waits for readiness probe (`/ready`) and opens the web application.

---

## 2. First-Run Setup Flow

Once SkyOps starts, open your browser:

👉 **`http://localhost:3000`** (or your server IP)

The First-Run Setup Wizard will guide you through 4 simple steps:

1. **Welcome**: Quick overview of zero-configuration self-hosted features.
2. **Create Administrator**: Enter your Full Name, Email, and Password to create the master account.
3. **Organization Setup**: Enter your organization name and select Community (Free Forever, up to 5 clusters) or Enterprise license.
4. **You're Ready**: Click **Open SkyOps Dashboard**. The setup wizard permanently locks against repetition.

---

## 3. Connecting Your Kubernetes Clusters

1. From the SkyOps Dashboard, click **Connect Cluster**.
2. Enter your cluster name (e.g., `production-us-east`).
3. SkyOps generates a cluster registration token and displays a one-line agent command:

```bash
curl -fsSL http://<YOUR_SKYOPS_HOST>:3000/agent.sh | \
  SKYOPS_SERVER_URL="http://<YOUR_SKYOPS_HOST>:3000" \
  SKYOPS_CLUSTER="production-us-east" \
  SKYOPS_TOKEN="<REGISTRATION_TOKEN>" \
  bash
```

4. Within 10 seconds, your cluster status changes to **CONNECTED** and real-time pods, deployments, incidents, and AI RCA diagnostics become active!

---

## 4. Docker Compose Deployment

For operators running via Docker Compose directly:

```bash
git clone https://github.com/skyops/skyops.git
cd skyops
docker compose up -d
```

---

## 5. Kubernetes Helm Chart Deployment

Deploy SkyOps high-availability control plane into any Kubernetes cluster:

```bash
# Add Helm chart repo
helm repo add skyops https://charts.skyops.io
helm repo update

# Install with automatic secret generation & bundled PostgreSQL
helm install skyops skyops/skyops \
  --namespace skyops-system \
  --create-namespace \
  --set ingress.hosts[0].host=skyops.internal.yourcompany.com
```

---

## 6. Advanced Configuration (Operators Only)

> [!NOTE]
> The parameters below are **optional** and intended solely for enterprise infrastructure operators. Normal users do not need to configure any of these.

### Environment Variable Overrides
| Variable | Description | Default / Behavior |
| :--- | :--- | :--- |
| `DEPLOYMENT_MODE` | `self-hosted` or `cloud` | `self-hosted` |
| `DATA_TELEMETRY_ENABLED` | Operational data telemetry | `false` (Strict local privacy) |
| `DATABASE_URL` | External PostgreSQL connection URL | Auto-configured for bundled DB |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | External PostgreSQL individual credentials | Optional alternative to `DATABASE_URL` |
| `JWT_SECRET` | 256-bit token signing key | Auto-generated via CSPRNG |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Automated headless CI/CD admin creation | Optional (Interactive `/setup` used otherwise) |
| `SKYOPS_DATA_DIR` | Secret and metadata persistence directory | `/app/.data` |

### Using Existing Kubernetes Secrets with Helm
```yaml
secrets:
  existingSecret: "my-custom-preconfigured-secrets"
```
