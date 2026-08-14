import { Router, Response } from 'express';
import { getRepository } from '../db';
import { optionalAuth, AuthenticatedRequest } from '../auth/middleware';
import { getDeploymentMode, isDataTelemetryEnabled } from '../telemetry/privacy';
import { secretManager } from '../config/secrets';

export const systemRouter = Router();

// GET /api/v1/system/info
systemRouter.get('/info', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const dbHealth = await repo.healthCheck();
    const mode = getDeploymentMode();
    const telemetryEnabled = isDataTelemetryEnabled();
    const secretStatus = secretManager.getStatus();

    let limits = {
      plan: 'COMMUNITY',
      maxClusters: 5,
      maxUsers: 10,
    };

    if (req.user) {
      const license = await repo.getLicenseByOrg(req.user.organizationId);
      if (license) {
        limits = {
          plan: license.plan,
          maxClusters: license.max_clusters,
          maxUsers: license.max_users,
        };
      }
    }

    const uptimeSeconds = Math.floor(process.uptime());

    return res.json({
      product: 'SkyOps Kubernetes Incident Intelligence Platform',
      version: '1.0.0',
      deploymentMode: mode,
      uptimeSeconds,
      dataPrivacy: {
        telemetryEnabled,
        mode: telemetryEnabled ? 'ANONYMIZED_TELEMETRY' : 'STRICT_LOCAL_ONLY',
        description:
          mode === 'self-hosted'
            ? 'Self-Hosted mode active: All cluster telemetry, incidents, and audit logs are retained locally inside your environment.'
            : 'Cloud Managed Control Plane mode active.',
      },
      database: dbHealth,
      secrets: {
        jwtSecretSource: secretStatus.jwtSecretSource,
        jwtSecretConfigured: secretStatus.jwtSecretConfigured,
        licenseSecretSource: secretStatus.licenseSecretSource,
        licenseSecretConfigured: secretStatus.licenseSecretConfigured,
        encryptionKeySource: secretStatus.encryptionKeySource,
        isSecretsFilePersisted: secretStatus.isSecretsFilePersisted,
        secretsFilePath: secretStatus.secretsFilePath,
      },
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      limits,
      authenticated: !!req.user,
      userRole: req.user?.role || null,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve system status', details: err.message });
  }
});

