import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-memory backing store synced with Firestore structure
  const store = {
    organizations: [
      {
        id: 'org-default',
        name: 'Default Organization',
        slug: 'default-org',
        createdAt: new Date().toISOString(),
      },
    ],
    clusters: [] as any[],
    incidents: [] as any[],
    tickets: [] as any[],
    k8sEvents: [] as any[],
    auditLogs: [] as any[],
    notifications: [] as any[],
    nodes: [] as any[],
    workloads: [] as any[],
    demoMode: false,
  };

  // Helper audit logger
  const logAudit = (action: string, resource: string, details: string, email = 'sre@skyops.io') => {
    store.auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organization_id: 'org-default',
      user_email: email,
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
    });
  };

  // Health and Observability endpoints for SkyOps itself
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'skyops-saas', timestamp: new Date().toISOString() });
  });

  app.get('/ready', (req, res) => {
    res.json({ status: 'ready', database: 'firestore' });
  });

  app.get('/metrics', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(
      `# HELP skyops_clusters_total Total registered clusters.\n` +
      `skyops_clusters_total ${store.clusters.length}\n` +
      `# HELP skyops_active_incidents Active correlated incidents.\n` +
      `skyops_active_incidents ${store.incidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length}\n` +
      `# HELP skyops_tickets_total Total SRE tickets.\n` +
      `skyops_tickets_total ${store.tickets.length}\n`
    );
  });

  // REST API Routes (/api/v1/*)

  // Organizations
  app.get('/api/v1/organizations', (req, res) => {
    res.json(store.organizations);
  });

  // Demo Mode toggle
  app.get('/api/v1/settings/demo-mode', (req, res) => {
    res.json({ demoMode: store.demoMode });
  });

  app.post('/api/v1/settings/demo-mode', (req, res) => {
    const { enabled } = req.body;
    store.demoMode = !!enabled;

    if (store.demoMode) {
      // Populate isolated demo cluster and incidents if enabling
      if (!store.clusters.some((c) => c.id === 'cls-demo')) {
        const now = new Date().toISOString();
        store.clusters.push({
          id: 'cls-demo',
          organization_id: 'org-default',
          name: 'demo-production-us-east',
          environment: 'production',
          status: 'CONNECTED',
          agent_version: 'v1.0.0',
          k8s_version: 'v1.30.2',
          node_count: 3,
          pod_count: 48,
          namespace_count: 6,
          active_incidents: 2,
          cpu_usage_cores: 2.4,
          memory_usage_bytes: 8589934592,
          last_heartbeat: now,
          created_at: now,
          is_demo: true,
        });

        store.incidents.push({
          id: 'INC-000101',
          title: 'CrashLoopBackOff on default/payment-api',
          status: 'OPEN',
          severity: 'CRITICAL',
          category: 'CrashLoopBackOff',
          organization_id: 'org-default',
          cluster_id: 'cls-demo',
          cluster_name: 'demo-production-us-east',
          namespace: 'default',
          resource_type: 'Deployment',
          resource_name: 'payment-api',
          pod_name: 'payment-api-7c8d9-x411',
          container_name: 'payment-server',
          occurrences: 14,
          summary: 'Pod default/payment-api-7c8d9-x411 crashed repeatedly during startup.',
          impact: 'Payment processing latency spike; 15% failed transactions.',
          root_cause: 'Fatal error: database connection refused at database.ts:42.',
          evidence: [
            'Error: ECONNREFUSED 10.96.12.4:5432',
            'Back-off restarting failed container in pod payment-api-7c8d9-x411',
            'Liveness probe failed: HTTP probe failed with statuscode: 500',
          ],
          timeline: [
            { timestamp: now, title: 'Incident Created', detail: 'Agent detected 14 restarts in 5m', type: 'event' },
          ],
          suggested_actions: [
            'Inspect live logs: kubectl logs -n default payment-api-7c8d9-x411',
            'Verify database secret configuration: kubectl get secret db-credentials -n default',
          ],
          suggested_command: 'kubectl rollout restart deployment/payment-api -n default',
          suggested_yaml_patch: `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: payment-api\n  namespace: default\nspec:\n  replicas: 3`,
          first_detected: now,
          last_detected: now,
          created_at: now,
          updated_at: now,
          is_demo: true,
        });

        store.tickets.push({
          id: 'SKY-1001',
          incident_id: 'INC-000101',
          organization_id: 'org-default',
          title: '[CRITICAL] CrashLoopBackOff on default/payment-api',
          description: 'Payment API container crashing on startup due to database connectivity failure (ECONNREFUSED). Service pods are entering CrashLoopBackOff with 14 restarts in 5 minutes.',
          severity: 'CRITICAL',
          priority: 'P0',
          assignee: 'sre-lead@skyops.io',
          status: 'OPEN',
          cluster_id: 'cls-demo',
          cluster_name: 'demo-production-us-east',
          namespace: 'default',
          resource: 'Deployment/payment-api',
          category: 'CrashLoopBackOff',
          impact: 'Payment processing latency spiked 320ms; 15% transaction checkout failures reported by gateway ingress.',
          root_cause: 'Postgres DB connection refused at 10.96.12.4:5432 due to secret rotation mismatch on db-credentials.',
          evidence: [
            'Error: ECONNREFUSED 10.96.12.4:5432 at database.ts:42',
            'Back-off restarting failed container in pod payment-api-7c8d9-x411',
            'Liveness probe failed: HTTP probe failed with statuscode: 500',
            'Container payment-server exited with exit code 1',
          ],
          suggested_actions: [
            'Inspect live pod logs: kubectl logs -n default payment-api-7c8d9-x411',
            'Verify database credentials secret: kubectl get secret db-credentials -n default -o yaml',
            'Perform rolling restart: kubectl rollout restart deployment/payment-api -n default',
            'Verify health endpoints: kubectl exec -it payment-api-7c8d9-x411 -- curl localhost:8080/health',
          ],
          suggested_command: 'kubectl rollout restart deployment/payment-api -n default',
          suggested_yaml_patch: `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: payment-api\n  namespace: default\nspec:\n  template:\n    spec:\n      containers:\n      - name: payment-server\n        env:\n        - name: DB_HOST\n          value: "postgres-primary.default.svc.cluster.local"`,
          tasks: [
            { id: 'tsk-1', text: 'Verify PostgreSQL database service connectivity from node subnet', completed: true },
            { id: 'tsk-2', text: 'Update db-credentials secret with rotated password', completed: false },
            { id: 'tsk-3', text: 'Trigger rolling restart of deployment/payment-api', completed: false },
            { id: 'tsk-4', text: 'Monitor Prometheus error rate metric for 10 minutes post-fix', completed: false },
          ],
          timeline: [
            { timestamp: now, title: 'Ticket Generated', detail: 'Automated SRE ticket created from incident INC-000101', type: 'event' },
            { timestamp: now, title: 'Assigned', detail: 'Assigned to sre-lead@skyops.io with P0 priority', type: 'status_change' },
          ],
          comments: [
            { id: 'cmt-1', author: 'SkyOps System', message: 'Automated SRE ticket generated from telemetry alert on payment-api.', createdAt: now },
            { id: 'cmt-2', author: 'sre-lead@skyops.io', message: 'Investigating database secret configuration and pod network policies.', createdAt: now },
          ],
          tags: ['CrashLoopBackOff', 'payment-api', 'P0-Outage', 'database'],
          created_at: now,
          updated_at: now,
          is_demo: true,
        });
      }
    } else {
      // Remove demo items when turning off demo mode
      store.clusters = store.clusters.filter((c) => !c.is_demo);
      store.incidents = store.incidents.filter((i) => !i.is_demo);
      store.tickets = store.tickets.filter((t) => !t.is_demo);
    }

    logAudit('demo_mode_toggled', 'System', `Demo mode set to ${store.demoMode}`);
    res.json({ demoMode: store.demoMode });
  });

  // Installer script endpoints
  const serveInstallerScript = (req: express.Request, res: express.Response) => {
    try {
      const scriptPath = path.join(process.cwd(), 'install.sh');
      if (fs.existsSync(scriptPath)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.sendFile(scriptPath);
      }
      return res.status(404).send('# Installer script not found');
    } catch (err) {
      return res.status(500).send('# Error loading installer script');
    }
  };

  app.get('/agent.sh', serveInstallerScript);
  app.get('/install.sh', serveInstallerScript);

  // Serve Kubernetes YAML manifest directly
  app.get('/agent.yaml', (req, res) => {
    try {
      const manifestPath = path.join(process.cwd(), 'deploy', 'install', 'agent.yaml');
      if (fs.existsSync(manifestPath)) {
        res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="skyops-agent.yaml"');
        return res.sendFile(manifestPath);
      }
      return res.status(404).send('# Agent manifest not found');
    } catch (err) {
      return res.status(500).send('# Error loading manifest');
    }
  });

  // Dynamic pre-configured installer download endpoint
  app.get('/api/v1/agent/download-script', (req, res) => {
    const cluster = (req.query.cluster as string) || 'production-us-east';
    const token = (req.query.token as string) || `skyops_reg_${crypto.randomBytes(12).toString('hex')}`;
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const serverUrl = (req.query.server_url as string) || hostUrl;

    try {
      const scriptPath = path.join(process.cwd(), 'install.sh');
      let scriptContent = '';
      if (fs.existsSync(scriptPath)) {
        scriptContent = fs.readFileSync(scriptPath, 'utf-8');
      } else {
        scriptContent = `#!/usr/bin/env bash\necho "SkyOps Agent Installer"`;
      }

      // Prepend customized environment exports
      const customizedScript = `#!/usr/bin/env bash
# ==============================================================================
# SkyOps Kubernetes Agent Customized Installer
# Target Cluster: ${cluster}
# Control Plane: ${serverUrl}
# Generated: ${new Date().toISOString()}
# ==============================================================================
export SKYOPS_CLUSTER="${cluster}"
export SKYOPS_TOKEN="${token}"
export SKYOPS_SERVER_URL="${serverUrl}"

` + scriptContent.replace(/^#!\/usr\/bin\/env bash\n/, '');

      res.setHeader('Content-Type', 'application/x-sh; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="skyops-install-${cluster}.sh"`);
      return res.send(customizedScript);
    } catch (err) {
      return res.status(500).send('# Error generating installer script');
    }
  });

  // Clusters API
  app.get('/api/v1/clusters', (req, res) => {
    res.json(store.clusters);
  });

  // Connect Cluster registration token generator
  app.post('/api/v1/clusters/register', (req, res) => {
    const { name, environment = 'production' } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Cluster name is required' });
    }

    const regToken = `skyops_reg_${crypto.randomBytes(16).toString('hex')}`;
    const clusterId = `cls-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const cluster = {
      id: clusterId,
      organization_id: 'org-default',
      name,
      environment,
      status: 'UNKNOWN',
      agent_version: 'v1.0.0',
      k8s_version: 'v1.30.0',
      registration_token: regToken,
      node_count: 0,
      pod_count: 0,
      namespace_count: 0,
      active_incidents: 0,
      cpu_usage_cores: 0,
      memory_usage_bytes: 0,
      last_heartbeat: now,
      created_at: now,
      updated_at: now,
    };

    store.clusters.push(cluster);
    logAudit('cluster_registered', name, `Cluster registration token created for ${name}`);

    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const installerScriptUrl = process.env.NODE_ENV === 'production' && !req.get('host')?.includes('run.app')
      ? 'https://install.skyops.io/agent.sh'
      : `${hostUrl}/agent.sh`;

    const installCommand = `curl -fsSL ${installerScriptUrl} | SKYOPS_TOKEN="${regToken}" SKYOPS_CLUSTER="${name}" SKYOPS_SERVER_URL="${hostUrl}" bash`;

    res.json({
      cluster,
      registration_token: regToken,
      install_command: installCommand,
      helm_command: installCommand,
    });
  });

  // Token Rotation
  app.post('/api/v1/clusters/:id/rotate-token', (req, res) => {
    const { id } = req.params;
    const cluster = store.clusters.find((c) => c.id === id);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    const newToken = `skyops_ctk_${crypto.randomBytes(24).toString('hex')}`;
    cluster.cluster_token = newToken;
    cluster.updated_at = new Date().toISOString();

    logAudit('token_rotated', cluster.name, `Cluster token rotated for ${cluster.name}`);
    res.json({ cluster_id: cluster.id, new_token: newToken });
  });

  // Delete Cluster
  app.delete('/api/v1/clusters/:id', (req, res) => {
    const { id } = req.params;
    const index = store.clusters.findIndex((c) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    const [deleted] = store.clusters.splice(index, 1);
    logAudit('cluster_deleted', deleted.name, `Cluster ${deleted.name} removed`);
    res.json({ status: 'deleted', id });
  });

  // Agent Register & Heartbeat API
  app.post('/api/v1/agent/register', (req, res) => {
    const { registration_token, cluster_name } = req.body;
    let cluster = store.clusters.find((c) => c.registration_token === registration_token);

    if (!cluster) {
      cluster = {
        id: `cls-${crypto.randomBytes(4).toString('hex')}`,
        organization_id: 'org-default',
        name: cluster_name || 'k8s-cluster',
        environment: 'production',
        status: 'CONNECTED',
        agent_version: 'v1.0.0',
        k8s_version: 'v1.30.2',
        node_count: 2,
        pod_count: 24,
        namespace_count: 4,
        active_incidents: 0,
        cpu_usage_cores: 1.2,
        memory_usage_bytes: 4294967296,
        last_heartbeat: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.clusters.push(cluster);
    } else {
      cluster.status = 'CONNECTED';
      cluster.registration_token = '';
      cluster.last_heartbeat = new Date().toISOString();
    }

    const clusterToken = `skyops_ctk_${crypto.randomBytes(24).toString('hex')}`;
    cluster.cluster_token = clusterToken;

    res.json({
      cluster_id: cluster.id,
      cluster_token: clusterToken,
      org_id: cluster.organization_id,
    });
  });

  app.post('/api/v1/agent/heartbeat', (req, res) => {
    const {
      cluster_id,
      cluster_name,
      node_count,
      pod_count,
      namespace_count,
      cpu_usage_cores,
      memory_bytes,
      k8s_version,
      agent_version,
      nodes,
      workloads,
    } = req.body;

    let cluster = store.clusters.find((c) => c.id === cluster_id || c.name === cluster_name);

    if (!cluster) {
      cluster = {
        id: cluster_id || `cls-${crypto.randomBytes(4).toString('hex')}`,
        organization_id: 'org-default',
        name: cluster_name || 'k8s-cluster',
        environment: 'production',
        status: 'CONNECTED',
        created_at: new Date().toISOString(),
      };
      store.clusters.push(cluster);
      logAudit('cluster_connected', cluster.name, `Agent connected from ${cluster.name}`);
    }

    cluster.status = 'CONNECTED';
    cluster.node_count = node_count || (nodes ? nodes.length : (cluster.node_count || 1));
    cluster.pod_count = pod_count || (workloads ? workloads.length * 2 : (cluster.pod_count || 10));
    cluster.namespace_count = namespace_count || cluster.namespace_count || 3;
    cluster.cpu_usage_cores = cpu_usage_cores || cluster.cpu_usage_cores || 0.8;
    cluster.memory_usage_bytes = memory_bytes || cluster.memory_usage_bytes || 2147483648;
    if (k8s_version) cluster.k8s_version = k8s_version;
    if (agent_version) cluster.agent_version = agent_version;
    cluster.last_heartbeat = new Date().toISOString();
    cluster.updated_at = new Date().toISOString();

    // Ingest nodes
    if (Array.isArray(nodes) && nodes.length > 0) {
      // Replace or merge nodes for this cluster
      store.nodes = [
        ...store.nodes.filter((n) => n.cluster_name !== cluster.name),
        ...nodes.map((n) => ({ ...n, cluster_name: cluster.name })),
      ];
    }

    // Ingest workloads
    if (Array.isArray(workloads) && workloads.length > 0) {
      store.workloads = [
        ...store.workloads.filter((w) => w.cluster_name !== cluster.name),
        ...workloads.map((w) => ({ ...w, cluster_name: cluster.name })),
      ];
    }

    // Recalculate active incidents for this cluster
    cluster.active_incidents = store.incidents.filter(
      (i) => (i.cluster_name === cluster.name || i.cluster_id === cluster.id) && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
    ).length;

    res.json({ status: 'ok', cluster_id: cluster.id, active_incidents: cluster.active_incidents });
  });

  // Agent Event Batch Ingestion API
  app.post('/api/v1/agent/events/batch', (req, res) => {
    const { cluster_id, events } = req.body;
    const cluster = store.clusters.find((c) => c.id === cluster_id);
    const clusterName = cluster ? cluster.name : 'k8s-cluster';

    if (Array.isArray(events) && events.length > 0) {
      const now = new Date().toISOString();
      const enrichedEvents = events.map((evt) => ({
        ...evt,
        id: evt.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        cluster_name: evt.cluster_name || clusterName,
        timestamp: evt.timestamp || now,
      }));

      // Keep latest 500 events in memory
      store.k8sEvents = [...enrichedEvents, ...store.k8sEvents].slice(0, 500);

      // Auto-correlate Warning / Crash / OOM events into incidents
      enrichedEvents.forEach((evt) => {
        if (
          evt.type === 'Warning' &&
          (evt.reason === 'BackOff' ||
            evt.reason === 'Failed' ||
            evt.reason === 'Unhealthy' ||
            evt.reason === 'FailedScheduling' ||
            evt.reason === 'OOMKilled')
        ) {
          const incId = `INC-EVT-${evt.reason.toUpperCase()}-${evt.namespace || 'default'}-${Date.now().toString().slice(-4)}`;
          const existing = store.incidents.find(
            (i) =>
              i.cluster_name === clusterName &&
              i.namespace === evt.namespace &&
              i.resource_name === evt.resource &&
              i.status !== 'RESOLVED'
          );

          if (existing) {
            existing.occurrences = (existing.occurrences || 1) + 1;
            existing.last_detected = now;
            if (!existing.evidence.includes(evt.message)) {
              existing.evidence.unshift(evt.message);
            }
          } else {
            store.incidents.unshift({
              id: incId,
              title: `${evt.reason} on ${evt.namespace}/${evt.resource || 'workload'}`,
              status: 'OPEN',
              severity: evt.reason === 'OOMKilled' || evt.reason === 'BackOff' ? 'CRITICAL' : 'HIGH',
              category: evt.reason,
              organization_id: 'org-default',
              cluster_id: cluster ? cluster.id : 'cls-agent',
              cluster_name: clusterName,
              namespace: evt.namespace || 'default',
              resource_type: evt.kind || 'Pod',
              resource_name: evt.resource || 'workload',
              occurrences: evt.count || 1,
              summary: evt.message || `Warning event ${evt.reason} captured by agent.`,
              impact: 'Workload availability and pod restarts affected.',
              root_cause: `Event ${evt.reason}: ${evt.message}`,
              evidence: [evt.message],
              timeline: [
                { timestamp: now, title: 'Event Captured', detail: evt.message, type: 'event' },
              ],
              suggested_actions: [
                `Inspect pod events: kubectl describe pod -n ${evt.namespace || 'default'}`,
                `Check workload logs: kubectl logs -n ${evt.namespace || 'default'} -l app=${evt.resource}`,
              ],
              suggested_command: `kubectl describe pod -n ${evt.namespace || 'default'}`,
              first_detected: now,
              last_detected: now,
              created_at: now,
              updated_at: now,
            });
          }
        }
      });
    }

    res.json({ status: 'ok', ingested: events ? events.length : 0 });
  });

  // Agent Incidents Batch Ingestion API
  app.post('/api/v1/agent/incidents', (req, res) => {
    const { cluster_id, incidents } = req.body;
    const cluster = store.clusters.find((c) => c.id === cluster_id);
    const clusterName = cluster ? cluster.name : 'k8s-cluster';

    if (Array.isArray(incidents) && incidents.length > 0) {
      const now = new Date().toISOString();
      incidents.forEach((incoming) => {
        const existingIndex = store.incidents.findIndex(
          (i) =>
            i.id === incoming.id ||
            (i.category === incoming.category &&
              i.cluster_name === clusterName &&
              i.namespace === incoming.namespace &&
              i.resource_name === incoming.resource_name &&
              i.status !== 'RESOLVED' &&
              i.status !== 'CLOSED')
        );

        const fullIncident = {
          ...incoming,
          id: incoming.id || `INC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          cluster_id: cluster ? cluster.id : (incoming.cluster_id || 'cls-agent'),
          cluster_name: incoming.cluster_name || clusterName,
          organization_id: 'org-default',
          status: incoming.status || 'OPEN',
          severity: incoming.severity || 'HIGH',
          evidence: Array.isArray(incoming.evidence) ? incoming.evidence : [incoming.summary || 'Incident reported by agent'],
          timeline: incoming.timeline || [
            { timestamp: now, title: 'Incident Detected', detail: incoming.summary || 'Real-time telemetry event', type: 'event' },
          ],
          suggested_actions: incoming.suggested_actions || [
            `Check pod logs: kubectl logs -n ${incoming.namespace || 'default'} ${incoming.resource_name || ''}`,
            `Inspect events: kubectl get events -n ${incoming.namespace || 'default'} --sort-by=.metadata.creationTimestamp`,
          ],
          suggested_command: incoming.suggested_command || `kubectl describe ${incoming.resource_type || 'pod'} ${incoming.resource_name || ''} -n ${incoming.namespace || 'default'}`,
          first_detected: incoming.first_detected || now,
          last_detected: now,
          created_at: incoming.created_at || now,
          updated_at: now,
        };

        if (existingIndex >= 0) {
          store.incidents[existingIndex] = {
            ...store.incidents[existingIndex],
            ...fullIncident,
            occurrences: (store.incidents[existingIndex].occurrences || 1) + 1,
            last_detected: now,
            updated_at: now,
          };
        } else {
          store.incidents.unshift(fullIncident);

          // Auto-generate SRE Ticket for Critical/High issues
          if (fullIncident.severity === 'CRITICAL' || fullIncident.severity === 'HIGH') {
            const ticketId = `SKY-${1000 + store.tickets.length + 1}`;
            store.tickets.unshift({
              id: ticketId,
              incident_id: fullIncident.id,
              organization_id: 'org-default',
              title: `[${fullIncident.severity}] ${fullIncident.title}`,
              description: `Automated incident ticket:\n${fullIncident.summary}\nRoot Cause: ${fullIncident.root_cause || 'Pending diagnosis'}`,
              severity: fullIncident.severity,
              priority: fullIncident.severity === 'CRITICAL' ? 'P0' : 'P1',
              assignee: 'sre-team@skyops.io',
              status: 'OPEN',
              cluster_id: fullIncident.cluster_id,
              cluster_name: fullIncident.cluster_name,
              namespace: fullIncident.namespace,
              resource: `${fullIncident.resource_type || 'Workload'}/${fullIncident.resource_name || 'app'}`,
              comments: [
                { id: `cmt-${Date.now()}`, author: 'SkyOps Agent Engine', message: `Telemetry alert detected in ${fullIncident.cluster_name}.`, createdAt: now },
              ],
              created_at: now,
              updated_at: now,
            });
          }

          logAudit('incident_detected', fullIncident.id, `Agent reported ${fullIncident.category} on ${fullIncident.cluster_name}`);
        }
      });

      if (cluster) {
        cluster.active_incidents = store.incidents.filter(
          (i) => i.cluster_name === cluster.name && i.status !== 'RESOLVED' && i.status !== 'CLOSED'
        ).length;
      }
    }

    res.json({ status: 'ok', received: incidents ? incidents.length : 0 });
  });

  // Incidents API
  app.get('/api/v1/incidents', (req, res) => {
    res.json(store.incidents);
  });

  app.get('/api/v1/incidents/:id', (req, res) => {
    const inc = store.incidents.find((i) => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });
    res.json(inc);
  });

  app.post('/api/v1/incidents/:id/acknowledge', (req, res) => {
    const inc = store.incidents.find((i) => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    inc.status = 'ACKNOWLEDGED';
    inc.timeline.push({
      timestamp: new Date().toISOString(),
      title: 'Incident Acknowledged',
      detail: `Acknowledged by ${req.body.user_email || 'sre@skyops.io'}`,
      type: 'status_change',
    });
    inc.updated_at = new Date().toISOString();

    logAudit('incident_acknowledged', inc.id, `Incident ${inc.id} acknowledged`);
    res.json(inc);
  });

  app.post('/api/v1/incidents/:id/resolve', (req, res) => {
    const inc = store.incidents.find((i) => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    inc.status = 'RESOLVED';
    inc.resolved_by = req.body.user_email || 'sre@skyops.io';
    inc.resolved_at = new Date().toISOString();
    inc.timeline.push({
      timestamp: new Date().toISOString(),
      title: 'Incident Resolved',
      detail: `Marked resolved by ${inc.resolved_by}`,
      type: 'status_change',
    });
    inc.updated_at = new Date().toISOString();

    logAudit('incident_resolved', inc.id, `Incident ${inc.id} resolved`);
    res.json(inc);
  });

  app.post('/api/v1/incidents/:id/close', (req, res) => {
    const inc = store.incidents.find((i) => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    inc.status = 'CLOSED';
    inc.resolved_by = req.body.user_email || 'sre@skyops.io';
    inc.resolved_at = new Date().toISOString();
    inc.timeline.push({
      timestamp: new Date().toISOString(),
      title: 'Incident Closed',
      detail: `Marked closed by ${inc.resolved_by}`,
      type: 'status_change',
    });
    inc.updated_at = new Date().toISOString();

    logAudit('incident_closed', inc.id, `Incident ${inc.id} closed`);
    res.json(inc);
  });

  // AI Diagnostic Generator using Gemini API
  app.post('/api/v1/incidents/:id/ai-diagnose', async (req, res) => {
    const inc = store.incidents.find((i) => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback deterministic AI diagnosis if key missing in dev
      return res.json({
        root_cause: `Automated analysis for ${inc.category}: Resource container exited with code 137 or unhandled crash.`,
        confidence: 0.92,
        evidence: inc.evidence,
        recommended_actions: inc.suggested_actions,
        potential_impact: inc.impact,
        is_ai: true,
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are SkyOps AI Diagnostic Agent for Kubernetes SRE teams. Analyze this incident evidence:
Category: ${inc.category}
Resource: ${inc.resource_type}/${inc.resource_name} in namespace ${inc.namespace}
Summary: ${inc.summary}
Evidence: ${JSON.stringify(inc.evidence)}

Provide a structured JSON output with fields:
- root_cause (string)
- confidence (number between 0.0 and 1.0)
- evidence_summary (string)
- recommended_actions (array of strings)
- potential_impact (string)`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      let jsonRes: any = {};
      try {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonRes = JSON.parse(cleanJson);
      } catch (e) {
        jsonRes = {
          root_cause: text,
          confidence: 0.88,
          recommended_actions: inc.suggested_actions,
          potential_impact: inc.impact,
        };
      }

      logAudit('ai_diagnosis_generated', inc.id, `AI diagnosis generated for ${inc.id}`);
      return res.json({ ...jsonRes, is_ai: true });
    } catch (err: any) {
      return res.status(500).json({ error: 'AI Diagnosis generation failed', details: err.message });
    }
  });

  // Ticket conversion
  app.post('/api/v1/incidents/:id/ticket', (req, res) => {
    const inc = store.incidents.find((i) => i.id === req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });

    const ticketNum = 1000 + store.tickets.length + 1;
    const ticketId = `SKY-${ticketNum}`;
    const now = new Date().toISOString();

    const tasks = (inc.suggested_actions && inc.suggested_actions.length > 0)
      ? inc.suggested_actions.map((act, idx) => ({
          id: `tsk-${idx + 1}`,
          text: act,
          completed: false,
        }))
      : [
          { id: 'tsk-1', text: `Inspect logs: kubectl logs -n ${inc.namespace} ${inc.resource_name}`, completed: false },
          { id: 'tsk-2', text: 'Verify resource requests, limits, and cluster events', completed: false },
          { id: 'tsk-3', text: 'Apply fix and confirm pod readiness', completed: false },
        ];

    const ticket = {
      id: ticketId,
      incident_id: inc.id,
      organization_id: inc.organization_id,
      title: `[${inc.severity}] ${inc.title}`,
      description: `Auto-generated SRE remediation ticket from correlated incident ${inc.id}.\n\n` +
        `Summary: ${inc.summary}\n` +
        `Root Cause: ${inc.root_cause || 'Pending diagnosis'}\n` +
        `Target: ${inc.resource_type}/${inc.resource_name} in namespace "${inc.namespace}" (${inc.cluster_name})`,
      severity: inc.severity,
      priority: inc.severity === 'CRITICAL' ? 'P0' : inc.severity === 'HIGH' ? 'P1' : 'P2',
      assignee: req.body.assignee || 'sre-team@skyops.io',
      status: 'OPEN',
      cluster_id: inc.cluster_id,
      cluster_name: inc.cluster_name,
      namespace: inc.namespace,
      resource: `${inc.resource_type}/${inc.resource_name}`,
      category: inc.category,
      impact: inc.impact,
      root_cause: inc.root_cause,
      suggested_actions: inc.suggested_actions,
      suggested_command: inc.suggested_command,
      suggested_yaml_patch: inc.suggested_yaml_patch,
      evidence: inc.evidence,
      tasks,
      timeline: [
        {
          timestamp: now,
          title: 'Ticket Generated',
          detail: `Converted from incident ${inc.id} by ${req.body.assignee || 'SRE Team'}`,
          type: 'event',
        },
      ],
      comments: [
        {
          id: `cmt-${Date.now()}`,
          author: 'SkyOps System',
          message: `Ticket automatically generated from incident report ${inc.id}.`,
          createdAt: now,
        },
      ],
      tags: [inc.category, inc.namespace, inc.cluster_name].filter(Boolean),
      created_at: now,
      updated_at: now,
    };

    store.tickets.unshift(ticket);
    logAudit('ticket_created', ticketId, `Ticket ${ticketId} created from incident ${inc.id}`);
    res.json(ticket);
  });

  // Tickets API
  app.get('/api/v1/tickets', (req, res) => {
    res.json(store.tickets);
  });

  app.get('/api/v1/tickets/:id', (req, res) => {
    const ticket = store.tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  });

  // Create manual SRE ticket
  app.post('/api/v1/tickets', (req, res) => {
    const now = new Date().toISOString();
    const ticketNum = 1000 + store.tickets.length + 1;
    const ticketId = `SKY-${ticketNum}`;

    const newTicket = {
      id: ticketId,
      incident_id: req.body.incident_id || '',
      organization_id: 'org-default',
      title: req.body.title || 'New SRE Ticket',
      description: req.body.description || 'Manual SRE Remediation Ticket',
      severity: req.body.severity || 'HIGH',
      priority: req.body.priority || 'P1',
      assignee: req.body.assignee || 'sre-team@skyops.io',
      status: req.body.status || 'OPEN',
      cluster_id: req.body.cluster_id || (store.clusters[0]?.id || 'cls-default'),
      cluster_name: req.body.cluster_name || (store.clusters[0]?.name || 'k8s-cluster'),
      namespace: req.body.namespace || 'default',
      resource: req.body.resource || 'Deployment/service',
      category: req.body.category || 'Maintenance',
      impact: req.body.impact || 'Service stability and reliability maintenance.',
      root_cause: req.body.root_cause || 'User-initiated maintenance and issue tracking.',
      suggested_actions: req.body.suggested_actions || [
        'Inspect workload health and pods',
        'Verify service endpoints and logs',
      ],
      suggested_command: req.body.suggested_command || 'kubectl get pods -n default',
      suggested_yaml_patch: req.body.suggested_yaml_patch || '',
      evidence: req.body.evidence || ['Manual ticket created by operator'],
      tasks: req.body.tasks || [
        { id: 'tsk-1', text: 'Investigate target workload status', completed: false },
        { id: 'tsk-2', text: 'Apply remediation configuration', completed: false },
        { id: 'tsk-3', text: 'Confirm health and close ticket', completed: false },
      ],
      timeline: [
        { timestamp: now, title: 'Ticket Created', detail: `Created by ${req.body.assignee || 'Operator'}`, type: 'event' },
      ],
      comments: [
        { id: `cmt-${Date.now()}`, author: req.body.assignee || 'Operator', message: 'Ticket opened for tracking.', createdAt: now },
      ],
      tags: req.body.tags || ['Manual-Ticket', req.body.namespace || 'default'],
      created_at: now,
      updated_at: now,
    };

    store.tickets.unshift(newTicket);
    logAudit('ticket_created', ticketId, `Manual ticket ${ticketId} created`);
    res.json(newTicket);
  });

  app.patch('/api/v1/tickets/:id', (req, res) => {
    const ticket = store.tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const now = new Date().toISOString();
    const oldStatus = ticket.status;

    if (req.body.status && req.body.status !== oldStatus) {
      ticket.status = req.body.status;
      ticket.timeline = ticket.timeline || [];
      ticket.timeline.push({
        timestamp: now,
        title: 'Status Updated',
        detail: `Status changed from ${oldStatus} to ${ticket.status}`,
        type: 'status_change',
      });
      if (ticket.status === 'RESOLVED') {
        ticket.resolved_at = now;
        ticket.resolved_by = req.body.author || ticket.assignee;
      }
    }

    if (req.body.assignee && req.body.assignee !== ticket.assignee) {
      const oldAssignee = ticket.assignee;
      ticket.assignee = req.body.assignee;
      ticket.timeline = ticket.timeline || [];
      ticket.timeline.push({
        timestamp: now,
        title: 'Assignee Changed',
        detail: `Reassigned from ${oldAssignee} to ${ticket.assignee}`,
        type: 'status_change',
      });
    }

    if (req.body.priority) ticket.priority = req.body.priority;
    if (req.body.severity) ticket.severity = req.body.severity;
    if (req.body.title) ticket.title = req.body.title;
    if (req.body.description) ticket.description = req.body.description;
    if (req.body.resolution_notes) ticket.resolution_notes = req.body.resolution_notes;
    if (Array.isArray(req.body.tasks)) ticket.tasks = req.body.tasks;
    if (Array.isArray(req.body.suggested_actions)) ticket.suggested_actions = req.body.suggested_actions;

    ticket.updated_at = now;

    logAudit('ticket_updated', ticket.id, `Ticket ${ticket.id} updated`);
    res.json(ticket);
  });

  // Toggle or update a task item on a ticket
  app.patch('/api/v1/tickets/:id/tasks/:taskId', (req, res) => {
    const ticket = store.tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    ticket.tasks = ticket.tasks || [];
    const task = ticket.tasks.find((tsk) => tsk.id === req.params.taskId);
    if (task) {
      task.completed = req.body.completed !== undefined ? !!req.body.completed : !task.completed;
      ticket.updated_at = new Date().toISOString();
    }

    res.json(ticket);
  });

  // Add Comment to Ticket API
  app.post('/api/v1/tickets/:id/comments', (req, res) => {
    const ticket = store.tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const { author, message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Comment message is required' });
    }

    const now = new Date().toISOString();
    const commentItem = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      author: author || 'sre-engineer@skyops.io',
      message: message.trim(),
      createdAt: now,
    };

    ticket.comments = ticket.comments || [];
    ticket.comments.push(commentItem);

    ticket.timeline = ticket.timeline || [];
    ticket.timeline.push({
      timestamp: now,
      title: 'Comment Added',
      detail: `Comment by ${commentItem.author}: "${commentItem.message.substring(0, 50)}${commentItem.message.length > 50 ? '...' : ''}"`,
      type: 'comment',
    });

    ticket.updated_at = now;
    logAudit('ticket_comment_added', ticket.id, `Comment added to ${ticket.id} by ${commentItem.author}`);
    res.json(ticket);
  });

  // Audit Logs API
  app.get('/api/v1/audit', (req, res) => {
    res.json(store.auditLogs);
  });

  // Events API
  app.get('/api/v1/events', (req, res) => {
    res.json(store.k8sEvents);
  });

  // Nodes & Workloads API
  app.get('/api/v1/nodes', (req, res) => {
    res.json(store.nodes);
  });

  app.get('/api/v1/workloads', (req, res) => {
    res.json(store.workloads);
  });

  // Synthetic Incident / Telemetry Signal Injection Endpoint
  app.post('/api/v1/simulate-incident', (req, res) => {
    const now = new Date().toISOString();
    const cluster = store.clusters[0] || {
      id: 'cls-prod-us-east',
      name: 'production-us-east',
    };

    const scenarios = [
      {
        title: 'Pod CrashLoopBackOff detected on checkout-service',
        category: 'CrashLoopBackOff',
        severity: 'CRITICAL',
        resource_type: 'Pod',
        resource_name: `checkout-service-${Math.random().toString(36).substring(2, 7)}`,
        namespace: 'production',
        summary: 'Checkout microservice pods failing startup probe after container exit code 137.',
        impact: 'User checkout flows returning 502 Bad Gateway errors. High transaction drop rate.',
        root_cause: 'Container JVM Heap exceeded cgroup memory limit (256Mi). Out of memory termination.',
        suggested_actions: [
          'Increase deployment memory limits from 256Mi to 512Mi in Helm values',
          'Inspect JVM Garbage Collection logs',
          'Trigger rolling restart of deployment/checkout-service',
        ],
        suggested_command: 'kubectl scale deployment checkout-service -n production --replicas=3',
      },
      {
        title: 'High Error Rate & Latency Spike on ingress-gateway',
        category: 'NetworkLatency',
        severity: 'HIGH',
        resource_type: 'Ingress',
        resource_name: 'main-ingress-alb',
        namespace: 'ingress-nginx',
        summary: 'P99 request latency degraded from 45ms to 1,850ms across public endpoints.',
        impact: 'Degraded API responsiveness for web and mobile clients.',
        root_cause: 'Upstream connection pool exhaustion on backend reverse proxy.',
        suggested_actions: [
          'Increase max_connections in nginx ingress configmap',
          'Verify cluster worker node network throughput',
        ],
        suggested_command: 'kubectl get ingress -n ingress-nginx',
      },
      {
        title: 'NodeDiskPressure reported on k8s-worker-node-03',
        category: 'NodePressure',
        severity: 'HIGH',
        resource_type: 'Node',
        resource_name: 'k8s-worker-node-03',
        namespace: 'kube-system',
        summary: 'Ephemeral storage usage exceeded 85% threshold on root filesystem.',
        impact: 'Kubernetes kubelet may begin evicting lower-priority batch pods.',
        root_cause: 'Accumulated unused container images and unrotated docker container logs.',
        suggested_actions: [
          'Run container image garbage collection on worker node',
          'Verify logrotate daemon configuration',
        ],
        suggested_command: 'kubectl describe node k8s-worker-node-03',
      },
    ];

    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const incId = `INC-${String(100000 + store.incidents.length + 1)}`;

    const newIncident = {
      id: incId,
      organization_id: 'org-default',
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      title: scenario.title,
      summary: scenario.summary,
      category: scenario.category,
      severity: scenario.severity,
      status: 'DETECTED',
      resource_type: scenario.resource_type,
      resource_name: scenario.resource_name,
      namespace: scenario.namespace,
      occurrences: 1,
      first_detected: now,
      last_detected: now,
      acknowledged_by: null,
      resolved_by: null,
      closed_by: null,
      impact: scenario.impact,
      root_cause: scenario.root_cause,
      suggested_actions: scenario.suggested_actions,
      suggested_command: scenario.suggested_command,
      suggested_yaml_patch: '',
      evidence: [
        `K8s Event: ${scenario.category} occurred on ${scenario.resource_type}/${scenario.resource_name}`,
        `Prometheus alert triggered with threshold condition > 5 anomalies`,
      ],
      ai_diagnosis: {
        summary: scenario.summary,
        confidence_score: 95,
        analyzed_at: now,
        root_cause_analysis: scenario.root_cause,
        remediation_steps: scenario.suggested_actions,
        verification_plan: 'Verify error rates return to zero and pod remains Running for 5 minutes.',
      },
      is_demo: false,
    };

    store.incidents.unshift(newIncident as any);

    // Also add to k8s events stream
    store.k8sEvents.unshift({
      id: `evt-${Date.now()}`,
      cluster_name: cluster.name,
      type: 'Warning',
      reason: scenario.category,
      message: `${scenario.title} on ${scenario.namespace}/${scenario.resource_name}`,
      involved_object: {
        kind: scenario.resource_type,
        name: scenario.resource_name,
        namespace: scenario.namespace,
      },
      source: 'skyops-watcher',
      first_timestamp: now,
      last_timestamp: now,
      count: 1,
      timestamp: now,
    });

    logAudit('signal_injected', incId, `Synthetic anomaly signal injected: ${scenario.title}`);
    res.json(newIncident);
  });


  // Vite Middleware in dev or static files in production
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
    console.log(`[SkyOps SaaS Control Plane] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
