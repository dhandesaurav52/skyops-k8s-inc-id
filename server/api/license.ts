import { Router, Response } from 'express';
import { getRepository } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { parseAndValidateLicenseKey, generateLicenseKey, LicenseClaims } from '../licensing/license';

export const licenseRouter = Router();

// GET /api/v1/license
licenseRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const license = await repo.getLicenseByOrg(req.user!.organizationId);
    const clusters = await repo.listClustersByOrg(req.user!.organizationId);
    const users = await repo.listUsersByOrg(req.user!.organizationId);

    if (!license) {
      return res.json({
        plan: 'COMMUNITY',
        max_clusters: 5,
        max_users: 10,
        current_clusters: clusters.length,
        current_users: users.length,
        is_valid: true,
        expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
        features: {
          advanced_rca: true,
          sso_enabled: false,
          audit_retention_days: 90,
          custom_runbooks: true,
          data_telemetry: false,
          unlimited_tickets: true,
        },
      });
    }

    return res.json({
      id: license.id,
      plan: license.plan,
      max_clusters: license.max_clusters,
      max_users: license.max_users,
      current_clusters: clusters.length,
      current_users: users.length,
      issued_at: license.issued_at,
      expires_at: license.expires_at,
      features: license.features,
      is_valid: license.is_valid,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch license details' });
  }
});

// POST /api/v1/license/activate (ADMIN only)
licenseRouter.post('/activate', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { license_key } = req.body;

  if (!license_key) {
    return res.status(400).json({ error: 'license_key is required' });
  }

  const verification = parseAndValidateLicenseKey(license_key);
  if (!verification.valid || !verification.claims) {
    return res.status(400).json({
      error: 'Invalid license key',
      details: verification.error,
    });
  }

  const claims = verification.claims;

  try {
    const repo = await getRepository();
    const updatedLicense = await repo.saveLicense({
      id: claims.id,
      organization_id: req.user!.organizationId,
      plan: claims.plan,
      max_clusters: claims.max_clusters,
      max_users: claims.max_users,
      features: claims.features,
      issued_at: claims.issued_at,
      expires_at: claims.expires_at,
      signature: license_key,
      is_valid: true,
    });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'license_activated',
      resource: `License/${claims.id}`,
      details: `Admin ${req.user!.email} activated ${claims.plan} license (Clusters: ${claims.max_clusters}, Users: ${claims.max_users})`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({
      status: 'ok',
      message: `License upgraded to ${claims.plan} plan successfully`,
      license: updatedLicense,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to apply license key', details: err.message });
  }
});

// POST /api/v1/license/generate-demo-key (For testing Enterprise / Pro tier activation in UI)
licenseRouter.post('/generate-demo-key', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { plan = 'ENTERPRISE' } = req.body;
  const now = new Date();
  const expires = new Date();
  expires.setFullYear(now.getFullYear() + 1);

  const claims: LicenseClaims = {
    id: `lic-${req.user!.organizationId}-${plan.toLowerCase()}-${Date.now().toString(36)}`,
    organization_id: req.user!.organizationId,
    plan: plan as any,
    max_clusters: plan === 'ENTERPRISE' ? 100 : 25,
    max_users: plan === 'ENTERPRISE' ? 250 : 50,
    features: {
      advanced_rca: true,
      sso_enabled: plan === 'ENTERPRISE',
      audit_retention_days: plan === 'ENTERPRISE' ? 365 : 180,
      custom_runbooks: true,
      data_telemetry: false,
      unlimited_tickets: true,
    },
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };

  const key = generateLicenseKey(claims);
  return res.json({ license_key: key, plan, claims });
});
