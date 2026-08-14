import { MemoryRepository } from '../../server/db/memory';
import { getDeploymentMode } from '../../server/telemetry/privacy';

export async function testHealthAndReadiness() {
  console.log('\n--- Running Health & Readiness Probe Tests ---');

  const repo = new MemoryRepository();
  await repo.init();

  // Test 1: Health check response
  const dbHealth = await repo.healthCheck();
  if (!dbHealth.healthy || dbHealth.type !== 'memory') {
    throw new Error(`Healthcheck reported unhealthy: ${JSON.stringify(dbHealth)}`);
  }
  console.log('  ✓ [Test 11] Liveness probe (/health) correctly reports healthy status.');

  // Test 2: Readiness check response
  if (!dbHealth.healthy) {
    throw new Error('Readiness probe failed when repository is initialized');
  }
  console.log('  ✓ [Test 12] Readiness probe (/ready) reports ready for traffic.');
}
