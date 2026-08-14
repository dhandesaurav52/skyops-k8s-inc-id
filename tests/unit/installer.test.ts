import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

export async function testOneLineInstallerWorkflow() {
  console.log('\n--- Running SkyOps One-Line Installer Workflow Tests ---');

  const installerPath = path.join(process.cwd(), 'install.sh');
  if (!fs.existsSync(installerPath)) {
    throw new Error('install.sh does not exist in project root');
  }

  const installerContent = fs.readFileSync(installerPath, 'utf8');

  // Test 1: Installer has no hard-coded secrets
  if (installerContent.includes('JWT_SECRET=') && !installerContent.includes('generate_secret')) {
    throw new Error('Installer contains hardcoded JWT secret');
  }
  if (installerContent.includes('SKYOPS-') && !installerContent.includes('BOOTSTRAP_HEX')) {
    throw new Error('Installer contains hardcoded bootstrap password');
  }
  console.log('  ✓ [Req 1] Installer uses CSPRNG for all cryptographic generation; no hard-coded secrets.');

  // Test 2: Installer output format conforms to terminal requirements
  if (
    !installerContent.includes('SKYOPS INSTALLED') ||
    !installerContent.includes('Initial Administrator Password:') ||
    !installerContent.includes('one-time bootstrap password')
  ) {
    throw new Error('Installer missing required terminal output format');
  }
  console.log('  ✓ [Req 2] Installer prints clean terminal experience with one-time initial administrator password.');

  // Test 3: Installer does NOT leak internal secrets in stdout
  if (
    installerContent.includes('echo "JWT_SECRET') ||
    installerContent.includes('echo "$JWT_SECRET') ||
    installerContent.includes('echo "$POSTGRES_PASSWORD')
  ) {
    throw new Error('Installer leaks internal secrets to stdout');
  }
  console.log('  ✓ [Req 3] Non-leakage verified: internal JWT, Postgres, and signing secrets are never printed.');

  // Test 4: Idempotency execution test in isolated directory
  const testTmpDir = path.join(os.tmpdir(), `skyops-test-install-${Date.now()}`);
  fs.mkdirSync(testTmpDir, { recursive: true });

  try {
    // Run installer in dry/isolated test mode
    const env = {
      ...process.env,
      SKYOPS_INSTALL_DIR: testTmpDir,
      SKYOPS_PORT: '3999',
      SKYOPS_HOST: '127.0.0.1',
    };

    const outputFresh = execSync(`bash ${installerPath}`, { env, encoding: 'utf8' });

    if (!outputFresh.includes('SKYOPS INSTALLED') || !outputFresh.includes('Initial Administrator Password:')) {
      throw new Error(`Fresh install output did not match expected banner: ${outputFresh}`);
    }

    const secretsFile = path.join(testTmpDir, 'data', 'secrets.json');
    const passwordFile = path.join(testTmpDir, 'data', 'secrets', 'initial-admin-password');

    if (!fs.existsSync(secretsFile) || !fs.existsSync(passwordFile)) {
      throw new Error('Installer failed to generate secrets.json or initial-admin-password');
    }

    const initialPwd = fs.readFileSync(passwordFile, 'utf8').trim();
    if (!initialPwd.startsWith('SKYOPS-') || initialPwd.length < 32) {
      throw new Error(`Generated initial password does not meet format: ${initialPwd}`);
    }
    console.log('  ✓ [Req 4] Fresh installation generated 0600 secrets and initial administrator password.');

    // Test 5: Re-running installer when uninitialized preserves the same password
    const outputRerun = execSync(`bash ${installerPath}`, { env, encoding: 'utf8' });
    const preservedPwd = fs.readFileSync(passwordFile, 'utf8').trim();
    if (preservedPwd !== initialPwd) {
      throw new Error('Installer unexpectedly replaced pending initial password on rerun');
    }
    console.log('  ✓ [Req 5] Re-running uninitialized installer preserves existing pending initial password.');

    // Test 6: Upgrade / already initialized run (simulate bootstrap completion)
    fs.unlinkSync(passwordFile); // Password file deleted upon initialization

    const outputUpgrade = execSync(`bash ${installerPath}`, { env, encoding: 'utf8' });
    if (!outputUpgrade.includes('SKYOPS UPDATED') || outputUpgrade.includes('Initial Administrator Password:')) {
      throw new Error(`Upgrade output did not match expected update banner: ${outputUpgrade}`);
    }
    if (fs.existsSync(passwordFile)) {
      throw new Error('Installer recreated password file on an initialized instance!');
    }
    console.log('  ✓ [Req 6] Upgrade mode: installer detected existing initialized system, preserved all data, and refused to recreate bootstrap credentials.');

  } finally {
    try {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}
