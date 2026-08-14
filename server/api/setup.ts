import { Router, Request, Response } from 'express';
import { getRepository } from '../db';
import { bootstrapManager } from '../auth/bootstrap';
import { getDeploymentMode, isDataTelemetryEnabled } from '../telemetry/privacy';
import { secretManager } from '../config/secrets';
import { PostgresRepository } from '../db/postgres';

export const setupRouter = Router();

// GET /api/v1/setup/status or /api/v1/bootstrap/status
setupRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const repo = await getRepository();
    const bootstrapStatus = await bootstrapManager.getStatus(repo);
    const dbHealth = await repo.healthCheck();
    const secretsStatus = secretManager.getStatus();

    return res.json({
      isInitialized: bootstrapStatus.isInitialized,
      setupRequired: bootstrapStatus.setupRequired,
      lifecycleState: bootstrapStatus.lifecycleState,
      passwordFilePath: bootstrapStatus.passwordFilePath,
      instructions: bootstrapStatus.instructions,
      deploymentMode: getDeploymentMode(),
      telemetryEnabled: isDataTelemetryEnabled(),
      database: {
        type: dbHealth.type,
        healthy: dbHealth.healthy,
      },
      secrets: {
        jwtSource: secretsStatus.jwtSecretSource,
        licenseSource: secretsStatus.licenseSecretSource,
        isPersisted: secretsStatus.isSecretsFilePersisted,
      },
      version: '1.0.0',
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to query setup status', details: err.message });
  }
});

// POST /api/v1/setup/verify-bootstrap-password
setupRouter.post('/verify-bootstrap-password', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Please provide the one-time initial administrator password.',
      });
    }

    const repo = await getRepository();
    const result = await bootstrapManager.verifyBootstrapPassword(repo, password);
    return res.json(result);
  } catch (err: any) {
    return res.status(401).json({
      error: 'AuthenticationFailed',
      message: err.message || 'Invalid initial administrator password.',
    });
  }
});

// POST /api/v1/setup/create-admin
setupRouter.post('/create-admin', async (req: Request, res: Response) => {
  try {
    const {
      bootstrapToken,
      name,
      email,
      password,
      confirmPassword,
      organizationName,
    } = req.body;

    if (password && confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Passwords do not match. Please verify and try again.',
      });
    }

    const repo = await getRepository();
    const result = await bootstrapManager.createPermanentAdministrator(repo, bootstrapToken, {
      name,
      email,
      password,
      organizationName,
      ipAddress: req.ip || '127.0.0.1',
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(400).json({
      error: 'AdminCreationError',
      message: err.message || 'Failed to create administrator account.',
    });
  }
});

// POST /api/v1/setup/test-db
setupRouter.post('/test-db', async (req: Request, res: Response) => {
  const { databaseUrl } = req.body;
  if (!databaseUrl || typeof databaseUrl !== 'string') {
    return res.status(400).json({ success: false, message: 'DATABASE_URL is required' });
  }

  try {
    const testPg = new PostgresRepository(databaseUrl);
    const health = await testPg.healthCheck();
    if (health.healthy) {
      return res.json({ success: true, message: 'PostgreSQL connection verified successfully' });
    } else {
      return res.status(400).json({ success: false, message: `Database check failed: ${health.details}` });
    }
  } catch (err: any) {
    return res.status(400).json({ success: false, message: `Connection error: ${err.message}` });
  }
});
