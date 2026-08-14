import { DatabaseRepository } from './repository';
import { PostgresRepository } from './postgres';
import { MemoryRepository } from './memory';

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
        return repoInstance;
      }
      console.warn('[SkyOps DB] PostgreSQL healthcheck failed, falling back to embedded repository:', health.details);
    } catch (err: any) {
      console.warn('[SkyOps DB] Failed to initialize PostgreSQL repository:', err.message);
      console.log('[SkyOps DB] Falling back to high-performance embedded repository.');
    }
  } else {
    console.log('[SkyOps DB] Running with high-performance embedded repository.');
  }

  const memRepo = new MemoryRepository();
  await memRepo.init();
  repoInstance = memRepo;
  return repoInstance;
}

/**
 * Reset repo instance for testing
 */
export function resetRepositoryInstance(): void {
  repoInstance = null;
}
