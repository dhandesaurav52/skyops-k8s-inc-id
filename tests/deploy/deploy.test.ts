import fs from 'fs';
import path from 'path';

export async function testDeploymentConfigurations() {
  console.log('\n--- Running Deployment, Docker Compose & Helm Chart Tests ---');

  // Test 1: Verify docker-compose.yml has persistent volumes and postgres healthchecks
  const composePath = path.join(process.cwd(), 'deploy/self-hosted/docker-compose.yml');
  if (!fs.existsSync(composePath)) {
    throw new Error(`docker-compose.yml missing at ${composePath}`);
  }
  const composeContent = fs.readFileSync(composePath, 'utf8');

  if (!composeContent.includes('postgres_data') || !composeContent.includes('skyops_data')) {
    throw new Error('docker-compose.yml is missing persistent volume declarations');
  }
  if (!composeContent.includes('healthcheck') || !composeContent.includes('pg_isready')) {
    throw new Error('docker-compose.yml is missing PostgreSQL healthcheck configuration');
  }
  if (!composeContent.includes('service_healthy')) {
    throw new Error('docker-compose.yml is missing service_healthy startup ordering');
  }
  console.log('  ✓ [Test 8, 9 & 10] Docker Compose configured with bundled PostgreSQL, volume persistence & startup healthchecks.');

  // Test 2: Verify Helm Chart secrets template logic
  const helmSecretPath = path.join(process.cwd(), 'deploy/helm/skyops/templates/secrets.yaml');
  if (!fs.existsSync(helmSecretPath)) {
    throw new Error(`Helm secrets template missing at ${helmSecretPath}`);
  }
  const helmSecretContent = fs.readFileSync(helmSecretPath, 'utf8');

  if (!helmSecretContent.includes('existingSecret')) {
    throw new Error('Helm secrets template missing existingSecret support');
  }
  if (!helmSecretContent.includes('randAlphaNum')) {
    throw new Error('Helm secrets template missing auto-generated secure secret fallback');
  }
  console.log('  ✓ [Test 13 & 14] Helm chart templates support automatic random secrets and externally supplied existingSecret.');
}
