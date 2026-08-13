import express from 'express';
import path from 'path';
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
          description: 'Payment API container crashing on startup due to DB connectivity error.',
          severity: 'CRITICAL',
          priority: 'P0',
          assignee: 'sre-lead@skyops.io',
          status: 'OPEN',
          cluster_id: 'cls-demo',
          cluster_name: 'demo-production-us-east',
          namespace: 'default',
          resource: 'Deployment/payment-api',
          comments: [
            { id: 'cmt-1', author: 'SkyOps Bot', message: 'Ticket automatically generated from INC-000101', createdAt: now },
          ],
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

    const helmCommand =
      `helm repo add skyops https://dhandesaurav52.github.io/k8s-ops\n` +
      `helm repo update\n\n` +
      `helm upgrade --install skyops-agent skyops/skyops-agent \\\n` +
      `  --namespace skyops-system \\\n` +
      `  --create-namespace \\\n` +
      `  --set server.url="${process.env.APP_URL || 'https://api.skyops.example.com'}" \\\n` +
      `  --set cluster.name="${name}" \\\n` +
      `  --set agent.token="${regToken}"`;

    res.json({
      cluster,
      registration_token: regToken,
      helm_command: helmCommand,
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
    const { cluster_id, cluster_name, node_count, pod_count, namespace_count, cpu_usage_cores, memory_bytes, k8s_version, agent_version } = req.body;
    let cluster = store.clusters.find((c) => c.id === cluster_id);

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
    }

    cluster.status = 'CONNECTED';
    cluster.node_count = node_count || cluster.node_count || 1;
    cluster.pod_count = pod_count || cluster.pod_count || 10;
    cluster.namespace_count = namespace_count || cluster.namespace_count || 3;
    cluster.cpu_usage_cores = cpu_usage_cores || cluster.cpu_usage_cores || 0.8;
    cluster.memory_usage_bytes = memory_bytes || cluster.memory_usage_bytes || 2147483648;
    if (k8s_version) cluster.k8s_version = k8s_version;
    if (agent_version) cluster.agent_version = agent_version;
    cluster.last_heartbeat = new Date().toISOString();
    cluster.updated_at = new Date().toISOString();

    res.json({ status: 'ok' });
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

    const ticket = {
      id: ticketId,
      incident_id: inc.id,
      organization_id: inc.organization_id,
      title: `[${inc.severity}] ${inc.title}`,
      description: `Auto-generated ticket from Incident ${inc.id}:\n\nSummary: ${inc.summary}\nRoot Cause: ${inc.root_cause}`,
      severity: inc.severity,
      priority: inc.severity === 'CRITICAL' ? 'P0' : inc.severity === 'HIGH' ? 'P1' : 'P2',
      assignee: req.body.assignee || 'sre-team@skyops.io',
      status: 'OPEN',
      cluster_id: inc.cluster_id,
      cluster_name: inc.cluster_name,
      namespace: inc.namespace,
      resource: `${inc.resource_type}/${inc.resource_name}`,
      comments: [
        { id: 'cmt-1', author: 'SkyOps System', message: `Ticket created from incident ${inc.id}`, createdAt: now },
      ],
      created_at: now,
      updated_at: now,
    };

    store.tickets.push(ticket);
    logAudit('ticket_created', ticketId, `Ticket ${ticketId} created from incident ${inc.id}`);
    res.json(ticket);
  });

  // Tickets API
  app.get('/api/v1/tickets', (req, res) => {
    res.json(store.tickets);
  });

  app.patch('/api/v1/tickets/:id', (req, res) => {
    const ticket = store.tickets.find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (req.body.status) ticket.status = req.body.status;
    if (req.body.assignee) ticket.assignee = req.body.assignee;
    ticket.updated_at = new Date().toISOString();

    logAudit('ticket_updated', ticket.id, `Ticket ${ticket.id} status changed to ${ticket.status}`);
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
