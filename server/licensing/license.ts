import crypto from 'crypto';
import { License, PlanType } from '../db/types';
import { secretManager } from '../config/secrets';

export interface LicenseClaims {
  id: string;
  organization_id: string;
  plan: PlanType;
  max_clusters: number;
  max_users: number;
  features: {
    advanced_rca: boolean;
    sso_enabled: boolean;
    audit_retention_days: number;
    custom_runbooks: boolean;
    data_telemetry: boolean;
    unlimited_tickets: boolean;
  };
  issued_at: string;
  expires_at: string;
}

export function generateLicenseKey(claims: LicenseClaims): string {
  const payloadJson = JSON.stringify(claims);
  const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
  const secret = secretManager.getLicenseSigningSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');
  return `SKYOPS-${payloadBase64}.${signature}`;
}

export function parseAndValidateLicenseKey(rawKey: string): { valid: boolean; claims?: LicenseClaims; error?: string } {
  if (!rawKey || !rawKey.startsWith('SKYOPS-')) {
    return { valid: false, error: 'Invalid license key format. Must start with SKYOPS-' };
  }

  const token = rawKey.replace(/^SKYOPS-/, '');
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed license structure' };
  }

  const [payloadBase64, signature] = parts;
  const secret = secretManager.getLicenseSigningSecret();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  if (signature !== expectedSig) {
    return { valid: false, error: 'Cryptographic signature verification failed' };
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const claims: LicenseClaims = JSON.parse(payloadJson);

    // Verify expiration
    if (new Date(claims.expires_at).getTime() < Date.now()) {
      return { valid: false, claims, error: `License expired on ${claims.expires_at}` };
    }

    return { valid: true, claims };
  } catch (err: any) {
    return { valid: false, error: `Failed to parse license payload: ${err.message}` };
  }
}

export function getDefaultCommunityLicense(orgId: string): License {
  const now = new Date();
  const expires = new Date();
  expires.setFullYear(now.getFullYear() + 2);

  const claims: LicenseClaims = {
    id: `lic-${orgId}-community`,
    organization_id: orgId,
    plan: 'COMMUNITY',
    max_clusters: 5,
    max_users: 10,
    features: {
      advanced_rca: true,
      sso_enabled: false,
      audit_retention_days: 90,
      custom_runbooks: true,
      data_telemetry: false,
      unlimited_tickets: true,
    },
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };

  const key = generateLicenseKey(claims);

  return {
    ...claims,
    signature: key,
    is_valid: true,
  };
}
