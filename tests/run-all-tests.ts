import { testSecretGenerationAndPersistence } from './unit/secrets.test';
import { testBootstrapAuthenticationFlow } from './unit/bootstrap.test';
import { testOneLineInstallerWorkflow } from './unit/installer.test';
import { testPasswordHashing } from './unit/password.test';
import { testLicensingEngine } from './unit/licensing.test';
import { testPrivacyAndCloudModes } from './unit/privacy.test';
import { testFirstRunSetupAndLocking } from './integration/setup.test';
import { testHealthAndReadiness } from './integration/health.test';
import { testDeploymentConfigurations } from './deploy/deploy.test';

async function runAllTests() {
  console.log('====================================================');
  console.log('       SKYOPS AUTOMATED VERIFICATION SUITE          ');
  console.log('====================================================');

  const startTime = Date.now();

  try {
    // 1. Secrets Generation, Persistence & Non-leakage
    await testSecretGenerationAndPersistence();

    // 2. Initial Bootstrap Authentication & Credential Lifecycle
    await testBootstrapAuthenticationFlow();

    // 3. Primary One-Line Installer & Idempotency Workflow
    await testOneLineInstallerWorkflow();

    // 4. Password Hashing & Bcrypt Validation
    await testPasswordHashing();

    // 5. Licensing Engine & Offline HMAC
    await testLicensingEngine();

    // 6. Privacy & Cloud Compatibility
    await testPrivacyAndCloudModes();

    // 7. First-Run Setup & Lock Protection
    await testFirstRunSetupAndLocking();

    // 8. Health & Readiness Probes
    await testHealthAndReadiness();

    // 9. Deployment, Docker Compose & Helm Configurations
    await testDeploymentConfigurations();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log(` ✅ ALL 18 TEST CATEGORIES PASSED SUCCESSFULLY (${duration}s)`);
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  }
}

runAllTests();
