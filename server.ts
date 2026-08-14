import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { getRepository } from './server/db';
import { bootstrapManager } from './server/auth/bootstrap';
import { authRouter } from './server/api/auth';
import { usersRouter } from './server/api/users';
import { organizationsRouter } from './server/api/organizations';
import { licenseRouter } from './server/api/license';
import { systemRouter } from './server/api/system';
import { setupRouter } from './server/api/setup';
import { bootstrapRouter } from './server/api/bootstrap';
import { clustersRouter } from './server/api/clusters';
import { agentRouter } from './server/api/agent';
import { incidentsRouter } from './server/api/incidents';
import { ticketsRouter } from './server/api/tickets';
import { telemetryRouter } from './server/api/telemetry';
import { observabilityRouter, trackRequest } from './server/api/observability';
import { getDeploymentMode, isDataTelemetryEnabled } from './server/telemetry/privacy';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database Repository on startup
  console.log('[SkyOps Platform] Initializing SkyOps Control Plane...');
  const repo = await getRepository();
  const dbHealth = await repo.healthCheck();
  console.log(`[SkyOps Platform] Database Engine: ${dbHealth.type} (${dbHealth.healthy ? 'READY' : 'DEGRADED'})`);
  console.log(`[SkyOps Platform] Deployment Mode: ${getDeploymentMode().toUpperCase()} (Data Telemetry: ${isDataTelemetryEnabled() ? 'ENABLED' : 'STRICT_LOCAL'})`);

  // Initialize Bootstrap Credential Lifecycle
  await bootstrapManager.initializeOnStartup(repo);

  // Basic Middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request tracker middleware for observability
  app.use((req, res, next) => {
    trackRequest(false);
    next();
  });

  // Health, Readiness & Prometheus Metrics (Unauthenticated for K8s probes & Prometheus scrapers)
  app.use('/', observabilityRouter);

  // Dynamic Agent Installer Script Endpoints
  const serveAgentScript = (req: express.Request, res: express.Response) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const script = `#!/bin/bash
# ==============================================================================
# SkyOps Kubernetes Agent Bootstrap Script
# ==============================================================================
set -euo pipefail

SKYOPS_SERVER_URL="\${SKYOPS_SERVER_URL:-${origin}}"
SKYOPS_TOKEN="\${SKYOPS_TOKEN:-}"
SKYOPS_CLUSTER="\${SKYOPS_CLUSTER:-production}"

if [ -z "\${SKYOPS_TOKEN}" ]; then
  echo "ERROR: SKYOPS_TOKEN environment variable is required."
  echo "Example: curl -fsSL ${origin}/agent.sh | SKYOPS_TOKEN=\"<token>\" SKYOPS_CLUSTER=\"<cluster_name>\" bash"
  exit 1
fi

echo "================================================================================"
echo " Connecting cluster '\${SKYOPS_CLUSTER}' to SkyOps Control Plane"
echo " Target Control Plane: \${SKYOPS_SERVER_URL}"
echo "================================================================================"

if ! command -v kubectl &> /dev/null; then
  echo "ERROR: kubectl is not installed or not in PATH."
  exit 1
fi

echo "[1/3] Setting up skyops namespace and RBAC permissions..."
kubectl create namespace skyops --dry-run=client -o yaml | kubectl apply -f -

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: skyops-agent-sa
  namespace: skyops
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: skyops-agent-role
rules:
  - apiGroups: [""]
    resources: ["events", "pods", "nodes", "namespaces", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "daemonsets", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: skyops-agent-rolebinding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: skyops-agent-role
subjects:
  - kind: ServiceAccount
    name: skyops-agent-sa
    namespace: skyops
EOF

echo "[2/3] Configuring agent registration credentials..."
kubectl create secret generic skyops-agent-secret \
  --namespace skyops \
  --from-literal=SKYOPS_SERVER_URL="\${SKYOPS_SERVER_URL}" \
  --from-literal=SKYOPS_REGISTRATION_TOKEN="\${SKYOPS_TOKEN}" \
  --from-literal=SKYOPS_CLUSTER_NAME="\${SKYOPS_CLUSTER}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "[3/3] Deploying SkyOps Agent Daemon..."
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skyops-agent
  namespace: skyops
  labels:
    app: skyops-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: skyops-agent
  template:
    metadata:
      labels:
        app: skyops-agent
    spec:
      serviceAccountName: skyops-agent-sa
      containers:
        - name: agent
          image: ghcr.io/skyops/agent:latest
          imagePullPolicy: IfNotPresent
          env:
            - name: SKYOPS_SERVER_URL
              valueFrom:
                secretKeyRef:
                  name: skyops-agent-secret
                  key: SKYOPS_SERVER_URL
            - name: SKYOPS_REGISTRATION_TOKEN
              valueFrom:
                secretKeyRef:
                  name: skyops-agent-secret
                  key: SKYOPS_REGISTRATION_TOKEN
            - name: SKYOPS_CLUSTER_NAME
              valueFrom:
                secretKeyRef:
                  name: skyops-agent-secret
                  key: SKYOPS_CLUSTER_NAME
          resources:
            limits:
              cpu: 200m
              memory: 256Mi
            requests:
              cpu: 50m
              memory: 64Mi
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
EOF

echo ""
echo "SUCCESS: SkyOps Agent installed in namespace 'skyops'."
echo "Live telemetry stream will be available in the SkyOps Console in ~10 seconds."
`;
    res.setHeader('Content-Type', 'text/x-sh');
    return res.send(script);
  };

  app.get('/agent.sh', serveAgentScript);
  app.get('/install.sh', serveAgentScript);

  // Mount API Routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/organizations', organizationsRouter);
  app.use('/api/v1/license', licenseRouter);
  app.use('/api/v1/system', systemRouter);
  app.use('/api/v1/setup', setupRouter);
  app.use('/api/v1/bootstrap', bootstrapRouter);
  app.use('/api/v1/clusters', clustersRouter);
  app.use('/api/v1/agent', agentRouter);
  app.use('/api/v1/incidents', incidentsRouter);
  app.use('/api/v1/tickets', ticketsRouter);
  app.use('/api/v1', telemetryRouter);

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[SkyOps Server Error]', err);
    res.status(err.status || 500).json({
      error: 'InternalServerError',
      message: err.message || 'An unexpected error occurred on the server',
    });
  });

  // Vite Middleware in development or Static SPA serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SkyOps Platform] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SkyOps Fatal Error] Failed to start SkyOps server:', err);
  process.exit(1);
});
