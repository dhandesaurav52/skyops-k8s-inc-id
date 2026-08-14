import { Router, Response } from 'express';
import { getRepository } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

export const organizationsRouter = Router();

// GET /api/v1/organizations/current
organizationsRouter.get('/current', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const org = await repo.getOrganizationById(req.user!.organizationId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    return res.json(org);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve organization' });
  }
});

// PATCH /api/v1/organizations/current (ADMIN only)
organizationsRouter.patch('/current', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Organization name cannot be empty' });
  }

  try {
    const repo = await getRepository();
    const updated = await repo.updateOrganization(req.user!.organizationId, { name: name.trim() });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'organization_updated',
      resource: `Organization/${req.user!.organizationId}`,
      details: `Admin ${req.user!.email} renamed organization to "${name.trim()}"`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update organization' });
  }
});
