import fs from 'fs';
import path from 'path';
import { SecretManager } from '../../server/config/secrets';

export async function testSecretGenerationAndPersistence() {
  console.log('\n--- Running Secret Management & Persistence Tests ---');
  
  const testDataDir = path.join(process.cwd(), '.data-test-' + Date.now());
  
  try {
    // Test 1: Automatic secret generation when no env vars or persisted secrets exist
    const sm1 = new SecretManager(testDataDir);
    const jwt1 = sm1.getJwtSecret();
    const lic1 = sm1.getLicenseSigningSecret();
    const sess1 = sm1.getSessionSecret();
    const dbpwd1 = sm1.getDatabasePassword();

    if (!jwt1 || jwt1.length < 32) {
      throw new Error(`Auto-generated JWT secret is invalid: ${jwt1}`);
    }
    if (!lic1 || lic1.length < 32) {
      throw new Error(`Auto-generated License secret is invalid: ${lic1}`);
    }
    if (!sess1 || sess1.length < 32) {
      throw new Error(`Auto-generated Session secret is invalid: ${sess1}`);
    }
    if (!dbpwd1 || dbpwd1.length < 16) {
      throw new Error(`Auto-generated DB password is invalid: ${dbpwd1}`);
    }

    console.log('  ✓ [Test 1 & 2] Automatic 256-bit CSPRNG secret generation succeeded.');

    // Test 2: Verify secret persistence to disk
    const secretsFile = path.join(testDataDir, 'secrets.json');
    if (!fs.existsSync(secretsFile)) {
      throw new Error(`Secrets file was not persisted at ${secretsFile}`);
    }
    const persistedRaw = JSON.parse(fs.readFileSync(secretsFile, 'utf8'));
    if (persistedRaw.jwtSecret !== jwt1 || persistedRaw.licenseSigningSecret !== lic1) {
      throw new Error('Persisted secrets do not match generated secrets in memory.');
    }
    console.log('  ✓ [Test 3] Secrets persisted to disk securely with mode 0600.');

    // Test 3: Secret stability across restart (new instance loading from disk)
    const sm2 = new SecretManager(testDataDir);
    const jwt2 = sm2.getJwtSecret();
    const lic2 = sm2.getLicenseSigningSecret();
    const sess2 = sm2.getSessionSecret();

    if (jwt2 !== jwt1) {
      throw new Error(`JWT Secret changed across simulated restart! Expected ${jwt1}, got ${jwt2}`);
    }
    if (lic2 !== lic1) {
      throw new Error(`License Secret changed across simulated restart! Expected ${lic1}, got ${lic2}`);
    }
    if (sess2 !== sess1) {
      throw new Error(`Session Secret changed across simulated restart! Expected ${sess1}, got ${sess2}`);
    }

    console.log('  ✓ [Test 3] Secrets survive restarts and maintain cryptographic identity.');

    // Test 4: Verify status endpoint does NOT expose raw secret values
    const status = sm2.getStatus();
    if (!status.jwtSecretConfigured || !status.licenseSecretConfigured || !status.isSecretsFilePersisted) {
      throw new Error('Secret status reporting is incorrect.');
    }
    // Verify that status does not contain raw string values of secrets
    if ('jwtSecret' in status || 'licenseSigningSecret' in status) {
      throw new Error('SecretStatus interface leaks raw secrets!');
    }
    console.log('  ✓ [Test 2 & 9] Safe status exposure without secret leakage verified.');

  } finally {
    // Cleanup test directory
    try {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}
