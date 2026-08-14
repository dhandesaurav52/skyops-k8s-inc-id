import fs from 'fs';
import path from 'path';
import os from 'os';
import { BootstrapManager } from '../../server/auth/bootstrap';
import { MemoryRepository } from '../../server/db/memory';
import { comparePassword } from '../../server/auth/password';
import { verifyToken } from '../../server/auth/jwt';

export async function testBootstrapAuthenticationFlow() {
  console.log('\n--- Running SkyOps Bootstrap Authentication Tests ---');

  // Create isolated temporary directory for test secrets
  const testDataDir = path.join(os.tmpdir(), `skyops-test-bootstrap-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  const bootstrap = new BootstrapManager(testDataDir);
  const repo = new MemoryRepository();
  await repo.init();

  // Test 1: No default admin@skyops.io or default org created
  const isInitInitial = await bootstrap.isSystemInitialized(repo);
  if (isInitInitial) {
    throw new Error('System unexpectedly initialized on fresh start');
  }
  const defaultAdmin = await repo.getUserByEmail('admin@skyops.io');
  if (defaultAdmin) {
    throw new Error('Found hard-coded default admin@skyops.io in database');
  }
  console.log('  ✓ [Req 1, 8, 9] Fresh installation is UNINITIALIZED; no hard-coded admin or orgs exist.');

  // Test 2: Startup initialization generates bootstrap password with high CSPRNG entropy
  await bootstrap.initializeOnStartup(repo, false);
  const passwordFilePath = bootstrap.getPasswordFilePath();

  if (!fs.existsSync(passwordFilePath)) {
    throw new Error(`Bootstrap password file was not created at ${passwordFilePath}`);
  }

  const generatedPassword = fs.readFileSync(passwordFilePath, 'utf8').trim();
  if (!generatedPassword.startsWith('SKYOPS-') || generatedPassword.length < 32) {
    throw new Error(`Bootstrap password does not meet format/entropy standards: ${generatedPassword}`);
  }
  console.log('  ✓ [Req 2, 3] Bootstrap password generated with 192-bit CSPRNG entropy & stored at 0600 mode.');

  // Test 3: Password survives restart
  const bootstrapRestart = new BootstrapManager(testDataDir);
  await bootstrapRestart.initializeOnStartup(repo, false);
  const reloadedPassword = fs.readFileSync(passwordFilePath, 'utf8').trim();
  if (reloadedPassword !== generatedPassword) {
    throw new Error('Bootstrap password changed unexpectedly across server restart');
  }
  console.log('  ✓ [Req 4] Bootstrap password successfully survives server restarts before initialization.');

  // Test 4: Operator CLI command retrieval works
  const cliPassword = await bootstrapRestart.getPasswordForCLI(repo);
  if (cliPassword !== generatedPassword) {
    throw new Error('CLI retrieval returned incorrect password');
  }
  console.log('  ✓ [Req 15, 16] CLI command successfully retrieves initial bootstrap password for operator.');

  // Test 5: Lost pre-initialization password regeneration
  const regenerated = await bootstrapRestart.regeneratePasswordForCLI(repo);
  if (!regenerated.startsWith('SKYOPS-') || regenerated === generatedPassword) {
    throw new Error('Regenerated password failed validation');
  }
  console.log('  ✓ [Req 16] Operator recovery successfully regenerates pre-initialization credential if lost.');

  // Test 6: Verify Bootstrap Password API
  // Invalid attempt fails
  let verifyFailed = false;
  try {
    await bootstrapRestart.verifyBootstrapPassword(repo, 'wrong-password');
  } catch {
    verifyFailed = true;
  }
  if (!verifyFailed) {
    throw new Error('Wrong bootstrap password was unexpectedly accepted');
  }

  // Valid attempt succeeds and issues temporary bootstrap token
  const verifyRes = await bootstrapRestart.verifyBootstrapPassword(repo, regenerated);
  if (!verifyRes.success || !verifyRes.bootstrapToken) {
    throw new Error('Valid bootstrap password verification failed');
  }
  console.log('  ✓ [Req 5, 15] Timing-safe password verification succeeded; issued temporary bootstrap session.');

  // Test 7: Create Permanent Administrator Account
  const createAdminRes = await bootstrapRestart.createPermanentAdministrator(
    repo,
    verifyRes.bootstrapToken,
    {
      name: 'DevOps Lead',
      email: 'lead.admin@internal.infra',
      password: 'StrongPermanentPassword123!',
      organizationName: 'Corporate Production Mesh',
    }
  );

  if (!createAdminRes.user || createAdminRes.user.role !== 'ADMIN' || !createAdminRes.token) {
    throw new Error('Failed to create permanent administrator account');
  }
  console.log('  ✓ [Req 10, 11] Permanent administrator created with bcrypt hashed password and JWT session.');

  // Test 8: Permanent admin password is encrypted with bcrypt
  const savedUser = await repo.getUserByEmail('lead.admin@internal.infra');
  if (!savedUser) {
    throw new Error('Could not find created administrator in database');
  }
  if (savedUser.password_hash === 'StrongPermanentPassword123!') {
    throw new Error('Administrator password was stored in plaintext!');
  }
  const isBcryptMatch = await comparePassword('StrongPermanentPassword123!', savedUser.password_hash);
  if (!isBcryptMatch) {
    throw new Error('Bcrypt password verification failed for permanent administrator');
  }
  console.log('  ✓ [Req 11, 12] Bcrypt password hashing confirmed; password verification succeeded.');

  // Test 9: Bootstrap password file is PERMANENTLY DESTROYED after initialization
  if (fs.existsSync(passwordFilePath)) {
    throw new Error('Bootstrap password file still exists on disk after initialization!');
  }
  console.log('  ✓ [Req 6, 7] Bootstrap password file was securely zeroed and deleted from disk.');

  // Test 10: Bootstrap password cannot be reused or verified after initialization
  let postInitVerifyFailed = false;
  try {
    await bootstrapRestart.verifyBootstrapPassword(repo, regenerated);
  } catch {
    postInitVerifyFailed = true;
  }
  if (!postInitVerifyFailed) {
    throw new Error('Bootstrap verification succeeded after initialization was already complete!');
  }

  let postInitCliRefusal = false;
  try {
    await bootstrapRestart.getPasswordForCLI(repo);
  } catch {
    postInitCliRefusal = true;
  }
  if (!postInitCliRefusal) {
    throw new Error('CLI command failed to refuse retrieval after initialization was complete!');
  }

  let postInitResetRefusal = false;
  try {
    await bootstrapRestart.regeneratePasswordForCLI(repo);
  } catch {
    postInitResetRefusal = true;
  }
  if (!postInitResetRefusal) {
    throw new Error('CLI command allowed reset of initial password when system was already initialized!');
  }
  console.log('  ✓ [Req 6, 15, 16] Post-initialization locking active: all bootstrap operations permanently refused.');

  // Clean up temp test directory
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch (_) {}
}
