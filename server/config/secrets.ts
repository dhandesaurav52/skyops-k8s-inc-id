import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SecretStatus {
  jwtSecretSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
  jwtSecretConfigured: boolean;
  licenseSecretSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
  licenseSecretConfigured: boolean;
  encryptionKeySource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
  encryptionKeyConfigured: boolean;
  sessionSecretSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
  sessionSecretConfigured: boolean;
  databasePasswordSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL';
  databasePasswordConfigured: boolean;
  secretsFilePath: string;
  isSecretsFilePersisted: boolean;
}

interface PersistedSecrets {
  jwtSecret?: string;
  licenseSigningSecret?: string;
  internalEncryptionKey?: string;
  sessionSecret?: string;
  databasePassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class SecretManager {
  private secretsDir: string;
  private secretsFilePath: string;
  private cachedSecrets: PersistedSecrets = {};
  private jwtSecret: string = '';
  private licenseSigningSecret: string = '';
  private internalEncryptionKey: string = '';
  private sessionSecret: string = '';
  private databasePassword: string = '';

  private jwtSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL' = 'GENERATED_EPHEMERAL';
  private licenseSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL' = 'GENERATED_EPHEMERAL';
  private encryptionSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL' = 'GENERATED_EPHEMERAL';
  private sessionSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL' = 'GENERATED_EPHEMERAL';
  private databasePasswordSource: 'ENVIRONMENT' | 'PERSISTED' | 'GENERATED_EPHEMERAL' = 'GENERATED_EPHEMERAL';

  constructor(customDataDir?: string) {
    // Determine data directory (support SKYOPS_DATA_DIR, DATA_DIR, or local .data)
    const dir = customDataDir || process.env.SKYOPS_DATA_DIR || process.env.DATA_DIR;
    this.secretsDir = dir ? path.resolve(dir) : path.join(process.cwd(), '.data');
    this.secretsFilePath = path.join(this.secretsDir, 'secrets.json');

    this.initializeSecrets();
  }

  public generateSecureSecret(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  private loadPersistedSecrets(): PersistedSecrets {
    try {
      if (fs.existsSync(this.secretsFilePath)) {
        const content = fs.readFileSync(this.secretsFilePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (err: any) {
      console.warn(`[SkyOps Secrets] Notice: Could not read existing secrets file at ${this.secretsFilePath}: ${err.message}`);
    }
    return {};
  }

  private savePersistedSecrets(secrets: PersistedSecrets): boolean {
    try {
      if (!fs.existsSync(this.secretsDir)) {
        fs.mkdirSync(this.secretsDir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(
        this.secretsFilePath,
        JSON.stringify({ ...secrets, updatedAt: new Date().toISOString() }, null, 2),
        { encoding: 'utf8', mode: 0o600 }
      );
      return true;
    } catch (err: any) {
      console.warn(`[SkyOps Secrets] Warning: Failed to persist secrets to ${this.secretsFilePath}: ${err.message}`);
      return false;
    }
  }

  public initializeSecrets() {
    this.cachedSecrets = this.loadPersistedSecrets();
    let hasNewPersistedSecrets = false;

    // 1. JWT Secret Resolution (Env -> Persisted -> Generate & Persist)
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
      this.jwtSecret = process.env.JWT_SECRET.trim();
      this.jwtSource = 'ENVIRONMENT';
    } else if (this.cachedSecrets.jwtSecret) {
      this.jwtSecret = this.cachedSecrets.jwtSecret;
      this.jwtSource = 'PERSISTED';
    } else {
      this.jwtSecret = this.generateSecureSecret(32);
      this.cachedSecrets.jwtSecret = this.jwtSecret;
      this.cachedSecrets.createdAt = this.cachedSecrets.createdAt || new Date().toISOString();
      hasNewPersistedSecrets = true;
      this.jwtSource = 'PERSISTED';
    }

    // 2. License Signing Secret Resolution (Env -> Persisted -> Generate & Persist)
    if (process.env.LICENSE_SIGNING_SECRET && process.env.LICENSE_SIGNING_SECRET.trim().length > 0) {
      this.licenseSigningSecret = process.env.LICENSE_SIGNING_SECRET.trim();
      this.licenseSource = 'ENVIRONMENT';
    } else if (this.cachedSecrets.licenseSigningSecret) {
      this.licenseSigningSecret = this.cachedSecrets.licenseSigningSecret;
      this.licenseSource = 'PERSISTED';
    } else {
      this.licenseSigningSecret = this.generateSecureSecret(32);
      this.cachedSecrets.licenseSigningSecret = this.licenseSigningSecret;
      hasNewPersistedSecrets = true;
      this.licenseSource = 'PERSISTED';
    }

    // 3. Internal Encryption Key Resolution (Env -> Persisted -> Generate & Persist)
    if (process.env.INTERNAL_ENCRYPTION_KEY && process.env.INTERNAL_ENCRYPTION_KEY.trim().length > 0) {
      this.internalEncryptionKey = process.env.INTERNAL_ENCRYPTION_KEY.trim();
      this.encryptionSource = 'ENVIRONMENT';
    } else if (this.cachedSecrets.internalEncryptionKey) {
      this.internalEncryptionKey = this.cachedSecrets.internalEncryptionKey;
      this.encryptionSource = 'PERSISTED';
    } else {
      this.internalEncryptionKey = this.generateSecureSecret(32);
      this.cachedSecrets.internalEncryptionKey = this.internalEncryptionKey;
      hasNewPersistedSecrets = true;
      this.encryptionSource = 'PERSISTED';
    }

    // 4. Session Secret Resolution
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length > 0) {
      this.sessionSecret = process.env.SESSION_SECRET.trim();
      this.sessionSource = 'ENVIRONMENT';
    } else if (this.cachedSecrets.sessionSecret) {
      this.sessionSecret = this.cachedSecrets.sessionSecret;
      this.sessionSource = 'PERSISTED';
    } else {
      this.sessionSecret = this.generateSecureSecret(32);
      this.cachedSecrets.sessionSecret = this.sessionSecret;
      hasNewPersistedSecrets = true;
      this.sessionSource = 'PERSISTED';
    }

    // 5. Database Password for Bundled PostgreSQL
    if (process.env.DATABASE_PASSWORD && process.env.DATABASE_PASSWORD.trim().length > 0) {
      this.databasePassword = process.env.DATABASE_PASSWORD.trim();
      this.databasePasswordSource = 'ENVIRONMENT';
    } else if (this.cachedSecrets.databasePassword) {
      this.databasePassword = this.cachedSecrets.databasePassword;
      this.databasePasswordSource = 'PERSISTED';
    } else {
      this.databasePassword = this.generateSecureSecret(24);
      this.cachedSecrets.databasePassword = this.databasePassword;
      hasNewPersistedSecrets = true;
      this.databasePasswordSource = 'PERSISTED';
    }

    if (hasNewPersistedSecrets) {
      const persisted = this.savePersistedSecrets(this.cachedSecrets);
      if (persisted) {
        console.log(`[SkyOps Secrets] Automatically generated & persisted cryptographic secrets to ${this.secretsFilePath}`);
      } else {
        console.log('[SkyOps Secrets] Running with in-memory cryptographically generated secrets.');
      }
    }
  }

  public getJwtSecret(): string {
    return this.jwtSecret;
  }

  public getLicenseSigningSecret(): string {
    return this.licenseSigningSecret;
  }

  public getInternalEncryptionKey(): string {
    return this.internalEncryptionKey;
  }

  public getSessionSecret(): string {
    return this.sessionSecret;
  }

  public getDatabasePassword(): string {
    return this.databasePassword;
  }

  public getStatus(): SecretStatus {
    return {
      jwtSecretSource: this.jwtSource,
      jwtSecretConfigured: !!this.jwtSecret,
      licenseSecretSource: this.licenseSource,
      licenseSecretConfigured: !!this.licenseSigningSecret,
      encryptionKeySource: this.encryptionSource,
      encryptionKeyConfigured: !!this.internalEncryptionKey,
      sessionSecretSource: this.sessionSource,
      sessionSecretConfigured: !!this.sessionSecret,
      databasePasswordSource: this.databasePasswordSource,
      databasePasswordConfigured: !!this.databasePassword,
      secretsFilePath: this.secretsFilePath,
      isSecretsFilePersisted: fs.existsSync(this.secretsFilePath),
    };
  }
}

export const secretManager = new SecretManager();
