import jwt from 'jsonwebtoken';
import { Role } from '../db/types';
import { secretManager } from '../config/secrets';

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function signToken(payload: TokenPayload): string {
  const secret = secretManager.getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = secretManager.getJwtSecret();
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
