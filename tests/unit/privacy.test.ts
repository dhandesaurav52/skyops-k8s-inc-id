import {
  getDeploymentMode,
  isDataTelemetryEnabled,
  sanitizePayloadForTelemetry,
} from '../../server/telemetry/privacy';

export async function testPrivacyAndCloudModes() {
  console.log('\n--- Running Privacy & Deployment Mode Tests ---');

  // Test 1: Self-hosted default telemetry is false
  const prevMode = process.env.DEPLOYMENT_MODE;
  const prevTelem = process.env.DATA_TELEMETRY_ENABLED;

  try {
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.DATA_TELEMETRY_ENABLED;

    if (getDeploymentMode() !== 'self-hosted') {
      throw new Error('Default deployment mode should be self-hosted');
    }
    if (isDataTelemetryEnabled() !== false) {
      throw new Error('Self-hosted deployment must default to DATA_TELEMETRY_ENABLED=false');
    }
    console.log('  ✓ [Test 15] Self-hosted mode defaults to strict local privacy (DATA_TELEMETRY_ENABLED=false).');

    // Test 2: Payload sanitization removes sensitive cluster credentials and raw secrets
    const rawClusterPayload = {
      cluster_name: 'prod-cluster-us-east',
      token: 'secret-token-12345',
      password: 'mypassword',
      pod_count: 42,
      node_count: 6,
    };
    const sanitized = sanitizePayloadForTelemetry(rawClusterPayload);
    if ('token' in sanitized || 'password' in sanitized) {
      throw new Error('Telemetry sanitizer leaked sensitive credentials');
    }
    console.log('  ✓ [Test 15] Telemetry sanitization scrubs credentials from operational logs.');

    // Test 3: Cloud mode compatibility
    process.env.DEPLOYMENT_MODE = 'cloud';
    process.env.DATA_TELEMETRY_ENABLED = 'true';
    if (getDeploymentMode() !== 'cloud') {
      throw new Error('Deployment mode failed to switch to cloud');
    }
    if (!isDataTelemetryEnabled()) {
      throw new Error('Cloud mode telemetry failed to activate');
    }
    console.log('  ✓ [Test 16] Cloud mode compatibility preserved (DEPLOYMENT_MODE=cloud).');
  } finally {
    process.env.DEPLOYMENT_MODE = prevMode;
    process.env.DATA_TELEMETRY_ENABLED = prevTelem;
  }
}
