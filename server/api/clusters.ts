import { Router, Response } from 'express';
import crypto from 'crypto';
import { getRepository } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest, hashToken } from '../auth/middleware';

export const clustersRouter = Router();

// GET /api/v1/clusters
clustersRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const clusters = await repo.listClustersByOrg(req.user!.organizationId);
    return res.json(clusters);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// GET /api/v1/clusters/:id
clustersRouter.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const cluster = await repo.getClusterById(req.params.id, req.user!.organizationId);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }
    return res.json(cluster);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch cluster' });
  }
});

// POST /api/v1/clusters/register (ADMIN, SRE)
clustersRouter.post('/register', authenticateToken, requireRole('ADMIN', 'SRE'), async (req: AuthenticatedRequest, res: Response) => {
  const { name, environment = 'production' } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Cluster name is required' });
  }

  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    const repo = await getRepository();

    // Check cluster limits
    const license = await repo.getLicenseByOrg(req.user!.organizationId);
    const existingClusters = await repo.listClustersByOrg(req.user!.organizationId);
    if (license && existingClusters.length >= license.max_clusters) {
      return res.status(403).json({
        error: 'Cluster limit reached',
        message: `Your current license allows up to ${license.max_clusters} connected clusters. Upgrade license for additional clusters.`,
      });
    }

    const rawRegToken = `skyops_reg_${crypto.randomBytes(16).toString('hex')}`;
    const regTokenHash = hashToken(rawRegToken);

    // Check if cluster with same name exists
    const existing = await repo.getClusterByName(cleanName, req.user!.organizationId);
    let cluster;

    if (existing) {
      cluster = await repo.updateCluster(existing.id, {
        environment,
        registration_token_hash: regTokenHash,
        status: 'UNKNOWN',
        updated_at: new Date().toISOString(),
      });
    } else {
      cluster = await repo.createCluster({
        organization_id: req.user!.organizationId,
        name: cleanName,
        environment,
        status: 'UNKNOWN',
        agent_version: 'v1.0.0',
        k8s_version: 'v1.30.0',
        registration_token_hash: regTokenHash,
        node_count: 0,
        pod_count: 0,
        namespace_count: 0,
        active_incidents: 0,
        cpu_usage_cores: 0,
        memory_usage_bytes: 0,
        last_heartbeat: new Date().toISOString(),
      });
    }

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'cluster_registration_initiated',
      resource: `Cluster/${cluster!.id}`,
      details: `Generated registration token for cluster "${cluster!.name}" (${environment})`,
      ip_address: req.ip || '127.0.0.1',
    });

    const origin = `${req.protocol}://${req.get('host')}`;

    return res.json({
      status: 'ok',
      registration_token: rawRegToken,
      cluster,
      install_command: `curl -fsSL ${origin}/agent.sh | SKYOPS_TOKEN="${rawRegToken}" SKYOPS_CLUSTER="${cluster!.name}" SKYOPS_SERVER_URL="${origin}" bash`,
      helm_command: `helm repo add skyops https://charts.skyops.io && helm upgrade --install skyops-agent skyops/skyops-agent --set server.url="${origin}" --set agent.token="${rawRegToken}" --set cluster.name="${cluster!.name}" --namespace skyops --create-namespace`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to initiate cluster registration', details: err.message });
  }
});

// POST /api/v1/clusters/:id/rotate-token (ADMIN, SRE)
clustersRouter.post('/:id/rotate-token', authenticateToken, requireRole('ADMIN', 'SRE'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const repo = await getRepository();
    const cluster = await repo.getClusterById(id, req.user!.organizationId);

    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    const rawRegToken = `skyops_reg_${crypto.randomBytes(16).toString('hex')}`;
    const regTokenHash = hashToken(rawRegToken);

    await repo.updateCluster(cluster.id, {
      registration_token_hash: regTokenHash,
      cluster_token_hash: undefined, // Revoke current cluster token
    });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'cluster_token_rotated',
      resource: `Cluster/${cluster.id}`,
      details: `Rotated credentials for cluster "${cluster.name}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    const origin = `${req.protocol}://${req.get('host')}`;

    return res.json({
      status: 'ok',
      message: 'Cluster token rotated. Please update your cluster agent with the new registration token.',
      registration_token: rawRegToken,
      install_command: `curl -fsSL ${origin}/agent.sh | SKYOPS_TOKEN="${rawRegToken}" SKYOPS_CLUSTER="${cluster.name}" SKYOPS_SERVER_URL="${origin}" bash`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to rotate cluster token' });
  }
});

// DELETE /api/v1/clusters/:id (ADMIN only)
clustersRouter.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const repo = await getRepository();
    const cluster = await repo.getClusterById(id, req.user!.organizationId);

    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    await repo.deleteCluster(id, req.user!.organizationId);

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'cluster_deleted',
      resource: `Cluster/${id}`,
      details: `Admin ${req.user!.email} deleted cluster "${cluster.name}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({ status: 'ok', message: `Cluster ${cluster.name} deleted successfully` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete cluster' });
  }
});
