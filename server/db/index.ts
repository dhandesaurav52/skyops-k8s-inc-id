import { DatabaseRepository } from './repository';
import { PostgresRepository } from './postgres';
import { MemoryRepository } from './memory';
import { hashPassword } from '../auth/password';

let repoInstance: DatabaseRepository | null = null;

export async function getRepository(): Promise<DatabaseRepository> {
  if (repoInstance) {
    return repoInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      console.log('[SkyOps DB] Connecting to PostgreSQL database...');
      const pgRepo = new PostgresRepository(databaseUrl);
      await pgRepo.init();
      const health = await pgRepo.healthCheck();
      if (health.healthy) {
        console.log('[SkyOps DB] Connected to PostgreSQL successfully.');
        repoInstance = pgRepo;
        await bootstrapInitialState(repoInstance);
        return repoInstance;
      }
      console.warn('[SkyOps DB] PostgreSQL healthcheck failed, falling back to embedded repository:', health.details);
    } catch (err: any) {
      console.warn('[SkyOps DB] Failed to initialize PostgreSQL repository:', err.message);
      console.log('[SkyOps DB] Falling back to high-performance embedded in-memory repository.');
    }
  } else {
    console.log('[SkyOps DB] No DATABASE_URL provided. Running with high-performance embedded repository.');
  }

  const memRepo = new MemoryRepository();
  await memRepo.init();
  repoInstance = memRepo;
  await bootstrapInitialState(repoInstance);
  return repoInstance;
}

export async function bootstrapInitialState(repo: DatabaseRepository) {
  // Check if primary organization exists
  let org = await repo.getOrganizationBySlug('default');
  if (!org) {
    console.log('[SkyOps DB] Bootstrapping primary organization (Acme Cloud Eng)...');
    org = await repo.createOrganization('Acme Cloud Eng', 'default');
  }

  // Check if default admin user exists
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@skyops.io';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'SkyOpsAdmin123!';
  const existingAdmin = await repo.getUserByEmail(adminEmail);

  if (!existingAdmin) {
    console.log(`[SkyOps DB] Bootstrapping initial Admin user (${adminEmail})...`);
    const passwordHash = await hashPassword(adminPassword);
    await repo.createUser({
      email: adminEmail,
      name: 'SkyOps Administrator',
      password_hash: passwordHash,
      role: 'ADMIN',
      organization_id: org.id,
    });
  }

  // Also create a default SRE engineer and Developer for test / evaluation
  const sreEmail = 'sre@skyops.io';
  if (!(await repo.getUserByEmail(sreEmail))) {
    const pwdHash = await hashPassword('SkyOpsSre123!');
    await repo.createUser({
      email: sreEmail,
      name: 'Alex Rivera (Staff SRE)',
      password_hash: pwdHash,
      role: 'SRE',
      organization_id: org.id,
    });
  }

  const devEmail = 'dev@skyops.io';
  if (!(await repo.getUserByEmail(devEmail))) {
    const pwdHash = await hashPassword('SkyOpsDev123!');
    await repo.createUser({
      email: devEmail,
      name: 'Jordan Lee (Dev Lead)',
      password_hash: pwdHash,
      role: 'DEVELOPER',
      organization_id: org.id,
    });
  }

  // Check if default license exists
  let license = await repo.getLicenseByOrg(org.id);
  if (!license) {
    const now = new Date();
    const expiry = new Date();
    expiry.setFullYear(now.getFullYear() + 1);

    await repo.saveLicense({
      id: `lic-${org.id}-community`,
      organization_id: org.id,
      plan: 'COMMUNITY',
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
    });
  }
}
