import { Router, Response } from 'express';
import { getRepository } from '../db';
import { comparePassword, hashPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const repo = await getRepository();
    const user = await repo.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const org = await repo.getOrganizationById(user.organization_id);

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organization_id,
    });

    await repo.createAuditLog({
      organization_id: user.organization_id,
      user_id: user.id,
      user_email: user.email,
      action: 'user_login',
      resource: `User/${user.id}`,
      details: `User ${user.email} logged in successfully`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        organization_name: org?.name || 'SkyOps Organization',
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const user = await repo.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const org = await repo.getOrganizationById(user.organization_id);
    const license = await repo.getLicenseByOrg(user.organization_id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        organization_name: org?.name || 'SkyOps Organization',
        created_at: user.created_at,
      },
      organization: org,
      license: license
        ? {
            plan: license.plan,
            max_clusters: license.max_clusters,
            max_users: license.max_users,
            expires_at: license.expires_at,
            features: license.features,
          }
        : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch current user profile' });
  }
});

// POST /api/v1/auth/change-password
authRouter.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  try {
    const repo = await getRepository();
    const user = await repo.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePassword(current_password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await hashPassword(new_password);
    await repo.updateUser(user.id, { password_hash: newHash });

    await repo.createAuditLog({
      organization_id: user.organization_id,
      user_id: user.id,
      user_email: user.email,
      action: 'password_changed',
      resource: `User/${user.id}`,
      details: `User ${user.email} updated account password`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({ status: 'ok', message: 'Password updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// POST /api/v1/auth/logout
authRouter.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    if (req.user) {
      await repo.createAuditLog({
        organization_id: req.user.organizationId,
        user_id: req.user.userId,
        user_email: req.user.email,
        action: 'user_logout',
        resource: `User/${req.user.userId}`,
        details: `User ${req.user.email} logged out`,
        ip_address: req.ip || '127.0.0.1',
      });
    }
    return res.json({ status: 'ok', message: 'Logged out successfully' });
  } catch (err: any) {
    return res.json({ status: 'ok' });
  }
});
