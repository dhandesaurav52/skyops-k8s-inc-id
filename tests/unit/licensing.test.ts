import {
  generateLicenseKey,
  parseAndValidateLicenseKey,
  getDefaultCommunityLicense,
} from '../../server/licensing/license';

export async function testLicensingEngine() {
  console.log('\n--- Running Licensing & Cryptographic Verification Tests ---');

  // Test 1: Community default license
  const communityLic = getDefaultCommunityLicense('org-test-123');
  if (communityLic.plan !== 'COMMUNITY' || communityLic.max_clusters !== 5 || communityLic.features.data_telemetry !== false) {
    throw new Error('Community license configuration is incorrect');
  }
  console.log('  ✓ [Test 10] Community Free Forever tier defaults verified.');

  // Test 2: Offline HMAC signed enterprise license key generation and verification
  const now = new Date();
  const expiry = new Date();
  expiry.setFullYear(now.getFullYear() + 1);

  const enterpriseKey = generateLicenseKey({
    id: 'lic-enterprise-test-1',
    organization_id: 'org-enterprise-456',
    plan: 'ENTERPRISE',
    max_clusters: 999,
    max_users: 500,
    features: {
      advanced_rca: true,
      sso_enabled: true,
      audit_retention_days: 365,
      custom_runbooks: true,
      data_telemetry: false,
      unlimited_tickets: true,
    },
    issued_at: now.toISOString(),
    expires_at: expiry.toISOString(),
  });

  if (!enterpriseKey.startsWith('SKYOPS-')) {
    throw new Error(`Enterprise license key prefix is invalid: ${enterpriseKey}`);
  }

  const validation = parseAndValidateLicenseKey(enterpriseKey);
  if (!validation.valid || !validation.claims) {
    throw new Error(`License validation failed: ${validation.error}`);
  }
  if (validation.claims.plan !== 'ENTERPRISE' || validation.claims.max_clusters !== 999) {
    throw new Error('Enterprise license claims mismatch');
  }

  // Test 3: Tampered license key detection
  const tamperedKey = enterpriseKey.slice(0, -5) + 'XXXXX';
  const tamperedValidation = parseAndValidateLicenseKey(tamperedKey);
  if (tamperedValidation.valid) {
    throw new Error('Tampered license signature was erroneously accepted!');
  }

  console.log('  ✓ [Test 10] Offline HMAC-SHA256 license generation, verification, and tamper protection verified.');
}
