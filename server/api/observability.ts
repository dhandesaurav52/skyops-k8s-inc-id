import { Router, Request, Response } from 'express';
import { getRepository } from '../db';
import { getDeploymentMode, isDataTelemetryEnabled } from '../telemetry/privacy';

export const observabilityRouter = Router();

// Startup timestamp
const startTime = Date.now();

// Request counters
let totalRequests = 0;
let totalAuthFailures = 0;
let totalHeartbeats = 0;
let totalIncidentsReported = 0;

export function trackRequest(isAuthFailure = false) {
  totalRequests++;
  if (isAuthFailure) totalAuthFailures++;
}

export function trackHeartbeat() {
  totalHeartbeats++;
}

export function trackIncidentReported() {
  totalIncidentsReported++;
}

// GET /health
observabilityRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const repo = await getRepository();
    const dbHealth = await repo.healthCheck();

    const status = dbHealth.healthy ? 200 : 503;
    return res.status(status).json({
      status: dbHealth.healthy ? 'HEALTHY' : 'DEGRADED',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      deployment_mode: getDeploymentMode(),
      database: dbHealth,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'UNHEALTHY',
      error: err.message,
    });
  }
});

// GET /ready
observabilityRouter.get('/ready', async (req: Request, res: Response) => {
  try {
    const repo = await getRepository();
    const dbHealth = await repo.healthCheck();
    if (!dbHealth.healthy) {
      return res.status(503).json({ ready: false, reason: 'Database connection unhealthy' });
    }
    return res.status(200).json({ ready: true, mode: getDeploymentMode() });
  } catch (err: any) {
    return res.status(503).json({ ready: false, error: err.message });
  }
});

// GET /metrics (Prometheus metric format)
observabilityRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const repo = await getRepository();
    const orgs = await repo.listOrganizations();
    let totalClusters = 0;
    let totalConnectedClusters = 0;
    let totalActiveIncidents = 0;
    let totalOpenTickets = 0;

    for (const org of orgs) {
      const cls = await repo.listClustersByOrg(org.id);
      totalClusters += cls.length;
      totalConnectedClusters += cls.filter((c) => c.status === 'CONNECTED').length;

      const incs = await repo.listIncidentsByOrg(org.id);
      totalActiveIncidents += incs.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;

      const ticks = await repo.listTicketsByOrg(org.id);
      totalOpenTickets += ticks.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
    }

    const uptime = Math.floor((Date.now() - startTime) / 1000);

    const metrics = `# HELP skyops_uptime_seconds Total uptime in seconds
# TYPE skyops_uptime_seconds gauge
skyops_uptime_seconds ${uptime}

# HELP skyops_http_requests_total Total HTTP requests processed
# TYPE skyops_http_requests_total counter
skyops_http_requests_total ${totalRequests}

# HELP skyops_auth_failures_total Total authentication failures
# TYPE skyops_auth_failures_total counter
skyops_auth_failures_total ${totalAuthFailures}

# HELP skyops_agent_heartbeats_total Total agent heartbeats received
# TYPE skyops_agent_heartbeats_total counter
skyops_agent_heartbeats_total ${totalHeartbeats}

# HELP skyops_incidents_reported_total Total incident signals received
# TYPE skyops_incidents_reported_total counter
skyops_incidents_reported_total ${totalIncidentsReported}

# HELP skyops_managed_clusters Total clusters registered
# TYPE skyops_managed_clusters gauge
skyops_managed_clusters ${totalClusters}

# HELP skyops_connected_clusters Total clusters actively connected
# TYPE skyops_connected_clusters gauge
skyops_connected_clusters ${totalConnectedClusters}

# HELP skyops_active_incidents Total active unresolved incidents across tenants
# TYPE skyops_active_incidents gauge
skyops_active_incidents ${totalActiveIncidents}

# HELP skyops_open_tickets Total open SRE tickets across tenants
# TYPE skyops_open_tickets gauge
skyops_open_tickets ${totalOpenTickets}
`;

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    return res.send(metrics);
  } catch (err: any) {
    return res.status(500).send('# Error collecting metrics');
  }
});
