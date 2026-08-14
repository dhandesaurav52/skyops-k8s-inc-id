import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { DatabaseRepository } from '../db/repository';
import { hashPassword } from './password';
import { signToken } from './jwt';
import { getDefaultCommunityLicense } from '../licensing/license';
import { secretManager } from '../config/secrets';

export type BootstrapLifecycleState =
  | 'UNINITIALIZED'
  | 'BOOTSTRAP_PASSWORD_GENERATED'
  | 'BOOTSTRAP_PASSWORD_AVAILABLE'
  | 'BOOTSTRAP_PASSWORD_VERIFIED'
  | 'INITIALIZED';

export interface BootstrapStatusResponse {
  isInitialized: boolean;
  setupRequired: boolean;
  lifecycleState: BootstrapLifecycleState;
  passwordFilePath: string;
  instructions: {
    cliCommand: string;
    dockerCommand: string;
    k8sCommand: string;
    catCommand: string;
  };
}

export class BootstrapManager {
  private dataDir: string;
  private secretsDir: string;
  private passwordFilePath: string;
  private inMemoryBootstrapPassword: string | null = null;
  private lifecycleState: BootstrapLifecycleState = 'UNINITIALIZED';

  constructor(customDataDir?: string) {
    const dir = customDataDir || process.env.SKYOPS_DATA_DIR || process.env.DATA_DIR;
    this.dataDir = dir ? path.resolve(dir) : path.join(process.cwd(), '.data');
    this.secretsDir = path.join(this.dataDir, 'secrets');
    this.passwordFilePath = path.join(this.secretsDir, 'initial-admin-password');
  }

  public getPasswordFilePath(): string {
    return this.passwordFilePath;
  }

  /**
   * Generates a cryptographically random bootstrap password with high entropy (192-bit CSPRNG).
   * Format: SKYOPS-<48 hex characters>
   */
  public generateBootstrapPassword(): string {
    const entropyHex = crypto.randomBytes(24).toString('hex');
    return `SKYOPS-${entropyHex}`;
  }

  /**
   * Checks if an administrator account already exists in the repository.
   */
  public async isSystemInitialized(repo: DatabaseRepository): Promise<boolean> {
    try {
      const orgs = await repo.listOrganizations();
      for (const org of orgs) {
        const users = await repo.listUsersByOrg(org.id);
        const hasAdmin = users.some((u) => u.role === 'ADMIN');
        if (hasAdmin) {
          this.lifecycleState = 'INITIALIZED';
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('[SkyOps Bootstrap] Error checking system initialization state:', err);
      return false;
    }
  }

  /**
   * Initializes the bootstrap credential state on server startup.
   * If the system is uninitialized:
   *  - Checks if an existing bootstrap password file exists (surviving restarts).
   *  - If not, generates a new CSPRNG bootstrap password and saves with mode 0600.
   *  - Prints the initial bootstrap operator banner to stdout.
   * If already initialized:
   *  - Ensures the temporary bootstrap password file is securely scrubbed and unlinked.
   */
  public async initializeOnStartup(repo: DatabaseRepository, printBanner: boolean = true): Promise<void> {
    const initialized = await this.isSystemInitialized(repo);

    if (initialized) {
      this.lifecycleState = 'INITIALIZED';
      this.inMemoryBootstrapPassword = null;
      this.destroyBootstrapPasswordFile();
      return;
    }

    // Ensure secrets directory exists with 0700 permissions
    if (!fs.existsSync(this.secretsDir)) {
      fs.mkdirSync(this.secretsDir, { recursive: true, mode: 0o700 });
    }

    let password = '';
    let isFreshGeneration = false;

    // Check if password file already exists from previous start
    if (fs.existsSync(this.passwordFilePath)) {
      try {
        const raw = fs.readFileSync(this.passwordFilePath, 'utf8').trim();
        if (raw && raw.startsWith('SKYOPS-') && raw.length >= 24) {
          password = raw;
          this.lifecycleState = 'BOOTSTRAP_PASSWORD_AVAILABLE';
        }
      } catch (err: any) {
        console.warn(`[SkyOps Bootstrap] Notice: Could not read existing initial password file: ${err.message}`);
      }
    }

    // If no valid existing password file, generate a new one
    if (!password) {
      password = this.generateBootstrapPassword();
      isFreshGeneration = true;
      try {
        fs.writeFileSync(this.passwordFilePath, `${password}\n`, { encoding: 'utf8', mode: 0o600 });
        this.lifecycleState = 'BOOTSTRAP_PASSWORD_GENERATED';
      } catch (err: any) {
        console.error(`[SkyOps Bootstrap Error] Failed to write initial password file: ${err.message}`);
      }
    }

    this.inMemoryBootstrapPassword = password;

    if (printBanner) {
      this.printStartupBanner(this.passwordFilePath, isFreshGeneration);
    }
  }

  /**
   * Prints the operator retrieval banner to stdout.
   * Never prints the actual password value.
   */
  public printStartupBanner(filePath: string, isFresh: boolean): void {
    const relOrAbs = filePath.startsWith(process.cwd())
      ? path.relative(process.cwd(), filePath)
      : filePath;

    console.log(`
==================================================
 SKYOPS INITIAL ADMINISTRATION
==================================================

SkyOps has ${isFresh ? 'generated' : 'loaded'} a one-time initial administrator
password.

Retrieve it using:

    cat ${relOrAbs}

Example:

    cat ~/.skyops/secrets/initial-admin-password
    # Or in Docker Compose:
    docker compose exec skyops skyops admin initial-password

Open:

    http://localhost:3000

IMPORTANT:

This is a ONE-TIME bootstrap credential.

After the administrator account is created,
this credential will be permanently invalidated.

SkyOps will NOT display it again.

==================================================
`);
  }

  /**
   * Returns non-sensitive status for web UI and health checks.
   */
  public async getStatus(repo: DatabaseRepository): Promise<BootstrapStatusResponse> {
    const isInit = await this.isSystemInitialized(repo);
    return {
      isInitialized: isInit,
      setupRequired: !isInit,
      lifecycleState: isInit ? 'INITIALIZED' : this.lifecycleState,
      passwordFilePath: this.passwordFilePath,
      instructions: {
        cliCommand: 'skyops admin initial-password',
        dockerCommand: 'docker compose exec skyops skyops admin initial-password',
        k8sCommand: 'kubectl exec -n skyops-system deployment/skyops -- skyops admin initial-password',
        catCommand: `cat ${this.passwordFilePath}`,
      },
    };
  }

  /**
   * Securely loads current bootstrap password from memory or file.
   */
  private getStoredBootstrapPassword(): string | null {
    if (this.inMemoryBootstrapPassword) {
      return this.inMemoryBootstrapPassword;
    }
    if (fs.existsSync(this.passwordFilePath)) {
      try {
        const content = fs.readFileSync(this.passwordFilePath, 'utf8').trim();
        if (content) {
          this.inMemoryBootstrapPassword = content;
          return content;
        }
      } catch (_) {}
    }
    return null;
  }

  /**
   * Verifies the submitted one-time bootstrap password using timing-safe comparison.
   * If valid, issues a short-lived temporary bootstrap authorization token.
   */
  public async verifyBootstrapPassword(
    repo: DatabaseRepository,
    inputPassword: string
  ): Promise<{ success: boolean; bootstrapToken: string }> {
    const initialized = await this.isSystemInitialized(repo);
    if (initialized) {
      throw new Error('SkyOps Control Plane is already initialized. The initial administrator credential has been permanently invalidated.');
    }

    const storedPassword = this.getStoredBootstrapPassword();
    if (!storedPassword) {
      throw new Error('Initial administrator password not found. Please restart SkyOps or use operator recovery CLI.');
    }

    if (!inputPassword || typeof inputPassword !== 'string') {
      throw new Error('Please enter the initial administrator password.');
    }

    const trimmedInput = inputPassword.trim();
    const storedBuf = Buffer.from(storedPassword, 'utf8');
    const inputBuf = Buffer.from(trimmedInput, 'utf8');

    const matches =
      storedBuf.length === inputBuf.length &&
      crypto.timingSafeEqual(storedBuf, inputBuf);

    if (!matches) {
      throw new Error('Invalid initial administrator password. Please check the credential file and try again.');
    }

    this.lifecycleState = 'BOOTSTRAP_PASSWORD_VERIFIED';

    // Sign a temporary 15-minute token allowing admin creation
    const jwtSecret = secretManager.getJwtSecret();
    const bootstrapToken = jwt.sign(
      {
        purpose: 'SKYOPS_BOOTSTRAP_VERIFIED',
        iat: Math.floor(Date.now() / 1000),
      },
      jwtSecret,
      { expiresIn: '15m' }
    );

    return { success: true, bootstrapToken };
  }

  /**
   * Creates the permanent administrator account, initializes the primary organization
   * and community license, and permanently invalidates and deletes the bootstrap password.
   */
  public async createPermanentAdministrator(
    repo: DatabaseRepository,
    bootstrapToken: string,
    params: {
      name: string;
      email: string;
      password: string;
      organizationName?: string;
      ipAddress?: string;
    }
  ) {
    const initialized = await this.isSystemInitialized(repo);
    if (initialized) {
      throw new Error('SkyOps Control Plane is already initialized. Re-initialization is strictly forbidden.');
    }

    // Verify bootstrap token
    if (!bootstrapToken) {
      throw new Error('Missing bootstrap authorization token. Please verify the initial administrator password first.');
    }

    try {
      const decoded = jwt.verify(bootstrapToken, secretManager.getJwtSecret()) as any;
      if (decoded.purpose !== 'SKYOPS_BOOTSTRAP_VERIFIED') {
        throw new Error('Invalid bootstrap token purpose.');
      }
    } catch (err: any) {
      throw new Error(`Bootstrap session expired or invalid (${err.message}). Please re-verify the initial administrator password.`);
    }

    const { name, email, password, organizationName, ipAddress } = params;

    // Validate inputs
    if (!name || name.trim().length < 2) {
      throw new Error('Full Name must be at least 2 characters.');
    }

    if (!email || !email.includes('@') || email.trim().length < 5) {
      throw new Error('A valid administrator email address is required.');
    }

    if (!password || password.length < 8) {
      throw new Error('Permanent password must be at least 8 characters long.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const orgTitle = organizationName && organizationName.trim().length > 0
      ? organizationName.trim()
      : 'Primary Workspace';

    // 1. Create primary organization
    let org = await repo.getOrganizationBySlug('default');
    if (!org) {
      org = await repo.createOrganization(orgTitle, 'default');
    }

    // 2. Hash permanent password with bcrypt
    const passwordHash = await hashPassword(password);

    // 3. Create permanent administrator user
    const adminUser = await repo.createUser({
      email: cleanEmail,
      name: cleanName,
      password_hash: passwordHash,
      role: 'ADMIN',
      organization_id: org.id,
    });

    // 4. Provision Community License (Free Forever default)
    const now = new Date();
    const expiry = new Date();
    expiry.setFullYear(now.getFullYear() + 10);

    const license = {
      id: `lic-${org.id}-community`,
      organization_id: org.id,
      plan: 'COMMUNITY' as const,
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
      expires_at: expiry.toISOString(),
      signature: 'builtin-community-signature',
      is_valid: true,
    };
    await repo.saveLicense(license);

    // 5. Emit Audit Log
    await repo.createAuditLog({
      organization_id: org.id,
      user_id: adminUser.id,
      user_email: adminUser.email,
      action: 'BOOTSTRAP_ADMIN_CREATED',
      resource: `User/${adminUser.id}`,
      details: JSON.stringify({
        name: adminUser.name,
        email: adminUser.email,
        organization: org.name,
        bootstrap_credential_destroyed: true,
      }),
      ip_address: ipAddress || '127.0.0.1',
    });

    // 6. PERMANENTLY DESTROY BOOTSTRAP CREDENTIALS
    this.destroyBootstrapPasswordFile();
    this.inMemoryBootstrapPassword = null;
    this.lifecycleState = 'INITIALIZED';

    console.log(`[SkyOps Bootstrap] Permanent administrator (${cleanEmail}) created. One-time bootstrap password permanently destroyed.`);

    // 7. Generate permanent session JWT token
    const token = signToken({
      userId: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      organizationId: org.id,
    });

    return {
      message: 'Administrator account created successfully. The bootstrap credential has been permanently invalidated.',
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        organization_id: adminUser.organization_id,
        created_at: adminUser.created_at,
      },
      organization: org,
      license,
    };
  }

  /**
   * Securely overwrites the bootstrap password file with zeros and unlinks it.
   */
  public destroyBootstrapPasswordFile(): void {
    try {
      if (fs.existsSync(this.passwordFilePath)) {
        const stats = fs.statSync(this.passwordFilePath);
        // Overwrite file contents with zeros for forensic security
        const zeroBuf = Buffer.alloc(stats.size, 0);
        fs.writeFileSync(this.passwordFilePath, zeroBuf);
        fs.unlinkSync(this.passwordFilePath);
        console.log(`[SkyOps Bootstrap] Securely deleted bootstrap password file at ${this.passwordFilePath}`);
      }
    } catch (err: any) {
      console.warn(`[SkyOps Bootstrap] Notice: Could not unlink bootstrap password file (${err.message})`);
    }
  }

  /**
   * CLI Operator Method: Retrieve initial password if uninitialized.
   */
  public async getPasswordForCLI(repo: DatabaseRepository): Promise<string> {
    const initialized = await this.isSystemInitialized(repo);
    if (initialized) {
      throw new Error('System is already initialized. The initial administrator password was invalidated and permanently destroyed.');
    }

    const password = this.getStoredBootstrapPassword();
    if (!password) {
      throw new Error(`Initial password file not found at ${this.passwordFilePath}. Run 'skyops admin reset-initial-password' to generate a new one.`);
    }

    return password;
  }

  /**
   * CLI Operator Recovery: Regenerate initial password if lost before setup.
   */
  public async regeneratePasswordForCLI(repo: DatabaseRepository): Promise<string> {
    const initialized = await this.isSystemInitialized(repo);
    if (initialized) {
      throw new Error('Cannot reset initial password: an administrator account already exists. Please use standard password recovery or admin tools.');
    }

    if (!fs.existsSync(this.secretsDir)) {
      fs.mkdirSync(this.secretsDir, { recursive: true, mode: 0o700 });
    }

    const newPassword = this.generateBootstrapPassword();
    fs.writeFileSync(this.passwordFilePath, `${newPassword}\n`, { encoding: 'utf8', mode: 0o600 });
    this.inMemoryBootstrapPassword = newPassword;
    this.lifecycleState = 'BOOTSTRAP_PASSWORD_GENERATED';

    return newPassword;
  }
}

export const bootstrapManager = new BootstrapManager();
