import { Router, Response } from 'express';
import { getRepository } from '../db';
import { hashPassword } from '../auth/password';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { Role } from '../db/types';

export const usersRouter = Router();

// List users for organization (ADMIN, SRE can list)
usersRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repo = await getRepository();
    const users = await repo.listUsersByOrg(req.user!.organizationId);

    const publicUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      organization_id: u.organization_id,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));

    return res.json(publicUsers);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user (ADMIN only)
usersRouter.post('/', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { email, name, password, role } = req.body;

  if (!email || !name || !password || !role) {
    return res.status(400).json({ error: 'Email, name, password, and role are required' });
  }

  const validRoles: Role[] = ['ADMIN', 'SRE', 'DEVELOPER', 'VIEWER'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const repo = await getRepository();

    // Check user limit from license
    const license = await repo.getLicenseByOrg(req.user!.organizationId);
    const existingUsers = await repo.listUsersByOrg(req.user!.organizationId);
    if (license && existingUsers.length >= license.max_users) {
      return res.status(403).json({
        error: 'User limit reached',
        message: `Your current plan allows up to ${license.max_users} users. Upgrade your license to add more members.`,
      });
    }

    const existing = await repo.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await repo.createUser({
      email,
      name,
      password_hash: passwordHash,
      role,
      organization_id: req.user!.organizationId,
    });

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'user_created',
      resource: `User/${newUser.id}`,
      details: `Admin ${req.user!.email} created user ${newUser.email} with role ${newUser.role}`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      organization_id: newUser.organization_id,
      created_at: newUser.created_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create user', details: err.message });
  }
});

// Update user role or profile (ADMIN only)
usersRouter.patch('/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, role, password } = req.body;

  try {
    const repo = await getRepository();
    const targetUser = await repo.getUserById(id);

    if (!targetUser || targetUser.organization_id !== req.user!.organizationId) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (role) {
      const validRoles: Role[] = ['ADMIN', 'SRE', 'DEVELOPER', 'VIEWER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.role = role;
    }
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      updates.password_hash = await hashPassword(password);
    }

    const updated = await repo.updateUser(id, updates);

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'user_updated',
      resource: `User/${id}`,
      details: `Admin ${req.user!.email} updated user ${targetUser.email}`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({
      id: updated!.id,
      email: updated!.email,
      name: updated!.name,
      role: updated!.role,
      organization_id: updated!.organization_id,
      updated_at: updated!.updated_at,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (ADMIN only)
usersRouter.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (id === req.user!.userId) {
    return res.status(400).json({ error: 'Cannot delete your own administrator account' });
  }

  try {
    const repo = await getRepository();
    const targetUser = await repo.getUserById(id);

    if (!targetUser || targetUser.organization_id !== req.user!.organizationId) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    await repo.deleteUser(id);

    await repo.createAuditLog({
      organization_id: req.user!.organizationId,
      user_id: req.user!.userId,
      user_email: req.user!.email,
      action: 'user_deleted',
      resource: `User/${id}`,
      details: `Admin ${req.user!.email} deleted user ${targetUser.email}`,
      ip_address: req.ip || '127.0.0.1',
    });

    return res.json({ status: 'ok', message: `User ${targetUser.email} deleted` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});
