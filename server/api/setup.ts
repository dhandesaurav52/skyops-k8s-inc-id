import { Router, Request, Response } from 'express';
import { getRepository } from '../db';
import { hashPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { getDefaultCommunityLicense, parseAndValidateLicenseKey } from '../licensing/license';
import { getDeploymentMode, isDataTelemetryEnabled } from '../telemetry/privacy';
import { secretManager } from '../config/secrets';
import { PostgresRepository } from '../db/postgres';

export const setupRouter = Router();

// Helper to check if system has already completed initial setup
async function isSystemInitialized(): Promise<boolean> {
  const repo = await getRepository();
  const orgs = await repo.listOrganizations();
  for (const org of orgs) {
    const users = await repo.listUsersByOrg(org.id);
    const admins = users.filter((u) => u.role === 'ADMIN');
    if (admins.length > 0) return true;
  }
  return false;
}

// GET /api/v1/setup/status
setupRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const repo = await getRepository();
    const isInit = await isSystemInitialized();
    const dbHealth = await repo.healthCheck();
    const secretsStatus = secretManager.getStatus();

    return res.json({
      isInitialized: isInit,
      setupRequired: !isInit,
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

// POST /api/v1/setup/test-db (Admin / Installer utility to verify external Postgres)
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

// POST /api/v1/setup/initialize
setupRouter.post('/initialize', async (req: Request, res: Response) => {
  try {
    const isInit = await isSystemInitialized();
    if (isInit) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'SkyOps Control Plane is already initialized. Re-running the setup wizard is locked for security.',
      });
    }

    const {
      adminName,
      adminEmail,
      adminPassword,
      organizationName,
      licenseKey,
      seedSampleData = true,
    } = req.body;

    if (!adminEmail || !adminEmail.includes('@')) {
      return res.status(400).json({ error: 'ValidationError', message: 'A valid admin email address is required.' });
    }

    if (!adminName || adminName.trim().length < 2) {
      return res.status(400).json({ error: 'ValidationError', message: 'Admin name must be at least 2 characters.' });
    }

    if (!adminPassword || adminPassword.length < 8) {
      return res.status(400).json({ error: 'ValidationError', message: 'Password must be at least 8 characters long.' });
    }

    const orgName = organizationName && organizationName.trim().length > 0
      ? organizationName.trim()
      : 'Primary Infrastructure';

    const repo = await getRepository();

    // 1. Create or retrieve primary organization
    let org = await repo.getOrganizationBySlug('default');
    if (!org) {
      org = await repo.createOrganization(orgName, 'default');
    }

    // 2. Create the primary Admin user
    const passwordHash = await hashPassword(adminPassword);
    const adminUser = await repo.createUser({
      email: adminEmail.trim().toLowerCase(),
      name: adminName.trim(),
      password_hash: passwordHash,
      role: 'ADMIN',
      organization_id: org.id,
    });

    // 3. Process License (either custom key or default Community key)
    let licenseObj;
    if (licenseKey && typeof licenseKey === 'string' && licenseKey.trim().length > 0) {
      const validation = parseAndValidateLicenseKey(licenseKey.trim());
      if (validation.valid && validation.claims) {
        licenseObj = {
          ...validation.claims,
          organization_id: org.id,
          signature: licenseKey.trim(),
          is_valid: true,
        };
        await repo.saveLicense(licenseObj);
      } else {
        // Fallback to Community if key is invalid
        licenseObj = getDefaultCommunityLicense(org.id);
        await repo.saveLicense(licenseObj);
      }
    } else {
      licenseObj = getDefaultCommunityLicense(org.id);
      await repo.saveLicense(licenseObj);
    }

    // 4. Optionally seed sample evaluation accounts & test cluster
    if (seedSampleData) {
      const sreEmail = 'sre@skyops.io';
      if (!(await repo.getUserByEmail(sreEmail))) {
        const pwdHash = await hashPassword('SkyOpsSre123!');
        await repo.createUser({
          email: sreEmail,
          name: 'Alex Rivera (Staff SRE)',
          password_hash: pwdHash,
          role: 'SRE',
          organization_id: org.id,
        });
      }

      const devEmail = 'dev@skyops.io';
      if (!(await repo.getUserByEmail(devEmail))) {
        const pwdHash = await hashPassword('SkyOpsDev123!');
        await repo.createUser({
          email: devEmail,
          name: 'Jordan Lee (Dev Lead)',
          password_hash: pwdHash,
          role: 'DEVELOPER',
          organization_id: org.id,
        });
      }
    }

    // 5. Emit Audit Log
    await repo.createAuditLog({
      organization_id: org.id,
      user_id: adminUser.id,
      user_email: adminUser.email,
      action: 'SYSTEM_INITIALIZATION',
      resource: 'control-plane',
      details: JSON.stringify({
        organization: org.name,
        deployment_mode: getDeploymentMode(),
        license_plan: licenseObj.plan,
        seeded_samples: seedSampleData,
      }),
      ip_address: req.ip || '127.0.0.1',
    });

    // 6. Sign JWT token for the newly created admin
    const token = signToken({
      userId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      organizationId: org.id,
    });

    return res.status(201).json({
      message: 'SkyOps Control Plane initialized successfully.',
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        organization_id: adminUser.organization_id,
        created_at: adminUser.created_at,
      },
      organization: org,
      license: licenseObj,
    });
  } catch (err: any) {
    console.error('[SkyOps Setup Error]', err);
    return res.status(500).json({ error: 'SetupInitializationFailed', message: err.message });
  }
});
