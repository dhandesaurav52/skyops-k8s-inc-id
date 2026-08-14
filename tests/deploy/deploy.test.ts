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

  // Test 2: Verify Helm Chart secrets template logic & RBAC
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

  const helmRolePath = path.join(process.cwd(), 'deploy/helm/skyops/templates/clusterrole.yaml');
  if (!fs.existsSync(helmRolePath)) {
    throw new Error(`Helm ClusterRole template missing at ${helmRolePath}`);
  }
  const helmRoleContent = fs.readFileSync(helmRolePath, 'utf8');
  if (!helmRoleContent.includes('pods') || !helmRoleContent.includes('events')) {
    throw new Error('Helm ClusterRole template missing required resource permissions');
  }

  const helmAgentPath = path.join(process.cwd(), 'deploy/helm/skyops/templates/agent-deployment.yaml');
  if (!fs.existsSync(helmAgentPath)) {
    throw new Error(`Helm Agent deployment template missing at ${helmAgentPath}`);
  }

  const helmPostgresPath = path.join(process.cwd(), 'deploy/helm/skyops/templates/postgresql-statefulset.yaml');
  if (!fs.existsSync(helmPostgresPath)) {
    throw new Error(`Helm PostgreSQL StatefulSet template missing at ${helmPostgresPath}`);
  }

  console.log('  ✓ [Test 13 & 14] Helm chart templates support automatic random secrets, existingSecret, In-Cluster Agent, and PostgreSQL StatefulSet.');
}
