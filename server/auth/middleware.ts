import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from './jwt';
import { Role, Cluster } from '../db/types';
import { Permission, hasPermission, isRoleAtLeast } from './roles';
import { getRepository } from '../db';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  cluster?: Cluster;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please provide a valid Bearer token.',
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token. Please log in again.',
    });
  }

  req.user = payload;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
      });
    }

    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Missing required permission: ${permission}`,
      });
    }

    next();
  };
}

export async function requireClusterToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) ||
    (req.headers['x-skyops-cluster-token'] as string);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Cluster agent authentication token is required.',
    });
  }

  const tokenHash = hashToken(token);
  const repo = await getRepository();
  const cluster = await repo.getClusterByTokenHash(tokenHash);

  if (!cluster) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or revoked cluster token.',
    });
  }

  req.cluster = cluster;
  next();
}
