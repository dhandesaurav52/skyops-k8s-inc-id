import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getRepository } from '../db';
import { requireClusterToken, AuthenticatedRequest, hashToken } from '../auth/middleware';

export const agentRouter = Router();

// POST /api/v1/agent/register
// Single-use registration token exchange for permanent cluster token
agentRouter.post('/register', async (req: Request, res: Response) => {
  const { registration_token, cluster_name, k8s_version, agent_version } = req.body;

  if (!registration_token) {
    return res.status(400).json({ error: 'registration_token is required' });
  }

  try {
    const repo = await getRepository();
    const tokenHash = hashToken(registration_token);

    // Look up cluster by registration token hash
    const cluster = await repo.getClusterByTokenHash(tokenHash);

    if (!cluster || cluster.registration_token_hash !== tokenHash) {
      return res.status(401).json({ error: 'Invalid or expired registration token' });
    }

    const rawClusterToken = `skyops_ctk_${crypto.randomBytes(24).toString('hex')}`;
    const clusterTokenHash = hashToken(rawClusterToken);
    const now = new Date().toISOString();

    const updatedCluster = await repo.updateCluster(cluster.id, {
      cluster_token_hash: clusterTokenHash,
      registration_token_hash: undefined, // Invalidate single-use registration token
      status: 'CONNECTED',
      k8s_version: k8s_version || cluster.k8s_version,
      agent_version: agent_version || cluster.agent_version,
      last_heartbeat: now,
    });

    await repo.createAuditLog({
      organization_id: cluster.organization_id,
      user_email: 'skyops-agent@cluster.local',
      action: 'agent_registered',
      resource: `Cluster/${cluster.id}`,
      details: `SkyOps Agent successfully registered on cluster "${cluster.name}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({
      status: 'ok',
      cluster_token: rawClusterToken,
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      organization_id: cluster.organization_id,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Agent registration exchange failed', details: err.message });
  }
});

// POST /api/v1/agent/heartbeat
agentRouter.post('/heartbeat', requireClusterToken, async (req: AuthenticatedRequest, res: Response) => {
  const { node_count, pod_count, namespace_count, k8s_version, agent_version, cpu_usage_cores, memory_usage_bytes } = req.body;

  try {
    const repo = await getRepository();
    const cluster = req.cluster!;
    const now = new Date().toISOString();

    await repo.updateCluster(cluster.id, {
      status: 'CONNECTED',
      node_count: node_count !== undefined ? Number(node_count) : cluster.node_count,
      pod_count: pod_count !== undefined ? Number(pod_count) : cluster.pod_count,
      namespace_count: namespace_count !== undefined ? Number(namespace_count) : cluster.namespace_count,
      k8s_version: k8s_version || cluster.k8s_version,
      agent_version: agent_version || cluster.agent_version,
      cpu_usage_cores: cpu_usage_cores !== undefined ? Number(cpu_usage_cores) : cluster.cpu_usage_cores,
      memory_usage_bytes: memory_usage_bytes !== undefined ? Number(memory_usage_bytes) : cluster.memory_usage_bytes,
      last_heartbeat: now,
    });

    return res.json({ status: 'ok', timestamp: now });
  } catch (err: any) {
    return res.status(500).json({ error: 'Heartbeat update failed' });
  }
});

// POST /api/v1/agent/events
agentRouter.post('/events', requireClusterToken, async (req: AuthenticatedRequest, res: Response) => {
  const { events } = req.body;
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: 'events must be an array' });
  }

  try {
    const repo = await getRepository();
    const cluster = req.cluster!;

    const k8sEventsToSave = events.map((ev: any) => ({
      organization_id: cluster.organization_id,
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      namespace: ev.namespace || 'default',
      resource: ev.resource || ev.involved_object?.name || 'resource',
      kind: ev.kind || ev.involved_object?.kind || 'Pod',
      type: ev.type || 'Warning',
      reason: ev.reason || 'TelemetrySignal',
      message: ev.message || '',
      count: ev.count || 1,
      first_observed: ev.first_observed || ev.first_timestamp || new Date().toISOString(),
      last_observed: ev.last_observed || ev.last_timestamp || new Date().toISOString(),
    }));

    await repo.saveK8sEvents(k8sEventsToSave);
    return res.json({ status: 'ok', received: events.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process event telemetry' });
  }
});

// POST /api/v1/agent/nodes
agentRouter.post('/nodes', requireClusterToken, async (req: AuthenticatedRequest, res: Response) => {
  const { nodes } = req.body;
  if (!Array.isArray(nodes)) {
    return res.status(400).json({ error: 'nodes must be an array' });
  }

  try {
    const repo = await getRepository();
    const cluster = req.cluster!;

    const nodesToSave = nodes.map((n: any) => ({
      organization_id: cluster.organization_id,
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      name: n.name,
      status: n.status || 'Ready',
      k8s_version: n.k8s_version || cluster.k8s_version,
      cpu_allocatable: n.cpu_allocatable || '4',
      mem_allocatable: n.mem_allocatable || '16Gi',
      pod_count: n.pod_count || 0,
      memory_pressure: !!n.memory_pressure,
      disk_pressure: !!n.disk_pressure,
      pid_pressure: !!n.pid_pressure,
    }));

    await repo.saveNodeHealth(nodesToSave);
    return res.json({ status: 'ok', received: nodes.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save node health' });
  }
});

// POST /api/v1/agent/workloads
agentRouter.post('/workloads', requireClusterToken, async (req: AuthenticatedRequest, res: Response) => {
  const { workloads } = req.body;
  if (!Array.isArray(workloads)) {
    return res.status(400).json({ error: 'workloads must be an array' });
  }

  try {
    const repo = await getRepository();
    const cluster = req.cluster!;

    const workloadsToSave = workloads.map((w: any) => ({
      organization_id: cluster.organization_id,
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      namespace: w.namespace || 'default',
      name: w.name,
      kind: w.kind || 'Deployment',
      desired: w.desired || 1,
      ready: w.ready || 0,
      available: w.available || 0,
      status: w.status || 'HEALTHY',
    }));

    await repo.saveWorkloadHealth(workloadsToSave);
    return res.json({ status: 'ok', received: workloads.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save workload health' });
  }
});

// POST /api/v1/agent/incidents
// Correlation and automated ticket creation
agentRouter.post('/incidents', requireClusterToken, async (req: AuthenticatedRequest, res: Response) => {
  const { incidents } = req.body;
  if (!Array.isArray(incidents)) {
    return res.status(400).json({ error: 'incidents must be an array' });
  }

  try {
    const repo = await getRepository();
    const cluster = req.cluster!;
    const now = new Date().toISOString();

    for (const inc of incidents) {
      // Check for existing open incident on same resource + category
      const existingList = await repo.listIncidentsByOrg(cluster.organization_id, {
        clusterId: cluster.id,
      });

      const existing = existingList.find(
        (i) =>
          i.namespace === (inc.namespace || 'default') &&
          i.resource_name === inc.resource_name &&
          i.category === inc.category &&
          i.status !== 'RESOLVED' &&
          i.status !== 'CLOSED'
      );

      if (existing) {
        // Update occurrences & last detected
        const timeline = existing.timeline || [];
        timeline.push({
          timestamp: now,
          title: `Occurrence #${existing.occurrences + 1} observed`,
          detail: inc.summary || `Agent observed repeated failure on ${inc.resource_name}`,
          type: 'event',
        });

        await repo.updateIncident(existing.id, {
          occurrences: existing.occurrences + 1,
          last_detected: now,
          timeline,
        });
      } else {
        // Create new incident
        const newIncident = await repo.createIncident({
          organization_id: cluster.organization_id,
          cluster_id: cluster.id,
          cluster_name: cluster.name,
          title: inc.title || `${inc.category} failure on ${inc.resource_name}`,
          status: 'OPEN',
          severity: inc.severity || 'HIGH',
          category: inc.category || 'WorkloadFailure',
          namespace: inc.namespace || 'default',
          resource_type: inc.resource_type || 'Pod',
          resource_name: inc.resource_name || 'workload',
          pod_name: inc.pod_name,
          container_name: inc.container_name,
          occurrences: 1,
          summary: inc.summary || `Workload failure detected in namespace ${inc.namespace}`,
          impact: inc.impact || 'Service degraded capacity',
          root_cause: inc.root_cause || 'Crash or resource limit breach',
          evidence: inc.evidence || [`Telemetry alert received from agent on ${cluster.name}`],
          timeline: [
            {
              timestamp: now,
              title: 'Incident Detected',
              detail: `Initial failure signal captured by SkyOps Agent on ${cluster.name}`,
              type: 'event',
            },
          ],
          suggested_actions: inc.suggested_actions || [
            `Inspect logs: kubectl logs -n ${inc.namespace || 'default'} ${inc.resource_name}`,
            'Verify resource limits and node events',
          ],
          suggested_command: inc.suggested_command || `kubectl describe pod ${inc.resource_name} -n ${inc.namespace || 'default'}`,
          suggested_yaml_patch: inc.suggested_yaml_patch,
          first_detected: now,
          last_detected: now,
        });

        // Auto-generate SRE Ticket for Critical or High severity incidents
        if (newIncident.severity === 'CRITICAL' || newIncident.severity === 'HIGH') {
          await repo.createTicket({
            incident_id: newIncident.id,
            organization_id: cluster.organization_id,
            title: `[${newIncident.severity}] ${newIncident.title}`,
            description: `Automated SRE Remediation Ticket:\n\nSummary: ${newIncident.summary}\nRoot Cause: ${newIncident.root_cause}\nTarget: ${newIncident.resource_type}/${newIncident.resource_name} in namespace "${newIncident.namespace}" (${cluster.name})`,
            severity: newIncident.severity,
            priority: newIncident.severity === 'CRITICAL' ? 'P0' : 'P1',
            assignee: 'sre-team@skyops.io',
            status: 'OPEN',
            cluster_id: cluster.id,
            cluster_name: cluster.name,
            namespace: newIncident.namespace,
            resource: `${newIncident.resource_type}/${newIncident.resource_name}`,
            category: newIncident.category,
            impact: newIncident.impact,
            root_cause: newIncident.root_cause,
            suggested_actions: newIncident.suggested_actions,
            suggested_command: newIncident.suggested_command,
            suggested_yaml_patch: newIncident.suggested_yaml_patch,
            evidence: newIncident.evidence,
            tasks: [
              { id: 'tsk-1', text: `Inspect workload status in ${newIncident.namespace}`, completed: false },
              { id: 'tsk-2', text: 'Apply remediation actions & verify logs', completed: false },
              { id: 'tsk-3', text: 'Confirm container readiness and close ticket', completed: false },
            ],
            timeline: [
              {
                timestamp: now,
                title: 'Ticket Generated',
                detail: `Automated ticket created from incident ${newIncident.id}`,
                type: 'event',
              },
            ],
            comments: [
              {
                id: `cmt-${Date.now()}`,
                author: 'SkyOps Agent Engine',
                message: `Automated incident remediation ticket opened for ${cluster.name}.`,
                createdAt: now,
              },
            ],
            tags: [newIncident.category, newIncident.namespace, cluster.name],
          });
        }

        await repo.createAuditLog({
          organization_id: cluster.organization_id,
          user_email: 'skyops-agent@cluster.local',
          action: 'incident_detected',
          resource: `Incident/${newIncident.id}`,
          details: `Agent reported ${newIncident.category} on cluster ${cluster.name}`,
          ip_address: req.ip || '127.0.0.1',
        });
      }
    }

    // Update active incidents count on cluster
    const activeIncidents = await repo.listIncidentsByOrg(cluster.organization_id, {
      clusterId: cluster.id,
    });
    const activeCount = activeIncidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
    await repo.updateCluster(cluster.id, { active_incidents: activeCount });

    return res.json({ status: 'ok', received: incidents.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process incident telemetry', details: err.message });
  }
});

// GET /api/v1/agent/download-script
agentRouter.get('/download-script', (req: Request, res: Response) => {
  const { cluster = 'k8s-cluster', token = '', server_url = '' } = req.query;
  const hostUrl = (server_url as string) || `${req.protocol}://${req.get('host')}`;

  const scriptContent = `#!/bin/bash
# ==============================================================================
# SkyOps Kubernetes Agent One-Line Installer (Production Self-Hosted & Cloud)
# ==============================================================================
set -e

CLUSTER_NAME="${cluster}"
REGISTRATION_TOKEN="${token}"
SERVER_URL="${hostUrl}"

echo "================================================================================"
echo " SkyOps Kubernetes Agent Installer"
echo " Target Cluster: \${CLUSTER_NAME}"
echo " Control Plane: \${SERVER_URL}"
echo "================================================================================"

if ! command -v kubectl &> /dev/null; then
    echo "ERROR: 'kubectl' command not found. Please ensure kubectl is in your PATH."
    exit 1
fi

echo "[1/3] Creating namespace and service account..."
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

echo "[2/3] Creating agent credentials secret..."
kubectl create secret generic skyops-agent-secret \
  --namespace skyops \
  --from-literal=SKYOPS_REGISTRATION_TOKEN="\${REGISTRATION_TOKEN}" \
  --from-literal=SKYOPS_SERVER_URL="\${SERVER_URL}" \
  --from-literal=SKYOPS_CLUSTER_NAME="\${CLUSTER_NAME}" \
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
echo "SUCCESS: SkyOps Agent deployed successfully in namespace 'skyops'."
echo "Agent will register with \${SERVER_URL} within 10 seconds."
`;

  res.setHeader('Content-Type', 'text/x-sh');
  res.setHeader('Content-Disposition', `attachment; filename="skyops-install-${cluster}.sh"`);
  res.send(scriptContent);
});
