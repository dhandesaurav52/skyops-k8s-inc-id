import { Router, Response } from 'express';
import { getRepository } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

export const telemetryRouter = Router();

// GET /api/v1/audit
telemetryRouter.get('/audit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const logs = await repo.listAuditLogsByOrg(req.user!.organizationId, 200);
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/v1/events
telemetryRouter.get('/events', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const events = await repo.listK8sEventsByOrg(req.user!.organizationId, 100);
    return res.json(events);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/v1/nodes
telemetryRouter.get('/nodes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const nodes = await repo.listNodeHealthByOrg(req.user!.organizationId);
    return res.json(nodes);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch nodes' });
  }
});

// GET /api/v1/workloads
telemetryRouter.get('/workloads', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const workloads = await repo.listWorkloadHealthByOrg(req.user!.organizationId);
    return res.json(workloads);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch workloads' });
  }
});

// POST /api/v1/simulate-incident (ADMIN, SRE)
telemetryRouter.post('/simulate-incident', authenticateToken, requireRole('ADMIN', 'SRE'), async (req: AuthenticatedRequest, res: Response) => {
  const now = new Date().toISOString();

  try {
    const repo = await getRepository();
    let clusters = await repo.listClustersByOrg(req.user!.organizationId);

    if (clusters.length === 0) {
      const newCluster = await repo.createCluster({
        organization_id: req.user!.organizationId,
        name: 'production-us-east',
        environment: 'production',
        status: 'CONNECTED',
        agent_version: 'v1.0.0',
        k8s_version: 'v1.30.0',
        node_count: 8,
        pod_count: 64,
        namespace_count: 6,
        active_incidents: 1,
        cpu_usage_cores: 14.2,
        memory_usage_bytes: 42949672960,
        last_heartbeat: now,
        is_demo: true,
      });
      clusters = [newCluster];
    }

    const cluster = clusters[0];

    const scenarios = [
      {
        title: 'Pod CrashLoopBackOff detected on checkout-service',
        category: 'CrashLoopBackOff',
        severity: 'CRITICAL' as const,
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
        severity: 'HIGH' as const,
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
        severity: 'HIGH' as const,
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

    const newIncident = await repo.createIncident({
      organization_id: req.user!.organizationId,
      cluster_id: cluster.id,
      cluster_name: cluster.name,
      title: scenario.title,
      summary: scenario.summary,
      category: scenario.category,
      severity: scenario.severity,
      status: 'OPEN',
      resource_type: scenario.resource_type,
      resource_name: scenario.resource_name,
      namespace: scenario.namespace,
      occurrences: 1,
      first_detected: now,
      last_detected: now,
      impact: scenario.impact,
      root_cause: scenario.root_cause,
      suggested_actions: scenario.suggested_actions,
      suggested_command: scenario.suggested_command,
      evidence: [
        `K8s Event: ${scenario.category} occurred on ${scenario.resource_type}/${scenario.resource_name}`,
        'Prometheus alert triggered with threshold condition > 5 anomalies',
      ],
      timeline: [
        {
          timestamp: now,
          title: 'Incident Detected',
          detail: `Telemetry alert received for ${scenario.title}`,
          type: 'event',
        },
      ],
      is_demo: false,
    });

    await repo.saveK8sEvents([
      {
        organization_id: req.user!.organizationId,
        cluster_id: cluster.id,
        cluster_name: cluster.name,
        namespace: scenario.namespace,
        resource: scenario.resource_name,
        kind: scenario.resource_type,
        type: 'Warning',
        reason: scenario.category,
        message: `${scenario.title} on ${scenario.namespace}/${scenario.resource_name}`,
        count: 1,
        first_observed: now,
        last_observed: now,
      },
    ]);

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'signal_injected',
      resource: `Incident/${newIncident.id}`,
      details: `Operator ${req.user!.email} injected failure signal: ${scenario.title}`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(newIncident);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to simulate incident', details: err.message });
  }
});

// Demo Sandbox State (Per Organization)
const demoState: Record<string, boolean> = {};

// GET /api/v1/demo-mode
telemetryRouter.get('/demo-mode', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const isDemo = demoState[req.user!.organizationId] || false;
  return res.json({ demoMode: isDemo });
});

// POST /api/v1/demo-mode
telemetryRouter.post('/demo-mode', authenticateToken, requireRole('ADMIN', 'SRE'), async (req: AuthenticatedRequest, res: Response) => {
  const { enabled } = req.body;
  const isEnabled = !!enabled;
  const orgId = req.user!.organizationId;
  demoState[orgId] = isEnabled;

  try {
    const repo = await getRepository();
    const now = new Date().toISOString();

    if (isEnabled) {
      // Seed rich sandbox dataset if none exists
      const existingClusters = await repo.listClustersByOrg(orgId);
      if (existingClusters.length === 0) {
        const prodCluster = await repo.createCluster({
          organization_id: orgId,
          name: 'production-us-east',
          environment: 'production',
          status: 'CONNECTED',
          agent_version: 'v1.0.0',
          k8s_version: 'v1.30.2',
          node_count: 12,
          pod_count: 84,
          namespace_count: 8,
          active_incidents: 2,
          cpu_usage_cores: 22.4,
          memory_usage_bytes: 68719476736,
          last_heartbeat: now,
          is_demo: true,
        });

        const stagingCluster = await repo.createCluster({
          organization_id: orgId,
          name: 'staging-eu-west',
          environment: 'staging',
          status: 'CONNECTED',
          agent_version: 'v1.0.0',
          k8s_version: 'v1.30.0',
          node_count: 4,
          pod_count: 28,
          namespace_count: 4,
          active_incidents: 0,
          cpu_usage_cores: 6.2,
          memory_usage_bytes: 17179869184,
          last_heartbeat: now,
          is_demo: true,
        });

        // Seed incidents
        const inc1 = await repo.createIncident({
          organization_id: orgId,
          cluster_id: prodCluster.id,
          cluster_name: prodCluster.name,
          title: 'CrashLoopBackOff detected on checkout-service',
          status: 'OPEN',
          severity: 'CRITICAL',
          category: 'CrashLoopBackOff',
          namespace: 'production',
          resource_type: 'Pod',
          resource_name: 'checkout-service-7f8d9b4c-2xk9l',
          pod_name: 'checkout-service-7f8d9b4c-2xk9l',
          occurrences: 14,
          summary: 'Checkout microservice pods continuously terminating with exit code 137.',
          impact: 'User checkout flows returning 502 Bad Gateway. 12% revenue impact.',
          root_cause: 'Container JVM Heap exceeded cgroup memory limit (256Mi). OOMKilled by Linux kernel.',
          evidence: [
            'Pod state: Terminated (Reason: OOMKilled, ExitCode: 137)',
            'K8s Event: BackOff restarting failed container checkout-service',
            'Last log: java.lang.OutOfMemoryError: Java heap space',
          ],
          timeline: [
            { timestamp: now, title: 'Incident Detected', detail: 'Agent detected repeated exit code 137.', type: 'event' },
          ],
          suggested_actions: [
            'Increase memory limits in values.yaml from 256Mi to 1Gi',
            'Trigger rolling restart: kubectl rollout restart deployment/checkout-service -n production',
          ],
          suggested_command: 'kubectl scale deployment checkout-service -n production --replicas=4',
          first_detected: now,
          last_detected: now,
          is_demo: true,
        });

        // Seed ticket
        await repo.createTicket({
          incident_id: inc1.id,
          organization_id: orgId,
          title: '[CRITICAL] CrashLoopBackOff on checkout-service',
          description: 'Automated remediation ticket for JVM heap exhaustion.',
          severity: 'CRITICAL',
          priority: 'P0',
          assignee: 'sre@skyops.io',
          status: 'OPEN',
          cluster_id: prodCluster.id,
          cluster_name: prodCluster.name,
          namespace: 'production',
          resource: 'Pod/checkout-service',
          category: 'CrashLoopBackOff',
          impact: 'High transaction drop rate',
          root_cause: 'Container JVM Heap exceeded cgroup memory limit (256Mi).',
          tasks: [
            { id: 'tsk-1', text: 'Increase deployment memory limit to 1Gi', completed: false },
            { id: 'tsk-2', text: 'Apply Helm upgrade and verify pod rollout', completed: false },
          ],
          timeline: [{ timestamp: now, title: 'Ticket Generated', detail: 'Generated from incident', type: 'event' }],
          comments: [{ id: 'cmt-1', author: 'SkyOps System', message: 'Ticket opened for critical alert.', createdAt: now }],
          tags: ['CrashLoopBackOff', 'production', 'OOMKilled'],
          is_demo: true,
        });

        // Seed nodes
        await repo.saveNodeHealth([
          {
            organization_id: orgId,
            cluster_id: prodCluster.id,
            cluster_name: prodCluster.name,
            name: 'ip-10-0-1-101.ec2.internal',
            status: 'Ready',
            k8s_version: 'v1.30.2',
            cpu_allocatable: '8',
            mem_allocatable: '32Gi',
            pod_count: 24,
            memory_pressure: false,
            disk_pressure: false,
            pid_pressure: false,
          },
          {
            organization_id: orgId,
            cluster_id: prodCluster.id,
            cluster_name: prodCluster.name,
            name: 'ip-10-0-1-102.ec2.internal',
            status: 'Ready',
            k8s_version: 'v1.30.2',
            cpu_allocatable: '8',
            mem_allocatable: '32Gi',
            pod_count: 22,
            memory_pressure: false,
            disk_pressure: false,
            pid_pressure: false,
          },
        ]);

        // Seed workloads
        await repo.saveWorkloadHealth([
          {
            organization_id: orgId,
            cluster_id: prodCluster.id,
            cluster_name: prodCluster.name,
            namespace: 'production',
            name: 'checkout-service',
            kind: 'Deployment',
            desired: 3,
            ready: 1,
            available: 1,
            status: 'DEGRADED',
          },
          {
            organization_id: orgId,
            cluster_id: prodCluster.id,
            cluster_name: prodCluster.name,
            namespace: 'production',
            name: 'order-processing',
            kind: 'Deployment',
            desired: 4,
            ready: 4,
            available: 4,
            status: 'HEALTHY',
          },
        ]);
      }
    }

    await repo.createAuditLog({
      organization_id: orgId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'demo_mode_toggled',
      resource: 'System',
      details: `Operator ${req.user!.email} ${isEnabled ? 'enabled' : 'disabled'} Demo Sandbox Mode`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({ demoMode: isEnabled });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to toggle demo mode', details: err.message });
  }
});
